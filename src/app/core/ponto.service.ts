import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  Unsubscribe, addDoc, arrayUnion, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { firestore } from './firebase';
import { Atividade, DB_PADRAO, PontoDb } from './models';
import { chaveDia, trabalhado } from './time.utils';

/** Chave antiga do localStorage (versão sem login). */
const KEY_LOCAL = 'ponto-x4-v1';
const KEY_BACKUP = KEY_LOCAL + '-bk';

type Batch = ReturnType<typeof writeBatch>;

/**
 * Estrutura no Firestore:
 *   users/{uid}                   -> { jornada: number[] }
 *   users/{uid}/dias/{AAAA-MM-DD} -> { batidas: number[], feriado?: boolean, folga?: number }
 *   users/{uid}/atividades/{id}   -> { data: 'AAAA-MM-DD', texto: string, criado: number }
 */
@Injectable({ providedIn: 'root' })
export class PontoService {
  private readonly auth = inject(AuthService);

  readonly db = signal<PontoDb>(structuredClone(DB_PADRAO));
  /** Atividades do relatório mensal, ordenadas por data. */
  readonly atividades = signal<Atividade[]>([]);
  /** false enquanto os dados da conta ainda não chegaram. */
  readonly carregado = signal(false);
  /** Relógio global atualizado a cada segundo. */
  readonly agora = signal(Date.now());
  readonly ultimoBackup = signal<number | null>(this.lerUltimoBackup());
  /** Dados da versão antiga (localStorage) que ainda não foram enviados para a nuvem. */
  readonly dadosLocais = signal<PontoDb | null>(this.lerLocal());

  /** Mensagem quando o Firestore recusa ler ou gravar (ex.: API desativada, regras). */
  readonly erroNuvem = signal('');

  private unsubs: Unsubscribe[] = [];

  constructor() {
    setInterval(() => this.agora.set(Date.now()), 1000);

    effect(() => {
      const uid = this.auth.user()?.uid;
      this.desinscrever();
      this.carregado.set(false);
      this.db.set(structuredClone(DB_PADRAO));
      this.atividades.set([]);
      if (uid) this.escutar(uid);
    });
  }

  bater() {
    const k = chaveDia(new Date());
    // arrayUnion evita perder batidas se dois aparelhos gravarem ao mesmo tempo
    return this.vigiar(setDoc(this.refDia(k), { batidas: arrayUnion(Date.now()) }, { merge: true }));
  }

  setDia(chave: string, batidas: number[], feriado = false) {
    return this.gravarDia(chave, batidas, feriado, this.db().folgas[chave] ?? 0);
  }

  /** Define (ou, com 0, remove) a folga tirada do banco de horas num dia. */
  setFolga(chave: string, minutos: number) {
    const { dias, feriados } = this.db();
    return this.gravarDia(chave, dias[chave] ?? [], feriados.includes(chave), minutos);
  }

  /** Jornada contratada do dia em minutos (feriado = 0). */
  jornadaDoDia(chave: string): number {
    const { jornada, feriados } = this.db();
    if (feriados.includes(chave)) return 0;
    const [y, m, d] = chave.split('-').map(Number);
    return jornada[new Date(y, m - 1, d).getDay()];
  }

  /**
   * Banco de horas = extras acumuladas - folgas tiradas.
   * Só dias com batidas entram nas extras (dia útil sem registro não conta como falta aqui;
   * para descontar, registre uma folga). O dia de hoje só entra depois da última saída.
   */
  readonly banco = computed(() => {
    const { dias, folgas } = this.db();
    const hoje = chaveDia(new Date(this.agora()));
    let acumulado = 0;
    for (const [k, b] of Object.entries(dias)) {
      if (k === hoje && b.length % 2) continue;
      acumulado += trabalhado(b, null) - this.jornadaDoDia(k) + (folgas[k] ?? 0);
    }
    const tiradas = Object.values(folgas).reduce((s, m) => s + m, 0);
    return { acumulado, tiradas, saldo: acumulado - tiradas };
  });

  addAtividade(data: string, texto: string) {
    return this.vigiar(addDoc(this.colAtividades(), { data, texto, criado: Date.now() }));
  }

  setAtividade(id: string, texto: string) {
    return this.vigiar(updateDoc(doc(this.colAtividades(), id), { texto }));
  }

  removerAtividade(id: string) {
    return this.vigiar(deleteDoc(doc(this.colAtividades(), id)));
  }

  setJornada(jornada: number[]) {
    return this.vigiar(setDoc(this.refUsuario(), { jornada }, { merge: true }));
  }

  exportar(): string {
    return JSON.stringify(this.db(), null, 1);
  }

  registrarBackupBaixado() {
    const agora = Date.now();
    this.ultimoBackup.set(agora);
    try { localStorage.setItem(KEY_BACKUP, String(agora)); } catch { /* ignora */ }
  }

  /** Substitui os dados da conta pelo conteúdo do backup. Retorna false se for inválido. */
  async importar(texto: string): Promise<boolean> {
    try {
      const d = JSON.parse(texto);
      if (!d?.dias || !Array.isArray(d.jornada)) return false;
      const feriados = Array.isArray(d.feriados) ? d.feriados : [];
      const folgas = d.folgas && typeof d.folgas === 'object' ? d.folgas : {};
      await this.substituirTudo({ jornada: d.jornada, dias: d.dias, feriados, folgas });
      return true;
    } catch {
      return false;
    }
  }

  /** Envia os dados da versão antiga (sem login) para a conta, somando aos que já existem. */
  async enviarLocaisParaNuvem() {
    const local = this.dadosLocais();
    if (!local) return;
    const atuais = this.db().dias;
    const dias: Record<string, number[]> = { ...atuais };
    for (const [k, b] of Object.entries(local.dias)) {
      dias[k] = [...new Set([...(atuais[k] ?? []), ...b])].sort((x, y) => x - y);
    }
    await this.substituirTudo({ jornada: local.jornada, dias, feriados: this.db().feriados, folgas: this.db().folgas });
    try { localStorage.removeItem(KEY_LOCAL); } catch { /* ignora */ }
    this.dadosLocais.set(null);
  }

  private async substituirTudo(novo: PontoDb) {
    const feriados = new Set(novo.feriados);
    const chaves = new Set([...Object.keys(novo.dias), ...feriados, ...Object.keys(novo.folgas)]);
    const atuais = this.chavesGravadas();
    const ops: ((b: Batch) => void)[] = [
      b => b.set(this.refUsuario(), { jornada: novo.jornada }, { merge: true }),
      ...[...atuais].filter(k => !chaves.has(k)).map(k => (b: Batch) => b.delete(this.refDia(k))),
      ...[...chaves].map(k => (b: Batch) => b.set(this.refDia(k),
        this.docDia(novo.dias[k] ?? [], feriados.has(k), novo.folgas[k] ?? 0))),
    ];
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(firestore);
      ops.slice(i, i + 400).forEach(op => op(batch));
      await batch.commit();
    }
  }

  private gravarDia(chave: string, batidas: number[], feriado: boolean, folga: number) {
    return this.vigiar(batidas.length || feriado || folga > 0
      ? setDoc(this.refDia(chave), this.docDia(batidas, feriado, folga))
      : deleteDoc(this.refDia(chave)));
  }

  private docDia(batidas: number[], feriado: boolean, folga: number) {
    return { batidas, ...(feriado && { feriado }), ...(folga > 0 && { folga }) };
  }

  private chavesGravadas() {
    const { dias, feriados, folgas } = this.db();
    return new Set([...Object.keys(dias), ...feriados, ...Object.keys(folgas)]);
  }

  private escutar(uid: string) {
    let jornada = DB_PADRAO.jornada;
    let dias: Record<string, number[]> = {};
    let feriados: string[] = [];
    let folgas: Record<string, number> = {};
    let recebeuJornada = false;
    let recebeuDias = false;

    const publicar = () => {
      this.db.set({ jornada, dias, feriados, folgas });
      if (recebeuJornada && recebeuDias) this.carregado.set(true);
    };

    this.unsubs.push(
      onSnapshot(doc(firestore, 'users', uid), snap => {
        this.erroNuvem.set('');
        const j = snap.data()?.['jornada'];
        jornada = Array.isArray(j) && j.length === 7 ? j : DB_PADRAO.jornada;
        recebeuJornada = true;
        publicar();
      }, e => this.falhou(e)),
      onSnapshot(collection(firestore, 'users', uid, 'dias'), snap => {
        dias = {};
        feriados = [];
        folgas = {};
        snap.forEach(d => {
          const b: number[] = d.data()['batidas'] ?? [];
          if (b.length) dias[d.id] = [...b].sort((x, y) => x - y);
          if (d.data()['feriado'] === true) feriados.push(d.id);
          const f = d.data()['folga'];
          if (typeof f === 'number' && f > 0) folgas[d.id] = f;
        });
        recebeuDias = true;
        publicar();
      }, e => this.falhou(e)),
      onSnapshot(collection(firestore, 'users', uid, 'atividades'), snap => {
        this.atividades.set(snap.docs
          .map(d => ({ id: d.id, data: d.data()['data'] ?? '', texto: d.data()['texto'] ?? '', criado: d.data()['criado'] ?? 0 }) as Atividade)
          .sort((a, b) => a.data.localeCompare(b.data) || a.criado - b.criado));
      }, e => this.falhou(e)),
    );
  }

  /** Registra falha de gravação (o setDoc só rejeita quando o servidor recusa). */
  private vigiar<T>(p: Promise<T>): Promise<T> {
    p.catch(e => this.falhou(e));
    return p;
  }

  private falhou(e: unknown) {
    const code = (e as { code?: string }).code ?? 'erro desconhecido';
    console.error('Firestore:', e);
    this.erroNuvem.set(`Não foi possível sincronizar com a nuvem (${code}). Seus dados podem não estar salvos.`);
  }

  private desinscrever() {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  private refUsuario() {
    return doc(firestore, 'users', this.uid());
  }

  private colAtividades() {
    return collection(firestore, 'users', this.uid(), 'atividades');
  }

  private refDia(chave: string) {
    return doc(firestore, 'users', this.uid(), 'dias', chave);
  }

  private uid(): string {
    const uid = this.auth.user()?.uid;
    if (!uid) throw new Error('Usuário não autenticado');
    return uid;
  }

  private lerLocal(): PontoDb | null {
    try {
      const d = JSON.parse(localStorage.getItem(KEY_LOCAL) ?? 'null');
      if (d?.dias && Array.isArray(d?.jornada) && Object.keys(d.dias).length) return d;
    } catch { /* sem dados locais */ }
    return null;
  }

  private lerUltimoBackup(): number | null {
    try {
      const v = localStorage.getItem(KEY_BACKUP);
      return v ? +v : null;
    } catch {
      return null;
    }
  }
}
