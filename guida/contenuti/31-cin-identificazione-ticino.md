---
id: cin-identificazione-ticino
titolo: CIN, identificazione degli ospiti e notifiche in Svizzera
menu: CIN e identificazione degli ospiti
sezione: Adempimenti
ordine: 31
riassunto: Dove chiedere, inserire e controllare il CIN (e cosa succede senza), come funziona la verifica dell'identità degli ospiti e il codice della serratura, e come notificare gli ospiti alla polizia del Canton Ticino o all'autorità di un altro cantone (solo per immobili in Svizzera).
chi: [gestore, amministratore, ospite]
dove: Affitti brevi › Adempimenti › CIN, Identificazione
parole_chiave: [CIN, codice identificativo nazionale, non ho il CIN, richiedere il CIN, BDSR, Ministero del Turismo, sanzione CIN, codice regionale, CIR, identificazione, verifica identità, selfie, documento ospite, codice serratura, QR di ingresso, Svizzera, Ticino, ospiti svizzeri, polizia cantonale, notifica ospiti, numero identificativo struttura, LEAR]
copre: [/app/short-rent/compliance/cin, /app/short-rent/compliance/identification, /app/short-rent/compliance/ticino]
stato: disponibile
fonte_codice: [frontend/src/features/cin/cin-compliance-page.tsx, frontend/src/features/cin/cin-deadline.ts, frontend/src/features/compliance/identification/identification-page.tsx, frontend/src/pages/SwissCompliancePage.tsx, frontend/src/features/compliance/ticino, frontend/src/features/compliance/swiss, backend/Casazen.Core/Regulatory/CinFormat.cs, backend/Casazen.Infrastructure/Services/IdentityVerificationFlowService.cs, backend/Casazen.Infrastructure/Services/AccessCodeService.cs, backend/Casazen.Infrastructure/Services/DocumentOcrService.cs, backend/Casazen.Infrastructure/Identity/LocalCheckInDocumentReader.cs, backend/Casazen.Infrastructure/Services/TicinoNotificationService.cs, backend/docs/runbooks/cin-format.md, backend/docs/runbooks/guest-notification-switzerland.md]
---

## In breve
Il **CIN** (codice identificativo nazionale) è il codice che ogni alloggio in affitto breve in Italia deve avere: lo chiedi sul portale del Ministero del Turismo, lo inserisci nell'immobile e CasaZen controlla che sia nel formato giusto. **Senza un CIN valido la casa non si attiva e non si può prenotare dal tuo sito.** La pagina **Identificazione** serve a impostare il codice della serratura che CasaZen manda all'ospite **solo dopo** che la sua identità è stata verificata. Per gli immobili in **Svizzera** (e solo per quelli) CasaZen non chiede il CIN: nel Canton Ticino ogni ospite va notificato alla polizia cantonale entro 24 ore e CasaZen prepara il file, ma la notifica la fai tu sul portale.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Conformità CIN | Mostra il CIN di ogni immobile, se è valido, mancante o non valido, e la scadenza | Adempimenti › CIN | gestore, amministratore | Disponibile | Controllare il CIN di tutti gli immobili |
| Richiesta del CIN | Apre il portale del Ministero del Turismo (BDSR) dove si chiede il codice | Adempimenti › CIN, pulsante «Richiedi il CIN sul portale» | gestore, amministratore | Disponibile | Chiedere il CIN |
| Inserimento del CIN | Salva il codice e ne controlla il formato | Scheda immobile › Modifica, oppure passo «Codice CIN» dell'attivazione | chi può modificare gli immobili | Disponibile | Inserire o correggere il CIN |
| Identificazione e accesso | Imposta il codice della serratura di ogni immobile e apre il QR di ingresso | Adempimenti › Identificazione | chi può modificare gli immobili | Disponibile | Impostare il codice della serratura |
| Verifica dell'identità dell'ospite | L'ospite fotografa il documento e scatta un selfie; il volto è confrontato con il documento | Check-in online dell'ospite | ospite | Su attivazione | Capire la verifica dell'identità |
| Decisione dell'operatore | Una persona approva, rifiuta o chiede una nuova foto | Cruscotto › Verifiche | chi può decidere le verifiche | Disponibile | Registrare la decisione su una verifica d'identità |
| Notifica alla polizia del Ticino | Prepara il file da caricare sul portale cantonale e tiene traccia del giorno | Adempimenti (voce «Notifica»), scheda immobile | chi può leggere i dati degli ospiti; per dichiarare, chi può inviare i dati degli ospiti | Disponibile | Notificare gli ospiti alla polizia del Ticino |
| Notifica agli altri cantoni | Prepara i dati da copiare sul portale dell'autorità del cantone | Adempimenti (voce «Notifica»), scheda immobile | come sopra | Su attivazione | Notificare gli ospiti in un altro cantone |
| Avvisi sulle 24 ore del Ticino | E-mail e notifiche prima e dopo la scadenza | Arrivano da sole | chi può inviare i dati degli ospiti | Su attivazione | Notificare gli ospiti alla polizia del Ticino |

## Come funziona

### CIN: cosa è e cosa controlla CasaZen
Il CIN è obbligatorio per ogni alloggio in affitto breve in Italia: va **esposto all'esterno dell'immobile** e **indicato in ogni annuncio**, come ricorda la pagina stessa. Si chiede sul portale ufficiale del Ministero del Turismo (BDSR, la banca dati delle strutture ricettive): nella pagina **Adempimenti › CIN** il pulsante «Richiedi il CIN sul portale» (con la dicitura «BDSR — Ministero del Turismo») apre il sito in una nuova scheda; nel riquadro di avviso lo stesso pulsante si chiama «Richiedi il CIN su BDSR». CasaZen non rilascia il CIN e non lo chiede al posto tuo: **chiedilo prima di attivare la casa** (vedi «Chiedere il CIN»).

Cosa fa CasaZen:
- **Controlla il formato.** Il CIN valido è «IT» seguito da 6 cifre (provincia e comune), da 2 caratteri (categoria) e da 1 a 8 caratteri finali, per esempio IT015146C2ABCDEFGH. Spazi e trattini li toglie da sola e mette tutto in maiuscolo. Il vecchio formato «IT» + 15 cifre non è valido.
- **Non verifica che il CIN esista nella banca dati ufficiale.** «Valido» vuol dire solo «nel formato corretto». La pagina scrive «Il CIN è nel formato corretto», non «registrato».
- **Dà uno stato a ogni immobile:** «Valido», «Mancante» o «Non valido».
- **Lo mostra agli ospiti** sul sito di prenotazione, come testo semplice, solo se è valido. Gli ospiti non vedono mai «mancante» o «non valido».
- **Lo usa per attivare l'immobile.** Senza un CIN valido l'attivazione non si completa e l'immobile non si può prenotare dal tuo sito. Se un immobile già attivo perde un requisito obbligatorio, CasaZen lo sospende e te lo comunica per e-mail; torna attivo quando completi di nuovo i requisiti.
- **Mostra la scadenza** (se impostata) e te la ricorda: «Mancano N giorni alla scadenza del …», «La scadenza del … è oggi» oppure «La scadenza del … è superata: inserisci il CIN al più presto.». Con una scadenza impostata ti avvisa anche 30, 7 e 1 giorni prima.

La pagina ricorda anche le sanzioni indicate nel testo della legge: da € 800 a € 8.000 per l'assenza del CIN, da € 500 a € 5.000 per la mancata esposizione o indicazione negli annunci. CasaZen non dà consulenza legale: verifica con il tuo consulente.

**CIN e codice regionale.** Il CIN è nazionale. Alcune Regioni hanno anche un codice proprio (si chiama CIR o CUSR) che il loro portale chiede: è un codice diverso, CasaZen non lo controlla e non lo scambia con il CIN. Compare solo come campo facoltativo «Codice della struttura» nelle credenziali ISTAT (vedi [[alloggiati-istat]]).

### Identificazione degli ospiti
Ci sono tre parti che lavorano insieme: il codice della serratura, la verifica dell'identità dell'ospite e la decisione di una persona quando serve.

**1. La pagina «Identificazione e accesso» (per te).** Elenca i tuoi immobili e dice per ciascuno se il codice della serratura è «Codice impostato» o «Codice mancante». Da qui imposti o cambi il codice e apri il **QR di ingresso** da stampare. Il codice è **in sola scrittura**: lo vedi solo mentre lo scrivi; una volta salvato CasaZen non lo mostra più (per cambiarlo ne scrivi uno nuovo).

**CasaZen non apre la serratura.** Conserva il codice che scrivi tu e lo manda all'ospite, per e-mail e sulla schermata del check-in, **solo dopo una verifica dell'identità andata a buon fine** (confronto automatico oppure approvazione di una persona) e solo per un soggiorno attivo (non per richieste, annullamenti o soggiorni già finiti). Se hai scelto di trattenere il codice finché l'imposta di soggiorno non è pagata ([[imposta-soggiorno-documenti]]), parte solo dopo il pagamento. Senza un codice impostato, un ospite verificato non riceve nulla per entrare. **Se non usi la verifica dell'identità, CasaZen non manda nessun codice**: daglielo tu, per esempio con un messaggio.

**2. La verifica dell'identità (per l'ospite).** Dentro il check-in online l'ospite:
- fotografa il documento. Per le carte d'identità con volto e zona leggibile su lati diversi servono due foto (fronte e retro): la guida dice quale lato manca;
- dà o nega il consenso al controllo del volto («Acconsento al controllo del volto» / «Non acconsento»);
- scatta un **selfie dal vivo** con la fotocamera (non si può scegliere una foto dalla galleria) e gira la testa a destra e a sinistra come indicato.

CasaZen legge il documento **al suo interno**: prima la zona a lettura ottica (MRZ), poi il testo stampato. Non indovina: se un dato non è leggibile, resta da inserire a mano, e i dati letti sono sempre confermati dall'ospite. Il selfie è confrontato con la foto del documento da un programma di CasaZen.

Esiti possibili: se il confronto è sicuro, la verifica passa e il codice della serratura viene rilasciato; se è dubbio, decide una persona; se il volto non corrisponde abbastanza, l'ospite riprova. Se non riesce dopo alcuni tentativi, o se non acconsente al controllo del volto, passa a una persona. Soglie e numero di tentativi li stabilisce CasaZen: non li imposti tu. I **minorenni** non sono mai verificati in automatico: decide sempre una persona.

**Su attivazione** ([[per-iniziare#cosa-significa-su-attivazione]]). Il confronto automatico del volto non è attivo di partenza: lo attiva CasaZen, chiedilo all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»). Finché non è attivato, l'identità la verifica sempre una persona. Il pulsante «Controlla l'identità» che vedi in Adempimenti ti porta alla prenotazione, scheda «Documenti», dove vedi cosa ha mandato l'ospite.

**3. La decisione di una persona.** Nella coda **Cruscotto › Verifiche** (vedi [[cruscotto-notifiche-assistente]]) puoi «Approva la verifica», «Non verificato» (con una nota obbligatoria), «Richiedi una nuova foto» o «Rifiuta il check-in». Dopo aver contattato l'ospite fuori da CasaZen registri la decisione: approvando, all'ospite arriva per e-mail il codice di accesso della struttura (se ne ha uno); «Non verificato» non invia nulla; «Rifiuta il check-in» chiude il check-in e l'ospite non può riprovare. Ogni decisione resta nel registro delle verifiche.

**Dove restano i dati.**
- Le foto del documento restano **cifrate** in un archivio privato solo fino alla fine della verifica (passata, affidata a una persona o foto sostituita), poi sono cancellate. Non si scrivono mai su disco in chiaro e non finiscono nei registri tecnici.
- Per un immobile **in Ticino non si conserva nessuna foto**: documento e selfie servono solo al momento del controllo.
- Dopo l'invio dell'Alloggiati, se è attiva la cancellazione dopo la ricevuta, le foto dei documenti di un soggiorno sono cancellate quando la ricevuta lo mette in regola (vedi [[alloggiati-istat]] e [[imposta-soggiorno-documenti#conservazione-e-privacy-dei-dati-degli-ospiti]]).
- I dati anagrafici e del documento dei soggiorni (cioè quelli per Alloggiati) restano fino a 5 anni dopo la partenza, poi sono anonimizzati.

**Limiti.** L'identificazione non sostituisce l'obbligo di identificare l'ospite di persona o con il documento: CasaZen verifica, ma la responsabilità resta tua. Non è prevista per i minorenni. La verifica automatica richiede che i modelli di confronto del volto siano pronti: se mancano, ogni verifica passa a una persona.

### Svizzera e Ticino: notifica degli ospiti
**Questa parte riguarda solo gli immobili che si trovano in Svizzera.** Se la tua casa è in Italia (per esempio a Como) e ospiti persone svizzere, non devi notificarle in Svizzera: i loro dati si comunicano alla Questura con Alloggiati Web come quelli di tutti gli altri ospiti ([[alloggiati-istat]]). In **Svizzera** non esistono CIN, Alloggiati Web e ISTAT. Il regime dipende dal cantone dell'immobile, che CasaZen ricava dal comune svizzero che indichi nei dati dell'immobile o, se manca, dal CAP e dalla città. Se il cantone non si riesce a stabilire, l'immobile resta «senza cantone noto» e non riceve nessun flusso finché non scegli il comune.

**Canton Ticino.** La polizia del Canton Ticino vuole ogni ospite notificato **entro 24 ore dall'arrivo** (dal primo arrivo registrato; senza arrivo registrato, entro la fine del giorno di arrivo). Il portale (notifiche.ti.ch) non ha un collegamento automatico e **CasaZen non vi accede mai e non conosce le tue credenziali**: CasaZen scrive il file, tu lo carichi e dichiari che è fatto. Nessun pulsante di CasaZen notifica la polizia: «Ho caricato il file» registra solo la tua dichiarazione.
- Il check-in per un immobile in Ticino chiede in più, per ogni adulto, tipo e numero del documento, l'indirizzo di casa (via, CAP, città) e, una volta per soggiorno, la targa dell'auto (facoltativa).
- Il file è un **CSV** (di norma in codifica Windows-1252, come il modello ufficiale) o un **XML**. Le lettere che la codifica non può contenere sono scritte senza accento: la pagina avvisa quante sono, così controlli i nomi sul portale.
- Per un **gruppo di 6 o più persone** nel file c'è solo il capogruppo (con il numero di membri sopra e sotto i 14 anni): la scheda con nome, cognome, data di nascita e nazionalità di tutti va conservata 5 anni a disposizione della polizia. CasaZen la scarica come CSV.
- I **minorenni senza adulto** servono con l'autorizzazione scritta dei genitori, da conservare 5 anni. Se manca, la polizia va avvisata subito: CasaZen non contatta mai la polizia.
- Per creare il file serve il **numero identificativo della struttura** («Numero identificativo LEAR / NO-LEAR», per esempio NL-12345678), quello che Ticino Turismo ti ha dato con la registrazione.
- Una volta caricato il file, il giorno si chiude con la **dichiarazione «Ho caricato il file»** oppure caricando la **ricevuta** del portale (il riepilogo come PDF, immagine o CSV, fino a 10 MB). Il giorno si chiude anche senza ricevuta.
- Se scarichi di nuovo il file di un giorno già chiuso, CasaZen ti chiede conferma: se lo carichi ancora, il portale potrebbe creare notifiche doppie.

**Altri cantoni** (su attivazione). Ogni cantone ha una regola sua: alcuni chiedono solo un registro da tenere, altri una notifica a un'autorità. CasaZen mostra «Cosa chiede il cantone», con un livello di certezza («Letto sulle fonti ufficiali», «Le fonti non sono tutte ufficiali o non dicono tutto», «Non abbiamo trovato una fonte ufficiale»): in ogni caso verifica con il comune o la polizia, perché CasaZen non dà consulenza legale. Dove la notifica è prevista, ti prepara i dati ospite per ospite da **copiare** sul portale del cantone; non c'è un file. Per i cantoni dove le fonti non indicano una scadenza la riga dice «Scadenza non nota». Se le fonti non dicono con certezza che la notifica vale per chi affitta una casa privata, decidi tu e puoi cambiare la risposta nella scheda dell'immobile.

**Avvisi (su attivazione).** Per il Ticino, e per i giorni dei cantoni che li hanno, CasaZen avvisa chi può inviare i dati degli ospiti: la sera del giorno di arrivo (o 2 ore dopo l'arrivo previsto), 6 ore prima della scadenza, alla scadenza e con al massimo 2 promemoria a distanza di 24 ore, finché il giorno non è chiuso. L'e-mail va all'indirizzo dell'organizzazione e non contiene mai nomi o numeri di documento, solo i tipi di dato che mancano.

### Differenze per paese dell'immobile
| Cosa | Italia | Svizzera: Ticino | Svizzera: altri cantoni | Altri paesi |
|---|---|---|---|---|
| CIN | obbligatorio | non serve | non serve | non serve |
| Comunicazione degli ospiti | Alloggiati Web, entro 24 ore ([[alloggiati-istat]]) | notifica alla polizia cantonale, entro 24 ore | notifica o registro, secondo il cantone | non gestita da CasaZen |
| ISTAT | secondo la regione | no | no | no |
| Attivazione | dati base, CIN, documenti, sicurezza | comune svizzero e numero identificativo della struttura | comune svizzero | — |
| Imposta di soggiorno | comunale, calcolata da CasaZen ([[imposta-soggiorno-documenti]]) | conteggio notti di fine anno | secondo la regola dell'immobile | — |

## Come fare

### Chiedere il CIN
**Ti serve:** i dati dell'immobile (indirizzo con numero civico) e l'accesso al portale del Ministero del Turismo (BDSR), che ti spiega come entrare. Il tempo di rilascio lo decide il portale: chiedilo per tempo, prima di attivare la casa. Il permesso di modificare gli immobili serve solo per inserire poi il codice.
1. Apri **Affitti brevi › Adempimenti › CIN**.
2. Premi «Richiedi il CIN sul portale»: si apre il sito del Ministero del Turismo (BDSR) in una nuova scheda.
3. Segui la procedura sul portale. Nella richiesta si dichiarano anche i requisiti di sicurezza dell'immobile (estintori e, dove c'è gas o una fiamma, rilevatori di gas e di monossido): CasaZen non verifica né certifica quello che dichiari.
4. Quando il portale ti dà il codice, torna in CasaZen e inseriscilo (vedi «Inserire o correggere il CIN»).

> **Nota:** finché non c'è un CIN valido l'immobile non si attiva e non si può prenotare dal tuo sito. Gli altri passaggi dell'attivazione puoi comunque completarli nell'ordine che preferisci ([[alloggiati-istat#attivare-gli-adempimenti-di-un-immobile]]).

### Inserire o correggere il CIN
**Ti serve:** il permesso di modificare gli immobili e il codice CIN.
1. Apri **Affitti brevi › Adempimenti › CIN**.
2. Premi «Aggiungi il CIN» (se manca) o «Correggi il CIN» (se non è valido) sulla riga dell'immobile: si apre la modifica dell'immobile.
3. Nel campo «Codice CIN» scrivi il codice come lo trovi sul portale, anche con spazi o trattini: CasaZen li toglie.
4. Salva. La riga passa a «Valido» se il formato è corretto.
5. Se l'immobile non è attivo, completa l'attivazione (vedi [[alloggiati-istat#attivare-gli-adempimenti-di-un-immobile]]): senza CIN valido non si può.

Se non hai ancora il codice, vedi «Chiedere il CIN».

### Controllare il CIN di tutti gli immobili
1. Apri **Adempimenti › CIN**.
2. In cima c'è un riquadro: se hai immobili senza CIN valido dice quanti sono e la scadenza; se è tutto a posto dice «Tutti gli immobili hanno un CIN valido».
3. Sotto trovi l'elenco «I tuoi immobili» con proprietà, città, codice CIN e stato.
4. Chi può solo leggere (senza il permesso di modificare) vede «Apri» al posto del pulsante di correzione.

### Impostare il codice della serratura
**Ti serve:** il permesso di modificare gli immobili e il codice della serratura (CasaZen non apre la porta: manda il codice all'ospite).
1. Apri **Adempimenti › Identificazione**.
2. Sulla riga dell'immobile premi «Imposta codice» (o «Cambia codice»).
3. Scrivi il «Codice della serratura» e premi «Salva codice». Dopo il salvataggio non lo rivedi più.
4. Per stampare il QR dell'ingresso premi «QR di ingresso».
5. Se un immobile è senza codice, la riga dice «Senza codice, un ospite verificato non riceve nulla per entrare.»

Se il salvataggio non riesce compare «Non siamo riusciti a salvare il codice. Quello di prima non è cambiato: riprova tra un momento.»

> **Nota:** il codice parte solo dopo una verifica dell'identità andata a buon fine. Se non usi la verifica dell'identità, daglielo tu.

### Registrare la decisione su una verifica d'identità
**Ti serve:** il permesso di decidere le verifiche.
1. Apri **Cruscotto › Verifiche**.
2. Apri la verifica: vedi i controlli automatici (qualità della foto, documento, confronto del volto) e i tentativi.
3. Contatta l'ospite fuori da CasaZen (per esempio con una videochiamata).
4. Scegli «Approva la verifica» (nota facoltativa) oppure «Non verificato» (nota obbligatoria), oppure «Richiedi una nuova foto» (all'ospite arriva un nuovo link), oppure «Rifiuta il check-in» (motivo obbligatorio).
5. Dopo l'approvazione l'ospite riceve il codice per e-mail, se l'immobile ne ha uno. Un rifiuto chiude il check-in e non si può riaprire dall'ospite.

### Notificare gli ospiti alla polizia del Ticino
**Ti serve:** un immobile in Ticino; il permesso di leggere i dati degli ospiti (per scaricare il file) e di inviare i dati degli ospiti (per dichiarare il giorno); le **tue** credenziali del portale delle notifiche e l'app di autenticazione; un **computer** (si scarica un file e lo si carica sul portale).
1. In **Adempimenti** cerca la voce «Notifica alla polizia gli ospiti arrivati il {data}» e premi «Notifica», oppure apri la scheda dell'immobile e premi «Notifica gli ospiti alla polizia». Si apre la finestra «Notifica alla polizia: {immobile}».
2. Se manca il numero identificativo, scrivilo in «Numero identificativo LEAR / NO-LEAR» e premi «Salva».
3. Passo **Ospiti da notificare**: controlla gli arrivi del giorno. Se un ospite non è nel file perché mancano dati, premi «Completa i dati» o apri la prenotazione.
4. Passo **Scarica il file**: premi «Scarica il file (CSV)» (o «Scarica in formato XML»). Per un gruppo di 6 o più premi anche «Scarica la scheda del gruppo di {nome}».
5. Passo **Carica sul portale**: premi «Apri il portale delle notifiche», accedi con le tue credenziali e il codice dell'app di autenticazione, apri «Notifiche → Invio», scegli il file e premi «Invia». Controlla che gli accenti dei nomi si leggano bene.
6. Passo **Ho caricato il file**: premi «Ho caricato il file». Il giorno esce dagli adempimenti e chi lavora con te lo vede subito. Premilo solo dopo aver caricato il file sul portale.
7. Passo **Aggiungi la ricevuta** (facoltativo): carica il riepilogo del portale con «Aggiungi la ricevuta». Per i minorenni senza adulto, «Archivia l'autorizzazione».

Se hai premuto «Ho caricato il file» per sbaglio, usa «Non l'ho caricato: riapri il giorno».

> **Nota:** il vecchio indirizzo della notifica del Ticino non è più una pagina: apre Adempimenti con la finestra della notifica in primo piano, così i link e i segnalibri continuano a funzionare.

### Notificare gli ospiti in un altro cantone
Su attivazione ([[per-iniziare#cosa-significa-su-attivazione]]). Funziona come per il Ticino, ma senza file.
1. In **Adempimenti** premi «Notifica» sulla voce «Notifica all'autorità gli ospiti arrivati il {data}», oppure apri la scheda dell'immobile («Apri la notifica degli ospiti»).
2. Leggi «Cosa chiede il cantone» e il livello di certezza.
3. Passo **Ospiti**: usa «Copia tutto» per ogni ospite o «Copia {campo}» per ogni dato.
4. Passo **Apri il portale**: premi «Apri il portale ufficiale», incolla i dati e conferma.
5. Passo **Ho notificato**: premi «Ho notificato». Per annullare, «Non l'ho notificato: riapri il giorno».

## Flussi completi

### Flusso: ospite in un immobile del Ticino
1. L'ospite compila il check-in online con in più documento, indirizzo e targa ([[ospiti-checkin]]).
2. Il giorno di arrivo il giorno compare in Adempimenti tra le **Scadenze di legge**.
3. Tu apri «Notifica», controlli gli ospiti e scarichi il file.
4. Carichi il file su notifiche.ti.ch con le tue credenziali.
5. Premi «Ho caricato il file» e, se vuoi, aggiungi la ricevuta.
6. Il giorno si chiude; ricevute e schede gruppo restano 5 anni e poi sono cancellate da CasaZen.

### Flusso: dalla verifica d'identità al codice della serratura
1. Hai impostato il codice della serratura in **Identificazione**.
2. L'ospite completa il check-in e la verifica dell'identità.
3. Se passa, CasaZen gli manda il codice per e-mail e lo mostra sulla schermata del check-in. Se non passa, una persona decide in **Verifiche**.
4. Se la decisione è «Approva la verifica», il codice parte. Se è «Non verificato» o «Rifiuta il check-in», non parte nulla.
5. Se non usi la verifica dell'identità, nessun codice parte da CasaZen: lo dai tu all'ospite.

## Regole e limiti
- **CIN**: formato «IT» + 6 cifre + 2 caratteri + da 1 a 8 caratteri. CasaZen non controlla che esista sul portale. Senza un CIN valido l'immobile non si attiva e non si può prenotare dal tuo sito.
- **Codice regionale (CIR o CUSR)**: è un codice diverso dal CIN, che alcune Regioni chiedono; CasaZen non lo controlla.
- **Codice serratura**: solo in scrittura; mai mostrato dopo il salvataggio. CasaZen lo manda solo dopo una verifica dell'identità riuscita.
- **Minorenni**: mai verificati in automatico.
- **Ticino**: notifica entro 24 ore dall'arrivo; file CSV o XML; ricevute e schede gruppo conservate 5 anni e poi cancellate in automatico; l'autorizzazione dei genitori per minori senza adulto si conserva 5 anni.
- **Gruppi**: dal sesto componente (6 o più persone) il file contiene solo il capogruppo.
- **Chi può cosa**: vedere la notifica e scaricare il file richiede il permesso di leggere i dati degli ospiti; dichiarare il giorno e aggiungere la ricevuta richiede il permesso di inviare i dati degli ospiti; impostare il codice della serratura, il numero identificativo della struttura e il CIN richiede il permesso di modificare gli immobili.
- **Fuori dall'Italia** la comunicazione alla Polizia italiana non si applica; la notifica svizzera riguarda solo gli immobili che si trovano in Svizzera.

## Domande frequenti

### Non ho il CIN: dove lo ottengo?
Si chiede sul portale del Ministero del Turismo (BDSR): apri **Adempimenti › CIN** e premi «Richiedi il CIN sul portale». Quando hai il codice lo inserisci in CasaZen. Finché manca, l'immobile non si attiva e non si può prenotare dal tuo sito. Vedi «Chiedere il CIN».

### Cosa succede se la casa non ha il CIN?
CasaZen non attiva l'immobile e non lo rende prenotabile dal tuo sito; in Adempimenti compare la voce da sistemare. La legge indica sanzioni per l'assenza del CIN e per la mancata esposizione o indicazione negli annunci (la pagina CIN le riporta): verifica con il tuo consulente.

### CasaZen verifica se il mio CIN è vero?
No. Controlla il formato. Se il codice è nel formato giusto lo considera valido.

### Il CIN e il codice regionale (CIR) sono la stessa cosa?
No. Il CIN è il codice nazionale. Alcune Regioni hanno anche un loro codice (CIR o CUSR). CasaZen controlla solo il CIN; il codice regionale compare solo come campo facoltativo nelle credenziali ISTAT.

### Ho ospiti svizzeri nel mio appartamento a Como: devo notificarli in Ticino?
No. La notifica svizzera riguarda solo gli immobili che si trovano in Svizzera. Gli ospiti svizzeri in un immobile italiano si comunicano ad Alloggiati Web come tutti gli altri ([[alloggiati-istat]]).

### Perché il mio immobile in Svizzera non mi chiede il CIN?
Perché il CIN è un obbligo italiano. Per la Svizzera conta il cantone.

### Il codice della serratura non è arrivato all'ospite: perché?
CasaZen lo manda solo dopo una verifica dell'identità andata a buon fine, e solo se il codice è impostato in **Identificazione**. Se non usi la verifica dell'identità, o se la verifica è ancora in attesa di una persona (**Cruscotto › Verifiche**), il codice non parte: daglielo tu.

### Il codice della serratura è sparito dopo il salvataggio: è un errore?
No, è voluto: nessuno può rileggerlo. Per cambiarlo scrivine uno nuovo con «Cambia codice».

### L'ospite non ha acconsentito al controllo del volto. Cosa succede?
La verifica passa a una persona: tocca a te decidere in **Verifiche**.

### Posso caricare il file del Ticino due volte?
Meglio di no: il portale potrebbe duplicare le notifiche. Se devi aggiungere un ospite tardi, controlla prima sul portale.

## Glossario
- **CIN**: codice identificativo nazionale dell'alloggio.
- **BDSR**: banca dati delle strutture ricettive del Ministero del Turismo, dove si chiede il CIN.
- **CIR / CUSR**: codice regionale che alcune Regioni chiedono, diverso dal CIN.
- **MRZ**: la zona del documento leggibile a macchina.
- **LEAR / NO-LEAR**: il numero con cui la struttura è registrata in Ticino.
- **Capogruppo**: chi guida un gruppo di ospiti nella notifica.
- **Identificazione**: la verifica che l'ospite sia chi dice di essere, con documento e selfie.

## Vedi anche
- [[alloggiati-istat]]: Adempimenti, Alloggiati Web e ISTAT.
- [[imposta-soggiorno-documenti]]: imposta di soggiorno, conteggio notti del Ticino, archivio documenti.
- [[ospiti-checkin]]: il check-in dell'ospite.
- [[cruscotto-notifiche-assistente]]: la coda «Verifiche».
