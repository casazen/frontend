# Manuale utente di CasaZen (`guida/`)

Il manuale d'uso di CasaZen è un sito statico di pagine HTML, in italiano, servito dall'app su **`/guida/`**. Si apre dal link «Manuale completo» nella Guida dell'app (`/app/<area>/help`). È pensato per due lettori: l'utente (pagine ordinate, con ricerca) e il futuro chatbot (blocchi di testo autosufficienti in JSON).

| Cosa | Dove |
|---|---|
| **Sorgenti** (da modificare) | `guida/contenuti/NN-id.md` + `guida/meta.json` (data e versione) |
| **Pagine generate** (non si modificano a mano) | `public/guida/*.html`, `guida-indice.js`, `guida-chunks.json`, `guida-completa.md`, `llms.txt` |
| **Aspetto e comportamento** (scritti a mano) | `public/guida/assets/guida.css`, `guida.js`, `marchio.svg`, `fonts/` |
| **Generatore** (nessuna dipendenza) | `scripts/build-guida.mjs` |
| **Controllo che i file generati siano aggiornati** | `scripts/build-guida.test.mjs` (gira con `npm test`) |

## Comandi

```bash
npm run guida:build     # rigenera public/guida da guida/contenuti
npm run guida:check     # non scrive: fallisce se i file generati sono vecchi o se il contenuto ha errori
node scripts/build-guida.mjs --coverage          # elenca le rotte del manifest senza pagina che le spieghi
node scripts/build-guida.mjs --notes note.md     # raccoglie le «Note per la revisione» di tutte le pagine
```

Anteprima: servire la cartella `public/` con un server statico (es. `node <server> public 4710`) e aprire `http://localhost:4710/guida/`. Le pagine usano percorsi relativi: si aprono anche da disco, ma la ricerca richiede un server.

## Quando si aggiorna (regola per chi sviluppa)

**Chi cambia un flusso, un nome di pulsante, una regola o una funzione aggiorna la pagina del manuale nella stessa PR** e rilancia `npm run guida:build` (il test fallisce se si dimentica). Se la funzione è nuova, aggiungi la sua riga nella tabella «Funzionalità» e un compito in «Come fare»; se una rotta nuova entra nel `route-manifest.ts`, citala nel `copre` della pagina che la spiega (`--coverage` mostra cosa manca). Aggiorna anche `guida/meta.json` (`aggiornato`, e `versione` se il cambio è grande). Chi sposta un menu o rinomina un'etichetta aggiorna anche i testi `productGuide` della guida rapida in-app (`src/i18n/locales/{it,en}.json`).

## Formato di un file sorgente

```
---
id: prenotazioni                  # univoco, minuscolo con trattini: è l'indirizzo della pagina (prenotazioni.html)
titolo: Prenotazioni e calendario
sezione: Affitti brevi            # una tra: Per iniziare, Affitti brevi, Adempimenti, Incassi e fisco, Affitti lunghi,
                                  #   Agenzie e proprietari, Fornitori e marketplace, Sito e portali, App mobile, Account e piano
ordine: 20
riassunto: Una o due frasi.
chi: [gestore, amministratore]    # gestore, amministratore, proprietario, commercialista, fornitore, ospite, inquilino
dove: Affitti brevi › Prenotazioni
parole_chiave: [prenotazione, calendario]
copre: [/app/short-rent/bookings, /app/short-rent/bookings/:id]   # rotte spiegate; «(non-utente)» per quelle tecniche
stato: disponibile                # disponibile | su-attivazione | in-arrivo
fonte_codice: [frontend/src/features/bookings/bookings-page.tsx]  # non pubblicato
---
## In breve · ## Funzionalità (tabella) · ## Come funziona · ## Come fare (### un compito per titolo, passi numerati)
## Flussi completi (### Flusso: …) · ## Regole e limiti · ## Domande frequenti (### domanda?) · ## Glossario
## Vedi anche
```

Sezione facoltativa `## Note per la revisione (NON pubblicate)`: il generatore non la pubblica e `--notes` la raccoglie. **Non committarla** in questo repository pubblico: dubbi, discrepanze e incertezze si tengono nei documenti privati del progetto (`documentazione/02-guida-utente/`), mai nei sorgenti del manuale.

Tabella «Funzionalità»: colonne `Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa` (la colonna «Come si usa» riporta il titolo del compito in «Come fare» e diventa un link). Link interni: `[[id]]`, `[[id#slug-del-titolo]]`, `[[id#slug|testo]]`. Note: citazione che inizia con `**Nota:**`, `**Attenzione:**` o `**Suggerimento:**`. Solo Markdown semplice: niente HTML, niente immagini.

## Regole editoriali (il generatore ne fa rispettare alcune)

1. **Solo cose vere e verificate sul codice.** Etichette e passi presi dalla schermata reale (`src/i18n/locales/it.json` e pagina React), regole e importi dal backend. Funzioni dietro flag o non finite: «su attivazione» / «in arrivo», mai promesse.
2. **Mai il nome del fornitore del contratto guidato** (né «CF», né «partner» riferito a quel servizio): l'utente resta dentro CasaZen («pratica di registrazione», «contratto guidato»). Mai clienti pilota, ticket (SR-…, LR-…), numeri di PR, nomi di flag, percorsi di file, endpoint. Il generatore blocca questi termini.
3. **Niente dati riservati**: margini, accordi, volumi. Importi e commissioni solo se l'utente li vede nell'app. La guida è contenuto pubblico.
4. **Non è consulenza** legale o fiscale: si descrive cosa fa CasaZen e cosa resta all'utente.
5. Un compito = una guida con passi numerati, un'azione per passo, etichette tra «», percorsi di menu con `›`. Tono diretto, «tu», frasi brevi.
6. Una rotta nuova nel `route-manifest.ts` va citata in `copre` di una pagina (anche come `(non-utente)`).

## Per il chatbot

Il chatbot legge **solo** questi file pubblici (aggiornati a ogni `guida:build`):

- `guida-chunks.json`: `{versione, aggiornato, lingua, base, chunks[]}`. Ogni chunk è autosufficiente e ha `id` (`pagina#paragrafo`), `tipo` (`pagina`, `howto`, `flusso`, `faq`, `funzionalita`, `concetto`, `regole`), `pagina`, `titolo_pagina`, `sezione`, `titolo`, `chi[]`, `dove`, `stato`, `url` (indirizzo da citare come fonte) e `testo` (italiano semplice con il contesto in apertura). Pensati per essere indicizzati uno per uno.
- `guida-completa.md`: tutta la guida in un unico file, per un contesto lungo.
- `llms.txt`: indice delle pagine per i sistemi automatici.

Suggerimento di risposta: citare sempre `url`, dire «secondo la guida» solo per ciò che è nei chunk, e rimandare all'assistenza se la risposta non c'è.

## Pubblicazione

Le pagine sono pubbliche (stesso dominio dell'app, nessun login) e oggi **non indicizzabili** (`ROBOTS = 'noindex, follow'` in `scripts/build-guida.mjs`): cambiare quella costante e rigenerare per farle comparire nei motori di ricerca. Nessuna informazione riservata deve entrare nei sorgenti.
