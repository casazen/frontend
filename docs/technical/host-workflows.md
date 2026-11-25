# Flussi quotidiani dell’host

| Domanda dell’host | Prima informazione da mostrare | Dove approfondire |
| --- | --- | --- |
| Chi arriva o parte oggi? | Soggiorni di oggi, filtrati per immobile | Calendario e scheda prenotazione |
| Cosa devo fare? | Una lista breve di azioni con una destinazione precisa | Elenco completo delle attività, approvazioni e verifiche |
| Chi ha prenotato? | Ospite, stato, date e immobile | Scheda completa con soggiorno, conversazione, check-in e pagamento |
| L’ospite ha scritto? | Ultimo messaggio e campo di risposta | Dettagli del soggiorno su richiesta e bozza AI per i canali supportati |
| Il pagamento è completo? | Totale, incassato e saldo nella valuta della prenotazione | Movimenti, fatturazione e provenienza degli importi |
| Sono in regola? | Stato risultante dal server, scadenze e controlli ancora aperti | Azione sulla singola scadenza e prova di completamento |

La lista delle attività, il conteggio delle attività urgenti e le notifiche non lette misurano eventi diversi. Sommarli produrrebbe un totale ambiguo. Il filtro immobile deve valere sia per i soggiorni sia per le attività presentate come riferite a quell’immobile.

La sessione di check-in espone stato, scadenza e consegna del link. Le informazioni fiscali e la trasmissione Alloggiati hanno fonti e permessi distinti. Una richiesta fallita o una verifica ancora sconosciuta devono rimanere distinguibili da un esito positivo.

## Passaggi tra ruoli

| Percorso | Comportamento da preservare |
| --- | --- |
| Login proprietario da un rendiconto | Dopo il login si riapre la destinazione interna autorizzata. Il proprietario mantiene il contesto del documento ricevuto. |
| Registrazione e invito | La scelta del profilo chiarisce l’area di destinazione. Un invito in attivazione propone «Riprova» dopo un errore o un’attesa anomala. |
| Primo immobile | Un errore riporta il focus al campo interessato. Dopo il salvataggio compare una sola conferma. |
| Prenotazione e arrivo | Con un solo immobile disponibile il modulo lo seleziona. Il riepilogo del check-in distingue conferma, sincronizzazione, imposta e comunicazione alla polizia. |
| Esperienza ospite e fornitore | Il cliente apre l’offerta che intende prenotare. Richiesta, preventivo, autorizzazione e conferma del fornitore hanno esiti distinti. Le note su una seconda offerta sopravvivono all’invio della prima. |
| Intervento e housekeeping | Si può rivedere la richiesta prima dell’invio. Lo slot scelto resta visibile tornando dal riepilogo. Il fornitore prende in carico la richiesta e conclude il lavoro con conferma del server. |

### Verifica ripetibile

Le suite nel repository usano fixture per inviti, prenotazioni e servizi. In Chromium, i test di `e2e/business-journey.spec.ts` attraversano la creazione di una prenotazione con tassa di soggiorno. I percorsi di `e2e/guest-checkin-portal.spec.ts` coprono anche un’interruzione recuperabile su telefono. Il test in `e2e/supplier-housekeeping-flow.spec.ts` segue la pulizia dalla presa in carico alla rilettura dell’esito. Gli esiti delle fixture verificano la navigazione e gli stati dell’interfaccia. La consegna delle email, l’identità esterna e il regolamento dei pagamenti richiedono una verifica con i rispettivi servizi.
