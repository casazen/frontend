# Sviluppo locale

## Preparazione

Usare Node.js 22 e npm. Eseguire `npm ci` dalla radice. Il backend è [casazen/backend](https://github.com/casazen/backend): avviarlo separatamente secondo il suo README.

Creare `.env.local` (ignorato da Git):

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://casazen-api
```

Sono variabili pubbliche incorporate nel bundle: **non inserire segreti**, chiavi private o client secret. Le variabili di deploy aggiuntive sono elencate nella [checklist condivisa](https://github.com/casazen/backend/blob/develop/docs/runbooks/deploy-checklist.md).

Eseguire `npm run dev` e aprire `http://localhost:5173`. Nel tenant di sviluppo gli URL di callback, logout e web origin devono comprendere l’origine locale. Il default API locale del codice è la porta **5000**, con suffisso `/api`.

## Demo

`npm run dev:demo` usa dati locali e non verifica autenticazione, persistenza o integrazioni. Vedere [modalità demo](demo-mode.md). Non usare la demo per dati reali o come prova di un adempimento inviato.

## Problemi frequenti

- Risposta HTML al posto di JSON: verificare `VITE_API_BASE_URL`; una richiesta relativa a `/api` può colpire il rewrite della SPA anziché il backend.
- `401`: controllare sessione, audience e tenant. `403`: controllare autorizzazioni e organizzazione; non aggirare i controlli nel client.
- Funzione assente: verificare contesti di `/api/me/contexts`, permessi, piano e feature flag.
- Modifica alle variabili non visibile: riavviare Vite; in deploy serve una nuova build.

Non allegare `.env`, token, documenti ospiti o risposte API con dati personali nei ticket.
