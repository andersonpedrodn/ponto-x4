import { Routes } from '@angular/router';
import { Hoje } from './pages/hoje/hoje';
import { Historico } from './pages/historico/historico';
import { Ajustes } from './pages/ajustes/ajustes';
import { Relatorio } from './pages/relatorio/relatorio';
import { Folha } from './pages/folha/folha';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'hoje' },
  { path: 'hoje', component: Hoje, title: 'Hoje — X4 Ponto' },
  { path: 'historico', component: Historico, title: 'Histórico — X4 Ponto' },
  { path: 'folha', component: Folha, title: 'Folha de ponto — X4 Ponto' },
  { path: 'ajustes', component: Ajustes, title: 'Ajustes — X4 Ponto' },
  { path: 'relatorio', component: Relatorio, title: 'Relatório — X4 Ponto' },
  { path: '**', redirectTo: 'hoje' },
];
