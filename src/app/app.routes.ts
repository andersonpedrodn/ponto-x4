import { Routes } from '@angular/router';
import { Hoje } from './pages/hoje/hoje';
import { Historico } from './pages/historico/historico';
import { Ajustes } from './pages/ajustes/ajustes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'hoje' },
  { path: 'hoje', component: Hoje, title: 'Hoje — X4 Ponto' },
  { path: 'historico', component: Historico, title: 'Histórico — X4 Ponto' },
  { path: 'ajustes', component: Ajustes, title: 'Ajustes — X4 Ponto' },
  { path: '**', redirectTo: 'hoje' },
];
