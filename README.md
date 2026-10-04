# X4 — Controle de Ponto

Registro do horário real de entrada/saída e cálculo de horas extras. Angular + Tailwind CSS, dados no `localStorage`.

## Rodar
```
npm install
npm start        # http://localhost:4200
npm run build    # saída em dist/ponto-x4-app/browser
```

## Estrutura
- `src/app/core/` — modelos, utilitários de tempo e `PontoService` (estado com signals + persistência)
- `src/app/pages/hoje|historico|ajustes/` — uma página por pasta (`.ts` + `.html`)
- `src/app/app.*` — layout (logo, abas, rodapé) e rotas
