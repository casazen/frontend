---
id: prenotazioni
titolo: Prenotazioni e calendario
sezione: Affitti brevi
ordine: 20
riassunto: Come lavorare una prenotazione dall'arrivo della richiesta alla partenza dell'ospite: elenco, calendario, nuova prenotazione a mano, richieste da accettare, modifiche, annullamenti e passaggi che CasaZen fa da solo.
chi: [gestore, amministratore]
dove: Affitti brevi › Prenotazioni · Affitti brevi › Calendario
parole_chiave: [prenotazione, calendario, richiesta, conferma, annullamento, rimborso, blocco date, iCal, portale, Airbnb, Booking.com, flusso, arrivo, partenza, no-show, channel manager]
copre: [/app/short-rent/bookings, /app/short-rent/bookings/create, /app/short-rent/bookings/calendar, /app/short-rent/bookings/flow, /app/short-rent/bookings/:id, /app/short-rent/bookings/:id/edit, /book/:orgSlug/requests/:bookingId/confirm]
stato: disponibile
fonte_codice: [frontend/src/features/bookings/bookings-page.tsx, frontend/src/features/bookings/bookings-list.tsx, frontend/src/features/bookings/booking-create-page.tsx, frontend/src/features/bookings/booking-detail-page.tsx, frontend/src/features/bookings/booking-edit-page.tsx, frontend/src/features/bookings/calendar-page.tsx, frontend/src/features/bookings/booking-flow-page.tsx, backend/Casazen.Web/Controllers/BookingController.cs, backend/Casazen.Web/Controllers/BookingLifecycleController.cs, backend/Casazen.Web/Controllers/BookingApprovalController.cs, backend/Casazen.Web/Controllers/BookingCancellationController.cs, backend/Casazen.Core/Services/OnSiteRequests.cs, backend/Casazen.Core/Services/IBookingFlowSettingsService.cs]
---

## In breve
**Prenotazioni** è l'elenco di tutti i soggiorni dei tuoi immobili: quelli del tuo sito, quelli dei portali (Airbnb, Booking.com e altri) e quelli che inserisci tu. **Calendario** mostra gli stessi soggiorni, più i blocchi, giorno per giorno. Aprendo una prenotazione vedi sempre «Cosa succede ora», cioè chi deve fare il prossimo passo: tu o l'ospite. Molti passaggi (invio del link per il check-in online, registrazione di arrivo e partenza) li fa CasaZen da solo, e li puoi cambiare nella scheda **Flusso**.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Elenco prenotazioni | Tutte le prenotazioni con ricerca, schede di stato, filtri e viste salvate; esporta in CSV | Prenotazioni | gestore, amministratore | Disponibile | Trovare una prenotazione |
| Nuova prenotazione | Registra un soggiorno preso per telefono o di persona, in 5 passi | Prenotazioni › «Nuova prenotazione» | gestore, amministratore | Disponibile | Creare una prenotazione manuale |
| Richieste «Da confermare» | Accetti o rifiuti le richieste con pagamento in struttura | Prenotazioni › scheda «Da confermare» | gestore, amministratore | Disponibile | Rispondere a una richiesta di prenotazione |
| Scheda prenotazione | Soggiorno, messaggi, check-in online, pagamento, cronologia | Prenotazioni › nome dell'ospite | gestore, amministratore | Disponibile | Leggere la scheda di una prenotazione |
| Registra arrivo | Segna che l'ospite è arrivato (stato «Check-in effettuato») | Riga della prenotazione o scheda | gestore, amministratore | Disponibile | Registrare l'arrivo di un ospite |
| Modifica prenotazione | Cambia date, ospiti e note, con ricalcolo di prezzo e pagamenti | Scheda › menu | gestore, amministratore | Disponibile | Modificare una prenotazione |
| Annulla prenotazione | Annulla e, dove serve, rimborsa | Riga o scheda › «Annulla prenotazione» | gestore, amministratore | Disponibile | Annullare una prenotazione |
| Soggiorno da verificare | Ti avvisa quando il calendario del portale non corrisponde più al soggiorno | Scheda prenotazione, elenco | gestore, amministratore | Disponibile | Controllare un soggiorno da verificare |
| Calendario | Vista Timeline, Mese, Settimana o Giorno, con legenda | Calendario | gestore, amministratore | Disponibile | Aprire e leggere il calendario |
| Blocca date | Chiude le notti per proprietario, manutenzione o altro motivo | Calendario › «Blocca date» | gestore, amministratore | Disponibile | Bloccare delle date |
| Crea soggiorno OTA | Trasforma un blocco di un calendario iCal in un soggiorno con i dati dell'ospite | Calendario › blocco | gestore, amministratore | Disponibile | Creare un soggiorno da un blocco di un altro canale |
| Flusso | Scegli quali passaggi fa CasaZen e quali fai tu | Prenotazioni › scheda «Flusso» | amministratore (gli altri la leggono) | Disponibile | Scegliere cosa fa CasaZen da solo |
| Portale ospiti della prenotazione | Gestisci l'area dell'ospite per quel soggiorno | Scheda › menu «Portale ospiti» | gestore, amministratore | Su attivazione | Vedi [[portale-ospite]] |
| Messaggi programmati | Mostra i messaggi che le routine manderanno all'ospite | Scheda › «Soggiorno» | gestore, amministratore | Su attivazione | Vedi [[routine-ai-crm]] |

## Come funziona

### Gli stati di una prenotazione
Ogni prenotazione ha uno di questi cinque stati.

| Stato | Cosa significa | Cosa puoi fare |
|---|---|---|
| In attesa | Il soggiorno non è ancora valido: è una richiesta con «Paga in struttura» che aspetta te o l'email dell'ospite, oppure un pagamento online non ancora completato. Le date sono tenute da parte. | Accettare o rifiutare la richiesta; altrimenti aspettare. Se nessuno risponde, la richiesta scade e le date tornano libere. |
| Confermata | Il soggiorno è valido e le notti sono occupate sul calendario, sul sito e sui canali collegati. | Mandare il link per il check-in online, registrare l'arrivo, modificare (dove consentito), annullare. |
| Check-in effettuato | L'arrivo è registrato: l'ospite è nell'immobile. | Registrare la partenza, annullare se serve. |
| Check-out effettuato | Il soggiorno è concluso. | Leggere i messaggi (per 7 giorni), chiedere una recensione, vedere incassi e documenti. |
| Annullata | Le date sono di nuovo libere. | Leggere il motivo nella scheda «Cronologia». Non si riapre: se serve, ne crei una nuova. |

> **Attenzione:** «Check-in online» (i dati e i documenti che l'ospite compila) e «Check-in effettuato» (l'arrivo registrato) sono due cose diverse. Il primo si prepara prima dell'arrivo, il secondo è il momento in cui l'ospite entra. Lo spiega [[ospiti-checkin]].

### Da dove arriva una prenotazione e cosa cambia
L'elenco mostra il **canale** (Sito diretto, Inserita a mano, Airbnb, Booking.com, Expedia, Vrbo, Tripadvisor, Agoda, Altri canali) e l'**origine** (Portale, Sito dell'agenzia, Sito CasaZen, Manuale).

| Come arriva | Quando è valida | Chi incassa | Modifica | Annullamento |
|---|---|---|---|---|
| Sito, pagamento online con carta | Appena l'ospite paga (ha 30 minuti per completare, poi scade) | CasaZen, sul tuo conto di pagamento | Sì, prima dell'arrivo; i pagamenti si adeguano | Da te, con rimborso |
| Sito, «Paga in struttura» | Quando la accetti | Tu, in struttura | Non finché è una richiesta | Da te, o il rifiuto |
| Inserita a mano | Subito | Tu (link di pagamento, bonifico o in struttura) | Sì, prima dell'arrivo | Da te |
| Portale (Airbnb, Booking.com…) tramite channel manager | Quando arriva, già confermata | Il portale | Sul portale: lo chiede l'ospite | Dal portale, oppure con «Chiedi l'annullamento» dove il portale lo permette |
| Blocco di un calendario iCal | Non è una prenotazione: sono solo date occupate | Il portale | — | — |

Per una prenotazione di un portale CasaZen non calcola i prezzi: mostra gli importi che comunica il canale, in «Importi del canale» nella scheda «Pagamento». Non registrare l'incasso anche in CasaZen: lo conteresti due volte nei ricavi.

### Cosa fa CasaZen da solo e cosa devi fare tu
Con le impostazioni iniziali CasaZen fa da solo questi passaggi, e ti avvisa quando li ha fatti:
- conferma le prenotazioni dei portali e quelle pagate sul tuo sito;
- manda all'ospite il link per il check-in online 3 giorni prima dell'arrivo;
- registra l'arrivo alla fine del giorno di arrivo;
- registra la partenza all'orario di check-out dell'immobile (alle 10:00 se non ne hai indicato uno);
- dichiara la casa pronta quando la pulizia è fatta;
- fa scadere le richieste senza risposta e i pagamenti non completati, e libera le date.

Restano **a te**: rispondere alle richieste «Da confermare»; la comunicazione ad Alloggiati Web (è un obbligo di legge: CasaZen prepara i dati, l'invio lo fai tu: vedi [[alloggiati-istat]]); segnare il no-show; registrare gli incassi fatti fuori da CasaZen; gestire modifiche e cancellazioni dei portali; completare i dati degli ospiti se mancano.

### Il calendario: cosa vedi
Il calendario ha quattro viste: **Timeline** (tutti gli immobili, un giorno per colonna), **Mese**, **Settimana** e **Giorno** (un immobile alla volta). Su uno schermo largo si apre la Timeline. I colori della legenda sono:
- Prenotazione confermata;
- Richiesta in attesa di conferma;
- Ospite arrivato;
- Soggiorno concluso;
- Date bloccate da un altro canale (iCal);
- Soggiorno OTA da verificare;
- Date chiuse da te (proprietario, manutenzione);
- In attesa di pagamento dell'ospite;
- Intervento di un fornitore;
- Date occupate due volte (conflitto: va risolto scegliendo quale soggiorno tenere).

I prezzi e le restrizioni per notte (soggiorno minimo, arrivi e partenze chiusi) si leggono e si cambiano dallo stesso calendario: li spiega [[prezzi-tariffe]].

### La cronologia di una prenotazione
Dal menu della scheda apri «Cronologia»: l'elenco di quello che è successo (richiesta ricevuta, prenotazione confermata, pagamento ricevuto, link inviato, documenti ricevuti, arrivo, partenza, rimborsi). Se la prenotazione è annullata trovi il motivo: l'ospite ha annullato, hai rifiutato la richiesta, la richiesta è scaduta, l'ospite non ha confermato l'email in tempo, il pagamento non è arrivato in tempo, le date non erano più libere quando l'ospite ha pagato.

## Come fare

### Trovare una prenotazione
1. Apri **Affitti brevi › Prenotazioni**. La lista si apre sulla scheda «In arrivo».
2. Scegli una scheda: «Tutte», «Da confermare», «In arrivo», «In corso», «Concluse» o «Cancellate». «Da confermare» mostra anche il numero delle richieste che aspettano te.
3. Scrivi nel campo «Cerca ospite, codice o immobile». La ricerca guarda in tutte le prenotazioni, non solo nella pagina che vedi.
4. Restringi con i filtri: «Immobile», «Canale», «Origine», «Arrivo tra le date», «Check-in online» (Tutti, Documenti ricevuti, Link da inviare, In attesa dell'ospite).
5. Per un filtro che usi spesso scegli una vista: «Arrivi dei prossimi 7 giorni», «Documenti da ricevere» o «Solo prenotazioni dirette».
6. Premi sul nome dell'ospite: si apre una scheda di riepilogo. Da lì «Apri la scheda completa» porta alla pagina intera.

Ogni riga mostra ospite e immobile, date e notti, canale, stato e totale. Con la scelta delle colonne puoi aggiungere Email, Pagamento (Non incassato, Incassato in parte, Incassato, Rimborsato) e Codice. Il comando di esportazione salva l'elenco in un file CSV. La lista e i filtri restano nell'indirizzo della pagina: «Indietro» e l'aggiornamento ti riportano dove eri.

### Creare una prenotazione manuale
Serve poter modificare «Prenotazioni e calendario». Dopo la creazione il soggiorno è subito **Confermato**.
1. Apri **Affitti brevi › Prenotazioni** e premi «Nuova prenotazione». Se arrivi dalla scheda di un immobile, l'immobile è già scelto.
2. Passo **Soggiorno**: scegli l'immobile, l'«Arrivo (check-in)» e la «Partenza (check-out)», poi gli «Adulti» (18 anni o più) e i «Minori». Se il comune chiede l'età dei minori per la tassa di soggiorno, ti viene chiesta.
3. Premi «Avanti». CasaZen controlla se le date sono libere, anche nel tuo channel manager se l'immobile è collegato. Se sono occupate, ti propone le date libere più vicine con «Usa …». Se sono già bloccate dal calendario di un portale, puoi premere «Collega» per completare quella prenotazione invece di crearne una seconda.
4. Passo **Ospite**: «Nome e cognome» ed «Email» bastano. L'email serve perché l'ospite riceva il link per il check-in online. Telefono e note sono facoltativi. I documenti e i dati di tutti gli ospiti li compila l'ospite con il check-in online.
5. Passo **Prezzo**: il prezzo lo calcola CasaZen dalle impostazioni dell'immobile (notti, pulizia, tassa di soggiorno). Cambia il «Totale della prenotazione» solo se hai concordato un altro prezzo; con «Torna al prezzo calcolato» annulli la modifica. La tassa di soggiorno resta quella calcolata.
6. Passo **Pagamento** (non c'è se stai completando una prenotazione di un portale): scegli «Link di pagamento» (l'ospite paga online con carta e l'incasso si registra da solo), «Bonifico» o «Paga in struttura» (in questi due casi segni tu l'incasso).
7. Passo **Riepilogo**: leggi «Cosa succede quando crei la prenotazione» e premi «Crea la prenotazione».
8. Nella schermata finale vedi che cosa è andato a buon fine e cosa resta da fare. Con «Crea e invia il link» mandi il link di pagamento. Con «Apri la prenotazione» passi alla scheda.

Cosa succede dopo: le notti risultano occupate sul calendario, sul sito di prenotazione e nel calendario iCal che i portali leggono. Pochi giorni prima dell'arrivo l'ospite riceve per email il link per il check-in online. Se l'immobile è collegato al channel manager, la prenotazione viene creata anche lì e chiude le date sugli altri canali: se questo non riesce, la schermata finale lo dice e ti offre «Riprova l'invio».
> **Attenzione:** se il pagamento lo incassa il portale, non registrare l'incasso anche in CasaZen: lo conteremmo due volte nei tuoi ricavi.
> **Nota:** la bozza si salva da sola: se esci, ritrovi quello che avevi scritto.

### Rispondere a una richiesta di prenotazione
Una richiesta arriva dal tuo sito quando l'ospite sceglie «Paga in struttura». Serve poter modificare «Prenotazioni e calendario».
1. Apri **Affitti brevi › Prenotazioni › Da confermare**. Ogni richiesta dice «Rispondi entro» la data e l'ora.
2. Per accettare premi «Accetta» sulla riga, oppure apri la scheda e usa il pulsante di conferma in «Cosa succede ora». La prenotazione diventa **Confermata**.
3. Per rifiutare scegli «Rifiuta la richiesta» dal menu della riga. Puoi scrivere un «Messaggio all'ospite (facoltativo)» e poi premere «Conferma rifiuto». L'ospite riceve un'email e le date tornano libere.

Una richiesta compare qui solo dopo che l'ospite ha confermato la sua email, con il link dell'email «richiesta ricevuta» (una pagina pubblica del tuo sito di prenotazione). Finché non lo fa vedi «Attesa conferma email ospite». Se non rispondi in tempo la richiesta scade: l'ospite non ha la prenotazione e le date tornano disponibili. Il rifiuto e la scadenza non si possono annullare.

### Leggere la scheda di una prenotazione
Apri la prenotazione dall'elenco o dal calendario. In alto trovi il nome dell'ospite, l'immobile, le date, lo stato e il blocco «Cosa succede ora» con il pulsante giusto (per esempio «Registra l'arrivo di …»). Il blocco dice anche se «Tocca a te» o «Tocca all'ospite».
- **Soggiorno**: immobile, date, ospiti, richieste speciali, contatti, richieste ai fornitori (per esempio «Richiedi le pulizie»), recensioni di quel soggiorno e, su attivazione, i messaggi programmati.
- **Messaggi**: la conversazione con l'ospite (solo per le prenotazioni del tuo sito, confermate; si chiude 7 giorni dopo la partenza). Vedi [[messaggi-recensioni]].
- **Check-in online**: stato del link, dati e documenti dell'ospite, Alloggiati Web. Vedi [[ospiti-checkin]].
- **Pagamento**: prezzo diviso in soggiorno, pulizia e tassa di soggiorno, totale, stato e importo incassato, «Resta da incassare», il pulsante «Registra incasso» e l'elenco degli incassi. Vedi [[incassi]].
- Dal menu della scheda: «Portale ospiti» (su attivazione), «Cronologia», «Modifica prenotazione», «Apri l'immobile», «Apri il calendario», «Annulla prenotazione».

### Registrare l'arrivo di un ospite
Con le impostazioni iniziali lo fa CasaZen alla fine del giorno di arrivo. Se vuoi farlo tu:
1. Apri la prenotazione (stato «Confermata») dal giorno di arrivo al giorno di partenza.
2. Premi «Registra arrivo» sulla riga o nella scheda e conferma.
3. CasaZen ti dice se i dati degli ospiti per Alloggiati Web sono completi. Se mancano puoi registrare l'arrivo lo stesso e completarli subito dopo con «Completa i dati degli ospiti».

La prenotazione passa a «Check-in effettuato». Se registri l'arrivo dopo il giorno previsto, il termine per Alloggiati Web resta calcolato dal giorno di check-in. Se l'ospite non arriva, segnalalo dal check-in guidato con «L'ospite non è arrivato»: vedi [[ospiti-checkin]].

### Modificare una prenotazione
1. Apri la prenotazione e scegli «Modifica prenotazione» dal menu. Se la voce non c'è, la prenotazione non si può modificare da CasaZen (vedi «Regole e limiti»).
2. Cambia date, numero di ospiti e minori, oppure le note. Il prezzo viene ricalcolato, tassa di soggiorno compresa.
3. Per una prenotazione del tuo sito già pagata si apre «Controlla prima di salvare»: ti dice il nuovo totale e che cosa succede ai soldi (rimborso sulla carta, addebito sulla carta salvata, link di pagamento per la differenza, oppure niente). Finché non premi «Conferma e salva» non è salvato nulla.
4. Se l'immobile è collegato al channel manager, la modifica parte anche lì. La pagina ti dice a che punto è; se non è arrivata premi «Riprova ora». Se nel channel manager la prenotazione è stata cambiata, scegli «Tieni la versione di CasaZen» oppure «Usa la versione del channel manager».

Se i soldi si muovono serve anche il permesso di gestire i pagamenti; per cambiare solo le note basta quello delle prenotazioni. Se nuove date si sovrappongono a un altro soggiorno o a un blocco, il salvataggio è rifiutato.

### Annullare una prenotazione
Serve poter modificare «Prenotazioni e calendario». L'annullamento non si può disfare.
1. Dalla riga o dalla scheda scegli «Annulla prenotazione».
2. Leggi cosa succede: CasaZen calcola quanto l'ospite ha pagato con carta, quanto è già stato rimborsato e se c'è un pagamento non completato (che viene annullato, così l'ospite non può più pagare).
3. Scrivi, se vuoi, il «Motivo (visibile solo a te)».
4. Premi «Annulla prenotazione». L'ospite riceve un'email di annullamento, senza il motivo. Le date tornano disponibili.

Quando annulli tu una prenotazione pagata online, CasaZen rimborsa all'ospite tutto ciò che ha pagato con carta. Un rimborso risulta fatto solo quando lo conferma il servizio di pagamento: fino ad allora lo vedi «in attesa». Gli importi pagati fuori da CasaZen (contanti, bonifico) non vengono restituiti da CasaZen: ti dice quanto resta da rimborsare e lo gestisci tu.
Per una prenotazione di un portale la finestra è diversa: «Chiedi al tuo channel manager di annullare questa prenotazione». Premi «Chiedi l'annullamento»: la prenotazione risulta annullata in CasaZen solo quando il channel manager conferma. Da CasaZen non si muove nessun pagamento. Se il portale non lo permette, trovi la frase che dice come fare (di solito: l'ospite annulla sul portale).

### Controllare un soggiorno da verificare
Quando il calendario del portale collegato non mostra più la prenotazione, o mostra date diverse, il soggiorno compare con «Da verificare» (elenco) e con il riquadro «Soggiorno da verificare» (scheda). CasaZen non modifica né cancella nulla: le date restano occupate.
1. Apri la prenotazione e leggi il riquadro (rimossa dal calendario, oppure date cambiate).
2. Controlla sul portale. Se la prenotazione è stata cancellata, annulla il soggiorno in CasaZen.
3. Se il portale ha date nuove giuste, premi «Applica le date del canale». Altrimenti premi «Segna come verificato».

### Aprire e leggere il calendario
1. Apri **Affitti brevi › Calendario**.
2. Scegli la vista (Timeline, Mese, Settimana, Giorno), il periodo e, se vuoi, un solo immobile. Con una sola scelta nell'indirizzo puoi condividere o salvare la vista.
3. Premi su un soggiorno per vederne il riepilogo e aprire la scheda. Premi su un blocco per leggerne il motivo.
4. Se nella Timeline compare «date occupate due volte», due soggiorni si sovrappongono: aprili e decidi quale tenere.
5. Sopra il calendario trovi «Ultime modifiche»: le variazioni di prezzo, restrizioni e blocchi mandate al channel manager, con il loro stato («Salvata in CasaZen», «In invio», «Accettata dal tuo channel manager», «Non inviata»). Dove non sono partite premi «Riprova».

Se non hai immobili, il calendario ti porta a «Vai alle proprietà» per crearne uno.

### Bloccare delle date
Serve il permesso di modifica degli immobili.
1. Nel calendario premi «Blocca date», oppure seleziona i giorni direttamente sul calendario e premi «Blocca».
2. Scegli «Dalla notte del» e «Di nuovo libero dal» (il primo giorno di nuovo prenotabile, come il giorno di partenza di un soggiorno).
3. Scegli il «Motivo»: «Soggiorno del proprietario», «Manutenzione» o «Altro motivo». Aggiungi una nota se vuoi: la vedi solo tu.
4. Premi «Blocca date».

Le notti non sono più prenotabili sul sito e risultano occupate sui canali che leggono il tuo calendario. Non puoi bloccare giorni già passati né notti già occupate da una prenotazione o da un altro blocco. Per toglierlo apri il blocco e premi «Elimina blocco»: le notti tornano prenotabili.

### Creare un soggiorno da un blocco di un altro canale
Un blocco «Date bloccate su …» arriva da un calendario iCal collegato: sono date occupate su un altro canale, senza i dati dell'ospite. Se è una prenotazione ricevuta su un portale, puoi farla diventare un soggiorno per mandare il link del check-in e gestire Alloggiati Web.
1. Nel calendario apri il blocco.
2. Premi «Crea soggiorno OTA».
3. Scrivi «Nome ospite», «Cognome ospite» ed «Email ospite» (il link del check-in viene mandato a quell'indirizzo). Scegli il «Canale della prenotazione». Numero di ospiti e importo sono facoltativi.
4. Premi «Crea soggiorno». Poi usa «Apri il soggiorno».

Non si può creare un soggiorno da un blocco già terminato.

### Scegliere cosa fa CasaZen da solo
Serve essere amministratore dell'organizzazione: gli altri vedono la pagina ma non la cambiano.
1. Apri **Affitti brevi › Prenotazioni › Flusso**.
2. Per ogni passaggio scegli «In automatico» (lo fa CasaZen) o «Lo fai tu»: «Link del check-in online», «Arrivo», «Partenza», «Casa pronta per il prossimo ospite».
3. Per il link scegli «Giorni prima dell'arrivo» (da 0 a 7). Per «Casa pronta» scegli «Quando la pulizia è fatta» o «Al check-out».
4. Premi «Salva il flusso».

I passaggi che lasci in automatico non finiscono più nella tua lista «Da fare». «Conferma» è sempre automatica per i portali e per i pagamenti online; «Dati degli ospiti» li inserisce l'ospite; la comunicazione ad Alloggiati Web è sempre tua; la pulizia si imposta su ogni immobile.

## Flussi completi

### Flusso: prenotazione dal tuo sito, dalla richiesta alla recensione
1. L'ospite sceglie date e immobile sul tuo sito ([[sito-prenotazione]]). Se paga con carta la prenotazione è **Confermata** da sola; se sceglie «Paga in struttura» diventa una richiesta.
2. Per una richiesta: l'ospite conferma l'email, tu rispondi dentro il tempo indicato ([[prenotazioni#rispondere-a-una-richiesta-di-prenotazione]]).
3. Pochi giorni prima dell'arrivo CasaZen manda il link per il check-in online; l'ospite compila i dati ([[ospiti-checkin#il-check-in-online-dal-lato-del-gestore]]).
4. Controlli i dati degli ospiti e prepari la comunicazione ad Alloggiati Web ([[alloggiati-istat]]).
5. Alla fine del giorno di arrivo CasaZen registra l'arrivo (o lo registri tu). Se l'ospite non arriva, segni il no-show.
6. Durante il soggiorno rispondi ai messaggi ([[messaggi-recensioni]]).
7. Alla partenza CasaZen registra il check-out; la casa viene dichiarata pronta dopo la pulizia. Tassa di soggiorno e documenti: [[imposta-soggiorno-documenti]].
8. Dopo la partenza chiedi la recensione all'ospite ([[messaggi-recensioni#chiedere-una-recensione-a-un-ospite]]) e controlli gli incassi ([[incassi]]).

### Flusso: prenotazione da un portale
1. La prenotazione arriva dal channel manager già confermata, con l'icona del canale e il segno «OTA» ([[canali-octorate]]).
2. L'incasso lo fa il portale: tu controlli gli «Importi del canale».
3. CasaZen manda il link per il check-in online (per email o nella chat del portale, se il canale lo permette). Se non riesce, la scheda dice perché e ti offre «Copia link» per mandarlo tu.
4. Se l'ospite cambia o cancella sul portale, il soggiorno compare «Da verificare»: lo controlli come descritto sopra.

### Flusso: prenotazione presa per telefono
1. Crei la prenotazione manuale ([[prenotazioni#creare-una-prenotazione-manuale]]) e scegli come pagherà l'ospite.
2. L'ospite riceve il link di pagamento (se lo hai scelto) e, prima dell'arrivo, il link per il check-in online.
3. Se paga con bonifico o in struttura, a incasso avvenuto premi «Registra incasso» nella scheda «Pagamento».

## Regole e limiti
- **Richieste «Paga in struttura»**: al massimo 30 notti; l'ospite ha 30 minuti per confermare l'email; dopo la conferma hai 24 ore per rispondere; poi la richiesta scade. Finché è in attesa, le date sono tenute da parte sul sito e nel calendario e risultano occupate anche sui portali che leggono il tuo calendario iCal.
- **Pagamento online**: l'ospite ha 30 minuti per completare; poi la prenotazione scade e le date tornano libere.
- **Nuova prenotazione manuale**: l'arrivo non può essere già passato; la partenza è dopo l'arrivo; massimo 366 notti; gli ospiti non possono superare la capienza dell'immobile. Sotto il soggiorno minimo dell'immobile puoi procedere: la prenotazione la inserisci tu.
- **Link per il check-in online**: parte 3 giorni prima dell'arrivo (da 0 a 7, lo scegli in «Flusso») e vale 7 giorni. Un nuovo link sostituisce quello di prima, che smette di funzionare.
- **Registrazione automatica di arrivo e partenza**: CasaZen controlla ogni ora e agisce solo sui soggiorni degli ultimi 3 giorni, per non chiudere in un colpo soggiorni vecchi.
- **Registra arrivo**: possibile dal giorno di check-in al giorno di partenza (ora italiana).
- **Modifica di date e ospiti**: solo per le prenotazioni inserite da te e per quelle confermate del tuo sito, prima dell'arrivo. Non si cambiano una prenotazione già iniziata, una annullata, una richiesta in attesa e una arrivata da un portale (per quelle lo chiede l'ospite sul portale). Le note si cambiano comunque. Per una prenotazione senza modifica possibile la scheda ti dice cosa fare.
- **Annullamento**: possibile per prenotazioni «In attesa», «Confermata» e «Check-in effettuato». Non per una già annullata o già conclusa. Quando annulli tu, il rimborso delle somme pagate con carta è totale.
- **Messaggi con l'ospite**: la conversazione si chiude 7 giorni dopo la partenza.
- **Permessi**: leggere prenotazioni e calendario è consentito anche a chi ha la sola lettura (per esempio il commercialista). Per accettare, modificare, annullare, registrare arrivo e partenza serve poter modificare «Prenotazioni e calendario». Bloccare date e cambiare prezzi dal calendario richiede il permesso di modifica degli immobili. I movimenti di denaro richiedono anche il permesso di gestire i pagamenti.
- Un collaboratore con accesso solo ad alcuni immobili vede solo le loro prenotazioni.

## Domande frequenti

### Posso riaprire una prenotazione annullata?
No. Crei una nuova prenotazione manuale per le stesse date, se sono ancora libere.

### Perché non vedo «Modifica prenotazione»?
La prenotazione è già iniziata, è annullata, è una richiesta in attesa oppure arriva da un portale. Per un portale chiedi all'ospite di cambiare sul portale: la scheda ti dice con quali parole.

### Ho una prenotazione in attesa che non vedo in «Da confermare». Perché?
Una richiesta compare in «Da confermare» solo dopo che l'ospite ha confermato la sua email. Prima la vedi come «Attesa conferma email ospite».

### Le date risultano occupate due volte. Cosa faccio?
Apri i due soggiorni dalla Timeline e decidi quale tenere. Se una è di un portale e non è più valida, annullala dal portale o con «Chiedi l'annullamento».

### Cosa succede se cambio le date di una prenotazione già pagata?
CasaZen ricalcola il prezzo e, prima di salvare, ti mostra se rimborsa l'ospite, addebita la differenza sulla carta salvata o gli manda un link di pagamento. Se hai ricevuto parte del pagamento fuori da CasaZen, ti dice quanto devi restituire tu.

### Dove vedo se l'ospite ha compilato il check-in online?
Nell'elenco usa il filtro «Check-in online» (per esempio «Documenti ricevuti» o «In attesa dell'ospite») oppure apri la scheda «Check-in online» della prenotazione.

### Una prenotazione di un portale può essere cancellata da CasaZen?
Solo dove il portale lo permette, tramite il tuo channel manager («Chiedi l'annullamento»). Altrimenti la cancella l'ospite sul portale.

## Glossario
- **Canale**: da dove arriva la prenotazione (il tuo sito, un portale, tu).
- **Channel manager**: il programma che collega CasaZen ai portali (Octorate). Vedi [[canali-octorate]].
- **Check-in online**: il modulo con i dati e i documenti che l'ospite compila prima di arrivare.
- **Check-in effettuato**: stato della prenotazione quando l'arrivo è registrato.
- **iCal**: un calendario condiviso tra programmi; un blocco iCal mostra solo date occupate, senza dati dell'ospite.
- **No-show**: l'ospite che non si presenta.
- **OTA**: portale di prenotazione (Airbnb, Booking.com…).
- **Richiesta**: prenotazione del tuo sito con «Paga in struttura», valida solo se la accetti.

## Vedi anche
- [[ospiti-checkin]]: il check-in online dell'ospite e l'anagrafica.
- [[messaggi-recensioni]]: scrivere agli ospiti e rispondere alle recensioni.
- [[incassi]]: registrare incassi e rimborsi.
- [[prezzi-tariffe]]: prezzi e restrizioni per notte dal calendario.
- [[canali-octorate]]: collegare i portali.
- [[alloggiati-istat]]: comunicazione degli ospiti alla Questura.
