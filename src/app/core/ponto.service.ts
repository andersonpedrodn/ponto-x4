import { Injectable, effect, inject, signal } from '@angular/core';
import {
  Unsubscribe, arrayUnion, collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { firestore } from './firebase';
import { DB_PADRAO, PontoDb } from './models';
import { chaveDia } from './time.utils';

/** Chave antiga do localStorage (versão sem login). */
const KEY_LOCAL = 'ponto-x4-v1';
const KEY_BACKUP = KEY_LOCAL + '-bk';

type Batch = ReturnType<typeof writeBatch>;

/**
 * Estrutura no Firestore:
 *   users/{uid}                   -> { jornada: number[] }
 *   users/{uid}/dias/{AAAA-MM-DD} -> { batidas: number[] }
 */
@Injectable({ providedIn: 'root' })
export class PontoService {
  private readonly auth = inject(AuthService);

  readonly db = signal<PontoDb>(structuredClone(DB_PADRAO));
  /** false enquanto os dados da conta ainda não chegaram. */
  readonly carregado = signal(false);
  /** Relógio global atualizado a cada segundo. */
  readonly agora = signal(Date.now());
  readonly ultimoBackup = signal<number | null>(this.lerUltimoBackup());
  /** Dados da versão antiga (localStorage) que ainda não foram enviados para a nuvem. */
  readonly dadosLocais = signal<PontoDb | null>(this.lerLocal());

  private unsubs: Unsubscribe[] = [];

  constructor() {
    setInterval(() => this.agora.set(Date.now()), 1000);

    effect(() => {
      const uid = this.auth.user()?.uid;
      this.desinscrever();
      this.carregado.set(false);
      this.db.set(structuredClone(DB_PADRAO));
      if (uid) this.escutar(uid);
    });
  }

  bater() {
    const k = chaveDia(new Date());
    // arrayUnion evita perder batidas se dois aparelhos gravarem ao mesmo tempo
    return setDoc(this.refDia(k), { batidas: arrayUnion(Date.now()) }, { merge: true });
  }

  setDia(chave: string, batidas: number[]) {
    return batidas.length
      ? setDoc(this.refDia(chave), { batidas })
      : deleteDoc(this.refDia(chave));
  }

  setJornada(jornada: number[]) {
    return setDoc(this.refUsuario(), { jornada }, { merge: true });
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
      await this.substituirTudo({ jornada: d.jornada, dias: d.dias });
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
    await this.substituirTudo({ jornada: local.jornada, dias });
    try { localStorage.removeItem(KEY_LOCAL); } catch { /* ignora */ }
    this.dadosLocais.set(null);
  }

  private async substituirTudo(novo: PontoDb) {
    const atuais = Object.keys(this.db().dias);
    const ops: ((b: Batch) => void)[] = [
      b => b.set(this.refUsuario(), { jornada: novo.jornada }, { merge: true }),
      ...atuais.filter(k => !(k in novo.dias)).map(k => (b: Batch) => b.delete(this.refDia(k))),
      ...Object.entries(novo.dias).map(([k, batidas]) => (b: Batch) => b.set(this.refDia(k), { batidas })),
    ];
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(firestore);
      ops.slice(i, i + 400).forEach(op => op(batch));
      await batch.commit();
    }
  }

  private escutar(uid: string) {
    let jornada = DB_PADRAO.jornada;
    let dias: Record<string, number[]> = {};
    let recebeuJornada = false;
    let recebeuDias = false;

    const publicar = () => {
      this.db.set({ jornada, dias });
      if (recebeuJornada && recebeuDias) this.carregado.set(true);
    };

    this.unsubs.push(
      onSnapshot(doc(firestore, 'users', uid), snap => {
        const j = snap.data()?.['jornada'];
        jornada = Array.isArray(j) && j.length === 7 ? j : DB_PADRAO.jornada;
        recebeuJornada = true;
        publicar();
      }),
      onSnapshot(collection(firestore, 'users', uid, 'dias'), snap => {
        dias = {};
        snap.forEach(d => {
          const b: number[] = d.data()['batidas'] ?? [];
          if (b.length) dias[d.id] = [...b].sort((x, y) => x - y);
        });
        recebeuDias = true;
        publicar();
      }),
    );
  }

  private desinscrever() {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  private refUsuario() {
    return doc(firestore, 'users', this.uid());
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
