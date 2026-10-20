# Test e rilascio

## Controlli locali

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

La build esegue TypeScript, bundle browser, bundle SSR del sito e prerender. Per un controllo mirato: `npx vitest run percorso/al/test.test.tsx`.

## Livelli browser

| Comando | Cosa verifica |
|---|---|
| `npm run test:e2e` | Suite Playwright demo/L2 con fixture; non prova il backend reale |
| `npm run test:e2e:local` | Progetto local con API e autenticazione configurate |
| `npm run test:e2e:staging` | Smoke dello staging con configurazione e credenziali richieste |
| `npm run test:e2e:staging-gj` | Golden Journey sullo staging |

Il dettaglio dei progetti, delle dipendenze di setup e del dev server è in `playwright.config.ts`. I flussi L3 su stack effimero hanno il [runbook condiviso](https://github.com/casazen/backend/blob/develop/docs/runbooks/golden-journey-l3.md). Non usare credenziali di produzione nei test locali.

La guida prodotto ha test di ricerca, cambio lingua, link nell’header e collocazione sotto il confine di autenticazione. Il test browser verifica navigazione dal pulsante, lettura e layout mobile.

## CI e deploy

I workflow in `.github/workflows/` definiscono i controlli effettivi. Verificare la revisione corrente della PR: lint/typecheck/unit/build, E2E L2 e Golden Journey dove previsti, oltre al deploy preview.

Uno smoke saltato non prova lo staging reale. Il preflight di staging deve verificare configurazione e readiness dell’API; in assenza dei requisiti correggere la configurazione, senza sostituire URL o credenziali con valori inventati.

Prima di unire verificare controlli richiesti verdi e assenza di conflitti. Per configurazione e verifica dopo il deploy: [checklist](https://github.com/casazen/backend/blob/develop/docs/runbooks/deploy-checklist.md) e [CI frontend](https://github.com/casazen/backend/blob/develop/docs/runbooks/ci-frontend.md).
