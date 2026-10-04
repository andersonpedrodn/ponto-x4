import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // hash evita 404 ao recarregar em hospedagem estática (ex.: GitHub Pages)
    provideRouter(routes, withHashLocation()),
  ],
};
