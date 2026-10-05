export interface PontoDb {
  /** Jornada contratada em minutos, indexada por dia da semana (0 = domingo). */
  jornada: number[];
  /** Batidas (timestamps em ms) por dia, chave 'YYYY-MM-DD'. Alternam entrada/saída. */
  dias: Record<string, number[]>;
  /** Dias marcados como feriado ('YYYY-MM-DD'): a jornada do dia é zero. */
  feriados: string[];
}

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const DB_PADRAO: PontoDb = {
  jornada: [0, 480, 480, 480, 480, 480, 0],
  dias: {},
  feriados: [],
};
