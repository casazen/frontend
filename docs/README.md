# Documentazione webapp CasaZen

## Per gli utenti

La **Guida CasaZen** è consultabile dopo il login dall’icona libro nell’intestazione. Ogni area la espone all’indirizzo `/app/<area>/help`. Non richiede un permesso operativo aggiuntivo, ma richiede accesso all’area e il completamento dell’onboarding.

Copre primi passi, immobili, prenotazioni, iCal, ospiti e privacy, Alloggiati, pagamenti e messaggi, organizzazione, contratti, fornitori e assistenza. I contenuti sono editoriali: non contengono dati dell’organizzazione o degli ospiti.

## Per chi sviluppa

| Documento | Contenuto |
|---|---|
| [Sviluppo](technical/development.md) | Prerequisiti, variabili, avvio, problemi frequenti |
| [Architettura](technical/architecture.md) | Routing, aree, dati, componenti, sicurezza |
| [Test e rilascio](technical/testing.md) | Vitest, Playwright, CI e verifica degli ambienti |
| [Modalità demo](technical/demo-mode.md) | Dati dimostrativi e limiti |
| [Guida prodotto](product/README.md) | Fonti dei contenuti e regole di aggiornamento |

L’[indice backend](https://github.com/casazen/backend/blob/develop/docs/index.md) raccoglie contratti API, dominio, infrastruttura e runbook operativi condivisi. I README accanto ai componenti restano nel codice perché descrivono le API locali dei componenti.
