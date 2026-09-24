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
