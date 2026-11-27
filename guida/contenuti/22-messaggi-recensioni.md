---
id: messaggi-recensioni
titolo: Messaggi, assistente e recensioni
sezione: Affitti brevi
ordine: 22
riassunto: Tutte le conversazioni con gli ospiti in un solo posto, i modelli di messaggio, l'assistente che prepara le bozze (che parte solo se le approvi tu), i messaggi programmati e le recensioni da leggere, chiedere e rispondere.
chi: [gestore, amministratore]
dove: Affitti brevi › Messaggi · Affitti brevi › Prenotazioni › Recensioni · Impostazioni › Assistente
parole_chiave: [messaggi, conversazioni, chat, modelli, modello di messaggio, assistente, bozza, intelligenza artificiale, AI, Airbnb, Booking.com, recensioni, risposta, messaggi programmati, traduzione, non lette, rispondere agli ospiti, whatsapp, e-mail ospite, approva e invia]
copre: [/app/short-rent/messages, /app/short-rent/messages/:threadKey, /app/short-rent/reviews, /app/short-rent/settings/assistant, /book/:orgSlug/booking/:bookingId/review]
stato: disponibile
fonte_codice: [frontend/src/features/messages/inbox-page.tsx, frontend/src/features/messages/thread-page.tsx, frontend/src/features/messages/review-thread-page.tsx, frontend/src/features/messages/components/template-picker.tsx, frontend/src/features/reviews/host-reviews-page.tsx, frontend/src/features/reviews/review-link-page.tsx, frontend/src/features/assistant/assistant-settings-page.tsx, frontend/src/features/bookings/components/booking-scheduled-messages.tsx, backend/Casazen.Web/Controllers/HostMessagesController.cs, backend/Casazen.Web/Controllers/MessageThreadsController.cs, backend/Casazen.Web/Controllers/MessageTemplatesController.cs, backend/Casazen.Web/Controllers/AssistantDraftsController.cs, backend/Casazen.Web/Controllers/AssistantRulesController.cs, backend/Casazen.Web/Controllers/ScheduledMessagesController.cs, backend/Casazen.Web/Controllers/ReviewsController.cs, backend/Casazen.Infrastructure/Events/AssistantMessageHandler.cs, backend/Casazen.Infrastructure/Services/GuestMessageService.cs]
---

## In breve
**Messaggi** raccoglie in un solo elenco le conversazioni con i tuoi ospiti: quelle dei portali (Airbnb, Booking.com e altri, tramite il channel manager Octorate) e quelle dirette del tuo sito. Rispondi senza uscire da CasaZen, con modelli di testo e traduzione. Se attivi l'**assistente**, CasaZen prepara una bozza di risposta: **non parte mai da sola, la approvi tu** con «Approva e invia». Puoi provarlo senza rischi: apri una conversazione e premi «Chiedi una bozza all'assistente»; non parte nulla finché non premi «Approva e invia». Le **recensioni** (del tuo sito e dei portali) si leggono nella scheda «Recensioni» e nel filtro «Recensioni» di Messaggi: puoi rispondere una sola volta a ognuna.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Elenco conversazioni | Tutte le conversazioni, con filtri e ricerca; contatore dei messaggi non letti | Messaggi | gestore, amministratore | Disponibile | Rispondere a un messaggio di un ospite |
| Risposta con modelli | Inserisce testi pronti nella risposta (i tuoi modelli, se ne hai, e quelli del canale) | Casella di risposta › «Modelli» | gestore, amministratore | Disponibile | Usare un modello o la traduzione |
| Traduzione | Traduce il messaggio dell'ospite e la tua risposta | Conversazione › «Traduci» | gestore, amministratore | Disponibile | Usare un modello o la traduzione |
| Scrivere per primo | Apre un contatto con l'ospite di una prenotazione | Messaggi aperto da una prenotazione | gestore, amministratore | Disponibile | Scrivere per primo a un ospite |
| Assistente: bozze | L'assistente prepara una bozza; tu approvi, modifichi o rifiuti | Conversazione › «Bozza dell'assistente» | gestore, amministratore | Su attivazione | Approvare o rifiutare una bozza dell'assistente |
| Assistente: regole e situazioni | Tono, lingue, firma, orari, argomenti e comportamento per ogni situazione | Impostazioni › Assistente | amministratore (regole); chi modifica gli immobili (immobili) | Su attivazione | Accendere e regolare l'assistente |
| Assistente: risposte della casa | Informazioni su Wi-Fi, regole, orari… che l'assistente può usare | Assistente › «Immobili» e «Regole» | amministratore, chi modifica gli immobili | Su attivazione | Insegnare all'assistente le risposte della tua casa |
| Messaggi programmati | I messaggi che le routine manderanno all'ospite; li puoi modificare, saltare o inviare subito | Prenotazione › «Soggiorno» | gestore, amministratore | Su attivazione | Gestire un messaggio programmato |
| Recensioni del tuo sito | Elenco, risposta, segnalazione a CasaZen | Prenotazioni › «Recensioni» | gestore, amministratore | Disponibile | Rispondere a una recensione |
| Recensioni dei portali | Lette dal portale; risposta pubblica e tua recensione dell'ospite | Messaggi › «Recensioni» | gestore, amministratore | Disponibile | Rispondere a una recensione |
| Richiesta di recensione | Manda una email all'ospite con il link per scrivere la recensione | Prenotazione | gestore, amministratore | Disponibile | Chiedere una recensione a un ospite |

## Come funziona

### Le conversazioni
- **Quali vedi.** Le conversazioni dei portali arrivano dal tuo channel manager (Octorate): senza Octorate collegato non ci sono ([[canali-octorate]]). Per leggere e rispondere a quelle di un annuncio devi aver dato il permesso alla chat nel channel manager: finché non è attivo, in cima all'elenco vedi «Per N annunci la chat dei portali non è ancora attiva», con la lista degli annunci. Le conversazioni dirette sono quelle dei soggiorni prenotati dal tuo sito. Chi ha accesso solo ad alcuni immobili vede solo le loro conversazioni.
- **Come si presenta l'elenco.** Si apre su «Da rispondere». Le altre viste sono «Non lette», «Tutte» e «Recensioni». Puoi filtrare per «Canale», «Immobile» o per una sola prenotazione, e cercare per ospite, codice o immobile. Il numero dei messaggi non letti compare accanto alla voce Messaggi e nella scheda «Messaggi» della prenotazione. Su telefono l'elenco porta alla conversazione; su schermo largo li vedi affiancati, con la prenotazione accanto.
- **Cosa vedi nella conversazione.** I messaggi con chi li ha scritti: «Ospite», «Tu», «Messaggio automatico» (mandato da una routine) o «Assistente CasaZen». Accanto, la scheda «Prenotazione»: soggiorno, persone, totale, già pagato, ancora da pagare, e per i portali commissione del canale e netto per te. Con «Apri la prenotazione» e «Apri il profilo dell'ospite» vai alle schede. Se l'ospite ha scritto prima di prenotare, la conversazione è una «Richiesta» e non c'è ancora una prenotazione.
- **Stato di un messaggio che invii.** «In invio», «Inviato», «Non inviato» (con «Riprova») oppure «Da verificare»: non sappiamo se il canale l'ha ricevuto, controlla la conversazione sul portale prima di riscriverlo.
- **Quando non puoi rispondere.** Puoi leggere ma non scrivere se la chat del portale non è ancora attiva per quell'annuncio, se l'annuncio non è ancora collegato a un tuo immobile, se la conversazione è chiusa, se non hai il permesso di rispondere, o se l'ospite ha chiesto la cancellazione dei suoi dati.
- **Regole dei portali.** Prima della prenotazione molti portali non permettono link, indirizzi email o numeri di telefono: toglili dal messaggio. Il testo può avere al massimo 2000 caratteri. Se mandi molti messaggi in poco tempo, ti viene chiesto di aspettare qualche minuto.
- **Messaggi diretti.** Se scrivi a un ospite del tuo sito, l'ospite riceve un'email che lo avvisa, **senza il testo**, e legge il messaggio nell'area della sua prenotazione. Non scrivere dati di pagamento. La conversazione di una prenotazione si chiude 7 giorni dopo la partenza.
- **Cosa non c'è.** CasaZen non manda messaggi su WhatsApp né SMS e non telefona: le conversazioni sono quelle dei portali (tramite Octorate) e quelle del tuo sito.

### I modelli di messaggio
Nella casella di risposta, «Modelli» mostra due elenchi:
- **«I tuoi modelli»**: i testi pronti già presenti nella tua organizzazione. **In questa versione l'app non ha una pagina per crearli o modificarli.** Se non ne hai, compare «Non hai ancora modelli di messaggio»: scrivi il messaggio a mano.
- **«Modelli del canale»**: i testi offerti dal portale, dove li offre, in sola lettura.

Premendo un modello il testo entra nella casella: lo leggi e lo cambi prima di inviare. I dati della prenotazione (nome dell'ospite, date, indirizzo, orari, link del check-in, link per la recensione, codice prenotazione, come si entra, il tuo nome) vengono scritti da CasaZen al momento della preparazione. Se con il modello il testo supera i 2000 caratteri, ti viene chiesto di accorciarlo. Le routine che mandano messaggi scelgono anch'esse tra i modelli presenti ([[routine-ai-crm]]).

### L'assistente messaggi con l'AI
**Su attivazione** ([[per-iniziare#cosa-significa-su-attivazione]]). È un componente dell'offerta («Assistente AI per i messaggi»): se non è attivo per la tua organizzazione, la pagina «Assistente» non compare. Il titolare o chi gestisce il piano può aggiungerlo da Amministrazione («Gestisci piano e moduli»: [[account-team-piano]]).

**Cosa fa.** Quando arriva un messaggio di un ospite, l'assistente può preparare una **bozza** di risposta, usando le informazioni della tua casa. La bozza compare nella conversazione e nella coda «Da approvare» del Cruscotto ([[cruscotto-notifiche-assistente]]). **Non parte mai da sola**: finché non premi «Approva e invia» non viene inviato nulla. L'ospite non viene avvisato che la bozza è stata scritta da un'intelligenza artificiale: l'avviso resta in CasaZen.

**Cosa decide chi.** Per ogni «situazione» (cancellazione o rimborso, orario di check-in, come arrivare, richiesta di sconto, arrivo anticipato o check-out in ritardo, emergenza, richiesta di fattura, guasto o problema, rumore, parcheggio, animali, Wi-Fi, ringraziamento, reclamo, altro) scegli una di due modalità:
- «Prepara una bozza»: l'assistente scrive una bozza che aspetta la tua approvazione.
- «Decide una persona»: l'assistente non scrive nulla e crea un'attività «Da fare» per te.
Le situazioni delicate sono segnate «Questa decisione spetta sempre a te». Le modalità automatiche (risposta senza approvazione) non sono attive in questa versione. Se un argomento è tra quelli vietati, l'assistente non scrive mai una bozza e ti crea un'attività.

**Una sola eccezione: la chat del portale ospite.** Nella chat del [[portale-ospite]], se la funzione «risposte automatiche» è attiva (è una funzione a parte, su attivazione e spenta di partenza), l'assistente può rispondere da solo alle domande pratiche su orari di check-in e check-out, parcheggio e Wi-Fi, **ma solo se la risposta è scritta nella guida della casa**. Tutte le altre domande arrivano a te.

**Quando non scrive la bozza.** Se è spento per l'organizzazione o per l'immobile, se hai già risposto, se l'ospite ha scritto di nuovo, se il messaggio è troppo vecchio, se la conversazione non è collegata a un immobile o è chiusa, se il servizio ha raggiunto il limite di utilizzo o non è disponibile. Ogni volta la finestra ti dice il motivo e puoi rispondere tu.

**Affidabilità.** Ogni bozza mostra «Alta affidabilità» oppure «Controllala con attenzione», con una percentuale: è solo un'indicazione, decidi sempre tu. Le bozze di risposta alle recensioni rispettano regole fisse: non possono promettere rimborsi o sconti, dire di essere un'intelligenza artificiale, né contenere link o numeri di telefono, e devono essere brevi; se non le rispettano non vengono proposte.

**Cosa legge.** Le risposte che scrivi tu, le informazioni lette dal tuo annuncio e le regole. I codici di accesso dell'immobile (serrature, cassetta delle chiavi) non vengono mai letti dall'assistente.

### I messaggi programmati
**Su attivazione** ([[per-iniziare#cosa-significa-su-attivazione]]). Le routine ([[routine-ai-crm]]) possono mandare messaggi all'ospite in momenti precisi (per esempio due giorni prima dell'arrivo). Nella scheda «Soggiorno» di una prenotazione vedi l'elenco «Messaggi programmati» per quel soggiorno, con lo stato: «Programmato», «Inviato», «Saltato», «Scaduto», «Annullato», «Bloccato», «Invio non riuscito».
- Di norma un messaggio parte tra le 8:00 e le 21:00 (ora italiana), e CasaZen li pianifica fino a 30 giorni prima. Se lo invii subito fuori da quella fascia, nell'elenco compare «Inviato fuori orario».
- Un messaggio **Bloccato** non parte finché non c'è un dato che manca (per esempio il codice d'accesso, il link del check-in o l'orario di arrivo): l'elenco dice «Manca:» e ti porta alla schermata giusta.
- Se l'orario previsto è passato da troppo tempo, il messaggio non viene mandato in ritardo.
- Puoi **modificarne il testo** (vale solo per quella prenotazione), **saltarlo** (l'ospite non lo riceve e gli altri del team vengono avvisati; non si torna indietro) o **inviarlo subito**.

### Le recensioni
- **Recensioni del tuo sito**: scheda «Recensioni» (Prenotazioni). Sono quelle degli ospiti che hanno soggiornato dal tuo sito. Per ognuna puoi rispondere **una sola volta**, e non potrai modificare la risposta. Puoi segnalare a CasaZen quelle che non vanno, **una sola volta**: CasaZen decide se tenerle o toglierle; finché non decide la recensione resta visibile. Tu non puoi nasconderle né toglierle.
- **Recensioni dei portali**: in Messaggi scegli la vista «Recensioni». Ogni riga mostra le stelle e «Senza risposta» se non hai risposto. Aprendola vedi la recensione, i voti per voce (Pulizia, Comunicazione, Check-in, Accuratezza dell'annuncio, Posizione, Qualità-prezzo, Rispetto delle regole della casa), il testo e la tua risposta. CasaZen legge le recensioni dal portale (puoi aggiornare con «Aggiorna», non troppo spesso). Per alcuni canali CasaZen non può leggere né rispondere: la scheda dice «leggile e rispondi dal portale».
- **La tua recensione dell'ospite**: dove il portale lo permette puoi scrivere una recensione dell'ospite (voti da 1 a 5, testo pubblico, nota privata). Si scrive una sola volta e non si ritira.
- **Inviti a recensire**: per le prenotazioni del tuo sito puoi chiedere tu la recensione, oppure lasciarla a una routine (un giorno dopo il check-out). L'invito parte una volta sola per prenotazione, entro 14 giorni dalla partenza.

## Come fare

### Rispondere a un messaggio di un ospite
**Ti serve:** il permesso di modificare «Prenotazioni e calendario». Per le conversazioni di Airbnb, Booking.com e degli altri portali: Octorate collegato, la chat attivata nel channel manager per quell'annuncio e l'annuncio collegato a un tuo immobile. Per i soggiorni del tuo sito non serve altro.
1. Apri **Affitti brevi › Messaggi**. Sei su «Da rispondere».
2. Scegli la conversazione.
3. Scrivi nella casella «Scrivi la tua risposta…». «Invio» manda il messaggio, «Maiusc+Invio» va a capo.
4. Premi «Invia». Sotto il messaggio vedi «In invio» e poi «Inviato».
5. Se il canale non lo ha accettato, compare «Non inviato»: premi «Riprova». Con «Da verificare» controlla prima sul portale.

Il messaggio non si può cancellare dopo l'invio. Se l'ospite ha scritto in un'altra lingua, vedi «Usare un modello o la traduzione».

### Usare un modello o la traduzione
1. Nella conversazione premi «Modelli». Scegli un testo tra «I tuoi modelli» o «Modelli del canale». Se «I tuoi modelli» è vuoto, scrivi il messaggio a mano (vedi «I modelli di messaggio»).
2. Il testo entra nella casella: correggilo come vuoi.
3. Per tradurre il messaggio dell'ospite premi «Traduci» accanto al messaggio, poi «Usa la traduzione» o «Nascondi la traduzione».
4. Per tradurre la tua risposta scegli la lingua nella casella (campo «Lingua della traduzione») e premi «Traduci». Il testo risulta come «Traduzione automatica»: rileggilo prima di inviare.

### Scrivere per primo a un ospite
**Ti serve:** il permesso di modificare «Prenotazioni e calendario» e una prenotazione confermata.
1. Apri la prenotazione dall'elenco **Prenotazioni**.
2. Se il soggiorno è del tuo sito e confermato, apri la scheda «Messaggi» e scrivi nel campo «Scrivi un messaggio…»: l'ospite riceve un'email che lo avvisa (senza il testo) e legge il messaggio nell'area della sua prenotazione.
3. Se il soggiorno è di un portale, apri **Messaggi** limitato a quella prenotazione. Se non c'è ancora una conversazione, la pagina «Scrivi all'ospite» ti dice come raggiungerlo: se il portale non ha una chat, premi «Scrivi per e-mail» e scrivi attraverso CasaZen, senza vedere né conservare l'indirizzo dell'ospite.
4. Se compare «Per questa prenotazione CasaZen non ha un modo per scrivere all'ospite», trovi il motivo (annuncio non collegato, collegamento ai canali non attivo, conversazione chiusa): sistemalo oppure scrivi dal portale.

### Accendere e regolare l'assistente
**Ti serve:** essere amministratore dell'organizzazione per le regole generali, e poter modificare gli immobili per le eccezioni di un immobile; il modulo «Assistente AI per i messaggi» attivo; qualche informazione sulla casa (Wi-Fi, orari, regole) da fargli conoscere.
1. Apri **Impostazioni › Assistente** (su attivazione). Ci sono tre parti: «Regole», «Situazioni», «Immobili».
2. In «Regole» accendi «Assistente acceso» (spento, non prepara bozze per nessun immobile). Scegli «Tono» (Formale, Cordiale, Neutro), le «Lingue» (italiano, inglese, tedesco, francese, spagnolo), la «Firma» (massimo 300 caratteri) e gli «Orari» in cui prepara le bozze (oppure «In qualsiasi momento»).
3. Scegli gli «Argomenti vietati» (l'assistente non scrive mai, ti crea un'attività) e, se vuoi, gli «Argomenti su cui l'assistente può rispondere». Premi «Salva le regole».
4. In «Situazioni» premi «Modifica» su una situazione e scegli «Cosa fa l'assistente». Puoi scrivere un «Testo della risposta» (con le stesse variabili dei messaggi pronti) o indicare da quale «Argomento dei dati dell'immobile» deve partire. Premi «Salva la situazione».
5. In «Immobili» scegli un immobile: puoi spegnere l'assistente solo per lui, cambiare tono, firma, orari, argomenti vietati e situazioni. Se allarghi le regole rispetto all'organizzazione, CasaZen ti avverte («Salvare regole meno restrittive?»). «Usa le impostazioni dell'organizzazione per tutto» cancella le eccezioni; le risposte dell'immobile restano.

### Insegnare all'assistente le risposte della tua casa
**Ti serve:** il permesso di modificare gli immobili e le informazioni da scrivere (Wi-Fi, parcheggio, orari, regole della casa).
1. In **Impostazioni › Assistente › Immobili** scegli l'immobile.
2. Guarda «Informazioni che mancano»: sono gli argomenti senza nessuna informazione, e senza di loro l'assistente non sa cosa rispondere. Premi «Aggiungi».
3. In «Le tue risposte» premi «Aggiungi una risposta». Scegli l'«Argomento» (Wi-Fi, Check-in, Check-out, Parcheggio, Animali, Orari, Come arrivare, Contatti, Regole della casa, Servizi e dotazioni, Domande frequenti), il «Tipo» (Informazione, Domanda frequente, Regola), la domanda e il testo (da 1 a 1000 caratteri).
4. Premi «Salva la risposta». Con l'interruttore «Usata dall'assistente» la accendi o la spegni senza cancellarla.

Le risposte valide per tutti gli immobili si scrivono nelle «Regole» e le cambia solo l'amministratore. Le informazioni «Dal tuo annuncio» non si cambiano qui: si cambiano nell'annuncio.

### Approvare o rifiutare una bozza dell'assistente
**Ti serve:** il permesso di modificare «Prenotazioni e calendario» e l'assistente acceso.
1. Apri la conversazione: se c'è una bozza la vedi come «Bozza dell'assistente». Altrimenti premi «Chiedi una bozza all'assistente».
2. Leggi il testo e l'indicazione di affidabilità.
3. Per inviarla così com'è premi «Approva e invia».
4. Per cambiarla premi «Modifica»: la bozza risulta «Modificata da te». Poi invia.
5. Per scartarla premi «Rifiuta»: «Bozza rifiutata. Non è stato inviato nulla».

Dopo l'invio il messaggio è come qualsiasi altro tuo messaggio e non si può ritirare. Per le recensioni vale lo stesso, con «Salva e pubblica»: la risposta è pubblica e non si può modificare.

### Gestire un messaggio programmato
**Ti serve:** le routine attive ([[routine-ai-crm]]) e una prenotazione con un messaggio programmato.
1. Apri la prenotazione › «Soggiorno» › «Messaggi programmati».
2. Per cambiare il testo premi «Modifica». I pulsanti «Inserisci un dato» mettono nel testo i dati che CasaZen scrive al momento dell'invio; i dati già compilati diventano testo fisso. Premi «Salva». «Usa il testo della routine» cancella la tua modifica.
3. Per non mandarlo premi «Salta», poi «Salta il messaggio». Non si torna indietro.
4. Per mandarlo adesso premi «Invia ora» e conferma: parte subito, anche prima dell'orario.

### Rispondere a una recensione
**Ti serve:** il permesso di modificare «Prenotazioni e calendario» e una recensione ricevuta.
1. Per il tuo sito: apri **Affitti brevi › Prenotazioni › Recensioni** e premi «Rispondi» sulla recensione. Per un portale: apri **Messaggi › Recensioni** e scegli la recensione.
2. Scrivi la risposta (testo pubblico). Puoi chiedere una bozza all'assistente.
3. Premi «Invia la risposta» (sito) o «Pubblica la risposta» (portale) e conferma «Pubblica».

La risposta è visibile a tutti sotto la recensione. Non si può modificare né ritirare e parte una sola volta. Se il portale non risponde, compare «Da verificare»: non riscriverla, CasaZen controlla da sola.

### Segnalare una recensione a CasaZen
1. In **Prenotazioni › Recensioni** premi «Segnala».
2. Scegli «Perché la segnali?» (l'autore non ha soggiornato qui, non parla del soggiorno, offensiva o minacciosa, contiene dati personali, pubblicità o spam, altro) e, se vuoi, aggiungi una nota.
3. Premi «Segnala a CasaZen».

La recensione resta visibile finché CasaZen decide. Si può segnalare una sola volta.

### Chiedere una recensione a un ospite
**Ti serve:** una prenotazione del tuo sito conclusa, entro 14 giorni dalla partenza, e l'email dell'ospite.
1. Apri la prenotazione e cerca il riquadro «Recensione».
2. Premi «Chiedi una recensione» e conferma «Invia l'email».
3. L'ospite riceve una sola email con il link per scrivere la recensione; compare «Recensione richiesta il …».

L'email parte una sola volta per prenotazione e non si può richiamare. La recensione sarà pubblica sul tuo sito, con il nome di battesimo dell'ospite se vorrà. Dopo la recensione compare «L'ospite ha lasciato una recensione» e «Vedi le recensioni».

### Scrivere la tua recensione dell'ospite
1. Apri la prenotazione di un portale (o la conversazione con la recensione).
2. Nel riquadro «La tua recensione dell'ospite» dai un voto da 1 a 5 a ogni voce e scrivi il testo pubblico; puoi aggiungere una «Nota privata per l'ospite».
3. Premi «Invia la recensione» e conferma «Invia».

Si scrive una volta sola. Se il portale non conferma l'invio, compare «Da verificare»: non riscriverla.

## Flussi completi

### Flusso: dal messaggio dell'ospite alla risposta con l'assistente
1. L'ospite scrive (sito o portale). Il messaggio compare in «Da rispondere».
2. Se l'assistente è acceso e la situazione è «Prepara una bozza», CasaZen scrive una bozza e te la propone. Se la situazione è «Decide una persona» o delicata, crea un'attività «Da fare».
3. Tu apri la conversazione, leggi la bozza e premi «Approva e invia», «Modifica» o «Rifiuta».
4. Solo dopo il tuo invio l'ospite riceve la risposta.

### Flusso: dal soggiorno alla recensione
1. Il soggiorno finisce ([[prenotazioni]]).
2. Un giorno dopo il check-out una routine ([[routine-ai-crm]]) o tu chiedete la recensione all'ospite ([[messaggi-recensioni#chiedere-una-recensione-a-un-ospite]]).
3. L'ospite scrive la recensione dalla pagina del link, entro 14 giorni.
4. Tu rispondi dalla scheda «Recensioni» ([[messaggi-recensioni#rispondere-a-una-recensione]]). Per i portali la leggi in Messaggi › «Recensioni».

## Regole e limiti
- Un messaggio: massimo 2000 caratteri. I portali possono rifiutare link, email e telefoni prima della prenotazione.
- Scrivere o rispondere richiede poter modificare «Prenotazioni e calendario»; con la sola lettura vedi i messaggi ma non rispondi. Titolare e amministratori hanno già tutti i permessi.
- I modelli di messaggio non si creano dall'app in questa versione: «I tuoi modelli» mostra solo quelli già presenti.
- L'assistente: solo bozze approvate da te (l'unica eccezione sono le risposte automatiche della chat del portale ospite, su attivazione); regole generali modificabili solo dall'amministratore; eccezioni per immobile modificabili da chi può modificare gli immobili; i codici d'accesso non sono mai letti.
- Messaggi programmati: di norma partono tra le 8:00 e le 21:00 ora italiana e sono pianificati fino a 30 giorni prima; se l'orario previsto è passato da troppo tempo non partono più.
- Risposta a una recensione: una sola, pubblica, non modificabile né ritirabile. Segnalazione a CasaZen: una sola per recensione.
- Invito a recensire: una volta per prenotazione, entro 14 giorni dalla partenza, solo per le prenotazioni del tuo sito.
- Chi ha accesso solo ad alcuni immobili vede solo le conversazioni e le recensioni di quelli.
- Non ci sono messaggi su WhatsApp né SMS: solo le conversazioni dei portali (tramite Octorate) e quelle del tuo sito.

## Domande frequenti

### Perché non vedo i messaggi di Airbnb o Booking.com?
La chat dei portali si attiva dal tuo channel manager (permesso alla chat) e richiede Octorate collegato. Finché non è attiva, CasaZen non riceve quei messaggi: l'avviso in cima a Messaggi elenca gli annunci interessati. Vedi [[canali-octorate]].

### L'assistente può rispondere da solo agli ospiti?
Di norma no: nelle conversazioni dei portali e del tuo sito prepara solo bozze, e non parte nessun messaggio senza la tua approvazione («Approva e invia»). L'unica eccezione è la chat del portale ospite, dove, se la funzione «risposte automatiche» è attiva (su attivazione, spenta di partenza), può rispondere da solo alle domande pratiche quando la risposta è nella guida della casa.

### L'ospite sa che la bozza l'ha scritta l'assistente?
No: l'ospite riceve il messaggio che hai approvato, come tuo. L'avviso «scritta da un modello di intelligenza artificiale» è visibile solo a te.

### Posso cancellare un messaggio inviato?
No. Puoi solo scrivere un messaggio successivo.

### Posso togliere una recensione negativa?
Non da solo. Puoi rispondere (una volta) e, per le recensioni del tuo sito, segnalarla a CasaZen, che decide.

### Dove creo i miei modelli di messaggio?
In questa versione l'app non ha una pagina per creare o modificare i modelli: «I tuoi modelli» mostra solo quelli già presenti nella tua organizzazione (se non ce ne sono compare «Non hai ancora modelli di messaggio»). Puoi scrivere il messaggio a mano o usare i «Modelli del canale», dove il portale li offre. Per i testi che l'assistente deve usare in una situazione (per esempio il Wi-Fi) scrivi il «Testo della risposta» in **Impostazioni › Assistente › Situazioni**. Le routine con un messaggio scelgono tra i modelli presenti ([[routine-ai-crm]]).

### Posso scrivere agli ospiti su WhatsApp o per SMS da CasaZen?
No. CasaZen scrive per le conversazioni dei portali e del tuo sito e, per le campagne, per e-mail. Se vuoi mandare un link con WhatsApp o SMS, copialo e mandalo tu (per esempio il link del check-in: «Copia link»).

## Glossario
- **Assistente**: la funzione che prepara bozze di risposta agli ospiti.
- **Bozza**: testo preparato dall'assistente che non è ancora stato inviato.
- **Situazione**: il tipo di richiesta dell'ospite (Wi-Fi, parcheggio, rimborso…).
- **Messaggio programmato**: messaggio che una routine manda a un'ora precisa.
- **Modello**: un testo pronto da inserire nella risposta.

## Vedi anche
- [[prenotazioni]]: la scheda della prenotazione e la scheda «Messaggi».
- [[ospiti-checkin]]: il link per il check-in online, spesso mandato per messaggio.
- [[routine-ai-crm]]: routine che mandano messaggi e richiedono recensioni.
- [[cruscotto-notifiche-assistente]]: la coda «Da approvare».
- [[canali-octorate]]: collegare i portali e attivare la chat.
- [[portale-ospite]]: la chat del portale ospite.
