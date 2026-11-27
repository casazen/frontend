# AGENTS.md — CasaZen webapp (frontend)

> Verificato il 2026-11-27 su `develop@498fb224`. Letto da tutti gli agenti (Claude Code tramite `CLAUDE.md`, Cursor, Codex).
> **Questo repository è PUBBLICO** (`casazen/frontend`): niente segreti, niente documenti riservati (business plan, listino, pareri legali o fiscali, dati personali o di clienti). Le variabili `VITE_*` finiscono nel bundle del browser: mai segreti.

## Il progetto in breve

Webapp React per immobili, prenotazioni, ospiti, adempimenti, affitti lunghi e richieste ai fornitori; contiene anche il sito pubblico/vetrina (prerender), le pagine di prenotazione diretta, il portale ospite e il plugin WordPress (`integrations/wordpress/casazen/`). Backend: `casazen/backend` (API .NET, pubblico); app mobile: `casazen/mobile` (privato). Stack: React 19, TypeScript 5.9, Vite 8, React Router 7, TanStack Query 5, Zustand 5, Tailwind 4, Radix UI, Auth0, i18next, Vitest, Playwright (versioni esatte in `package.json`).

## Struttura

| Percorso | Responsabilità |
|---|---|
| `src/routes/`, `src/config/route-manifest.ts` | albero router, redirect, pagine pubbliche e protette; pagine operative con permessi, flag e navigazione |
| `src/components/auth/`, `src/components/layout/` | login, onboarding e guard delle aree; shell condivisa (header, sidebar, barra mobile) |
| `src/features/` | pagine, componenti e modelli per dominio |
| `src/api/` | contratti HTTP per dominio; client condiviso `src/api/client.ts`, base URL e token in `src/lib/axios.ts` |
| `src/queries/` | query, mutazioni, invalidazione (TanStack Query) |
| `src/store/` | stato UI locale (Zustand) |
| `src/i18n/` | risorse italiano/inglese |
| `src/site/`, `src/embed/` | pagine pubbliche e sito degli host; widget incorporabile |
| `e2e/`, `src/**/__tests__` | Playwright e Vitest |

Le aree sono `short-rent`, `long-rent`, `account` (amministrazione dell'organizzazione cliente), `supplier` e `admin` (console staff). `ProtectedRoute`, `OnboardingGuard` e `ContextRouteGuard` orientano l'interfaccia, ma **l'autorizzazione sui dati resta dell'API**: non aggirare i controlli nel client. La guida è una route `help` in ogni area.

Convenzioni: richieste solo tramite i moduli API (niente `fetch('/api/...')` nelle feature); dati server in TanStack Query e, dopo una mutazione, invalidare tutte le query interessate (anche le varianti filtrate); **ogni testo UI passa da i18next con chiavi identiche in italiano e inglese** (`src/i18n/locales/{it,en}.json`); date di soggiorno con `src/lib/stay-dates.ts`; HTML esterno solo con la sanitizzazione condivisa; controlli accessibili (focus visibile, etichette per le icone, layout mobile); nessun token o dato personale in console. Notifiche in tempo reale (SignalR `/hubs/notifications`) e avvisi popup: dettagli in `documentazione/03-documenti-ai/runbook/frontend/architecture.md`. Un flusso a passi nella shell usa `WizardShell` (o `useWizardOpenFlag`) perché gli avvisi aspettino.

## Avvio e controlli

Node.js 22 e npm (come in CI).

```bash
npm ci
npm run dev            # http://localhost:5173, richiede .env.local con VITE_API_BASE_URL (default API locale: porta 5000, suffisso /api), VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, VITE_AUTH0_AUDIENCE
npm run dev:demo       # dati locali: non prova autenticazione, persistenza o integrazioni
npm run lint && npm run typecheck && npm test && npm run build
```

La build esegue TypeScript, bundle browser, bundle SSR del sito, prerender e widget incorporabile. Un test mirato: `npx vitest run percorso/al/test.test.tsx`. Se vedi HTML al posto di JSON controlla `VITE_API_BASE_URL`; un `401` indica sessione/audience/tenant, un `403` autorizzazioni o organizzazione. Le variabili di deploy sono nella checklist del backend (`documentazione/03-documenti-ai/runbook/backend/deploy-checklist.md`); `.env.example` e la checklist sono confrontati da un test.

## Test

| Comando | Cosa verifica |
|---|---|
| `npm test` | Vitest (unitari e di componente) |
| `npm run test:e2e` | Playwright demo/L2 con fixture: non prova il backend reale |
| `npm run test:e2e:local` | progetto `local` con API e autenticazione configurate |
| `npm run test:e2e:staging`, `…:staging-gj` | smoke e Golden Journey sullo staging (servono configurazione e credenziali; mai quelle di produzione) |
| `npm run test:e2e:embed` | widget incorporabile |

I flussi L3 su stack effimero (`e2e/gj-l3/`, `e2e/stack/up.sh`) hanno il runbook condiviso `documentazione/03-documenti-ai/runbook/backend/golden-journey-l3.md` (workspace). Uno smoke saltato non prova lo staging reale. Prima di unire: controlli richiesti verdi e nessun conflitto (workflow in `.github/workflows/`).

## Guida utente

Ci sono due guide e **la stessa PR che cambia un flusso aggiorna entrambe**:

1. **Guida in-app** (dopo il login, **Guida** nell'intestazione, `/app/<area>/help`): componente `src/features/help/product-guide-page.tsx`; **i testi stanno solo** sotto `productGuide` in `src/i18n/locales/{it,en}.json` (nessuna seconda copia Markdown). Ogni sezione ha id stabile, titolo, parole chiave e passi ordinati (ancora `#guide-<id>`). Argomenti: primi passi, immobili, prenotazioni, calendari iCal, ospiti/privacy, Alloggiati/adempimenti, pagamenti/messaggi, organizzazione/permessi, contratti, fornitori, assistenza.
2. **Guida HTML** (sorgenti `guida/**`, pagine generate `public/guida/**`, comando `npm run guida:build`): creata nel ramo `docs/guida-utente-html`; se non è ancora in `develop` citala comunque nella PR.

Regole editoriali: (1) descrivi azioni e risultati disponibili nell'app, con i nomi delle schermate; (2) aggiorna entrambe le lingue mantenendo gli stessi id; (3) verifica i limiti contro codice e runbook (es.: iCal non è un channel manager completo; scaricare un contratto non è firmarlo o registrarlo; una prenotazione non è un pagamento riuscito; controlla lo stato attuale di Alloggiati e dei flag prima di scrivere «automatico»); (4) non presentare obiettivi del pilota o decisioni commerciali come funzioni consegnate e non pubblicare dati commerciali, volumi, credenziali o appunti di intervista; (5) non duplicare normative e istruzioni di infrastruttura: i dettagli operativi restano nei runbook; (6) non nominare mai il fornitore ConcordatoFacile né «partner» nei testi per gli utenti. La guida è contenuto statico del bundle: il login non la rende riservata, quindi **nessuna informazione confidenziale**.

## Flusso di consegna

Branch `feature/<nome>`, `fix/<nome>` o simili **da `develop`**; commit in Conventional Commits **senza** riga `Co-Authored-By`; **mai push o merge diretto su `develop` o `main`**; PR verso `develop` con Riepilogo, come verificare e `Closes #N`; non si fa force-push su rami condivisi. Ogni funzione visibile a host, ospite, fornitore o staff aggiorna anche la demo del backend (`DemoShowcaseCatalog`, regola in `backend/.claude/rules/demo-seed.md`).

## Documentazione: tienila pulita e aggiornata

La documentazione di progetto sta nella cartella **`documentazione/` del workspace CasaZen** (la cartella che contiene `backend/`, `frontend/` e `mobile/`), **fuori dai repository** di proposito. `01-documenti-ufficiali/` è scritta o approvata dall'utente o da professionisti; `03-documenti-ai/` è scritta dall'AI (requisiti, punti aperti, decisioni, revisioni, integrazioni, ADR, consegne, guide tecniche). Regole:

1. **Un solo posto.** Analisi, requisiti, punti aperti, decisioni, revisioni, runbook, ADR e report vivono solo in `documentazione/`. **Non creare `.md` sparsi in questo repository** (restano soltanto i README accanto al codice o alle risorse: componenti condivisi, `site-maps`, `public/brand`, plugin WordPress) e niente log, JSON di stato, cartelle «attempt», screenshot di verifica, report o appunti di sessione: sono rumore e restano nella storia git.
2. **La PR che cambia un comportamento aggiorna i documenti toccati**: lo stato dei requisiti (`documentazione/03-documenti-ai/requisiti/<area>.md`), i punti aperti (quelli chiusi vanno in `decisioni.md` con data e decisione), i runbook, **la guida utente** (`guida/**` sorgenti e `public/guida/**` pagine generate con `npm run guida:build`, più i testi `productGuide` in-app it/en) e **la documentazione tecnica ufficiale** (`documentazione/01-documenti-ufficiali/documentazione-tecnica/`, sorgenti e PDF: si rigenera quando cambiano architettura, stack, integrazioni, sicurezza o moduli).
3. **Una sola fonte per argomento**: collega, non copiare.
4. **Date assolute** (AAAA-MM-GG) e, in testa a ogni documento vivo, l'ultima verifica: `Verificato il AAAA-MM-GG su develop@<sha>` solo se hai davvero controllato; altrimenti `Stato: NON verificato — fonte: <file>`.
5. **A fine lavoro rimuovi i file temporanei** che hai creato (script, log, patch, screenshot, bozze).
6. **Documenti riservati** (business plan, listino, pareri, contratti, dati di clienti) **mai** in questo repository pubblico.
7. I **documenti ufficiali** (`01-documenti-ufficiali/`) non si riscrivono senza richiesta dell'utente.
8. Se una regola di questa sezione confligge con quanto trovi nel repository, **segnalalo** (nella PR o nel report) invece di scegliere in silenzio.

Senza accesso al workspace (per esempio in una sandbox cloud) non inventare né ricreare documenti qui: scrivi nella PR cosa andrebbe aggiornato in `documentazione/`.
