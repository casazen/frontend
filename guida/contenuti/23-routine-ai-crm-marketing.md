---
id: routine-ai-crm
titolo: Routine AI, CRM e marketing
sezione: Affitti brevi
ordine: 23
riassunto: Le routine fanno da sole cose ripetitive (messaggi, pulizie, promemoria, richieste di recensione) e le puoi provare in simulazione prima di attivarle. Il CRM raccoglie i profili degli ospiti, i duplicati, i pubblici e le campagne email. Entrambi i moduli sono spenti di partenza e si attivano su richiesta.
chi: [gestore, amministratore]
dove: Affitti brevi › Routine AI · Affitti brevi › CRM Ospiti
parole_chiave: [routine, automazioni, AI Agents, simulazione, modalità test, registro, CRM, profili ospiti, tag, duplicati, pubblici, segmento, campagne, campagna e-mail, newsletter, marketing, consenso marketing, disiscrizione, codice di accesso, pulizia al check-out, promemoria documenti]
copre: [/app/short-rent/automations, /app/short-rent/crm/guests, /app/short-rent/crm/guests/:id, /app/short-rent/crm/segments, /app/short-rent/crm/campaigns, /app/short-rent/crm/merge]
stato: su-attivazione
fonte_codice: [frontend/src/pages/RoutinesPage.tsx, frontend/src/components/routines/RoutineEditor.tsx, frontend/src/components/routines/RoutineLibrary.tsx, frontend/src/pages/crm/GuestList.tsx, frontend/src/pages/crm/GuestDetail.tsx, frontend/src/pages/SegmentsPage.tsx, frontend/src/pages/CampaignsPage.tsx, frontend/src/features/crm/merge/merge-page.tsx, backend/Casazen.Web/Controllers/RoutinesController.cs, backend/Casazen.Web/Controllers/CrmController.cs, backend/Casazen.Web/Controllers/CampaignsController.cs, backend/Casazen.Infrastructure/Services/CampaignService.cs, backend/Casazen.Infrastructure/Services/RoutineBookingActions.cs, backend/Casazen.Infrastructure/Services/AccessCodeService.cs, backend/Casazen.Core/Services/RoutineActionCatalog.cs, backend/Casazen.Core/Services/CommercialSignup.cs]
---

## In breve
**Routine AI** ti permette di dire a CasaZen «quando succede questo, fai quest'altro»: per esempio mandare le istruzioni d'arrivo due giorni prima, creare la pulizia al check-out o chiedere la recensione. Ogni routine si prova prima su una prenotazione vera, in simulazione. **CRM Ospiti** mostra i profili degli ospiti con soggiorni, spesa e possibilità di scrivergli, ti aiuta a unire i duplicati e prepara pubblici e campagne email.

**Entrambi sono su attivazione** ([[per-iniziare#cosa-significa-su-attivazione]]): di partenza sono spenti e, se non sono attivi per la tua organizzazione, le voci di menu non compaiono. Il CRM è in fase di rifinitura: quello che trovi funziona, ma l'invio c'è solo per email (non per WhatsApp né per telefono). Se ti servono, scrivi all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza».

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Libreria di modelli | Quattro routine pronte: pulizia al check-out, promemoria documenti, istruzioni prima dell'arrivo, richiesta di recensione | Routine AI › «Apri la libreria» | gestore, amministratore | Su attivazione | Creare una routine da un modello |
| Nuova routine | Scegli evento, momento, condizioni e azioni | Routine AI › «Nuova routine» | gestore, amministratore | Su attivazione | Creare una routine su misura |
| Prova su una prenotazione | Simula la routine su un soggiorno reale senza fare nulla | Routine › «Prova su una prenotazione» | gestore, amministratore | Su attivazione | Provare una routine prima di attivarla |
| Attiva, pausa, modalità test | Decidi se la routine esegue azioni reali, simulate o nessuna | Scheda della routine | gestore, amministratore | Su attivazione | Attivare o mettere in pausa una routine |
| Registro delle esecuzioni | Cosa ha fatto la routine, soggiorno per soggiorno | Routine › «Registro» | gestore, amministratore | Su attivazione | Leggere il registro delle esecuzioni |
| Elenco profili ospiti | Ospiti con soggiorni, spesa, canali, tag e raggiungibilità | CRM Ospiti | gestore, amministratore | Su attivazione | Trovare un ospite nel CRM |
| Profilo ospite | Totali, come viaggia, storico, tag e contatti | CRM Ospiti › nome | gestore, amministratore | Su attivazione | Trovare un ospite nel CRM |
| Tag | Parole tue per ritrovare gli ospiti | Profilo ospite | gestore, amministratore | Su attivazione | Aggiungere tag a un ospite |
| Duplicati | Propone di unire profili della stessa persona | CRM Ospiti › «Duplicati» | gestore, amministratore | Su attivazione | Unire due profili duplicati |
| Pubblici | Gruppi di ospiti da raggiungere con una campagna | CRM Ospiti › «Pubblici» | gestore, amministratore | Su attivazione | Creare un pubblico |
| Campagne | Email di marketing agli ospiti, con approvazione e rapporto | CRM Ospiti › «Campagne» | gestore, amministratore | Su attivazione | Creare e mandare una campagna |

## Come funziona

### Cosa è attivo e cosa no
- **Routine AI.** Di partenza è spenta. Per usarla servono due cose: che CasaZen la abiliti e che il modulo «AI Agents» sia nella tua offerta. Se non vedi «Routine AI» nel menu, o la pagina dice «Le automazioni non sono disponibili in questo momento», non è attiva: chiedine l'attivazione all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»). Il modulo si aggiunge da Amministrazione con «Gestisci piano e moduli» ([[account-team-piano]]).
- **CRM Ospiti.** Di partenza è spento. È in fase di rifinitura: quello che trovi funziona (elenco e profili, tag, unione dei duplicati, pubblici, campagne email con approvazione, programmazione e rapporto). Per mandare una campagna serve anche il modulo «CRM e Marketing» nella tua offerta.
- **Cosa non c'è.** Non c'è l'invio su WhatsApp né per telefono o SMS: l'ospite può dare il consenso a questi canali, ma CasaZen per ora scrive solo per email.

### Le routine
Una routine è fatta da: un **evento** (quando parte), un eventuale **momento** (per esempio «2 giorni prima del check-in»), delle **condizioni** (a quali prenotazioni si applica) e delle **azioni** (cosa fa). Ci sono eventi come «Prima del check-in», «Dopo il check-out», «Nuova prenotazione», «Prenotazione confermata», «Prenotazione annullata», «Check-in online completato», «Pagamento riuscito», «Messaggio ospite ricevuto», «Recensione ricevuta» e «Ricorrenza settimanale».

**Cosa possono fare.** Le azioni sono: «Invia messaggio all'ospite», «Invia codice di accesso», «Richiedi recensione», «Crea la pulizia», «Crea un promemoria manuale», «Notifica proprietario», «Notifica staff», «Notifica team», «Attendi» (ore o giorni, poi le azioni dopo continuano) e «Aggiungi tag» (solo se è attivo il CRM). Se descrivi a parole una singola operazione («Organizza la pulizia con chi pulisce già la casa»), «Trova operazione» ti propone l'azione giusta.

**«Invia messaggio all'ospite» vuole un modello.** L'azione manda un testo scelto tra i «Modello messaggio» presenti nella tua organizzazione. In questa versione l'app non ha una pagina per creare nuovi modelli di messaggio: se la lista è vuota, la routine con un messaggio resta in prova (modalità test) e non puoi attivare l'invio vero («Scegli un modello nella routine prima di attivare l'invio»). Vedi [[messaggi-recensioni#i-modelli-di-messaggio]].

**«Invia codice di accesso» non apre serrature.** CasaZen non crea né revoca codici: manda per e-mail all'ospite il codice che hai scritto tu nell'immobile, e solo se la verifica dell'identità dell'ospite è riuscita (su attivazione: [[ospiti-checkin#il-codice-della-serratura-cosa-manda-casazen-e-cosa-no]]), il soggiorno è in arrivo o in corso e l'ospite ha un'e-mail. Se non lo è, l'azione risulta «Bloccata» nel registro («Il codice di accesso parte solo dopo la verifica dell'identità dell'ospite»). Senza verifica dell'identità non parte nessun codice: dai tu l'accesso all'ospite.

**Condizioni.** Puoi limitare la routine per «Immobile», «Canale della prenotazione», «Numero di ospiti», «Notti del soggiorno» e «Giorni tra la prenotazione e l'arrivo» (non vale per i portali: per loro il dato non è noto e la regola non scatta mai). Le condizioni possono essere «tutte vere» oppure «almeno una vera». Senza condizioni la routine parte per ogni prenotazione. In più c'è una **condizione AI** facoltativa, scritta a parole (per esempio «Solo per soggiorni di almeno tre notti»): l'AI guarda canale, stato, numero di ospiti e notti. Se i dati non bastano per decidere, l'azione resta sospesa; se il servizio AI non è disponibile, l'azione non parte.

**Tre stati.**
- **In pausa**: non fa nulla. Ogni routine nuova nasce in pausa.
- **Attiva in simulazione** (scheda «Test»): fa finta. Scrive nel registro cosa farebbe, ma non manda messaggi, non crea pulizie, non cambia nulla.
- **Attiva · azioni reali**: fa davvero le azioni. Per passare ad azioni reali CasaZen chiede conferma («Attivare le azioni reali?»).

**Cosa succede dopo, e si può annullare?** Un messaggio mandato, una pulizia creata o una richiesta di recensione partita **non si ritirano**. Per questo conviene provare prima in simulazione. Spegnere una routine ferma solo le esecuzioni future; se una routine è in attesa e la spegni, non va avanti.

**Dove agiscono.** Le routine valgono per tutta l'organizzazione. Per salvarle e provarle serve poter modificare gli immobili e avere accesso a tutti: chi vede solo alcuni immobili non le vede.

**Modulo aggiuntivo.** «AI Agents» è un componente della tua offerta («Agenti preimpostati e personalizzati per gestire soggiorni, organizzare pulizie e comunicare con gli ospiti in autonomia»). Se non è attivo, la pagina dice «Le automazioni non sono disponibili in questo momento».

**Messaggi programmati.** I messaggi che una routine manderà a un soggiorno compaiono, con orario e stato, nella scheda «Soggiorno» della prenotazione ([[messaggi-recensioni#i-messaggi-programmati]]).

### Il CRM Ospiti
Il CRM costruisce un **profilo** per ogni ospite che ha soggiornato nei tuoi immobili: soggiorni, spesa, canali di prenotazione, recensioni, come viaggia (da solo, in coppia, in famiglia, in gruppo), tag e contatti. Vedi solo gli ospiti dei soggiorni negli immobili a cui hai accesso.

**Raggiungibilità: cosa puoi scrivere a chi.** Ogni profilo ha uno stato che dice se puoi scrivergli per novità e offerte:
- **Raggiungibile, con consenso**: l'ospite ha dato il consenso e ha confermato l'email.
- **Raggiungibile, cliente diretto**: ha prenotato direttamente da te; puoi proporgli servizi simili a quelli già acquistati, e ogni messaggio ha il link per annullare l'iscrizione.
- **Da confermare**: ha dato il consenso ma non ha ancora confermato l'indirizzo: per ora non puoi scrivergli.
- **Solo servizio**: puoi scrivergli solo per il soggiorno (conferme, istruzioni di arrivo, fattura). È il caso degli indirizzi dei portali.
- **Iscrizione annullata**: ha chiesto di non ricevere più email promozionali.
- **Nessun contatto**: non c'è un indirizzo utilizzabile.

**Il consenso al marketing.** Lo dà l'ospite nel check-in online ([[ospiti-checkin]]): è facoltativo e non blocca il check-in. Tu non lo puoi dare al suo posto: puoi solo registrarne la revoca su sua richiesta, dalla sua scheda «Privacy». Una campagna parte solo per chi ha il consenso (o è «cliente diretto») e un indirizzo utilizzabile.

**Cosa è disponibile e cosa no.** Elenco e profili, tag, unione dei duplicati, pubblici, campagne email con approvazione, programmazione e rapporto funzionano. **Non c'è** l'invio su altri canali (WhatsApp, telefono): CasaZen per ora scrive solo per email. L'invio di una campagna richiede anche che il modulo sia compreso nella tua offerta («CRM e Marketing»).

### I duplicati
CasaZen accosta due profili che potrebbero essere la stessa persona (stessa email, stesso telefono, stesso nome con la stessa data di nascita, stesso nome nello stesso immobile). **Non unisce mai nulla da solo**: decidi tu.

### I pubblici e le campagne
Un **pubblico** è un gruppo di ospiti scelto con regole (per esempio «ha soggiornato almeno 2 volte»), con l'anteprima di quanti sono. Nel menu si chiama «Pubblici», ma i pulsanti e i campi lo chiamano anche «segmento» («Crea segmento», «Nome del segmento»): è la stessa cosa. Una **campagna** è un'email a un pubblico. Il percorso è: Bozza → In attesa di approvazione → Approvata → Programmata → Invio in corso → Inviata (o Fallita). Una campagna passa da «Da approvare» (Cruscotto: [[cruscotto-notifiche-assistente]]) prima di partire.

Quando una campagna parte:
- si rivalutano i destinatari al momento dell'invio;
- si saltano gli ospiti che hanno annullato l'iscrizione o non sono raggiungibili;
- ogni email ha il link per annullare l'iscrizione;
- c'è un limite mensile di email per ogni ospite (2 al mese, se non lo cambia l'organizzazione);
- se il modulo viene spento prima dell'invio, la campagna programmata torna «Approvata» e non parte.

## Come fare

### Creare una routine da un modello
**Ti serve:** Routine AI attiva (modulo «AI Agents»); il permesso di modificare gli immobili, con accesso a tutti; per le routine con un messaggio, almeno un modello di messaggio presente; per «Pulizia al check-out», su ogni immobile chi pulisce, il prezzo e l'ora.
1. Apri **Affitti brevi › Routine AI** e premi «Apri la libreria» («Modelli di routine»).
2. Scegli un modello: «Pulizia al check-out», «Promemoria documenti prima dell'arrivo», «Istruzioni prima dell'arrivo» o «Richiesta di recensione».
3. Controlla l'evento e il momento, e personalizza le azioni. Dove serve scegli il modello del messaggio («Modello messaggio»); se non ce ne sono, vedi «Invia messaggio all'ospite vuole un modello».
4. Premi «Salva in pausa». Se il modello contiene azioni non ancora disponibili puoi solo «Crea in modalità test».
5. Per «Pulizia al check-out» servono prima, su ogni immobile, chi pulisce, il prezzo e l'ora: premi «Imposta chi pulisce». Gli immobili senza chi pulisce restano come prima.

La routine nasce **in pausa**: non fa nulla finché non la attivi.
> **Attenzione:** il promemoria documenti arriva a tutti gli ospiti, anche a chi li ha già mandati: le routine non controllano ancora se l'ospite ha già mandato i documenti.

### Creare una routine su misura
**Ti serve:** Routine AI attiva e il permesso di modificare gli immobili.
1. Premi «Nuova routine».
2. Scrivi il «Nome» (per esempio «Invia istruzioni 2 giorni prima») e scegli il «Tipo di evento».
3. In «Temporizzazione» scegli quando parte («2 giorni prima del check-in», «All'ora dell'evento»…).
4. In «Condizioni» aggiungi quelle che servono («Aggiungi una condizione»), oppure lasciale vuote.
5. In «Azioni» scegli «Aggiungi azione» e configurala. Puoi metterne più di una: vengono eseguite nell'ordine che scegli, e con «Attendi» puoi mettere una pausa tra l'una e l'altra.
6. Premi «Crea routine».

Puoi avere al massimo 50 routine. Se premi «Crea e attiva la routine» parte subito con azioni reali: di solito conviene prima provare.

### Provare una routine prima di attivarla
**Ti serve:** una routine già creata e almeno una prenotazione su cui provarla.
1. Sulla scheda della routine premi «Prova su una prenotazione».
2. Cerca per codice o ospite («Cerca per codice o ospite», «Cerca») e scegli una prenotazione.
3. Premi «Simula con questi dati».
4. Leggi il «Risultato della prova»: se la prenotazione soddisfa le condizioni, vedi le azioni previste; se ne manca una (dato mancante, azione bloccata) lo dice.

La prova lascia invariati la prenotazione e lo stato della routine.

### Attivare o mettere in pausa una routine
1. Nell'elenco usa le schede «Attive», «Inattive» e «Test».
2. Per passare a azioni reali scegli «Passa alle azioni reali» e conferma «Conferma attivazione». **Da lì messaggi, pulizie e richieste di recensione partono davvero e non si ritirano.**
3. Per tornare a provare scegli «Passa alla simulazione».
4. Per fermarla usa l'interruttore «Attiva». Un messaggio di conferma dice «Routine disattivata».
5. Per cancellare una routine premi «Elimina» e conferma: si cancella anche il suo registro. Non si può annullare.

Una routine con azioni non ancora disponibili si può provare in simulazione ma non attivare.

### Leggere il registro delle esecuzioni
1. Sulla scheda della routine premi «Registro».
2. Per ogni esecuzione vedi l'esito: «Completata», «Simulata», «In attesa» (con «Riprende il …»), «Bloccata», «Non riuscita», «Nulla da fare» o «In corso».
3. Aprila per vedere le singole azioni («Eseguita», «Simulata: non è stato fatto nulla», «Saltata», «Bloccata», «Non riuscita») e il perché: per esempio «Il codice di accesso parte solo dopo la verifica dell'identità dell'ospite», «Questo immobile non ha chi pulisce» o «L'invito per questa prenotazione è già stato inviato».

Il registro mostra le ultime esecuzioni.

### Trovare un ospite nel CRM
**Ti serve:** CRM Ospiti attivo e il permesso di leggere gli ospiti. I profili arrivano dalle prenotazioni: un ospite compare dopo il primo soggiorno concluso.
1. Apri **Affitti brevi › CRM Ospiti**.
2. Scrivi nel campo «Cerca un ospite» (parte del nome, oppure email o telefono interi).
3. Restringi con «Filtri»: «Prenotato su», «Lingua», «Paese» (codice a due lettere, per esempio IT), «Tag», «Raggiungibile via e-mail», «Soggiorni» (almeno N). Ordina per «Ultimo soggiorno», «Nome (A-Z)», «Spesa più alta» o «Più soggiorni».
4. Premi sul nome per aprire il profilo: «In breve» (soggiorni, spesa totale e media, anticipo medio), «Come viaggia», «Dove prenota», «Immobili», «Recensioni», «Storico dei soggiorni» e «Contatti».

### Aggiungere tag a un ospite
**Ti serve:** il permesso di modificare gli ospiti.
1. Apri il profilo dell'ospite.
2. Nel riquadro «Tag» scrivi il tag (per esempio «VIP») e premi «Aggiungi».
3. Per toglierlo premi sulla X del tag.

Fino a 50 tag per ospite, di massimo 40 caratteri. I tag sono tuoi: servono per ritrovare gli ospiti e prepararli per gli invii.

### Chiedere la conferma di un contatto
**Ti serve:** un ospite con il consenso al marketing dato ma non ancora confermato («Da confermare»). Per scrivere per novità e offerte a un ospite con consenso non ancora confermato:
1. Apri il profilo › «Contatti».
2. Sulla riga dell'email premi «Invia la richiesta di conferma».
3. L'ospite riceve un'email per confermare l'iscrizione.

Non puoi rimandare la richiesta dopo pochi minuti, né oltre il numero massimo di richieste a quell'indirizzo, né a chi ha chiesto di non ricevere più email.

### Unire due profili duplicati
**Ti serve:** il permesso di modificare gli ospiti.
1. Apri **CRM Ospiti › Duplicati**.
2. Leggi «Perché li abbiamo accostati».
3. Se sono la stessa persona premi «Unisci», scegli quale profilo tenere e premi «Unisci i profili». Lo storico e i contatti dell'altro passano a quello che tieni; nessun consenso cambia. **Non si può annullare.**
4. Se sono persone diverse premi «Non sono la stessa persona» e conferma: la coppia non ti viene più riproposta.

### Creare un pubblico
**Ti serve:** CRM Ospiti attivo e il permesso per il marketing.
1. Apri **CRM Ospiti › Pubblici** e premi «Crea segmento» (un pubblico e un segmento sono la stessa cosa).
2. Scrivi il «Nome del segmento» (per esempio «Ospiti frequenti»).
3. Aggiungi le regole (campo, confronto, valore) e scegli se valgono «tutte» o «almeno una», oppure descrivi il pubblico a parole e lascia che l'AI proponga le regole.
4. Salva, poi premi «Anteprima» per vedere quanti destinatari ci sono.

### Creare e mandare una campagna
**Ti serve:** il permesso per il marketing; il modulo «CRM e Marketing» nella tua offerta; almeno un pubblico; ospiti con il consenso al marketing e un'e-mail utilizzabile.
1. Apri **CRM Ospiti › Campagne** e premi «Crea campagna». Serve almeno un pubblico.
2. Scegli il «Segmento» (cioè il pubblico; vedi i destinatari), scrivi «Oggetto» e «Corpo», oppure premi «Genera con AI».
3. Premi «Salva bozza».
4. Premi «Invia per approvazione». Chi può decidere la approva dal Cruscotto.
5. Dopo l'approvazione premi «Programma invio», scegli «Data» e «Ora» e premi «Programma».
6. Dopo l'invio apri «Visualizza rapporto»: «Inviate», «Aperte», «Cliccate», «Rimbalzate», «Errori», «Disiscrizioni».

**Una campagna inviata non si ritira.** Le email partono solo agli ospiti che hanno dato il consenso e non hanno annullato l'iscrizione.

## Flussi completi

### Flusso: da un evento al messaggio dell'ospite con una routine
1. La prenotazione si conferma ([[prenotazioni]]).
2. La routine «Istruzioni prima dell'arrivo» pianifica un messaggio 2 giorni prima del check-in (serve un modello di messaggio scelto nella routine).
3. Nella prenotazione, «Messaggi programmati» mostra il messaggio. Se manca un dato (per esempio il codice d'accesso) resta «Bloccato» e lo vedi.
4. Prima dell'invio puoi modificarlo, saltarlo o mandarlo subito ([[messaggi-recensioni]]).
5. Il messaggio parte tra le 8:00 e le 21:00 e compare nella conversazione come «Messaggio automatico».

### Flusso: da un ospite a una campagna
1. L'ospite dà il consenso nel check-in online ([[ospiti-checkin]]) e conferma l'indirizzo.
2. Il profilo CRM diventa «Raggiungibile, con consenso».
3. Crei un pubblico e una campagna, la mandi in approvazione e la programmi.
4. CasaZen manda le email e, a ogni email, mette il link per annullare l'iscrizione.

## Regole e limiti
- Routine AI e CRM Ospiti sono spenti di partenza: compaiono solo se attivati per la tua organizzazione.
- Al massimo 50 routine per organizzazione.
- Una routine nasce in pausa; l'attivazione con azioni reali chiede conferma.
- Le routine vedono solo l'organizzazione intera: chi ha accesso a pochi immobili non le gestisce.
- Un messaggio di una routine parte tra le 8:00 e le 21:00 (ora italiana); non viene mandato se l'orario previsto è passato da troppo tempo.
- Le azioni con un messaggio vogliono un modello di messaggio già presente: l'app non ha una pagina per crearne.
- Il codice di accesso parte solo dopo la verifica dell'identità riuscita.
- Campagne: serve il modulo CRM nella tua offerta, destinatari con consenso e indirizzo utilizzabile, link di disiscrizione in ogni email, limite di 2 email al mese per ospite (se non cambiato). Solo email: niente WhatsApp, telefono o SMS.
- Tag: 50 per ospite, 40 caratteri ciascuno.
- Per leggere i profili serve poter leggere gli ospiti; per unire i duplicati e modificare i tag serve poterli modificare; pubblici e campagne richiedono il permesso per il marketing. Titolare e amministratori hanno già tutti i permessi.

## Domande frequenti

### Perché non vedo «Routine AI» o «CRM Ospiti» nel menu?
Perché non sono attivi per la tua organizzazione: sono funzioni su attivazione e di partenza sono spente ([[per-iniziare#cosa-significa-su-attivazione]]). Chiedine l'attivazione all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza». Il modulo («AI Agents», «CRM e Marketing») si aggiunge anche da Amministrazione con «Gestisci piano e moduli».

### La routine non ha mandato il messaggio. Perché?
Apri il «Registro» della routine: per ogni azione c'è il motivo (per esempio modello del messaggio assente, nessuna conversazione, canale che non lo accetta, esecuzione in simulazione).

### Posso provare una routine senza mandare messaggi veri?
Sì: attivala in simulazione («Test»), oppure usa «Prova su una prenotazione».

### Spegnere una routine annulla i messaggi già programmati?
I messaggi non ancora partiti non partono più: nell'elenco della prenotazione il motivo è «La routine è stata spenta o non contiene più questo messaggio».

### Perché un ospite non può ricevere la mia campagna?
Può non avere dato il consenso, non aver confermato l'indirizzo, aver annullato l'iscrizione, avere un indirizzo di un portale (solo servizio), oppure aver già ricevuto il numero massimo di email del mese.

### Il CRM manda messaggi su WhatsApp?
No: per ora le campagne partono solo per email. Non ci sono nemmeno SMS o telefonate.

### La routine «Invia codice di accesso» non manda il codice. Perché?
Il codice parte solo se la verifica dell'identità dell'ospite è riuscita (su attivazione), il soggiorno è in arrivo o in corso e l'ospite ha un'e-mail. CasaZen non apre serrature: manda solo il codice che hai scritto tu nell'immobile. Se non usi la verifica dell'identità, dai tu l'accesso all'ospite ([[ospiti-checkin#il-codice-della-serratura-cosa-manda-casazen-e-cosa-no]]).

## Glossario
- **Azione**: cosa fa una routine (mandare un messaggio, creare una pulizia…).
- **Modalità test (simulazione)**: la routine scrive nel registro cosa farebbe, ma non fa nulla.
- **Pubblico**: gruppo di ospiti scelto con regole (la schermata lo chiama anche «segmento»).
- **Consenso**: il permesso dell'ospite a ricevere novità e offerte.
- **Profilo CRM**: scheda dell'ospite con soggiorni, spesa e contatti.

## Vedi anche
- [[messaggi-recensioni]]: messaggi programmati e richieste di recensione.
- [[ospiti-checkin]]: il consenso marketing dell'ospite e il codice della serratura.
- [[prenotazioni]]: eventi e stati delle prenotazioni.
- [[cruscotto-notifiche-assistente]]: la coda «Da approvare».
- [[account-team-piano]]: moduli e piano dell'organizzazione.
