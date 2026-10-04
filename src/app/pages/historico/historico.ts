import { Component, computed, inject, signal } from '@angular/core';
import { DIAS_CURTOS } from '../../core/models';
import { PontoService } from '../../core/ponto.service';
import { chaveDia, classeSaldo, fmtMin, fmtSaldo, hhmm, pad, trabalhado } from '../../core/time.utils';

interface LinhaDia {
  chave: string;
  dia: string;
  diaSemana: string;
  registros: string;
  temRegistro: boolean;
  total: number;
  saldo: number;
}

@Component({
  selector: 'app-historico',
  templateUrl: './historico.html',
})
export class Historico {
  private readonly ponto = inject(PontoService);

  protected readonly fmtMin = fmtMin;
  protected readonly fmtSaldo = fmtSaldo;
  protected readonly classeSaldo = classeSaldo;

  /** Primeiro dia do mês exibido. */
  protected readonly mes = signal(this.inicioDoMes(new Date()));
  protected readonly rotuloMes = computed(() =>
    this.mes().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  );

  protected readonly linhas = computed<LinhaDia[]>(() => {
    const db = this.ponto.db();
    const ano = this.mes().getFullYear();
    const m = this.mes().getMonth();
    const diasNoMes = new Date(ano, m + 1, 0).getDate();
    const hojeChave = chaveDia(new Date());
    const linhas: LinhaDia[] = [];

    for (let d = 1; d <= diasNoMes; d++) {
      const chave = `${ano}-${pad(m + 1)}-${pad(d)}`;
      const batidas = db.dias[chave] ?? [];
      const dow = new Date(ano, m, d).getDay();
      const jornada = db.jornada[dow];
      // dias futuros e dias sem expediente e sem registro não aparecem
      if (!batidas.length && (chave > hojeChave || jornada === 0)) continue;

      const total = trabalhado(batidas, chave === hojeChave ? this.ponto.agora() : null);
      linhas.push({
        chave,
        dia: pad(d),
        diaSemana: DIAS_CURTOS[dow],
        registros: batidas.map(hhmm).join(' · '),
        temRegistro: batidas.length > 0,
        total,
        // dia útil já passado sem registro conta como falta (saldo negativo)
        saldo: batidas.length || chave < hojeChave ? total - jornada : 0,
      });
    }
    return linhas;
  });

  protected readonly totalMes = computed(() => this.linhas().reduce((s, l) => s + l.total, 0));
  protected readonly saldoMes = computed(() => this.linhas().reduce((s, l) => s + l.saldo, 0));

  // ----- edição de um dia -----
  protected readonly editando = signal<string | null>(null);
  protected readonly horarios = signal<string[]>([]);
  protected readonly tituloEdicao = computed(() => {
    const k = this.editando();
    if (!k) return '';
    const [y, mo, d] = k.split('-');
    return `Registros de ${d}/${mo}/${y}`;
  });

  protected mudarMes(delta: number) {
    const m = this.mes();
    this.mes.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
    this.fechar();
  }

  protected abrir(chave: string) {
    this.editando.set(chave);
    this.horarios.set((this.ponto.db().dias[chave] ?? []).map(hhmm));
  }

  protected fechar() {
    this.editando.set(null);
  }

  protected adicionar() {
    this.horarios.update(h => [...h, '']);
  }

  protected remover(i: number) {
    this.horarios.update(h => h.filter((_, idx) => idx !== i));
  }

  protected alterar(i: number, valor: string) {
    this.horarios.update(h => h.map((v, idx) => (idx === i ? valor : v)));
  }

  protected salvar() {
    const chave = this.editando();
    if (!chave) return;
    const [y, mo, d] = chave.split('-').map(Number);
    const batidas = this.horarios()
      .filter(Boolean)
      .map(v => {
        const [h, mi] = v.split(':').map(Number);
        return new Date(y, mo - 1, d, h, mi, 0).getTime();
      })
      .sort((a, b) => a - b);
    this.ponto.setDia(chave, batidas);
    this.fechar();
  }

  private inicioDoMes(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
}
