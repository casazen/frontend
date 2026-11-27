---
id: alloggiati-istat
titolo: Adempimenti: Alloggiati Web, ISTAT e attivazione degli immobili
sezione: Adempimenti
ordine: 30
riassunto: La pagina Adempimenti ti dice cosa devi fare per essere in regola: comunicazione degli ospiti alla Questura (Alloggiati Web), statistiche ISTAT, attivazione degli immobili. Qui trovi chi invia cosa, le scadenze, come correggere un invio e cosa fa «Gestisci con AI».
chi: [gestore, amministratore]
dove: Affitti brevi › Adempimenti
parole_chiave: [adempimenti, alloggiati web, questura, schedine, ISTAT, ROSS1000, scadenza 24 ore, ricevuta, channel manager, invio automatico, attivazione immobile, gestisci con AI, prove, archivio delle prove]
copre: [/app/short-rent/compliance, /app/short-rent/alloggiati, /app/short-rent/alloggiati/reports, /app/short-rent/compliance/sender, /app/short-rent/properties/:id/activation]
stato: disponibile
fonte_codice: [frontend/src/features/compliance/compliance-summary-page.tsx, frontend/src/features/compliance/lib/cockpit-model.ts, frontend/src/features/compliance/lib/compliance-tiers.ts, frontend/src/features/alloggiati/alloggiati-dashboard-page.tsx, frontend/src/features/alloggiati/components/alloggiati-booking-panel.tsx, frontend/src/pages/AlloggiatiPage.tsx, frontend/src/features/compliance/sender-wizard/sender-wizard-model.ts, frontend/src/features/compliance/activation-wizard.tsx, frontend/src/features/compliance/autopilot, frontend/src/features/compliance/lib/istat-coverage-model.ts, frontend/src/features/properties/components/property-institutional-portals.tsx, backend/Casazen.Web/Controllers/AlloggiatiController.cs, backend/Casazen.Web/Controllers/DirectPortalRoutesController.cs, backend/docs/runbooks/alloggiati.md, backend/docs/runbooks/compliance-autopilot.md, backend/docs/runbooks/direct-institutional-portals.md]
---

## In breve
**Adempimenti** è la pagina che risponde alla domanda «sono in regola?». Mette in cima le cose con una scadenza di legge (soprattutto la comunicazione degli ospiti alla Questura, **Alloggiati Web**, entro 24 ore dall'arrivo), poi gli immobili da attivare e le cose da chiudere dopo un soggiorno.

Per Alloggiati Web, di norma **non è CasaZen a inviare**: CasaZen raccoglie i dati degli ospiti, controlla che siano completi, ti prepara il file e ti ricorda la scadenza; l'invio lo fa il tuo channel manager oppure lo fai tu sul portale della Questura, e poi lo registri in CasaZen. L'invio diretto da CasaZen esiste solo su attivazione, per alcuni immobili.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Pagina Adempimenti | Elenca ciò che richiede attenzione, in tre livelli: «Scadenze di legge», «Per iniziare a lavorare», «Da chiudere» | Affitti brevi › Adempimenti | gestore, amministratore | Disponibile | Leggere la pagina Adempimenti |
| Semaforo (Da fare / In corso / In regola / Da verificare) | Ogni voce ha uno stato; il verde compare solo se CasaZen ha la prova | Adempimenti | gestore, amministratore | Su attivazione | Leggere la pagina Adempimenti |
| Elenco Alloggiati | Una riga per ogni soggiorno con stato, scadenza e pulsante per registrare l'invio | Adempimenti › Alloggiati | gestore, amministratore | Disponibile | Inviare Alloggiati Web con il file |
| Sezione «Alloggiati Web» della prenotazione | Dati di ogni ospite da copiare, file per il portale, stato e scadenza | Prenotazioni › una prenotazione › scheda «Documenti» | gestore, amministratore | Disponibile | Inviare Alloggiati Web con il file |
| «Modifica ospiti» | Inserisce o corregge gli ospiti del soggiorno | Scheda «Documenti» della prenotazione | chi può modificare le prenotazioni | Disponibile | Completare i dati degli ospiti |
| «Segna come inviato manualmente» | Registra che hai inviato tu la comunicazione sul portale | Elenco Alloggiati e scheda della prenotazione | chi può inviare i dati degli ospiti | Disponibile | Inviare Alloggiati Web con il file |
| Invio tramite channel manager | Gli ospiti passano al tuo channel manager (Octorate), che li invia alla Questura | Scelta in «Chi invia» | gestore, amministratore | Su attivazione | Scegliere chi invia i dati degli ospiti |
| Invio diretto da CasaZen | CasaZen invia con le credenziali Alloggiati Web dell'immobile | Scheda immobile › «Portali istituzionali» | chi può modificare gli immobili | Su attivazione | Attivare l'invio diretto |
| Chi invia (procedura guidata) | Sceglie e verifica chi trasmette i dati degli ospiti | Adempimenti › Alloggiati o scheda immobile | chi può modificare gli immobili | Disponibile | Scegliere chi invia i dati degli ospiti |
| Archivio delle prove (Report Alloggiati) | Conserva ricevute Alloggiati, prove ISTAT e ricevute dell'imposta di soggiorno | Adempimenti › Report Alloggiati | gestore, amministratore | Disponibile | Caricare una ricevuta o una prova |
| ISTAT | Ti dice se l'ISTAT della tua regione parte dal channel manager o va fatto sul portale regionale, e conserva la prova | Adempimenti, procedura «Chi invia», scheda immobile | gestore, amministratore | Disponibile | Gestire l'ISTAT |
| ROSS1000 (Lombardia) | Anteprima e invio del movimento giornaliero | Scheda immobile › «Portali istituzionali» | chi può modificare gli immobili | Su attivazione | Gestire l'ISTAT |
| Attivazione dell'immobile | Procedura guidata con i requisiti per rendere prenotabile la casa | Scheda immobile › «Wizard attivazione» | chi può modificare gli immobili | Disponibile | Attivare un immobile |
| «Gestisci con AI» | Fa al posto tuo alcune cose pratiche (chiedere i dati agli ospiti, chiudere partenze) | Adempimenti, pulsante in alto | chi può modificare le prenotazioni | Disponibile | Usare «Gestisci con AI» |
| Avvisi sulle scadenze | E-mail e notifiche prima e dopo la scadenza di Alloggiati Web | Arrivano da sole | gestore, amministratore | Disponibile | Capire gli avvisi |

## Come funziona

### Cosa vedi nella pagina Adempimenti
Il titolo della pagina è «Sono in regola?». Le voci sono divise in tre livelli:

- **Scadenze di legge** («Rischi una sanzione»). Alloggiati Web, i dati degli ospiti che servono per inviarlo, ISTAT, l'imposta di soggiorno di un mese, la notifica agli enti svizzeri e l'invio automatico alla Questura quando va sistemato. Questo livello è sempre in vista e il suo numero compare accanto alla voce di menu «Adempimenti». Se c'è una scadenza, la riga la dice in parole: «Entro oggi», «Entro domani», «Scaduto da 3 giorni».
- **Per iniziare a lavorare**. Gli immobili da attivare (CIN, documenti, checklist di sicurezza). Finché non sono a posto, queste case non si attivano e non si possono prenotare dal tuo sito.
- **Da chiudere**. La cura dei soggiorni: partenze da chiudere, case da dichiarare pronte per il prossimo ospite, identità degli ospiti da verificare.

Sotto trovi due elenchi chiusi: «N adempimenti in regola» e «N case in regola». Ogni riga ha un pulsante che ti porta dove si risolve (la scheda della prenotazione, la procedura di attivazione, l'archivio delle prove). Se non hai il permesso per fare l'azione, il pulsante diventa «Apri»: puoi guardare ma non modificare.

Il **semaforo** (su attivazione) dà a ogni voce uno stato: «Da fare», «In corso», «In regola» o «Da verificare». Il verde compare **solo quando CasaZen ha la prova** (per esempio la ricevuta archiviata). Senza la prova la voce resta gialla o «Da verificare», anche se hai già inviato.

Il pulsante «Verifica nel tuo Cassetto Compliance» compare, su attivazione, accanto alle voci il cui esito si vede solo nell'area del channel manager (Octorate). CasaZen non legge quell'esito e non lo registra come prova: ti porta nella sezione giusta e ti dice cosa controllare.

### Alloggiati Web: che cosa è e chi invia
Chi ospita deve comunicare alla Questura i dati di ogni ospite (una «schedina» per persona, minori compresi) **entro 24 ore dall'arrivo**, oppure **entro 6 ore** se il soggiorno non supera una notte. Il portale accetta solo schedine con data di arrivo **di oggi o di ieri**: prima del giorno di arrivo la comunicazione resta «Da inviare» e non si può spedire.

Per ogni ospite CasaZen tiene: tipo di ospite (ospite singolo, capofamiglia, capogruppo, familiare, membro del gruppo), cognome, nome, sesso, data e luogo di nascita, cittadinanza e, per ospite singolo, capofamiglia e capogruppo, tipo e numero del documento e luogo di rilascio. I familiari seguono il loro capofamiglia, i membri il loro capogruppo. Per una schedina il soggiorno può durare da 1 a 30 notti: oltre le 30 notti CasaZen non prepara il file (per i soggiorni più lunghi il portale chiede una nuova schedina come nuovo arrivo, che CasaZen non costruisce).

Chi invia dipende da come hai impostato l'immobile (vedi «Chi invia i dati degli ospiti alla Polizia?»):

- **Lo faccio io, con il file** (invio manuale). È la scelta di partenza. CasaZen prepara i dati e il file; lo carichi tu sul portale Alloggiati Web e poi premi «Segna come inviato manualmente». CasaZen non riceve la ricevuta: registra la tua dichiarazione. Lo stato è «Inviato manualmente».
- **Il tuo channel manager**. Se l'immobile è collegato a Octorate, i dati degli ospiti passano al channel manager, che li invia alla Questura ogni giorno. Lo stato è «Affidato al channel manager, in attesa della ricevuta». Per CasaZen la comunicazione è fatta (verde) solo quando la **ricevuta è archiviata**. Su attivazione.
- **CasaZen** (invio diretto). Su attivazione, solo per gli immobili per cui è stato predisposto. Nella procedura guidata «Chi invia» la voce «CasaZen» può risultare «Non ancora disponibile»: in quel caso l'attivazione si fa dalla scheda immobile (vedi «Attivare l'invio diretto»).

> **Nota:** CasaZen non ti toglie la responsabilità della comunicazione: restano tue la correttezza dei dati e il rispetto della scadenza. Se scegli un invio automatico, lo dichiari in una delega che ti viene mostrata e che devi accettare.

### Gli stati di una comunicazione
- **Da inviare**: aspetta il giorno di arrivo.
- **Da inviare manualmente**: è il giorno di arrivo (dalle 00:00 ora italiana) e la comunicazione è dovuta. Tocca a te.
- **Inviato manualmente**: hai dichiarato tu l'invio, con la data. CasaZen non ha la ricevuta: conserva quella rilasciata dal portale.
- **Inviato (ricevuta)**: c'è la ricevuta vera. Con l'invio diretto compare anche il pulsante «Scarica ricevuta Questura».
- **Affidato al channel manager, in attesa della ricevuta**: gli ospiti sono partiti verso il channel manager; mancano la ricevuta o l'esito.
- **Da correggere**: il channel manager non ha accettato uno o più ospiti.
- **Errore** e **Rifiutato**: la preparazione è fallita o il portale ha rifiutato i dati. Vedi «Correggere un invio andato male».
- **Trasmissione in corso**, **Acquisizione parziale · verifica gli ospiti sul portale**, **Esito incerto · verifica sul portale prima di ripetere l'invio**, **Inviato, ricevuta in attesa**: stati dell'invio diretto.
- **Non dovuta**: non c'è niente da comunicare (per esempio l'ospite non è mai arrivato).

### ISTAT: cosa fa CasaZen e cosa resta a te
I flussi statistici regionali (ISTAT) hanno regole diverse da regione a regione. CasaZen **non invia l'ISTAT**, salvo il caso su attivazione di ROSS1000 in Lombardia. Quello che fa:

- Per ogni immobile ti dice **se il tuo channel manager invia l'ISTAT della tua regione**: «copre», «non copre» oppure «da verificare». Dice «copre» o «non copre» solo quando lo staff di CasaZen ha controllato la regione; altrimenti scrive «da verificare» e non promette niente.
- Ti mostra la **scadenza** del flusso della tua regione: un giorno del mese successivo, ogni giorno, oppure «da verificare».
- Ti indica il passo successivo: collegare l'ISTAT nel pannello del channel manager, aprire la guida del portale regionale, oppure chiedere aiuto all'assistenza.
- Tra gli adempimenti compare «Carica la prova ISTAT di {mese}»: serve la **prova** (la ricevuta del portale) caricata nell'archivio delle prove.

In «Chi invia» c'è anche il campo facoltativo **Credenziali ISTAT** (su attivazione): se vuoi, lasci le credenziali del portale regionale perché l'assistenza di CasaZen colleghi l'ISTAT per te nel pannello del channel manager. Le apre solo su tua richiesta, e ogni apertura compare nel registro delle attività. Può cambiare queste credenziali solo il titolare o un amministratore dell'organizzazione.

**ROSS1000 Lombardia** (su attivazione): nella scheda immobile, sezione «Portali istituzionali», compare il pannello «Movimento giornaliero ROSS1000». Scegli il «Giorno di attività», indica se la «Struttura aperta» e i dati di capienza («Camere disponibili», «Camere occupate», «Posti letto disponibili») e premi «Prepara anteprima»: CasaZen ricava arrivi e partenze dai check-in e check-out registrati. Se l'invio diretto è attivo, premi «Invia il movimento alla Lombardia»; l'esito è per identificativo («Accettato» o «Respinto»). Un movimento accettato vale per quel giorno; per esiti incerti, correzioni e soggiorni arrivati prima dell'attivazione si usa il portale regionale. Servono il permesso di modificare gli immobili e quello di leggere i dati degli ospiti.

### «Gestisci con AI»: cosa fa e cosa non fa mai
Il pulsante «Gestisci con AI» compare in alto nella pagina Adempimenti quando ci sono soggiorni su cui può lavorare (serve il permesso di modificare le prenotazioni). Ti mostra un piano in tre gruppi (**Faccio io**, **Aspetto**, **Resta a te**) e parte solo quando premi «Avvia».

Cosa fa:
- **Chiede i dati agli ospiti** che non li hanno ancora compilati: manda un'e-mail con il link del check-in e, dove c'è un telefono, ti prepara un messaggio per WhatsApp e SMS che mandi tu con un tocco. Non lo manda da solo.
- **Chiude le partenze** di soggiorni già finiti (solo i giorni passati, mai la partenza di oggi): registra la partenza come faresti tu, **senza** dichiarare la casa pronta.

Cosa non fa mai: non invia nulla ad Alloggiati Web o all'ISTAT, non scrive dati degli ospiti, non sceglie i codici ufficiali, non dichiara «inviato» una comunicazione, non attiva immobili, non chiede il CIN e i documenti, non dichiara una casa pronta. Per queste cose ti dice che «resta a te».

Limiti: stesso ospite al massimo 3 richieste e almeno 24 ore tra l'una e l'altra; fino a 20 ospiti e 30 partenze per volta (le altre aspettano la volta dopo). L'AI scrive soltanto il testo dei messaggi WhatsApp e SMS e **non riceve nessun dato degli ospiti, dei soggiorni o tuo**: nomi, struttura, data e link li aggiunge CasaZen dopo. Se l'AI non risponde, i messaggi sono testi pronti di CasaZen e il lavoro continua lo stesso. Dopo l'esecuzione vedi cosa è stato fatto («Fatto»), cosa non è riuscito e cosa è già a posto.

### Gli avvisi di scadenza
Per ogni comunicazione non ancora inviata CasaZen ti avvisa **una volta per fase**, con un'e-mail all'indirizzo dell'organizzazione e una notifica nell'app:
1. il giorno prima dell'arrivo, alle 10:00, se mancano dati degli ospiti;
2. circa 12 ore prima della scadenza;
3. alla scadenza («scaduta»);
4. poi al massimo 2 promemoria, alle 09:00 dei giorni dopo;
5. se la comunicazione risulta rifiutata, un avviso a parte.

Se registri l'invio («Segna come inviato manualmente») o il soggiorno viene annullato, gli avvisi si fermano. Se sposti la data di arrivo ripartono per la nuova data. Se l'arrivo non è registrato, la scadenza per gli avvisi è la fine del giorno di arrivo.

### Attivazione di un immobile
Un immobile in attesa non si può prenotare dal sito. La procedura guidata ha questi passaggi: «Dati base proprietà», «Codice CIN», «Documenti richiesti», «Checklist sicurezza», «Imposta di soggiorno», «Sincronizzazione calendario» e, per gli immobili svizzeri, «Notifica degli ospiti», poi «Riepilogo e attivazione». Bloccano l'attivazione: dati base incompleti (nome, indirizzo, città, ospiti, tariffa), CIN mancante o non valido, documenti obbligatori mancanti, estintori sotto il minimo richiesto, e per la Svizzera il comune e il numero identificativo della struttura (Ticino). L'imposta di soggiorno e il calendario sono solo un avviso o un consiglio e non bloccano. L'immobile può essere **In attesa**, **Attivo** o **Sospeso**: un immobile sospeso non è visibile né prenotabile finché i punti obbligatori non sono di nuovo completi.

## Come fare

### Leggere la pagina Adempimenti
1. Apri **Affitti brevi › Adempimenti**.
2. Guarda la riga riassuntiva in alto («N da sistemare», «N in corso», «N da verificare»).
3. Parti dalle voci in **Scadenze di legge**: sono quelle con una data e il pulsante pieno.
4. Premi il pulsante della riga (per esempio «Prepara i dati» per Alloggiati Web, «Risolvi» se è stato rifiutato) per andare dove si risolve.
5. Se la voce è già a posto compare in «N adempimenti in regola»: apri l'elenco per rileggerla.

> **Nota:** se compare «Non riusciamo a controllare gli adempimenti», non significa che sia tutto in ordine: riprova tra un momento.

### Inviare Alloggiati Web con il file
Serve il permesso di leggere i dati degli ospiti per scaricare il file e quello di inviare i dati degli ospiti per registrare l'invio.
1. Apri **Affitti brevi › Adempimenti › Alloggiati**: l'elenco mette in cima gli errori, poi i soggiorni «Da inviare manualmente».
2. Premi «Prepara i dati» sulla riga: si apre la prenotazione, scheda **Documenti**, sezione «Alloggiati Web».
3. Controlla le schede degli ospiti: ogni scheda mostra «Completo», «N dati mancanti» oppure «Codici da completare». Se manca qualcosa, vedi «Completare i dati degli ospiti».
4. Premi «Scarica il file». È disponibile solo se i dati e i codici ufficiali sono completi e il soggiorno non supera 30 notti. Scaricarlo **non invia nulla**.
5. Sul portale Alloggiati Web della Questura apri il menu **File**, scegli il file, premi «Elabora» e controlla le righe corrette, poi «Prosegui». Se usi il profilo «Gestione Appartamenti», scegli prima l'appartamento sul portale.
6. Torna in CasaZen e premi «Segna come inviato manualmente». Scegli la data di invio sul portale (da quella di arrivo a oggi), spunta la conferma e premi «Conferma invio».
7. Conserva la ricevuta rilasciata dal portale e, se vuoi, caricala (vedi «Caricare una ricevuta o una prova»).

> **Attenzione:** il file contiene i dati dei documenti: conservalo con cura ed eliminalo dopo l'invio. Se lo scarichi prima del giorno di arrivo o dopo il giorno successivo, il portale lo rifiuta.

Il pulsante «Segna come inviato manualmente» non è disponibile prima del giorno di arrivo. L'azione non invia nulla alla Questura: registra soltanto la tua dichiarazione.

### Completare i dati degli ospiti
1. Apri la prenotazione e vai alla scheda **Documenti**, sezione «Alloggiati Web».
2. Premi «Modifica ospiti» (serve il permesso di modificare le prenotazioni).
3. Compila ogni ospite, minori compresi. Il documento serve solo all'ospite singolo, al capofamiglia o al capogruppo. Scegli dai menu i comuni, gli stati e i tipi di documento: CasaZen salva anche il codice ufficiale.
4. Premi «Salva ospiti».
5. In alternativa, chiedi all'ospite di compilare il check-in online: nella stessa scheda **Documenti** (stato del check-in) puoi inviare di nuovo il link o copiarlo.

Il numero del documento compare mascherato; premi «Mostra» per vederlo (richiede il permesso di leggere i dati degli ospiti, e l'apertura viene registrata).

### Correggere un invio andato male
**Invio manuale, stato «Errore» o «Rifiutato».** Il portale non ha accettato i dati.
1. Apri la prenotazione, scheda **Documenti**, sezione «Alloggiati Web».
2. Correggi gli ospiti con «Modifica ospiti» (di solito è un codice, un nome con caratteri non ammessi o una data).
3. Scarica di nuovo il file e caricalo sul portale, oppure inserisci la schedina a mano.
4. Registra l'invio con «Segna come inviato manualmente».

**Channel manager, stato «Da correggere».** La scheda dice quali ospiti non sono stati presi e perché (accesso rifiutato, luogo non riconosciuto, troppe richieste, servizio non raggiungibile).
1. Correggi il dato indicato in «Modifica ospiti» (per esempio il comune di nascita o il luogo di rilascio del documento che il channel manager non riconosce) e salva.
2. Premi «Riprova». Per correggere o riprovare serve il permesso di inviare i dati degli ospiti.
3. Se serve, apri il check-in degli ospiti e premi «Conferma e invia»: è lì che l'ospite corretto passa al channel manager. Con l'invio automatico acceso parte da solo.

**Invio diretto.** Se la Questura rifiuta il controllo preliminare, vedi «La Questura ha rifiutato il controllo preliminare. Verifica i dati degli ospiti.» e, per ogni ospite, l'esito («Acquisito», «Respinto», «Convalidato», «In attesa»). Corregge i dati; non rifare l'invio prima di aver controllato sul portale se un esito è «Acquisizione parziale» o «Esito incerto».

> **Attenzione:** se un ospite era già stato trasmesso e i suoi dati cambiano, quello che è andato alla Polizia può richiedere una correzione sul portale Alloggiati Web: CasaZen crea un'attività urgente nelle cose da fare.

### Scegliere chi invia i dati degli ospiti
Serve il permesso di modificare gli immobili. L'invio si sceglie **immobile per immobile** (non vale per le case fuori Italia).
1. Apri **Affitti brevi › Adempimenti** e premi «Controlla l'invio» sulla voce «Attiva l'invio automatico alla Questura», oppure apri la scheda immobile › «Portali istituzionali» › «Configura mittente e invio». Se l'immobile non è già scelto, scegline uno.
2. Nel passo **Chi invia** scegli una delle voci: «Il tuo channel manager» (consigliata se l'immobile è collegato), «Lo faccio io, con il file», oppure «CasaZen» se disponibile. Per un invio automatico leggi il testo della delega e spunta «Ho letto il testo e affido la trasmissione dei dati degli ospiti.»
3. Nel passo **Riepilogo** leggi «Cosa cambia», spunta «Ho capito cosa cambia e confermo» e premi «Conferma e continua».
4. Passo **Credenziali** (facoltativo): le credenziali del portale Alloggiati Web servono perché CasaZen scarichi le ricevute. Non si vedono più dopo il salvataggio. Premi «Salva e continua».
5. Passo **Pannello** (solo channel manager, su attivazione): segui le istruzioni nel pannello del channel manager e premi «Vai alla verifica».
6. Passo **Verifica**: «Controlla ora». Lo stato è «Attivo» solo se il channel manager lo conferma. Se non lo dice, puoi dichiarare tu di aver visto «Attivato»: resta uno stato «Dichiarato attivo», cioè una tua dichiarazione.
7. Premi «Conferma e concludi». Puoi uscire e riprendere dopo con «Salva ed esci»: la bozza resta. Le credenziali non vengono mai salvate nella bozza.

Se passi da un invio automatico a un altro o a quello manuale, **spegni anche l'invio automatico nel pannello del vecchio sistema**: altrimenti i dati partirebbero due volte. Finché lo stato del nuovo invio non è «Attivo», continui a inviare tu.

L'impostazione **«Invia gli ospiti da solo quando i dati sono completi e l'identità è verificata»** vale per tutta l'organizzazione e la può cambiare solo il titolare o un amministratore. Spenta (impostazione di partenza), gli ospiti vanno al channel manager solo quando confermi tu il check-in.

### Attivare l'invio diretto
Disponibile solo se nella scheda dell'immobile, nella sezione **Portali istituzionali**, compare «Configura invio diretto». Se non compare, per quell'immobile non è attivo.
1. Nella sezione **Portali istituzionali** salva le credenziali (**Credenziali Alloggiati Web (Questura)**): «Nome utente», «Password», «Chiave web service (WSKey)». Dopo il salvataggio non si vedono più; per cambiarle le inserisci di nuovo.
2. Premi «Configura invio diretto».
3. Spunta «Ho disattivato gli invii automatici precedenti, compreso l'eventuale inoltro alla Questura da ROSS1000» e «Ho riconciliato i giorni precedenti. I dati di oggi di questo servizio devono ancora essere trasmessi.»
4. Per Alloggiati Web accetta la delega.
5. Premi «Attiva CasaZen da oggi». CasaZen prima controlla le credenziali con la Questura: se non vanno compare «Attivazione non riuscita. Controlla le credenziali e lo stato degli invii prima di riprovare.»
6. Controlla con «Verifica le credenziali Questura»: deve rispondere «Autenticazione confermata dalla Questura.»

Da quel giorno compare «CasaZen invia direttamente dal {data}». Il passaggio interrompe tutti gli invii istituzionali tramite il channel manager per quell'immobile; l'altro adempimento (ISTAT o Alloggiati) resta manuale finché non lo attivi a sua volta. Una volta attivato, il pulsante «Configura mittente e invio» sparisce dalla scheda immobile: per tornare indietro rivolgiti all'assistenza.

### Caricare una ricevuta o una prova
1. Apri **Affitti brevi › Adempimenti › Report Alloggiati** («Archivio delle prove»).
2. Premi «Carica una prova» (serve il permesso di inviare i dati degli ospiti; per le prove dell'imposta di soggiorno serve anche il permesso sui pagamenti).
3. In «Cosa dimostra» scegli: «Ricevuta Alloggiati Web», «Prova ISTAT», «Dichiarazione dell'imposta di soggiorno» o «Pagamento dell'imposta di soggiorno».
4. Scegli l'immobile e il giorno (o il mese). Per una ricevuta Alloggiati vedi quanti soggiorni diventano in regola. Se usi un solo account del portale per più immobili, la ricevuta del giorno li comprende: spunta quelli che copre (tutti devono essere in Italia).
5. Scegli il file (PDF, JPG o PNG) e premi «Carica la prova».

La ricevuta Alloggiati è pronta sul portale dal giorno dopo l'invio e resta scaricabile per 30 giorni: se non l'hai ancora, la finestra ti spiega come recuperarla. Il file resta nel tuo archivio privato **per cinque anni**, poi viene cancellato.

> **Attenzione (su attivazione):** quando CasaZen ha la ricevuta di un giorno, cancella le **foto dei documenti degli ospiti** dei soggiorni che quella ricevuta mette in regola. Non si può annullare. I dati degli ospiti restano.

La scheda **Riepilogo** (su attivazione) dice cosa è richiesto nel periodo e cosa manca («N con prova · N da verificare · N mancanti · N non applicabili») e si scarica come PDF o CSV. La scheda **Prove** elenca i file, con filtri per immobile, tipo e periodo, il pulsante «Scarica» e «Scarica l'archivio (ZIP)».

### Gestire l'ISTAT
1. Apri **Adempimenti** e premi «Carica la prova» sulla voce ISTAT del mese, oppure apri la scheda immobile.
2. Leggi l'avviso: dice se il tuo channel manager invia l'ISTAT della tua regione e quando scade.
3. Se è coperto: collega l'ISTAT nel pannello del channel manager (passo guidato). Se non lo è: apri la guida del portale regionale e fai l'invio lì.
4. Quando hai la ricevuta, caricala in **Report Alloggiati** come «Prova ISTAT» (vedi sopra).

### Usare «Gestisci con AI»
1. Apri **Adempimenti** e premi «Gestisci con AI».
2. Leggi il piano: «Faccio io» (cosa farà), «Aspetto», «Resta a te».
3. Premi «Avvia».
4. Leggi il risultato («Fatto»): se ci sono messaggi per WhatsApp e SMS, premi «WhatsApp» o «SMS» per mandarli, oppure «Copia il testo».
5. Premi «Nuovo controllo» per ripetere il giro.

### Attivare un immobile
1. Apri la scheda dell'immobile e premi «Wizard attivazione» (o «Apri wizard attivazione»), oppure vai dalla voce dell'immobile in Adempimenti.
2. Completa i passaggi nell'ordine che preferisci: l'elenco mostra «completato», «consigliato» o «da completare». Puoi tornare a un passaggio senza perdere i dati.
3. Nel passo «Codice CIN» inserisci il codice (vedi [[cin-identificazione-ticino#inserire-o-correggere-il-cin]]).
4. Nel passo «Riepilogo e attivazione» spunta la conferma dei requisiti e premi «Completa attivazione». Il pulsante si abilita quando tutti i punti obbligatori sono completi.

Se resta qualcosa di consigliato (per esempio la checklist di sicurezza o i documenti ancora da completare), puoi attivare lo stesso confermando «Attivo comunque: so che la scheda di sicurezza e i documenti ancora da completare sono un mio obbligo e li completo il prima possibile.»

## Flussi completi

### Flusso: dall'arrivo dell'ospite alla ricevuta (invio manuale)
1. L'ospite compila il check-in online (vedi [[ospiti-checkin]]) oppure tu inserisci gli ospiti con «Modifica ospiti».
2. Il giorno prima dell'arrivo, se i dati sono incompleti, CasaZen ti avvisa (e «Gestisci con AI» può rimandare il link).
3. Dalle 00:00 del giorno di arrivo la comunicazione passa a «Da inviare manualmente» e compare tra le **Scadenze di legge**.
4. Tu scarichi il file e lo carichi sul portale della Questura.
5. Registri l'invio con «Segna come inviato manualmente»: la comunicazione diventa «Inviato manualmente».
6. Il giorno dopo scarichi la ricevuta dal portale e la carichi in **Report Alloggiati**: ora CasaZen ha la prova.

### Flusso: dall'arrivo alla ricevuta (con channel manager)
1. Dati degli ospiti completi e, se previsto, identità verificata ([[cin-identificazione-ticino#identificazione-degli-ospiti]]).
2. Con l'invio automatico acceso gli ospiti passano al channel manager da soli; altrimenti li invii tu con «Conferma e invia» nel check-in.
3. Il channel manager invia alla Questura: lo stato è «Affidato al channel manager, in attesa della ricevuta».
4. Carichi la ricevuta dell'account (una al giorno per account) o la controlli nel Cassetto Compliance: solo allora la voce diventa verde.

## Regole e limiti
- **Termine**: 24 ore dall'arrivo; 6 ore se il soggiorno non supera 24 ore. Il portale accetta solo arrivi di oggi o di ieri.
- **Notti**: da 1 a 30 per schedina. Oltre 30 notti CasaZen non prepara il file.
- **Nomi**: nel file i nomi si scrivono con le sole lettere A-Z (accenti tolti): un nome in caratteri cirillici o cinesi non è accettato, scrivi la traslitterazione del documento.
- **Dati**: sesso solo maschio o femmina; il documento è richiesto a ospite singolo, capofamiglia e capogruppo.
- **Immobili fuori dall'Italia**: la comunicazione alla Polizia italiana non si applica; per la Svizzera vedi [[cin-identificazione-ticino#svizzera-e-ticino-notifica-degli-ospiti]].
- **No-show**: se l'ospite non è mai arrivato, la comunicazione è «Non dovuta».
- **Nessun pulsante «Invia»**: nella scheda di una prenotazione non c'è un pulsante che trasmetta alla Questura; l'invio manuale si fa sul portale e poi si registra.
- **Conservazione**: le ricevute e le prove restano 5 anni; i dati degli ospiti vengono cancellati 5 anni dopo la partenza (vedi [[imposta-soggiorno-documenti#conservazione-e-privacy-dei-dati-degli-ospiti]]).
- **Chi può cosa**: vedere Adempimenti e Alloggiati richiede il permesso di leggere le prenotazioni (e gli immobili); registrare un invio, correggere gli ospiti per il channel manager e caricare prove richiede il permesso di inviare i dati degli ospiti; scegliere chi invia e attivare un immobile richiede il permesso di modificare gli immobili.

## Domande frequenti

### CasaZen invia davvero i dati alla Questura?
Di norma no. Prepara i dati e il file, ti ricorda la scadenza e, se l'immobile è collegato, passa gli ospiti al tuo channel manager. L'invio diretto da CasaZen esiste solo per gli immobili in cui l'hai attivato.

### Ho inviato dal portale ma la voce non diventa verde. Perché?
Il verde richiede la prova. Registrando l'invio con «Segna come inviato manualmente» la voce passa a «Inviato manualmente», ma CasaZen non ha la ricevuta. Caricala in **Report Alloggiati** e la voce si chiude.

### Posso inviare prima dell'arrivo?
No: il portale accetta solo arrivi di oggi o di ieri. Fino al giorno di arrivo la comunicazione è «Da inviare».

### La scadenza è passata: cosa faccio?
Invia appena puoi. Se la data di arrivo è più vecchia di ieri il portale rifiuta: va gestita con la Questura. Poi registra comunque l'invio in CasaZen.

### Posso cambiare chi invia?
Sì, in qualsiasi momento dalla procedura «Chi invia». Se cambi, spegni l'invio automatico del vecchio sistema.

### «Gestisci con AI» manda dei messaggi da solo?
No. L'e-mail con il link parte da CasaZen; i messaggi WhatsApp e SMS li invii tu con un tocco.

## Glossario
- **Alloggiati Web**: il servizio della Polizia di Stato dove si comunicano gli alloggiati.
- **Schedina**: la scheda di un ospite da comunicare.
- **Channel manager**: il servizio collegato (Octorate) che gestisce i canali e può inviare i dati.
- **ISTAT**: i flussi statistici regionali sulle presenze.
- **Prova**: il file (per esempio la ricevuta) che CasaZen conserva come dimostrazione.
- **Cassetto Compliance**: l'area del channel manager dove si vede l'esito degli invii.

## Vedi anche
- [[cin-identificazione-ticino]]: CIN, identificazione degli ospiti e Svizzera.
- [[imposta-soggiorno-documenti]]: imposta di soggiorno, archivio documenti e check-out.
- [[ospiti-checkin]]: il check-in online dell'ospite.
- [[canali-octorate]]: il collegamento con il channel manager.
