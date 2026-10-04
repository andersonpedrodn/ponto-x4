import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
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
  /** Jornada vinda da conta (atualiza sozinha quando os dados chegam). */
  private readonly jornadaNuvem = computed(() => this.ponto.db().jornada.map(minParaHHMM));
  /** Edições ainda não salvas; enquanto vazio, mostra o valor da conta. */
  private readonly edicoes = signal<Record<number, string>>({});
  protected readonly jornadas = computed(() => this.jornadaNuvem().map((v, i) => this.edicoes()[i] ?? v));
  protected readonly salvo = signal(false);
  protected readonly temDadosLocais = computed(() => this.ponto.dadosLocais() !== null);

  protected readonly email = inject(AuthService).user;
  protected readonly ultimoBackup = computed(() => {
    const t = this.ponto.ultimoBackup();
    return t ? 'Último backup baixado: ' + new Date(t).toLocaleString('pt-BR') : 'Nenhum backup baixado ainda.';
  });
  protected readonly mensagem = signal('');

  protected alterar(dia: number, valor: string) {
    this.edicoes.update(e => ({ ...e, [dia]: valor }));
  }

  protected salvarJornada() {
    this.ponto.setJornada(this.jornadas().map(hhmmParaMin));
    this.edicoes.set({});
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
    const ok = await this.ponto.importar(await arquivo.text());
    this.mensagem.set(ok ? 'Backup importado (substituiu os dados atuais).' : 'Arquivo inválido.');
    input.value = '';
  }

  protected async enviarLocais() {
    await this.ponto.enviarLocaisParaNuvem();
    this.mensagem.set('Dados antigos enviados para a sua conta.');
  }
}
