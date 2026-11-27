# docs/ — indirizzamento

> Verificato il 2026-11-27 su `develop@498fb224`. Questa cartella contiene **solo questo file**: non aggiungere altri `.md` qui (vedi `AGENTS.md`, sezione «Documentazione»).

La documentazione di progetto (requisiti, punti aperti, decisioni, ADR, integrazioni, guide tecniche, report) sta nella cartella **`documentazione/` del workspace CasaZen** (la cartella che contiene `backend/`, `frontend/` e `mobile/`), fuori dai repository di proposito: questo repository è pubblico.

| Cercavi | Ora è in |
|---|---|
| `docs/technical/*` (sviluppo, architettura, test, demo, design system, flussi host, guida contratti, assistente, plugin WordPress) | `documentazione/03-documenti-ai/runbook/frontend/` (essenziale in `AGENTS.md`) |
| `docs/product/README.md` (regole editoriali della guida) | `AGENTS.md`, sezione «Guida utente» |
| `docs/product/demo-e-conversione.md` | `documentazione/03-documenti-ai/requisiti/specifiche/frontend-demo-e-conversione.md` |
| `docs/product/{verifica,revisione}-*.md`, `evidenze-*` | rimossi (verifiche e screenshot di sessioni concluse: restano nella storia git, `git show 498fb224:<percorso>`) |
| Runbook condivisi con il backend | repository `casazen/backend`, cartella `docs/runbooks/` |

Mappa completa dei vecchi percorsi: `documentazione/99-archivio/MAPPA-SPOSTAMENTI.md`. Guida utente: in-app (**Guida** nell'intestazione, testi `productGuide` in `src/i18n/locales/{it,en}.json`) e guida HTML (`guida/`, `public/guida/`, `npm run guida:build`).
