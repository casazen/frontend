# Guida prodotto per gli utenti

## Dove si trova

Dopo il login, l’icona libro **Guida** nell’header apre `/app/<area>/help`. La guida resta nella shell corrente e richiede accesso a quell’area. È disponibile in italiano e inglese, con ricerca su titoli, parole chiave e istruzioni e con link ai singoli argomenti.

Gli argomenti sono: primi passi, immobili, prenotazioni, calendari iCal, ospiti/privacy, Alloggiati/adempimenti, pagamenti/messaggi, organizzazione/permessi, contratti, fornitori, assistenza.

## Fonte unica dei contenuti

I testi effettivamente mostrati sono sotto `productGuide` in:

- [Italiano](../../src/i18n/locales/it.json)
- [Inglese](../../src/i18n/locales/en.json)

Il componente [ProductGuidePage](../../src/features/help/product-guide-page.tsx) rende sezioni, istruzioni e indice senza una seconda copia Markdown. Ogni sezione ha un id stabile, titolo, parole chiave per la ricerca e passi ordinati. Gli anchor hanno formato `#guide-<id>`.

## Regole editoriali

1. Descrivere azioni e risultati disponibili nell’app, con nomi coerenti alle schermate.
2. Aggiornare entrambe le lingue e mantenere gli stessi id di sezione.
3. Verificare i limiti contro codice e runbook: Alloggiati attualmente manuale, iCal non è un channel manager completo, download di contratto diverso da firma o registrazione, prenotazione diversa da pagamento riuscito.
4. Non presentare obiettivi del pilota o decisioni Quokka come funzionalità già consegnate. Non pubblicare dati commerciali, volumi, credenziali o appunti di intervista nella guida generale.
5. Non duplicare normative e istruzioni infrastrutturali: i dettagli operativi restano nei runbook.
6. Quando un flusso cambia, includere l’aggiornamento della guida nella stessa PR.

La guida è contenuto statico del bundle: il login protegge l’esperienza di consultazione, non rende riservati i testi scaricati dal browser. Non inserirvi informazioni confidenziali.
