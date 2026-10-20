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

La nuova interfaccia (neutri caldi, un accento per area, font Inter) è l'unico aspetto dell'app: non c'è nessun
interruttore (`<html data-ui="v2">` è scritto in `index.html`).

Il sito pubblico di prenotazione (`/book/...`, ricerca, guide, pagine legali, vetrina fornitore) e le pagine di ospiti e
inquilini (check-in, pagamento dell'affitto) non la ricevono: restano come sono fino alla loro migrazione (DB-01).
`UiVersionSync` toglie l'attributo dalle rotte marcate `NOT_REDESIGNED_ROUTE_HANDLE` e sul dominio proprio di un'organizzazione.
Il colore d'area (`data-area` su `<html>`) segue la rotta `/app/<area>/…`; fuori da un'area (accesso, scelta area) c'è
l'inchiostro del marchio.

### Le primitive su una pagina sola

Con il dev server (`npm run dev:demo`) la pagina `/dev/primitives` mostra insieme dialogo (foglio dal basso su telefono),
suggerimento «?», schede, controlli segmentati e a scelta, quantità, elenco tabella/card e toast con «Annulla» (UI-07). Serve a
guardarli e a farci girare axe e gli Playwright dei telefoni (`e2e/ui-primitives-b.spec.ts`). **Non esiste nella build**:
la rotta c'è solo se `import.meta.env.DEV` è vero.

### L'elenco unico su una pagina sola

Sempre con il dev server, la pagina `/dev/list-view` mostra l'elenco unico (UI-14, `ListView`) su prenotazioni finte che cambiano
davvero quando si esegue un'azione: ricerca, filtri rapidi, filtri nel cassetto, viste (anche salvate, nel browser), colonne e
ordine, CSV, selezione e azioni di massa con «Annulla», swipe e menu «⋯» delle card, cassetto di dettaglio e vista a colonne
(trascinamento con il mouse, «Sposta in…» con tastiera e dito). I pulsanti in alto cambiano lo stato dell'elenco (caricamento,
aggiornamento, errore, vuoto) con `?scenario=`. Serve a guardarlo e a farci girare axe e gli Playwright dei telefoni
(`e2e/list-view.spec.ts`). Come si configura un elenco, con un esempio, è nel `README.md` di `src/components/shared/list-view/`;
la prima pagina vera che lo usa è l'elenco **Ospiti** (`features/guests/guests-list.ts`). **Non esiste nella build.**

### Il cassetto di dettaglio globale su una pagina sola

Sempre con il dev server, la pagina `/dev/detail-drawer` mostra il cassetto globale (UI-15) su due tipi finti: si apre da un
pulsante fuori da ogni elenco, dalla riga di un elenco (`detail: { drawerKind }`; con `?slot=local` l'elenco apre invece il suo
slot locale, come prima) e da un indirizzo condiviso (`?detail=tipo:id`); «indietro» lo chiude. Sotto `md` (768 px) è un foglio
dal basso, da `md` un pannello a destra. Sulla stessa pagina: la `Timeline` in tre varianti, le schede fra rotte (`RouteTabs`) e il
tono del numero sulle schede (`Tabs`). Come si registra un tipo è nel `README.md` di `src/components/shared/detail-drawer/`.
**Non esiste nella build.**

### I blocchi calmi su una pagina sola

Sempre con il dev server, la pagina `/dev/calm-blocks` mostra i blocchi delle home d'area (UI-16): il blocco in evidenza nei cinque toni,
la riga di numeri, la sezione senza scatola, l'elenco per giorno e quello in «oggi / domani / più avanti», la striscia dei sette giorni,
l'attività recente, il prossimo passo e la checklist compatta, più una home composta con tutti insieme. Serve a guardarli e a farci girare
axe e gli Playwright dei telefoni (`e2e/calm-blocks.spec.ts`). Quando usare quale blocco è nel `README.md` di
`src/components/shared/calm/`. **Non esiste nella build.**

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
