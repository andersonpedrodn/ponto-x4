import { Component, computed, inject, signal } from '@angular/core';
import { DIAS_SEMANA } from '../../core/models';
import { PontoService } from '../../core/ponto.service';
import { chaveDia, hhmmParaMin, minParaHHMM } from '../../core/time.utils';

@Component({
  selector: 'app-ajustes',
  templateUrl: './ajustes.html',
})
export class Ajustes {
  private readonly ponto = inject(PontoService);

  /** Segunda a domingo, na ordem de exibição (índice = getDay()). */
  protected readonly ordem = [1, 2, 3, 4, 5, 6, 0];
  protected readonly nomes = DIAS_SEMANA;
  protected readonly jornadas = signal(this.ponto.db().jornada.map(minParaHHMM));
  protected readonly salvo = signal(false);

  protected readonly protegido = this.ponto.armazenamentoProtegido;
  protected readonly ultimoBackup = computed(() => {
    const t = this.ponto.ultimoBackup();
    return t ? 'Último backup baixado: ' + new Date(t).toLocaleString('pt-BR') : 'Nenhum backup baixado ainda.';
  });
  protected readonly mensagem = signal('');

  protected alterar(dia: number, valor: string) {
    this.jornadas.update(j => j.map((v, i) => (i === dia ? valor : v)));
  }

  protected salvarJornada() {
    this.ponto.setJornada(this.jornadas().map(hhmmParaMin));
    this.salvo.set(true);
    setTimeout(() => this.salvo.set(false), 1500);
  }

  protected baixarBackup() {
    const blob = new Blob([this.ponto.exportar()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ponto-x4-backup-${chaveDia(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.ponto.registrarBackupBaixado();
  }

  protected async importar(event: Event) {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    const ok = this.ponto.importar(await arquivo.text());
    if (ok) this.jornadas.set(this.ponto.db().jornada.map(minParaHHMM));
    this.mensagem.set(ok ? 'Backup importado (substituiu os dados atuais).' : 'Arquivo inválido.');
    input.value = '';
  }
}
