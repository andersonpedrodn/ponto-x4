import { Component, computed, inject, signal } from '@angular/core';
import { PontoService } from '../../core/ponto.service';
import { Atividade } from '../../core/models';
import { chaveDia, pad } from '../../core/time.utils';

const COLABORADOR = { nome: 'Anderson Pedro do Nascimento', funcao: 'Web Design' };
const CONTRATO = 'CONTRATO Nº 38/2026';

@Component({
  selector: 'app-relatorio',
  templateUrl: './relatorio.html',
})
export class Relatorio {
  private readonly ponto = inject(PontoService);

  protected readonly colaborador = COLABORADOR;
  protected readonly contrato = CONTRATO;

  /** Primeiro dia do mês exibido (padrão: mês atual, pois as atividades são cadastradas durante o mês). */
  private readonly escolhido = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly mes = this.escolhido.asReadonly();

  protected readonly prefixo = computed(() => `${this.mes().getFullYear()}-${pad(this.mes().getMonth() + 1)}`);
  protected readonly nomeMes = computed(() => {
    const n = this.mes().toLocaleDateString('pt-BR', { month: 'long' });
    return n.charAt(0).toUpperCase() + n.slice(1);
  });
  protected readonly ano = computed(() => this.mes().getFullYear());
  protected readonly rotuloMes = computed(() => `${this.nomeMes()} de ${this.ano()}`);

  protected readonly atividades = computed(() =>
    this.ponto.atividades().filter(a => a.data.startsWith(this.prefixo())));

  /** Linha de data no rodapé: último dia do mês exibido. */
  protected readonly dataRodape = computed(() => {
    const m = this.mes();
    const dia = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    return `Natal/RN, ${dia} de ${this.nomeMes().toLowerCase()} de ${this.ano()}.`;
  });

  protected readonly novaData = signal(chaveDia(new Date()));
  protected readonly novoTexto = signal('');
  protected readonly editandoId = signal<string | null>(null);

  protected mudarMes(delta: number) {
    const m = this.mes();
    this.escolhido.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
    // a data do novo cadastro acompanha o mês exibido
    const hoje = new Date();
    const dia = this.prefixo() === chaveDia(hoje).slice(0, 7) ? pad(hoje.getDate()) : '01';
    this.novaData.set(`${this.prefixo()}-${dia}`);
  }

  protected adicionar() {
    const texto = this.novoTexto().trim();
    if (!texto || !this.novaData()) return;
    this.ponto.addAtividade(this.novaData(), texto);
    this.novoTexto.set('');
  }

  protected salvar(a: Atividade, valor: string) {
    const texto = valor.trim();
    if (texto && texto !== a.texto) this.ponto.setAtividade(a.id, texto);
    this.editandoId.set(null);
  }

  protected remover(a: Atividade) {
    if (confirm('Remover esta atividade?')) this.ponto.removerAtividade(a.id);
  }

  protected dataCurta(chave: string) {
    const [, m, d] = chave.split('-');
    return `${d}/${m}`;
  }

  protected valorDe(ev: Event) {
    return (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected imprimir() {
    window.print();
  }
}
