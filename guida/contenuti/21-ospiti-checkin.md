---
id: ospiti-checkin
titolo: Ospiti e check-in online
sezione: Affitti brevi
ordine: 21
riassunto: L'anagrafica degli ospiti e il check-in online: come l'ospite compila i suoi dati e i documenti con un link, come segui lo stato, come completi tu i dati mancanti e cosa fa CasaZen con questi dati.
chi: [gestore, amministratore, ospite]
dove: Affitti brevi › Prenotazioni › Ospiti · scheda «Check-in online» di una prenotazione
parole_chiave: [ospiti, anagrafica, check-in online, link, documenti, QR, Alloggiati, privacy, GDPR, no-show, tassa di soggiorno, identità]
copre: [/app/short-rent/guests, /app/short-rent/guests/:id, /app/short-rent/bookings/:id/check-in, /checkin/:token, /checkin/porta/:doorToken]
stato: disponibile
fonte_codice: [frontend/src/features/guests/guests-page.tsx, frontend/src/features/guests/guests-list.ts, frontend/src/features/guests/guest-detail-page.tsx, frontend/src/features/guests/components/gdpr-tab.tsx, frontend/src/features/bookings/components/checkin-link-panel.tsx, frontend/src/features/checkin/checkin-page.tsx, frontend/src/features/checkin/wizard/checkin-wizard.tsx, backend/Casazen.Web/Controllers/BookingCheckInLinkController.cs, backend/Casazen.Web/Controllers/PublicGuestCheckInController.cs, backend/Casazen.Web/Controllers/GdprController.cs, backend/Casazen.Web/Controllers/GuestsController.cs, backend/Casazen.Infrastructure/Services/GuestCheckInAccessRules.cs, backend/Casazen.Core/Options/GuestCheckInOptions.cs]
---

## In breve
Il **check-in online** è un modulo che l'ospite compila dal telefono, con un link personale, prima di arrivare: i dati di tutte le persone che soggiornano, il documento di chi fa da capofamiglia o è ospite singolo e qualche consenso. Tu segui lo stato dalla prenotazione e, se mancano dati, li completi con il **check-in guidato**. Gli ospiti sono raccolti nell'elenco **Ospiti**, con una scheda per ognuno. Come questi dati vengono comunicati alla Questura lo spiega [[alloggiati-istat]].

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Elenco ospiti | Cerca per nome o email, apre la scheda, esporta | Prenotazioni › scheda «Ospiti» | gestore, amministratore | Disponibile | Trovare un ospite e leggere la sua scheda |
| Scheda ospite | Soggiorni, dati anagrafici, documenti, privacy | Ospiti › «Dettagli» | gestore, amministratore | Disponibile | Trovare un ospite e leggere la sua scheda |
| Link per il check-in online | Manda o copia il link personale dell'ospite | Prenotazione › scheda «Check-in online» | gestore, amministratore | Disponibile | Mandare il link per il check-in online |
| Stato del check-in online | Link inviato, In compilazione, Completato, Alloggiati inviato, Scaduto | Prenotazione › «Check-in online» | gestore, amministratore | Disponibile | Capire a che punto è il check-in online |
| Check-in guidato | Compili tu i dati degli ospiti, i documenti e la tassa di soggiorno | Prenotazione › «Apri il check-in guidato» | gestore, amministratore | Disponibile | Fare il check-in guidato al posto dell'ospite |
| L'ospite non è arrivato | Segna il no-show | Check-in guidato | gestore, amministratore | Disponibile | Segnare che l'ospite non è arrivato |
| Pagamento della tassa di soggiorno nel check-in | L'ospite paga online la tassa del comune | Check-in dell'ospite | ospite | Su attivazione | Vedi [[imposta-soggiorno-documenti]] |
| Verifica dell'identità con selfie | L'ospite fotografa documento e volto; il codice d'accesso arriva dopo | Check-in dell'ospite | ospite | Su attivazione | Come funziona |
| Check-in all'ingresso con QR | L'ospite apre la pagina del QR della porta e cerca il suo soggiorno | QR dell'immobile | ospite | Su attivazione | Come funziona |
| Esporta, anonimizza, cancella dati | Diritti dell'ospite sui suoi dati, esercitati da te per lui | Scheda ospite › «Privacy» | amministratore (o chi può gestire gli ospiti) | Disponibile | Esportare, anonimizzare o cancellare i dati di un ospite |

## Come funziona

### Il check-in online dal lato del gestore
Per ogni prenotazione confermata CasaZen prepara un **link personale**, con scadenza. L'ospite lo apre dal telefono, senza creare un account.

**Quando si apre.** Il check-in online si apre alcuni giorni prima dell'arrivo (3, se non lo cambi in «Flusso») per le prenotazioni «Confermata» o «Check-in effettuato» non ancora concluse. Si chiude quando l'ospite ha inviato i dati o quando la comunicazione ad Alloggiati Web è già stata fatta. Il link vale 7 giorni dall'invio.

**Come arriva il link all'ospite.**
- Se in «Flusso» il passaggio «Link del check-in online» è in automatico, CasaZen manda il link per email, ogni giorno, alle prenotazioni che entrano nella finestra. Se non riesce a raggiungere l'ospite, te lo dice.
- Per le prenotazioni dei portali il link va per email, se il portale ci dà l'indirizzo, oppure nella chat del portale. Quando CasaZen non ha un modo automatico di raggiungere l'ospite, la scheda ti avvisa e ti offre «Copia link»: lo mandi tu (WhatsApp, SMS…).
- Puoi sempre mandarlo o rimandarlo tu dalla prenotazione.

**Cosa compila l'ospite.** I passaggi sono (alcuni compaiono solo se attivi):
1. **Documento** (facoltativo): una foto del documento; CasaZen legge i dati e li propone. L'ospite li controlla prima di inviarli. In alternativa scrive tutto a mano.
2. **Ospiti**: tutti quelli che soggiornano, minori compresi (la legge chiede i dati di ognuno). Per ogni persona: tipo (ospite singolo, capofamiglia, capogruppo, familiare, membro del gruppo), nome, cognome, sesso, data di nascita, luogo di nascita (comune e provincia, oppure stato estero), cittadinanza. Residenza e altri dati facoltativi, o richiesti dalla tua regione, compaiono quando servono.
3. **Documento d'identità**: tipo, numero, luogo di rilascio e scadenza. Serve **solo** all'ospite singolo, al capofamiglia o al capogruppo, non ai familiari.
4. **Imposta di soggiorno** (su attivazione): se la tassa è dovuta e puoi incassarla online, l'ospite può pagarla con la carta. Altrimenti gli viene detto che la paga a te in struttura, che è già compresa nel pagamento o che la incassa il portale.
5. **Verifica dell'identità** (su attivazione): foto del documento (fronte e retro) e selfie. Solo la persona che lascia il documento fa il selfie. Il documento non viene archiviato. Se la verifica non riesce, l'ospite può rifare i tentativi che restano oppure chiedere la verifica di una persona: tu vieni avvisato e decidi tu. Il codice d'accesso arriva dopo la verifica, e, se la tassa di soggiorno è dovuta, dopo il pagamento.
6. **Informativa e consensi**: l'ospite legge l'informativa privacy; il consenso al marketing (email, WhatsApp) è facoltativo e non blocca il check-in.
7. **Fattura** (facoltativo): l'ospite può dirti se gli serve la fattura e a chi intestarla (persona o azienda, codice fiscale o partita IVA, PEC, codice destinatario). Se ora non ha i dati, li chiederai tu.

Alla fine l'ospite vede «Check-in completato!». Se riapre il link dopo l'invio, i dati non vengono più mostrati, per proteggere la sua privacy: per correggerli ti contatta.

**Il check-in all'ingresso (su attivazione).** Se l'immobile ha un codice QR sulla porta, l'ospite che arriva lo inquadra, scrive il codice della prenotazione (o il cognome) e la data di arrivo, e prosegue fino alla verifica dell'identità. Non serve nessun accesso.

### Cosa fa CasaZen con i dati
- Li usa per registrare il soggiorno e per **preparare** la comunicazione degli ospiti alla Questura (Alloggiati Web). La comunicazione è un obbligo di legge (art. 109 del TULPS): CasaZen prepara i dati, l'invio lo fai tu entro i termini: [[alloggiati-istat]].
- Li usa per calcolare la tassa di soggiorno ospite per ospite, con le esenzioni ([[imposta-soggiorno-documenti]]) e, se l'ospite lo chiede, per intestare la fattura ([[fisco-documenti]]).
- Conserva documento e dati per periodi che dipendono dalla categoria (scansioni del documento, dati Alloggiati, consenso marketing, dati fiscali): li vedi nella scheda «Privacy» dell'ospite. Se per una categoria non è stato fissato un periodo, non c'è cancellazione automatica.
- Non usa i dati per il marketing se l'ospite non ha dato il consenso.

### Gli stati del link
| Stato | Cosa significa | Cosa fai |
|---|---|---|
| Link inviato | L'ospite ha il link e non ha ancora iniziato | Aspetta; se serve «Invia sollecito» |
| In compilazione | L'ospite ha aperto il modulo | Aspetta |
| Completato | Ha inviato i dati | Controlla i dati degli ospiti nella sezione «Alloggiati Web» della stessa scheda |
| Alloggiati inviato | La comunicazione alla Questura è fatta | Niente |
| Scaduto | Il link non vale più | «Invia sollecito» o «Genera link da copiare» |

Se non c'è ancora nessun link, la scheda dice «Nessun link di check-in generato».

## Come fare

### Trovare un ospite e leggere la sua scheda
1. Apri **Affitti brevi › Prenotazioni** e scegli la scheda «Ospiti».
2. Scrivi nome o email nel campo «Cerca per nome o email...». La lista mostra 20 ospiti per pagina con «Anagrafica», «Email», «Città» e «Data Creazione»; puoi aggiungere «Telefono» e «Paese».
3. Premi «Dettagli» (o sul nome). La scheda ha quattro parti: «Soggiorni» (con «In casa ora», «Prossimo soggiorno» o «Ultimo soggiorno»), «Dati dell'ospite», «Documenti» e «Privacy».
4. In «Documenti» il numero del documento è nascosto: premi «Mostra» per vederlo e «Nascondi» per coprirlo. Con «Scarica scansione documento» scarichi la copia, se l'ospite l'ha caricata.

Il comando di esportazione salva l'elenco in un file CSV. Il CRM con tag e storico spesa è un'altra cosa: [[routine-ai-crm]].

### Mandare il link per il check-in online
Serve poter modificare «Prenotazioni e calendario». La prenotazione deve essere «Confermata» o «Check-in effettuato».
1. Apri la prenotazione e scegli la scheda «Check-in online».
2. Se non c'è ancora un link, premi «Invia link via email»: l'ospite lo riceve all'indirizzo della prenotazione.
3. Se preferisci mandarlo tu, premi «Genera link da copiare». Compare il link con la sua data di scadenza: copialo con il pulsante e mandalo all'ospite.
4. Per ricordarlo a chi non ha compilato premi «Invia sollecito».

Un nuovo link **sostituisce** quello di prima, che smette di funzionare. Sotto il link vedi se l'email è «inviata», «in coda» o «non inviata» e perché (indirizzo mancante, rifiutato dal servizio email…). Il link si può mandare solo quando il check-in è aperto: altrimenti la scheda dice che per ora non si può emettere un nuovo link.

### Capire a che punto è il check-in online
1. Apri la prenotazione › «Check-in online».
2. Leggi il cartellino dello stato (vedi la tabella sopra) e la scadenza del link.
3. Sotto trovi «Alloggiati Web»: lo stato della comunicazione e, se mancano dati, «Dati ospite incompleti».
4. Per un elenco di tutte le prenotazioni in attesa usa, in **Prenotazioni**, il filtro «Check-in online» (Documenti ricevuti, Link da inviare, In attesa dell'ospite) o la vista «Documenti da ricevere».

### Fare il check-in guidato al posto dell'ospite
Serve poter modificare «Prenotazioni e calendario» e poter inviare Alloggiati Web. La prenotazione deve essere «Confermata» o «Check-in effettuato». Puoi arrivarci da «Completa il check-in» nel blocco «Cosa succede ora» o da «Apri il check-in guidato».
1. **Ospiti**: controlla i dati di ogni persona e completa quelli che mancano. Premi «Salva ospiti».
2. **Documenti**: serve il documento dell'ospite singolo o del capofamiglia o capogruppo. Puoi premere «Fotografa il documento»: CasaZen legge i dati e li propone, e la foto non viene salvata. Se la lettura dà risultati diversi da quelli già scritti, scegli «Usa i dati della foto» o «Tieni i miei».
3. **Controlli**: i problemi in rosso (per esempio documento scaduto prima dell'arrivo, un dato mancante, un numero di ospiti diverso da quello della prenotazione) vanno risolti con «Correggi» per poter proseguire. Gli avvisi puoi lasciarli e premere «Prosegui comunque».
4. **Imposta di soggiorno**: vedi il calcolo ospite per ospite. Scegli le esenzioni dove spettano. Rispondi alla domanda «Chi ha incassato l'imposta di soggiorno?» («La incasso io in struttura» o «L'ha incassata il canale»). Se mancano le tariffe del comune, puoi inserire tu l'importo («Inserisci l'imposta del tuo comune»): resta tuo.
5. **Invio**: leggi «Cosa viene inviato e come». Non parte nulla finché non premi «Conferma e invia».
6. Nella schermata «Check-in registrato» vedi cosa è stato salvato. Da lì puoi premere «Registra arrivo», «Torna alla prenotazione» o «Vai agli adempimenti».

Cosa succede dopo la conferma: secondo come hai scelto il mittente della comunicazione, i dati dei singoli ospiti vanno al gestionale dei canali (Octorate), che li invia alla Questura quando registri l'arrivo, oppure la comunicazione resta da fare sul portale Alloggiati Web e CasaZen ti mostra la guida. Se qualcosa non è arrivato a Octorate, la schermata lo dice e propone «Riprova adesso». Se avevi già inviato dati alla Questura, una correzione va fatta sul portale Alloggiati Web.
> **Suggerimento:** con «Salva ed esci» puoi interrompere e riprendere dopo, ma per salvare servono i dati completi degli ospiti e il documento dell'ospite singolo o del capofamiglia.

### Segnare che l'ospite non è arrivato
1. Apri il check-in guidato della prenotazione.
2. Premi «L'ospite non è arrivato» e leggi «Cosa succede»: il soggiorno è segnato come «ospite non arrivato» e non c'è nessuna comunicazione alla Questura da fare.
3. Premi «Segna come non arrivato».

Se l'ospite arriva più tardi, registrando l'arrivo il segno viene tolto. Una prenotazione segnata come non arrivata non riceve inviti alla recensione.

### Esportare, anonimizzare o cancellare i dati di un ospite
Serve il permesso di gestire gli ospiti. Sono diritti dell'ospite (accesso, portabilità, cancellazione): li eserciti tu per lui, quando li chiede.
1. Apri la scheda dell'ospite › «Privacy».
2. Per una copia dei dati premi «Esporta dati». Il file contiene anche il documento in chiaro: trattalo con cura.
3. Per rendere anonimi tutti i dati personali premi «Anonimizza» e conferma. Non sarà più possibile identificare l'ospite.
4. Per cancellare tutto premi «Cancella dati» e conferma con «Cancella definitivamente». L'azione è irreversibile.

Non puoi anonimizzare né cancellare finché l'ospite ha prenotazioni in corso o future: la scheda lo dice, e lo potrai fare quando saranno concluse o annullate.

### Registrare la revoca del consenso marketing
Il consenso al marketing lo può dare solo l'ospite, dal check-in online. Tu puoi solo revocarlo se l'ospite lo chiede.
1. Apri la scheda dell'ospite › «Privacy» e cerca «Consenso marketing».
2. Premi «Revoca su richiesta dell'ospite».
3. Scrivi la richiesta: data e canale (per esempio «Email del 02/09/2026») e non inserire altri dati personali.
4. Premi «Revoca consenso».

Lo «Storico di informativa e consensi» mostra tutto quello che è successo, con la fonte (ospite, tu, regola di conservazione).

## Flussi completi

### Flusso: dal link al check-in completato
1. La prenotazione è confermata ([[prenotazioni]]).
2. CasaZen manda il link all'ospite pochi giorni prima dell'arrivo, oppure lo mandi tu.
3. L'ospite compila i passaggi; tu vedi lo stato passare da «Link inviato» a «In compilazione» a «Completato».
4. Controlli i dati degli ospiti: se sono completi, passi alla comunicazione ([[alloggiati-istat]]); se mancano, usi il check-in guidato.
5. Registri l'arrivo (o lo fa CasaZen a fine giornata).
6. Alla partenza si chiudono tassa di soggiorno e documenti ([[imposta-soggiorno-documenti]]).

## Regole e limiti
- Il link vale 7 giorni dall'invio e va mandato quando il check-in è aperto (3 giorni prima dell'arrivo, salvo la tua scelta in «Flusso»). Un nuovo link annulla il precedente.
- Il documento serve solo all'ospite singolo, al capofamiglia o al capogruppo. I dati anagrafici servono per **tutte** le persone, minori compresi.
- Foto del documento per la lettura nel check-in guidato: JPEG o PNG, fino a 10 MB. Nel modulo dell'ospite: JPG, PNG o WebP, fino a 5 MB.
- Se la verifica dell'identità non riesce, l'ospite ha un numero limitato di tentativi (la pagina dice quanti restano).
- Esportare, anonimizzare e cancellare richiedono il permesso di gestire gli ospiti; non sono possibili con prenotazioni in corso o future.
- La comunicazione alla Questura la fai tu. CasaZen non la invia al posto tuo.
- Chi ha accesso solo ad alcuni immobili vede solo gli ospiti e le prenotazioni di quelli.

## Domande frequenti

### L'ospite non ha un'email: come gli faccio arrivare il link?
Premi «Genera link da copiare» e mandalo tu (WhatsApp, SMS…). Per i portali la scheda ti dice se il link è partito dalla chat del portale o se va consegnato a mano.

### L'ospite dice che il link non funziona.
Probabilmente è scaduto o è stato sostituito da un link più recente. Apri la scheda «Check-in online» e mandane uno nuovo.

### Posso correggere i dati dopo che l'ospite ha inviato il modulo?
Sì, dal check-in guidato della prenotazione. L'ospite, riaprendo il link, non rivede i suoi dati.

### Cosa succede se un ospite non si presenta?
Segna «L'ospite non è arrivato» dal check-in guidato. Non c'è nessuna comunicazione alla Questura da fare per quel soggiorno.

### Chi vede i documenti degli ospiti?
Solo chi ha il permesso di leggere i dati degli ospiti. Il numero del documento è nascosto finché non premi «Mostra».

### Il documento viene salvato?
Dipende dal passaggio. La foto letta dal check-in guidato viene eliminata dopo la lettura. Nella verifica dell'identità con selfie il documento non viene archiviato. Una scansione caricata dall'ospite nel modulo resta salvata nei periodi di conservazione che vedi nella scheda «Privacy».

## Glossario
- **Capofamiglia / capogruppo**: la persona che per un gruppo di ospiti presenta il documento.
- **Check-in guidato**: la procedura con cui compili tu i dati degli ospiti.
- **Check-in online**: il modulo che l'ospite compila con il suo link.
- **No-show**: l'ospite che non arriva.
- **Verifica dell'identità**: controllo del documento con un selfie, su attivazione.

## Vedi anche
- [[prenotazioni]]: stati, arrivo e partenza.
- [[alloggiati-istat]]: comunicazione degli ospiti alla Questura.
- [[imposta-soggiorno-documenti]]: tassa di soggiorno dell'ospite.
- [[routine-ai-crm]]: profili CRM con tag e consensi marketing.
- [[portale-ospite]]: l'area dell'ospite.
