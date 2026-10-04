export const pad = (n: number) => String(n).padStart(2, '0');

export const chaveDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const hhmm = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const hhmmss = (ts: number) => `${hhmm(ts)}:${pad(new Date(ts).getSeconds())}`;

/** 125 -> "2h05" */
export const fmtMin = (m: number) => {
  const sinal = m < 0 ? '-' : '';
  const abs = Math.abs(Math.round(m));
  return `${sinal}${Math.floor(abs / 60)}h${pad(abs % 60)}`;
};

export const fmtSaldo = (m: number) => (m > 0 ? '+' : '') + fmtMin(m);

export const classeSaldo = (m: number) => (m > 0 ? 'text-ok' : m < 0 ? 'text-warn' : '');

/** Minutos -> "HH:MM" (para input type=time). */
export const minParaHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export const hhmmParaMin = (v: string) => {
  const [h, m] = (v || '00:00').split(':').map(Number);
  return h * 60 + m;
};

/** Minutos trabalhados: pares entrada/saída; se ímpar, o último segue aberto até `agora`. */
export function trabalhado(batidas: number[], agora: number | null): number {
  let ms = 0;
  for (let i = 0; i < batidas.length; i += 2) {
    const fim = i + 1 < batidas.length ? batidas[i + 1] : agora;
    if (fim != null) ms += Math.max(0, fim - batidas[i]);
  }
  return ms / 60000;
}
