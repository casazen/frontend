# 🎭 CASAZEN Demo Mode

## Panoramica

CASAZEN supporta due modalità di esecuzione:

1. **Modalità Normale**: Richiede autenticazione Auth0
2. **Modalità Demo**: Salta l'autenticazione per dimostrazioni e test

Procedura Vercel e verifiche: `backend/docs/runbooks/demo-mode.md`.

## Come Usare la Demo Mode

### Avvio in modalità demo

```bash
npm run dev:demo
```

### Avvio in modalità normale (con autenticazione)

```bash
npm run dev
```

## Build

### Build normale (con autenticazione)

```bash
npm run build
```

Una build normale non è **mai** in modalità demo: se `VITE_DEMO_MODE=true` è presente nell'ambiente (o in un file
`.env*`), la build fallisce con un errore esplicito.

### Build demo (senza autenticazione)

```bash
npm run build:demo
```

Esegue `vite build --mode demo` con `VITE_DEMO_MODE=true`. È rifiutata sull'ambiente Production di Vercel
(`VERCEL_ENV=production`): per una demo pubblica usa un progetto Vercel separato con deployment Preview.

## Cosa Cambia in Demo Mode

- ✅ **Nessun login richiesto**: l'app si apre direttamente sulla home della persona demo
- ✅ **Utente demo**: viene simulato un utente "Demo User" (demo@casazen.com)
- ✅ **Persona**: `?demoProfile=short-stay|long-term|dual|admin|triple|supplier|onboarding` (oppure
  `VITE_DEMO_PROFILE`, default `long-term`)
- ✅ **Profilo**: se `GET /users/me` non risponde (fuori da Playwright il token demo viene rifiutato), il profilo
  deriva dalla persona: nessun loop verso `/onboarding`
- ✅ **Banner visibile**: un banner giallo in alto indica che l'app è in modalità demo
- ⚠️ **Chiamate API**: partono con il token finto `demo-token` e il backend reale le rifiuta (401): le pagine con
  dati mostrano un errore, salvo i mock di Playwright

## Vedere la nuova interfaccia (redesign)

La nuova interfaccia (neutri caldi, un accento per area, font Inter) è dietro un interruttore ed è **spenta** di
default: senza interruttore l'app è identica a prima. Per vederla:

- **in un solo browser** (QA): dalla console `localStorage.setItem('casazen:ui', 'v2')` e ricarica;
  `localStorage.removeItem('casazen:ui')` la spegne;
- **per chi apre una build** (anteprima, prova locale): `VITE_UI_V2=true`, ad esempio
  `npx cross-env VITE_UI_V2=true npm run dev:demo`;
- **per tutti**: il flag `UiRedesign` del backend (lo aggiunge il task BL-01), letto da `GET /api/public/features`.

Il sito pubblico di prenotazione (`/book/...`, ricerca, guide, pagine legali, vetrina fornitore) e le pagine di ospiti e
inquilini (check-in, pagamento dell'affitto) non la ricevono mai: restano come sono fino alla loro migrazione (DB-01).
Il colore d'area (`data-area` su `<html>`) segue la rotta `/app/<area>/…`; fuori da un'area (accesso, scelta area) c'è
l'inchiostro del marchio.

## Configurazione

La modalità demo è controllata dalla variabile d'ambiente `VITE_DEMO_MODE`, valida solo con il dev server o con
`npm run build:demo`:

- `VITE_DEMO_MODE=true` → Modalità demo attiva (dev server / build demo)
- `VITE_DEMO_MODE=false` → Modalità normale (default)

## Quando Usare la Demo Mode

- 🎯 **Presentazioni**: Mostrare l'app a clienti o stakeholder
- 🔧 **Sviluppo UI**: Testare componenti senza configurare Auth0
- 🎨 **Design review**: Valutare l'interfaccia utente
- 📸 **Screenshot**: Catturare schermate per documentazione

## Note Importanti

- La demo mode **NON** deve essere usata in produzione con dati reali
- La demo mode bypassa completamente l'autenticazione lato frontend
- I dati visualizzati in demo mode sono simulati
