import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { PontoService } from './core/ponto.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly ponto = inject(PontoService);

  protected readonly abas = [
    { rota: '/hoje', nome: 'Hoje' },
    { rota: '/historico', nome: 'Histórico' },
    { rota: '/ajustes', nome: 'Ajustes' },
  ];
}
