import { Injectable, signal } from '@angular/core';
import { DB_PADRAO, PontoDb } from './models';
import { chaveDia } from './time.utils';

const KEY = 'ponto-x4-v1';
const KEY_BACKUP = KEY + '-bk';

@Injectable({ providedIn: 'root' })
export class PontoService {
  readonly db = signal<PontoDb>(this.carregar());
  /** Relógio global atualizado a cada segundo. */
  readonly agora = signal(Date.now());
  readonly ultimoBackup = signal<number | null>(this.lerUltimoBackup());
  readonly armazenamentoProtegido = signal(false);

  constructor() {
    setInterval(() => this.agora.set(Date.now()), 1000);
    navigator.storage?.persist?.().then(ok => this.armazenamentoProtegido.set(ok));
  }

  bater() {
    const k = chaveDia(new Date());
    this.setDia(k, [...(this.db().dias[k] ?? []), Date.now()]);
  }

  setDia(chave: string, batidas: number[]) {
    const dias = { ...this.db().dias };
    if (batidas.length) dias[chave] = batidas;
    else delete dias[chave];
    this.atualizar({ ...this.db(), dias });
  }

  setJornada(jornada: number[]) {
    this.atualizar({ ...this.db(), jornada });
  }

  exportar(): string {
    return JSON.stringify(this.db(), null, 1);
  }

  registrarBackupBaixado() {
    const agora = Date.now();
    this.ultimoBackup.set(agora);
    try { localStorage.setItem(KEY_BACKUP, String(agora)); } catch { /* ignora */ }
  }

  /** Substitui os dados atuais. Retorna false se o conteúdo for inválido. */
  importar(texto: string): boolean {
    try {
      const d = JSON.parse(texto);
      if (!d?.dias || !Array.isArray(d.jornada)) return false;
      this.atualizar({ jornada: d.jornada, dias: d.dias });
      return true;
    } catch {
      return false;
    }
  }

  private atualizar(db: PontoDb) {
    this.db.set(db);
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignora */ }
  }

  private carregar(): PontoDb {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (d?.dias && d?.jornada) return d;
    } catch { /* usa padrão */ }
    return structuredClone(DB_PADRAO);
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
