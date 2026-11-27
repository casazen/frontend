---
id: alloggiati-istat
titolo: Adempimenti: Alloggiati Web, ISTAT e attivazione degli immobili
menu: Adempimenti: Alloggiati e ISTAT
sezione: Adempimenti
ordine: 30
riassunto: La pagina Adempimenti ti dice cosa devi fare per essere in regola: comunicazione degli ospiti alla Questura (Alloggiati Web), statistiche ISTAT, attivazione degli immobili. Qui trovi chi invia cosa, le scadenze, cosa fanno davvero i pulsanti (nessuno avvisa la Questura da solo), come correggere un invio e cosa fa «Gestisci con AI».
chi: [gestore, amministratore]
dove: Affitti brevi › Adempimenti
parole_chiave: [adempimenti, alloggiati web, questura, polizia, schedina, schedine, comunicare ospiti, ISTAT, ROSS1000, scadenza 24 ore, ricevuta, channel manager, Octorate, invio automatico, credenziali alloggiati, file alloggiati, segna come inviato, attivazione immobile, gestisci con AI, prove, archivio delle prove, Cassetto Compliance, sanzione, sono in regola]
copre: [/app/short-rent/compliance, /app/short-rent/alloggiati, /app/short-rent/alloggiati/reports, /app/short-rent/compliance/sender, /app/short-rent/properties/:id/activation]
stato: disponibile
fonte_codice: [frontend/src/features/compliance/compliance-summary-page.tsx, frontend/src/features/compliance/lib/cockpit-model.ts, frontend/src/features/compliance/lib/compliance-tiers.ts, frontend/src/features/alloggiati/alloggiati-dashboard-page.tsx, frontend/src/features/alloggiati/components/alloggiati-booking-panel.tsx, frontend/src/pages/AlloggiatiPage.tsx, frontend/src/features/compliance/sender-wizard/sender-wizard-model.ts, frontend/src/features/compliance/activation-wizard.tsx, frontend/src/features/compliance/autopilot, frontend/src/features/compliance/lib/istat-coverage-model.ts, frontend/src/features/properties/components/property-institutional-portals.tsx, backend/Casazen.Web/Controllers/AlloggiatiController.cs, backend/Casazen.Web/Controllers/DirectPortalRoutesController.cs, backend/Casazen.Core/Regulatory/AlloggiatiTerms.cs, backend/Casazen.Core/Regulatory/AlloggiatiStatusRules.cs, backend/Casazen.Core/Services/StayAlerts.cs, backend/Casazen.Infrastructure/Services/PropertySenderStore.cs, backend/Casazen.Infrastructure/Services/ComplianceStatusService.cs, backend/docs/runbooks/alloggiati.md, backend/docs/runbooks/compliance-autopilot.md, backend/docs/runbooks/direct-institutional-portals.md]
---

## In breve
**Adempimenti** è la pagina che risponde alla domanda «sono in regola?». Mette in cima le cose con una scadenza di legge (soprattutto la comunicazione degli ospiti alla Questura, **Alloggiati Web**, entro 24 ore dall'arrivo), poi gli immobili da attivare e le cose da chiudere dopo un soggiorno.

**Alloggiati Web: CasaZen non avvisa la Questura da sola.** Raccoglie i dati degli ospiti, controlla che siano completi, prepara il file e ti ricorda la scadenza. A trasmettere è chi hai scelto in «Chi invia»: **tu**, caricando il file sul portale della Questura con le tue credenziali di Alloggiati Web (CasaZen non le crea); oppure **il tuo channel manager** (Octorate); oppure **CasaZen**, ma solo dove l'invio diretto è stato attivato. Nessun pulsante «Scarica il file», «Conferma e invia» o «Segna come inviato manualmente» trasmette alla Questura (vedi «Cosa fanno davvero i pulsanti»). Per CasaZen una comunicazione è in regola solo con la **ricevuta** del portale.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Pagina Adempimenti | Elenca ciò che richiede attenzione, in tre livelli: «Scadenze di legge», «Per iniziare a lavorare», «Da chiudere» | Affitti brevi › Adempimenti | gestore, amministratore | Disponibile | Leggere la pagina Adempimenti |
| Semaforo (Da fare / In corso / In regola / Da verificare) | Ogni voce ha uno stato; il verde compare solo se CasaZen ha la prova | Adempimenti | gestore, amministratore | Su attivazione | Leggere la pagina Adempimenti |
| Elenco Alloggiati | Una riga per ogni soggiorno con stato, scadenza e pulsante per registrare l'invio | Adempimenti › Alloggiati | gestore, amministratore | Disponibile | Comunicare gli ospiti alla Questura (Alloggiati Web) |
| Sezione «Alloggiati Web» della prenotazione | Dati di ogni ospite da copiare, file per il portale, stato e scadenza | Prenotazioni › una prenotazione › scheda «Documenti» | gestore, amministratore | Disponibile | Comunicare gli ospiti alla Questura (Alloggiati Web) |
| «Modifica ospiti» | Inserisce o corregge gli ospiti del soggiorno | Scheda «Documenti» della prenotazione | chi può inviare i dati degli ospiti | Disponibile | Completare i dati degli ospiti |
| «Segna come inviato manualmente» | Registra che hai inviato tu la comunicazione sul portale (non trasmette nulla) | Elenco Alloggiati e scheda della prenotazione | chi può inviare i dati degli ospiti | Disponibile | Comunicare gli ospiti alla Questura (Alloggiati Web) |
| Invio tramite channel manager | Gli ospiti passano al tuo channel manager (Octorate), che li invia alla Questura | Scelta in «Chi invia» | gestore, amministratore | Su attivazione | Scegliere chi invia i dati degli ospiti |
| Invio diretto da CasaZen | CasaZen invia con le credenziali Alloggiati Web dell'immobile | Scheda immobile › «Portali istituzionali» | chi può modificare gli immobili | Su attivazione | Attivare l'invio diretto |
| Chi invia (procedura guidata) | Sceglie e verifica chi trasmette i dati degli ospiti | Adempimenti › Alloggiati o scheda immobile | chi può modificare gli immobili | Disponibile | Scegliere chi invia i dati degli ospiti |
| Archivio delle prove (Report Alloggiati) | Conserva ricevute Alloggiati, prove ISTAT e ricevute dell'imposta di soggiorno | Adempimenti › Report Alloggiati | gestore, amministratore | Disponibile | Caricare una ricevuta o una prova |
| ISTAT | Ti dice se l'ISTAT della tua Regione parte dal channel manager o va fatto sul portale regionale, e conserva la prova | Adempimenti, procedura «Chi invia», scheda immobile | gestore, amministratore | Disponibile | Comunicare l'ISTAT della tua Regione |
| ROSS1000 (Lombardia) | Anteprima e invio del movimento giornaliero | Scheda immobile › «Portali istituzionali» | chi può modificare gli immobili | Su attivazione | Comunicare l'ISTAT della tua Regione |
| Attivazione dell'immobile | Procedura guidata con i requisiti per rendere prenotabile la casa | Scheda immobile › «Wizard attivazione» | chi può modificare gli immobili | Disponibile | Attivare gli adempimenti di un immobile |
| «Gestisci con AI» | Fa al posto tuo alcune cose pratiche (chiedere i dati agli ospiti, chiudere partenze) | Adempimenti, pulsante in alto | chi può modificare le prenotazioni | Disponibile | Usare «Gestisci con AI» |
| Avvisi sulle scadenze | E-mail e notifiche prima e dopo la scadenza di Alloggiati Web | Arrivano da sole | gestore, amministratore | Disponibile | Capire gli avvisi |

## Come funziona

### Cosa vedi nella pagina Adempimenti
Il titolo della pagina è «Sono in regola?». Le voci sono divise in tre livelli:

- **Scadenze di legge** («Rischi una sanzione»). Alloggiati Web, i dati degli ospiti che servono per inviarlo, ISTAT, l'imposta di soggiorno di un mese, la notifica agli enti svizzeri e l'invio automatico alla Questura quando va sistemato. Questo livello è sempre in vista e il suo numero compare accanto alla voce di menu «Adempimenti». Se c'è una scadenza, la riga la dice in parole: «Entro oggi», «Entro domani», «Scaduto da 3 giorni».
- **Per iniziare a lavorare**. Gli immobili da attivare (CIN, documenti, checklist di sicurezza). Finché non sono a posto, queste case non si attivano e non si possono prenotare dal tuo sito.
- **Da chiudere**. La cura dei soggiorni: partenze da chiudere, case da dichiarare pronte per il prossimo ospite, identità degli ospiti da verificare.

Sotto trovi due elenchi chiusi: «N adempimenti in regola» e «N case in regola». Ogni riga ha un pulsante che ti porta dove si risolve (la scheda della prenotazione, la procedura di attivazione, l'archivio delle prove). Se non hai il permesso per fare l'azione, il pulsante diventa «Apri»: puoi guardare ma non modificare.

> **Attenzione:** una voce che non c'è non vuol dire che non ci sia niente da fare. Alcune voci compaiono solo quando CasaZen conosce i dati che servono: la voce ISTAT solo se conosce la scadenza della tua Regione (vedi «ISTAT»), la voce dell'imposta di soggiorno solo per i mesi già chiusi in cui c'è un'imposta.

Il **semaforo** dà a ogni voce uno stato: «Da fare», «In corso», «In regola» o «Da verificare». È su attivazione ([[per-iniziare#cosa-significa-su-attivazione]]): lo accende CasaZen per la tua organizzazione, chiedilo all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»). Il verde compare **solo quando CasaZen ha la prova** (per esempio la ricevuta archiviata). Senza la prova la voce resta gialla o «Da verificare», anche se hai già inviato.

Il pulsante «Verifica nel tuo Cassetto Compliance» compare, con il semaforo, accanto alle voci il cui esito si vede solo nell'area del channel manager (Octorate). CasaZen non legge quell'esito e non lo registra come prova: ti porta nella sezione giusta e ti dice cosa controllare.

### Alloggiati Web: la regola, il termine, il portale
Chi dà alloggio deve comunicare alla Questura i dati di ogni ospite, minori compresi (una «schedina» per persona), usando **Alloggiati Web**, il servizio della Polizia di Stato. La legge (art. 109 del Testo Unico delle Leggi di Pubblica Sicurezza) chiede di farlo **entro 24 ore dall'arrivo**, oppure **entro 6 ore** se il soggiorno non supera le 24 ore. Un'omissione può portare a una sanzione.

Come CasaZen conta il termine:
- Parte dall'**arrivo registrato** in CasaZen (il check-in fatto dall'host). Se l'arrivo non è registrato, parte dalle **00:00 del giorno di arrivo** (ora italiana): è la stima più prudente.
- Le prenotazioni hanno solo le date, non gli orari. Per questo CasaZen applica le **6 ore a ogni soggiorno di una notte o meno**: il termine che vedi non è mai più largo di quello di legge.
- Esempio: soggiorno di 3 notti, arrivo non registrato, arrivo il 10: la scadenza mostrata è alle 00:00 dell'11. Soggiorno di una notte, arrivo non registrato, arrivo il 10: la scadenza mostrata è alle 06:00 del 10. Con l'arrivo registrato il termine parte dall'orario del check-in.

La regola del **portale** è un'altra e va aggiunta al termine: Alloggiati Web accetta solo schedine con **data di arrivo di oggi o di ieri**. Quindi non si può inviare in anticipo: prima del giorno di arrivo la comunicazione resta «Da inviare». E se la data di arrivo è più vecchia di ieri il portale rifiuta la schedina: una comunicazione così in ritardo va gestita con la Questura.

Per ogni ospite CasaZen tiene: tipo di ospite (ospite singolo, capofamiglia, capogruppo, familiare, membro del gruppo), cognome, nome, sesso, data e luogo di nascita, cittadinanza e, per ospite singolo, capofamiglia e capogruppo, tipo e numero del documento e luogo di rilascio. I familiari seguono il loro capofamiglia, i membri il loro capogruppo. Per una schedina il soggiorno può durare da 1 a 30 notti: oltre le 30 notti CasaZen non prepara il file (per i soggiorni più lunghi il portale chiede una nuova schedina come nuovo arrivo, che CasaZen non costruisce).

### Cosa ti serve per inviare: le credenziali di Alloggiati Web
Per caricare il file sul portale servono le **credenziali di Alloggiati Web (nome utente e password)**, che rilascia la Questura. **CasaZen non le crea e non può chiederle per te.** Se non le hai ancora, chiedile alla Questura prima del primo ospite: senza non puoi inviare e il termine corre lo stesso.

In CasaZen i tre campi delle credenziali («Nome utente», «Password», «Chiave web service (WSKey)») servono a due cose: scaricare in automatico le **ricevute** (consigliato con il channel manager) e, dove l'**invio diretto** è attivo (su attivazione), far trasmettere i dati ad Alloggiati Web da CasaZen. Per l'invio a mano non servono. La WSKey è una chiave del servizio web del portale, diversa dalla password. Dopo il salvataggio non si rivedono più.

### Chi invia i dati degli ospiti
Chi trasmette si sceglie **immobile per immobile**, nella procedura «Chi invia»:

- **Lo faccio io, con il file** (invio manuale). CasaZen prepara i dati e il file; lo carichi tu sul portale Alloggiati Web e poi premi «Segna come inviato manualmente». CasaZen non riceve la ricevuta: registra la tua dichiarazione. Lo stato è «Inviato manualmente».
- **Il tuo channel manager**. Se l'immobile è collegato a Octorate, i dati degli ospiti passano al channel manager, che li invia alla Questura ogni giorno. Lo stato è «Affidato al channel manager, in attesa della ricevuta». Per CasaZen la comunicazione è fatta (verde) solo quando la **ricevuta è archiviata**. Su attivazione.
- **CasaZen** (invio diretto). Su attivazione, solo per gli immobili per cui è stato predisposto. Nella procedura «Chi invia» la voce «CasaZen» compare ma non si sceglie da lì: sotto la voce leggi «Non si sceglie da qui: dove è disponibile, l'invio diretto si attiva dalla scheda dell'immobile» (vedi «Attivare l'invio diretto»). Quando l'invio diretto è già attivo, nessuna delle tre voci si cambia da questa procedura: sotto ognuna leggi «Non si cambia da qui: con l'invio diretto attivo serve l'assistenza».

**Cosa succede se non hai mai scelto.** Per un immobile non collegato a Octorate vale «Lo faccio io, con il file». Per un immobile già collegato a Octorate (annuncio abbinato e confermato) CasaZen parte da «Il tuo channel manager»: aprilo in «Chi invia» e controlla che lo stato sia **«Attivo»**. È «Attivo» solo se Octorate conferma che invia davvero. Se l'invio automatico degli ospiti è spento, sotto «Adesso» la procedura aggiunge «Di partenza non parte nulla da solo: gli ospiti vanno al tuo channel manager solo quando confermi tu il check-in. Controlla lo stato in Adempimenti.» In ogni caso una prenotazione resta «Da inviare manualmente» dal giorno di arrivo finché gli ospiti non risultano passati al channel manager o tu non dichiari l'invio: CasaZen non considera mai fatta una comunicazione senza motivo.

> **Nota:** CasaZen non ti toglie la responsabilità della comunicazione: restano tue la correttezza dei dati e il rispetto della scadenza. Se scegli un invio automatico, lo dichiari in una delega che ti viene mostrata e che devi accettare.

### Cosa fanno davvero i pulsanti
**Nessun pulsante di CasaZen avvisa la Questura per te**, tranne l'invio diretto attivato. Se il pulsante dice «invia» non vuol dire che la Questura sia stata avvisata.

| Pulsante | Cosa fa | Cosa non fa |
|---|---|---|
| «Scarica il file» (scheda «Documenti» della prenotazione) | Prepara il file con i dati degli ospiti, da caricare sul portale | Non invia nulla e non cambia nessuno stato |
| «Conferma e invia» (check-in guidato, vedi [[ospiti-checkin]]) | Salva i dati confermati in CasaZen. Se il mittente è il channel manager e la prenotazione è collegata a Octorate, manda gli ospiti a Octorate | Non avvisa la Questura: lo fa Octorate, con i suoi tempi. Se il mittente sei tu, non manda niente neanche a Octorate |
| «Segna come inviato manualmente» | Registra che hai già caricato i dati sul portale, con la data che scegli e il tuo nome utente. Spegne gli avvisi su quel soggiorno e chiude il check-in online dell'ospite (il link non gli viene più mandato) | Non trasmette nulla, non riceve la ricevuta e non rende verde la voce. Da questa schermata non si annulla |
| «Carica la prova» (Report Alloggiati) | Archivia la ricevuta che hai scaricato dal portale | Non invia nulla |
| «Gestisci con AI» | Chiede i dati agli ospiti e chiude le partenze | Non invia nulla ad Alloggiati Web o all'ISTAT |
| Check-in online dell'ospite | L'ospite compila i suoi dati | Non comunica nulla alla Questura |

Per sapere se la Questura ha ricevuto i dati serve la **ricevuta** del portale, disponibile dal giorno dopo l'invio.

### Gli stati di una comunicazione
- **Da inviare**: aspetta il giorno di arrivo.
- **Da inviare manualmente**: è il giorno di arrivo (dalle 00:00 ora italiana) e la comunicazione è dovuta. Tocca a te (se per l'immobile non è attivo l'invio diretto di CasaZen, CasaZen non la trasmette), o al channel manager se gli ospiti non sono ancora passati da lui.
- **Inviato manualmente**: hai dichiarato tu l'invio, con la data. CasaZen non ha la ricevuta: conserva quella rilasciata dal portale.
- **Inviato (ricevuta)**: c'è la ricevuta vera. Con l'invio diretto compare anche il pulsante «Scarica ricevuta Questura».
- **Affidato al channel manager, in attesa della ricevuta**: gli ospiti sono partiti verso il channel manager; mancano la ricevuta o l'esito.
- **Da correggere**: il channel manager non ha accettato uno o più ospiti.
- **Errore** e **Rifiutato**: la preparazione è fallita o il portale ha rifiutato i dati. Vedi «Correggere un invio andato male».
- **Trasmissione in corso**, **Acquisizione parziale · verifica gli ospiti sul portale**, **Esito incerto · verifica sul portale prima di ripetere l'invio**, **Inviato, ricevuta in attesa**: stati dell'invio diretto.
- **Non dovuta**: non c'è niente da comunicare (per esempio l'ospite non è mai arrivato).

### ISTAT: cosa fa CasaZen e cosa resta a te
L'**ISTAT** qui è la rilevazione statistica sul movimento dei clienti (arrivi e presenze) che le strutture comunicano alla propria **Regione**. Non è la comunicazione alla Questura. Ogni Regione ha il suo portale (in Lombardia si chiama **ROSS1000**), la sua frequenza e le sue regole. CasaZen **non invia l'ISTAT**, salvo il caso su attivazione di ROSS1000 in Lombardia.

Quello che fa CasaZen:

- Per ogni immobile ti dice **se il tuo channel manager invia l'ISTAT della tua Regione**: «copre», «non copre» oppure «da verificare». Dice «copre» o «non copre» solo quando lo staff di CasaZen ha controllato la Regione; altrimenti scrive «da verificare» e non promette niente.
- Ti mostra il **portale della Regione** e la **scadenza** del flusso: un giorno del mese successivo, ogni giorno, oppure «da verificare». Le scadenze e i portali regionali li leggi nell'avviso ISTAT della scheda dell'immobile e nella procedura «Chi invia»: CasaZen non ne inventa.
- Ti indica il passo successivo: collegare l'ISTAT nel pannello del channel manager, aprire la guida del portale regionale, oppure chiedere aiuto all'assistenza.
- Tra gli adempimenti compare «Carica la prova ISTAT di {mese}»: serve la **prova** (la ricevuta del portale) caricata nell'archivio delle prove. La voce compare **solo per le Regioni di cui CasaZen conosce il giorno di scadenza** e solo per i mesi con soggiorni; è verde con la prova caricata, diventa rossa dopo la scadenza se la prova manca.

**Se non vedi la voce ISTAT** non vuol dire che l'ISTAT non sia dovuto: vuol dire che CasaZen non conosce la scadenza della tua Regione. Apri la scheda dell'immobile, leggi l'avviso ISTAT e controlla sul portale della tua Regione se devi comunicare e quando. CasaZen non decide per te se sei obbligato.

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
Per ogni comunicazione non ancora inviata o dichiarata CasaZen ti avvisa **una volta per fase**, con un'e-mail all'indirizzo dell'organizzazione e una notifica nell'app a chi gestisce l'immobile:
1. il giorno prima dell'arrivo, alle 10:00, se mancano dati degli ospiti;
2. circa 12 ore prima della scadenza (non prima delle 00:00 del giorno di arrivo);
3. alla scadenza («scaduta»);
4. poi, di norma, al massimo 2 promemoria, alle 09:00 dei giorni dopo;
5. se la comunicazione risulta rifiutata, un avviso a parte.

Se premi «Segna come inviato manualmente» o il soggiorno viene annullato, gli avvisi si fermano: per questo premi il pulsante solo quando hai davvero caricato il file sul portale. Se sposti la data di arrivo gli avvisi ripartono per la nuova data. Se l'arrivo non è registrato, per gli avvisi la scadenza è la fine del giorno di arrivo (per i soggiorni di una notte la scadenza mostrata nella prenotazione è più stretta: 06:00 del giorno di arrivo).

Con il semaforo attivo ci sono avvisi in più: «ricevuta mancante» il giorno dopo la comunicazione se la ricevuta non è archiviata; per i soggiorni di una notte e per quelli oltre 30 notti, che il channel manager non copre da solo, un avviso prima dell'arrivo.

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

### Comunicare gli ospiti alla Questura (Alloggiati Web)
**Ti serve:** il permesso di leggere i dati degli ospiti (per scaricare il file) e quello di inviare i dati degli ospiti (per registrare l'invio); le credenziali di Alloggiati Web rilasciate dalla Questura; i dati completi di tutti gli ospiti, minori compresi, e il documento dell'ospite singolo, del capofamiglia o del capogruppo; un **computer**, perché il file si scarica e poi si carica sul portale (da telefono è scomodo).

1. Apri **Affitti brevi › Adempimenti › Alloggiati**: l'elenco mette in cima gli errori, poi i soggiorni «Da inviare manualmente».
2. Premi «Prepara i dati» sulla riga: si apre la prenotazione, scheda **Documenti**, sezione «Alloggiati Web».
3. Controlla le schede degli ospiti: ogni scheda mostra «Completo», «N dati mancanti» oppure «Codici da completare». Se manca qualcosa, vedi «Completare i dati degli ospiti».
4. Premi «Scarica il file». È disponibile solo se i dati e i codici ufficiali sono completi e il soggiorno non supera 30 notti. Scaricarlo **non invia nulla**.
5. Sul portale Alloggiati Web della Questura apri il menu **File**, scegli il file, premi «Elabora» e controlla le righe corrette, poi «Prosegui». Se usi il profilo «Gestione Appartamenti» (quello del portale per chi gestisce appartamenti), scegli prima l'appartamento sul portale. Con «Prosegui» la comunicazione è fatta: il portale accetta solo arrivi di oggi o di ieri.
6. Torna in CasaZen e premi «Segna come inviato manualmente». Scegli la data di invio sul portale (da quella di arrivo a oggi), spunta la conferma e premi «Conferma invio». Prima di confermare la finestra ti dice che cosa succede: CasaZen smette di avvisarti su quel soggiorno e considera concluso il check-in online dell'ospite (il link non gli viene più mandato).
7. Il giorno dopo scarica dal portale la **ricevuta**: è pronta dal giorno dopo l'invio e resta scaricabile per 30 giorni. Caricala in **Report Alloggiati** (vedi «Caricare una ricevuta o una prova»). Finché non lo fai la voce non diventa verde.

> **Attenzione:** premi «Segna come inviato manualmente» solo **dopo** aver caricato il file sul portale e controllato che le righe siano corrette. Da quel momento CasaZen non ti manda più avvisi su quel soggiorno, considera concluso il check-in online dell'ospite (il link non gli viene più mandato) e non controlla che l'invio sia avvenuto. Da questa schermata la dichiarazione non si annulla.

> **Attenzione:** il file contiene i dati dei documenti: conservalo con cura ed eliminalo dopo l'invio. Il limite «oggi o ieri» vale quando **carichi** il file sul portale: se lo carichi prima del giorno di arrivo o dopo il giorno successivo, il portale lo rifiuta.

### Completare i dati degli ospiti
**Ti serve:** il permesso di inviare i dati degli ospiti.
1. Apri la prenotazione e vai alla scheda **Documenti**, sezione «Alloggiati Web».
2. Premi «Modifica ospiti».
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
**Ti serve:** il permesso di modificare gli immobili; per il channel manager, l'immobile collegato a Octorate (vedi [[canali-octorate]]); se vuoi le ricevute automatiche, le credenziali di Alloggiati Web.

L'invio si sceglie **immobile per immobile** (non vale per le case fuori Italia).
1. Apri **Affitti brevi › Adempimenti** e premi «Controlla l'invio» sulla voce «Attiva l'invio automatico alla Questura», oppure apri la scheda immobile › «Portali istituzionali» › «Configura mittente e invio». Se l'immobile non è già scelto, scegline uno.
2. Nel passo **Chi invia** scegli una delle voci: «Il tuo channel manager» (consigliata se l'immobile è collegato), «Lo faccio io, con il file», oppure «CasaZen» se disponibile. Per un invio automatico leggi il testo della delega e spunta «Ho letto il testo e affido la trasmissione dei dati degli ospiti.»
3. Nel passo **Riepilogo** leggi «Cosa cambia», spunta «Ho capito cosa cambia e confermo» e premi «Conferma e continua».
4. Passo **Credenziali** (facoltativo): scrivi «Nome utente», «Password» e «Chiave web service (WSKey)» di Alloggiati Web (devono esserci tutti e tre) perché CasaZen scarichi le ricevute. Non si vedono più dopo il salvataggio. Premi «Salva e continua», oppure salta il passo.
5. Passo **Pannello** (solo channel manager, su attivazione): segui le istruzioni nel pannello del channel manager e premi «Vai alla verifica». Il channel manager può chiedere un suo modulo di gestione, di solito a pagamento: controlla il tuo abbonamento.
6. Passo **Verifica**: «Controlla ora». Lo stato è «Attivo» solo se il channel manager lo conferma. Se non lo dice, la procedura ti chiede «Hai visto lo stato «Attivato»?»: rispondi «Sì, l'ho visto» solo se lo vedi nel pannello del channel manager. Lo stato diventa «Dichiarato attivo»: è una tua dichiarazione, CasaZen non può verificarla.
7. Premi «Conferma e concludi». Puoi uscire e riprendere dopo con «Salva ed esci»: la bozza resta. Le credenziali non vengono mai salvate nella bozza.

> **Attenzione:** se dichiari «Attivato» senza averlo visto e il channel manager in realtà non sta inviando, **nessuno comunica gli ospiti alla Questura** e la responsabilità resta tua. Quando Octorate non permette di verificare, la tua dichiarazione fa anche sparire da Adempimenti l'avviso giallo su questo punto. Dichiaralo solo se lo hai controllato.

Se passi da un invio automatico a un altro o a quello manuale, **spegni anche l'invio automatico nel pannello del vecchio sistema**: altrimenti i dati partirebbero due volte. Finché lo stato del nuovo invio non è «Attivo», continui a inviare tu.

L'impostazione **«Invia gli ospiti da solo quando i dati sono completi e l'identità è verificata»** vale per tutta l'organizzazione e la può cambiare solo il titolare o un amministratore. Spenta (impostazione di partenza), gli ospiti vanno al channel manager solo quando confermi tu il check-in.

### Attivare l'invio diretto
**Ti serve:** l'immobile in Italia, il permesso di modificare gli immobili e le credenziali di Alloggiati Web. È su attivazione ([[per-iniziare#cosa-significa-su-attivazione]]): lo predispone CasaZen per gli immobili che lo richiedono, chiedilo all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»).

Disponibile solo se nella scheda dell'immobile, nella sezione **Portali istituzionali**, compare «Configura invio diretto». Se non compare, per quell'immobile non è attivo.
1. Nella sezione **Portali istituzionali** salva le credenziali (**Credenziali Alloggiati Web (Questura)**): «Nome utente», «Password», «Chiave web service (WSKey)». Dopo il salvataggio non si vedono più; per cambiarle le inserisci di nuovo.
2. Premi «Configura invio diretto».
3. Spunta «Ho disattivato gli invii automatici precedenti, compreso l'eventuale inoltro alla Questura da ROSS1000» e «Ho riconciliato i giorni precedenti. I dati di oggi di questo servizio devono ancora essere trasmessi.»
4. Per Alloggiati Web accetta la delega.
5. Premi «Attiva CasaZen da oggi». CasaZen prima controlla le credenziali con la Questura: se non vanno compare «Attivazione non riuscita. Controlla le credenziali e lo stato degli invii prima di riprovare.»
6. Controlla con «Verifica le credenziali Questura»: deve rispondere «Autenticazione confermata dalla Questura.»

Da quel giorno compare «CasaZen invia direttamente dal {data}». Il passaggio interrompe tutti gli invii istituzionali tramite il channel manager per quell'immobile; l'altro adempimento (ISTAT o Alloggiati) resta manuale finché non lo attivi a sua volta. Da allora «Segna come inviato manualmente» non è più disponibile per i soggiorni dalla data di attivazione in poi. Una volta attivato, il pulsante «Configura mittente e invio» sparisce dalla scheda immobile: per tornare indietro rivolgiti all'assistenza.

### Caricare una ricevuta o una prova
**Ti serve:** la ricevuta scaricata dal portale (PDF, JPG o PNG) e il permesso di inviare i dati degli ospiti; per le prove dell'imposta di soggiorno anche quello sui pagamenti.

> **Attenzione (su attivazione):** quando CasaZen ha la ricevuta di un giorno, cancella le **foto dei documenti degli ospiti** dei soggiorni che quella ricevuta mette in regola. Non si può annullare. I dati degli ospiti restano. Carica la ricevuta solo quando sei pronto a perdere le foto.

1. Apri **Affitti brevi › Adempimenti › Report Alloggiati** («Archivio delle prove»).
2. Premi «Carica una prova».
3. In «Cosa dimostra» scegli: «Ricevuta Alloggiati Web», «Prova ISTAT», «Dichiarazione dell'imposta di soggiorno» o «Pagamento dell'imposta di soggiorno».
4. Scegli l'immobile e il giorno (o il mese). Per una ricevuta Alloggiati vedi quanti soggiorni diventano in regola. Se usi un solo account del portale per più immobili, la ricevuta del giorno li comprende: spunta quelli che copre (tutti devono essere in Italia).
5. Scegli il file (PDF, JPG o PNG) e premi «Carica la prova».

La ricevuta Alloggiati è pronta sul portale dal giorno dopo l'invio e resta scaricabile per 30 giorni: se non l'hai ancora, la finestra ti spiega come recuperarla. Il file resta nel tuo archivio privato **per cinque anni**, poi viene cancellato.

La scheda **Riepilogo** (su attivazione) dice cosa è richiesto nel periodo e cosa manca («N con prova · N da verificare · N mancanti · N non applicabili») e si scarica come PDF o CSV. La scheda **Prove** elenca i file, con filtri per immobile, tipo e periodo, il pulsante «Scarica» e «Scarica l'archivio (ZIP)».

### Comunicare l'ISTAT della tua Regione
**Ti serve:** sapere in che Regione è l'immobile e avere l'accesso al portale della Regione (o il channel manager che lo copre); la ricevuta del portale da caricare.
1. Apri **Adempimenti** e premi «Carica la prova» sulla voce ISTAT del mese, oppure apri la scheda immobile (così leggi l'avviso anche se la voce non c'è).
2. Leggi l'avviso: dice se il tuo channel manager invia l'ISTAT della tua Regione, qual è il portale regionale e quando scade.
3. Se è coperto: collega l'ISTAT nel pannello del channel manager (passo guidato). Se non lo è: apri la guida del portale regionale e fai l'invio lì.
4. Quando hai la ricevuta, caricala in **Report Alloggiati** come «Prova ISTAT» (vedi sopra). CasaZen non controlla il contenuto: conta che l'hai caricata tu.

### Usare «Gestisci con AI»
1. Apri **Adempimenti** e premi «Gestisci con AI».
2. Leggi il piano: «Faccio io» (cosa farà), «Aspetto», «Resta a te».
3. Premi «Avvia».
4. Leggi il risultato («Fatto»): se ci sono messaggi per WhatsApp e SMS, premi «WhatsApp» o «SMS» per mandarli, oppure «Copia il testo».
5. Premi «Nuovo controllo» per ripetere il giro.

### Attivare gli adempimenti di un immobile
**Ti serve:** il permesso di modificare gli immobili; il CIN dell'immobile (se non ce l'hai, vedi [[cin-identificazione-ticino#chiedere-il-cin]]); i documenti che la procedura elenca.
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
4. Tu scarichi il file e lo carichi sul portale della Questura, entro 24 ore dall'arrivo (6 ore se il soggiorno è di una notte o meno).
5. Registri l'invio con «Segna come inviato manualmente»: la comunicazione diventa «Inviato manualmente».
6. Il giorno dopo scarichi la ricevuta dal portale e la carichi in **Report Alloggiati**: ora CasaZen ha la prova.

### Flusso: dall'arrivo alla ricevuta (con channel manager)
1. Dati degli ospiti completi e, se previsto, identità verificata ([[cin-identificazione-ticino#identificazione-degli-ospiti]]).
2. Con l'invio automatico acceso gli ospiti passano al channel manager da soli; altrimenti li invii tu con «Conferma e invia» nel check-in.
3. Il channel manager invia alla Questura: lo stato è «Affidato al channel manager, in attesa della ricevuta».
4. Carichi la ricevuta dell'account (una al giorno per account) o la controlli nel Cassetto Compliance: solo allora la voce diventa verde.

## Regole e limiti
- **Termine di legge**: 24 ore dall'arrivo; 6 ore se il soggiorno non supera le 24 ore. CasaZen applica le 6 ore ai soggiorni di una notte o meno. Il conteggio parte dall'arrivo registrato o, in mancanza, dalle 00:00 del giorno di arrivo (ora italiana).
- **Regola del portale**: accetta solo schedine con data di arrivo di oggi o di ieri. Non si invia in anticipo; una comunicazione più vecchia di ieri si gestisce con la Questura.
- **Cosa non parte da solo**: nessun pulsante di CasaZen avvisa la Questura (salvo l'invio diretto attivato). «Conferma e invia» manda al massimo gli ospiti a Octorate; «Segna come inviato manualmente» registra solo la tua dichiarazione.
- **Credenziali**: quelle di Alloggiati Web le rilascia la Questura; CasaZen non le crea. Servono per caricare il file sul portale; in CasaZen servono (facoltative) per le ricevute automatiche e per l'invio diretto.
- **Notti**: da 1 a 30 per schedina. Oltre 30 notti CasaZen non prepara il file.
- **Nomi**: nel file i nomi si scrivono con le sole lettere A-Z (accenti tolti): un nome in caratteri cirillici o cinesi non è accettato, scrivi la traslitterazione del documento.
- **Dati**: sesso solo maschio o femmina; il documento è richiesto a ospite singolo, capofamiglia e capogruppo.
- **Immobili fuori dall'Italia**: la comunicazione alla Polizia italiana non si applica; per la Svizzera vedi [[cin-identificazione-ticino#svizzera-e-ticino-notifica-degli-ospiti]].
- **No-show**: se l'ospite non è mai arrivato, la comunicazione è «Non dovuta».
- **Nessun pulsante «Invia» verso la Questura**: nella scheda di una prenotazione non c'è un pulsante che trasmetta alla Questura; l'invio manuale si fa sul portale e poi si registra.
- **ISTAT**: la voce compare solo per le Regioni di cui CasaZen conosce la scadenza; se non c'è, controlla sul portale della tua Regione.
- **Conservazione**: le ricevute e le prove restano 5 anni; i dati degli ospiti vengono cancellati 5 anni dopo la partenza (vedi [[imposta-soggiorno-documenti#conservazione-e-privacy-dei-dati-degli-ospiti]]).
- **Chi può cosa**: vedere Adempimenti e Alloggiati richiede il permesso di leggere le prenotazioni (e gli immobili); scaricare il file richiede quello di leggere i dati degli ospiti; registrare un invio, correggere gli ospiti («Modifica ospiti»), riprovare un invio al channel manager e caricare prove richiede il permesso di inviare i dati degli ospiti; scegliere chi invia e attivare un immobile richiede il permesso di modificare gli immobili.

## Domande frequenti

### Ho premuto «Conferma e invia»: la Questura è stata avvisata?
No. «Conferma e invia» (nel check-in guidato) salva i dati in CasaZen e, solo se il mittente è il tuo channel manager e la prenotazione è collegata a Octorate, manda gli ospiti a Octorate, che poi li invia alla Questura. Se il mittente sei tu non parte niente: devi caricare il file sul portale Alloggiati Web e poi premere «Segna come inviato manualmente». Controlla lo stato in **Adempimenti › Alloggiati**.

### CasaZen invia davvero i dati alla Questura?
Di norma no. Prepara i dati e il file, ti ricorda la scadenza e, se l'immobile è collegato, passa gli ospiti al tuo channel manager. L'invio diretto da CasaZen esiste solo per gli immobili in cui l'hai attivato.

### Come ottengo le credenziali di Alloggiati Web?
Le rilascia la Questura: CasaZen non le crea e non può chiederle per te. Chiedile prima del primo ospite. Senza le credenziali non puoi caricare il file sul portale. Se il tuo channel manager invia per te, le credenziali nel pannello del channel manager servono a lui; in CasaZen le salvi solo se vuoi le ricevute automatiche.

### Ho inviato dal portale ma la voce non diventa verde. Perché?
Il verde richiede la prova. Registrando l'invio con «Segna come inviato manualmente» la voce passa a «Inviato manualmente», ma CasaZen non ha la ricevuta. Scaricala dal portale il giorno dopo e caricala in **Report Alloggiati**: la voce si chiude.

### Quanto tempo ho per comunicare gli ospiti?
24 ore dall'arrivo, 6 ore se il soggiorno non supera le 24 ore (CasaZen applica le 6 ore ai soggiorni di una notte o meno). Il portale accetta solo arrivi di oggi o di ieri: per stare tranquillo invia il giorno stesso dell'arrivo.

### Posso inviare prima dell'arrivo?
No: il portale accetta solo arrivi di oggi o di ieri. Fino al giorno di arrivo la comunicazione è «Da inviare». Scaricare il file prima non fa danni, ma il portale lo rifiuta se lo carichi troppo presto.

### La scadenza è passata: cosa faccio?
Invia appena puoi. Se la data di arrivo è più vecchia di ieri il portale rifiuta: va gestita con la Questura. Poi registra comunque l'invio in CasaZen.

### Posso cambiare chi invia?
Sì, in qualsiasi momento dalla procedura «Chi invia». Se cambi, spegni l'invio automatico del vecchio sistema.

### Ho dichiarato «Attivato» ma non sono sicuro che il channel manager invii. Cosa rischio?
Se non invia, nessuno comunica gli ospiti alla Questura e la responsabilità è tua. Apri **Adempimenti › Alloggiati › Chi invia** e rifai «Controlla ora»; controlla anche nel pannello del channel manager che l'invio automatico giornaliero sia acceso. Finché non sei sicuro, invia tu con il file.

### Devo comunicare anche l'ISTAT? Non vedo la voce in Adempimenti.
L'ISTAT è la statistica sul movimento dei clienti che si comunica alla propria Regione, ognuna con il suo portale e le sue regole. La voce in Adempimenti compare solo se CasaZen conosce la scadenza della tua Regione. Se non c'è, apri la scheda dell'immobile, leggi l'avviso ISTAT e controlla sul portale regionale se devi comunicare.

### «Gestisci con AI» manda dei messaggi da solo?
No. L'e-mail con il link parte da CasaZen; i messaggi WhatsApp e SMS li invii tu con un tocco.

## Glossario
- **Alloggiati Web**: il servizio della Polizia di Stato dove si comunicano gli alloggiati.
- **Schedina**: la scheda di un ospite da comunicare.
- **TULPS**: il Testo Unico delle Leggi di Pubblica Sicurezza; l'art. 109 obbliga a comunicare gli ospiti alla Questura.
- **Questura**: l'ufficio della Polizia di Stato che riceve la comunicazione degli ospiti e rilascia le credenziali di Alloggiati Web.
- **WSKey (chiave web service)**: chiave del servizio web del portale Alloggiati Web, diversa dalla password.
- **Gestione Appartamenti**: profilo del portale Alloggiati Web per chi gestisce appartamenti (si sceglie l'appartamento prima di caricare il file).
- **Channel manager**: il servizio collegato (Octorate) che gestisce i canali e può inviare i dati.
- **ISTAT**: la statistica regionale sul movimento dei clienti (arrivi e presenze).
- **ROSS1000**: il portale della Regione Lombardia per la comunicazione ISTAT.
- **Prova**: il file (per esempio la ricevuta) che CasaZen conserva come dimostrazione.
- **Cassetto Compliance**: l'area del channel manager dove si vede l'esito degli invii.
- **Semaforo**: lo stato colorato di ogni voce di Adempimenti (su attivazione).
- **Delega**: il testo con cui affidi la trasmissione a CasaZen o al channel manager; la responsabilità resta tua.
- **Dichiarato attivo**: stato che dice solo che l'hai dichiarato tu; il channel manager non l'ha confermato.

## Vedi anche
- [[cin-identificazione-ticino]]: CIN, identificazione degli ospiti e Svizzera.
- [[imposta-soggiorno-documenti]]: imposta di soggiorno, archivio documenti e check-out.
- [[ospiti-checkin]]: il check-in online dell'ospite.
- [[canali-octorate]]: il collegamento con il channel manager.
