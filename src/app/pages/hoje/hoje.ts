import { Component, computed, inject } from '@angular/core';
import { PontoService } from '../../core/ponto.service';
import { chaveDia, classeSaldo, fmtMin, hhmm, hhmmss, trabalhado } from '../../core/time.utils';

@Component({
  selector: 'app-hoje',
  templateUrl: './hoje.html',
})
export class Hoje {
  private readonly ponto = inject(PontoService);

  protected readonly fmtMin = fmtMin;
  protected readonly hhmmss = hhmmss;

  protected readonly agora = this.ponto.agora;
  protected readonly dataExtenso = computed(() =>
    new Date(this.agora()).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
  );

  protected readonly batidas = computed(() => this.ponto.db().dias[chaveDia(new Date(this.agora()))] ?? []);
  protected readonly aberto = computed(() => this.batidas().length % 2 === 1);
  protected readonly trabalhadoMin = computed(() => trabalhado(this.batidas(), this.agora()));
  protected readonly jornadaMin = computed(
    () => this.ponto.db().jornada[new Date(this.agora()).getDay()],
  );
  protected readonly saldo = computed(() => this.trabalhadoMin() - this.jornadaMin());
  protected readonly classeSaldo = computed(() => classeSaldo(this.saldo()));

  protected readonly previsaoSaida = computed(() =>
    this.aberto() && this.saldo() < 0 ? hhmm(this.agora() + Math.abs(this.saldo()) * 60000) : '--:--',
  );

  protected readonly rotuloBotao = computed(() =>
    this.aberto() ? 'Registrar saída' : this.batidas().length ? 'Registrar nova entrada' : 'Registrar entrada',
  );

  protected readonly status = computed(() => {
    const b = this.batidas();
    if (this.aberto()) return 'Em expediente desde ' + hhmm(b[b.length - 1]);
    return b.length ? 'Fora do expediente' : 'Nenhum registro hoje';
  });

  protected bater() {
    this.ponto.bater();
  }
}
