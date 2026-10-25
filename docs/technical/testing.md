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

### Giro del contratto a canone concordato (stack effimero)

`e2e/gj-l3/concordato-round.spec.ts` percorre dall’interfaccia tutto il giro del contratto a canone concordato: «Nuovo contratto», scheda, privacy, accesso, modulo guidato, stato della pratica, caricamento dei documenti, lettura del contratto, wizard, importazione, registrazione con la ricevuta già caricata. Dal CF-DOCS-REAL i documenti sono quelli veri del servizio: UN solo file scansionato con il contratto, l’attestazione e la scheda di calcolo (letto con l’OCR, sezioni riconosciute, nessun avviso) e la ricevuta digitale dell’Agenzia delle Entrate come secondo caricamento; la dichiarazione della registrazione parte da numero e data letti dalla ricevuta, che la persona controlla e conferma. Per questo il job installa `tesseract-ocr` e `poppler-utils` (dove mancano il simulatore consegna il PDF con il suo testo). L’API serve solo da oracolo (in sola lettura) per le asserzioni; su ogni schermata chiave il testo visibile non deve nominare il fornitore né «partner». Gira solo in CI (job «GJ L3 (UI, ephemeral stack)») ed è nella cartella `e2e/gj-l3/` perché il progetto `gj-l3` di Playwright cerca lì.

Lo stack parte con il servizio acceso e il modulo SIMULATO (`e2e/stack/up.sh`: `Features__ConcordatoFacile=true`, `ConcordatoFacile__FormMode=Simulated`, `ConcordatoFacile__BaseUrl` = il frontend dello stack, un `ConcordatoFacile__LinkSecret` di prova, `ConcordatoFacile__Simulator__StatusTtlSeconds=1`). Senza Stripe l’accesso arriva in due modi: un amministratore di piattaforma (account `gj-admin-*` del falso IdP) che ha creato anche un’organizzazione propria, oppure la pratica omaggio, assegnata con l’API admin (fixture dichiarata: non ha una schermata) e usata dalla pagina di pagamento. Non coperti: il pagamento con carta vera e il webhook di Stripe (la CI non ha le chiavi di prova di Stripe) e il modulo vero del servizio.

## CI e deploy

I workflow in `.github/workflows/` definiscono i controlli effettivi. Verificare la revisione corrente della PR: lint/typecheck/unit/build, E2E L2 e Golden Journey dove previsti, oltre al deploy preview.

Uno smoke saltato non prova lo staging reale. Il preflight di staging deve verificare configurazione e readiness dell’API; in assenza dei requisiti correggere la configurazione, senza sostituire URL o credenziali con valori inventati.

Prima di unire verificare controlli richiesti verdi e assenza di conflitti. Per configurazione e verifica dopo il deploy: [checklist](https://github.com/casazen/backend/blob/develop/docs/runbooks/deploy-checklist.md) e [CI frontend](https://github.com/casazen/backend/blob/develop/docs/runbooks/ci-frontend.md).
