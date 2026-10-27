# X4 — Controle de Ponto

Registro do horário real de entrada/saída e cálculo de horas extras. Angular + Tailwind CSS, dados no `localStorage`.

## Rodar
```
npm install
npm start        # http://localhost:4200
npm run build    # saída em dist/ponto-x4-app/browser
```

## PWA

O projeto também pode ser instalado como aplicativo e usa um service worker
no build de produção. Os dados continuam sendo armazenados no `localStorage`,
portanto ficam disponíveis offline apenas no dispositivo e navegador em que
foram registrados.

Para publicar:

```
npm run build
npx firebase deploy --only hosting
```

O service worker não é ativado pelo `ng serve`. Para testar a instalação e o
modo offline, use o endereço HTTPS publicado no Firebase e verifique o
manifesto e o service worker em **Application** no DevTools do navegador.

## Estrutura
- `src/app/core/` — modelos, utilitários de tempo e `PontoService` (estado com signals + persistência)
- `src/app/pages/hoje|historico|ajustes/` — uma página por pasta (`.ts` + `.html`)
- `src/app/app.*` — layout (logo, abas, rodapé) e rotas
