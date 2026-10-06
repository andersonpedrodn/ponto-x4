import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { DIAS_SEMANA } from '../../core/models';
import { PontoService } from '../../core/ponto.service';
import { hhmm, pad } from '../../core/time.utils';

const EMPREGADOR = {
  nome: 'X4 Serviços de Apoio Administrativo LTDA',
  endereco: 'Rua Jorge Tavares da Silva, 45 A, Pajuçara, Natal/RN',
  atividade: 'Terceirização de Mão de Obra',
  cnpj: '27.571.784/0001-64',
};
const EMPREGADO = { nome: 'Anderson Pedro do Nascimento', cargo: 'Web Design' };

interface LinhaFolha {
  dia: string;
  /** 'AAAA-MM-DD', ou '' para dias que não existem no mês. */
  chave: string;
  /** Texto que ocupa a coluna Entrada quando não há batidas (Sábado, Domingo, Feriado). */
  rotulo: string;
  entrada: string;
  inicio: string;
  fim: string;
  saida: string;
}

const hhmmParaTs = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).getTime();
};

const hora = (ts?: number) => (ts == null ? '—' : hhmm(ts).replace(':', 'h'));

@Component({
  selector: 'app-folha',
  templateUrl: './folha.html',
})
export class Folha {
  private readonly ponto = inject(PontoService);
  private readonly param = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map(p => p.get('mes'))),
    { initialValue: null },
  );

  private readonly paramEmpresa = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map(p => p.get('empresa') === '1')),
    { initialValue: false },
  );
  private readonly empresaEscolhida = signal<boolean | null>(null);
  /** Versão para empresa: igual à completa, mas com a folha aberta para ajustes antes de imprimir. */
  protected readonly empresa = computed(() => this.empresaEscolhida() ?? this.paramEmpresa());

  protected alternarVersao() {
    this.editando.set(null);
    this.editandoJust.set(null);
    this.empresaEscolhida.set(!this.empresa());
  }

  protected readonly empregador = EMPREGADOR;
  protected readonly empregado = EMPREGADO;

  /** Primeiro dia do mês exibido (padrão: mês passado, ou o do parâmetro ?mes=AAAA-MM). */
  private readonly escolhido = signal<Date | null>(null);
  protected readonly mes = computed(() => {
    const e = this.escolhido();
    if (e) return e;
    const m = /^(\d{4})-(\d{2})$/.exec(this.param() ?? '');
    if (m) return new Date(+m[1], +m[2] - 1, 1);
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth() - 1, 1);
  });

  protected readonly competencia = computed(() => `${pad(this.mes().getMonth() + 1)} / ${this.mes().getFullYear()}`);
  protected readonly rotuloMes = computed(() =>
    this.mes().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  );

  /** Sempre 31 linhas, como no formulário em papel; dias que não existem no mês ficam em branco. */
  protected readonly linhas = computed<LinhaFolha[]>(() => {
    const db = this.ponto.db();
    const ano = this.mes().getFullYear();
    const m = this.mes().getMonth();
    const diasNoMes = new Date(ano, m + 1, 0).getDate();
    const linhas: LinhaFolha[] = [];

    for (let d = 1; d <= 31; d++) {
      const dia = pad(d);
      const vazia: LinhaFolha = { dia, chave: '', rotulo: '—', entrada: '—', inicio: '—', fim: '—', saida: '—' };
      if (d > diasNoMes) { linhas.push(vazia); continue; }

      const chave = `${ano}-${pad(m + 1)}-${dia}`;
      vazia.chave = chave;
      const b = db.dias[chave] ?? [];
      const dow = new Date(ano, m, d).getDay();

      if (b.length) {
        // 2 batidas = entrada e saída sem intervalo; 4 = jornada com intervalo
        const [e, i, f, s] = b.length === 2 ? [b[0], undefined, undefined, b[1]] : b;
        linhas.push({ dia, chave, rotulo: '', entrada: hora(e), inicio: hora(i), fim: hora(f), saida: hora(s) });
      } else if (db.feriados.includes(chave)) {
        linhas.push({ ...vazia, rotulo: 'Feriado' });
      } else if (db.jornada[dow] === 0) {
        linhas.push({ ...vazia, rotulo: DIAS_SEMANA[dow] });
      } else {
        linhas.push(vazia);
      }
    }
    return linhas;
  });

  /** Saídas ajustadas só para a impressão (não alteram os dados salvos). Chave 'AAAA-MM-DD' -> 'HH:MM'. */
  protected readonly saidasEditadas = signal<Record<string, string>>({});
  protected readonly editando = signal<string | null>(null);

  protected saidaExibida(l: LinhaFolha): string {
    const editada = this.saidasEditadas()[l.chave];
    if (editada) return hora(hhmmParaTs(editada));
    return l.saida;
  }

  /** Justificativas digitadas só para a impressão. Chave 'AAAA-MM-DD' -> texto. */
  protected readonly justificativas = signal<Record<string, string>>({});
  protected readonly editandoJust = signal<string | null>(null);

  protected editarJust(l: LinhaFolha, ev: Event) {
    if (!this.empresa()) return;
    if (l.chave) this.editandoJust.set(l.chave);
    this.focarCampo(ev);
  }

  /** O atributo autofocus não vale para elementos inseridos depois do carregamento; foca o input após renderizar. */
  private focarCampo(ev: Event) {
    const td = ev.currentTarget as HTMLElement;
    setTimeout(() => td.querySelector('input')?.focus());
  }

  protected confirmarJust(l: LinhaFolha, valor: string) {
    const v = valor.trim();
    this.justificativas.update(o => {
      const { [l.chave]: _, ...resto } = o;
      return v ? { ...resto, [l.chave]: v } : resto;
    });
    this.editandoJust.set(null);
  }

  protected valorEdicao(l: LinhaFolha): string {
    return this.saidasEditadas()[l.chave] ?? '';
  }

  protected editarSaida(l: LinhaFolha, ev: Event) {
    if (!this.empresa()) return;
    if (l.chave) this.editando.set(l.chave);
    this.focarCampo(ev);
  }

  protected confirmarSaida(l: LinhaFolha, valor: string) {
    this.saidasEditadas.update(o => {
      const { [l.chave]: _, ...resto } = o;
      return valor ? { ...resto, [l.chave]: valor } : resto;
    });
    this.editando.set(null);
  }

  protected mudarMes(delta: number) {
    const m = this.mes();
    this.escolhido.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  protected imprimir() {
    window.print();
  }
}
