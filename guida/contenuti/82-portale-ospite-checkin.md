---
id: portale-ospite
titolo: Portale ospite
sezione: Sito e portali
ordine: 82
riassunto: La pagina personale che ogni ospite riceve per il suo soggiorno: check-in online, guida della casa, servizi, chat, pagamenti, documenti e recensione, in cinque lingue. Come la prepari, come mandi il link e cosa vedi delle azioni dell'ospite.
chi: [ospite, gestore, amministratore]
dove: Impostazioni › Portale ospiti · Prenotazioni › scheda di una prenotazione › «Accesso ospite»
parole_chiave: [portale ospite, link personale, check-in online, guida della casa, istruzioni di arrivo, servizi, extra, chat, documenti, recensione, privacy, lingue, tedesco, francese, spagnolo, QR, codice di accesso]
copre: [/app/short-rent/settings/guest-portal, /s/:slug, /s/action/checkin/:token, /s/action/documents/:documentId, /s/action/org/:orgSlug/review/:bookingId, /s/action/org/:orgSlug/cancellation/:bookingId, /checkin/:token, /documents/view/:documentId, /app/guest-stays]
stato: su-attivazione
fonte_codice: [frontend/src/features/guest-portal/guest-portal-page.tsx, frontend/src/features/guest-portal/guest-linked-section.tsx, frontend/src/features/guest-portal/linked-stay-paths.ts, frontend/src/features/guest-portal/guest-portal-payments.tsx, frontend/src/features/guest-portal/guest-portal-stay-change.tsx, frontend/src/features/guest-portal/guest-portal-privacy.tsx, frontend/src/features/guest-portal/guest-account-stays-page.tsx, frontend/src/features/guest-portal/house-guide-fields.ts, frontend/src/features/settings/guest-portal-settings-page.tsx, frontend/src/features/onboarding/components/guest-portal-setup.tsx, frontend/src/features/bookings/components/guest-portal-link-panel.tsx, frontend/src/features/bookings/components/guest-stay-change-panel.tsx, frontend/src/features/checkin/checkin-page.tsx, frontend/src/features/checkin/lib/guest-locale.ts, frontend/src/features/checkin/tourist-tax-step.tsx, frontend/src/features/checkin/ConsentStep.tsx, frontend/src/features/checkin/identity-step.tsx, frontend/src/pages/DoorCheckInPage.tsx, backend/Casazen.Core/GuestPortal/GuestPortalRules.cs, backend/Casazen.Core/GuestPortal/IGuestPortalEmailService.cs, backend/Casazen.Core/GuestPortal/GuestPortalSetup.cs, backend/Casazen.Core/Entities/GuestPortalLink.cs, backend/Casazen.Web/Controllers/GuestPortalLinkController.cs, backend/Casazen.Web/Controllers/GuestPortalSetupController.cs, backend/Casazen.Web/Controllers/GuestPortalOverviewController.cs, backend/Casazen.Web/Controllers/PublicGuestCheckInController.cs, backend/Casazen.Infrastructure/GuestPortal/GuestStayLinkProvider.cs, backend/Casazen.Core/Features/FeatureFlags.cs]
---

## In breve
Il **portale ospite** è una pagina personale che l'ospite apre dal telefono con un **link**, senza account. Raccoglie tutto il suo soggiorno: i dati della prenotazione, il **check-in online**, la **guida della casa** con le istruzioni di arrivo, i servizi e gli extra, la chat con te, i pagamenti, i documenti e la recensione. Parla **italiano, inglese, tedesco, francese e spagnolo**.

Ogni prenotazione confermata ha il suo link, di qualunque origine (tuo sito, portali, inserita da te). Tu lo mandi o lo copi dalla scheda della prenotazione e prepari il portale una volta per casa da **Impostazioni › Portale ospiti**. Il portale è **su attivazione**: finché non è attivo sul tuo account, restano i link separati di check-in, cancellazione, recensione e documenti.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Link personale del soggiorno | Un indirizzo privato per ogni prenotazione che porta l'ospite al suo portale | Prenotazione › «Accesso ospite» | gestore, amministratore | Su attivazione | Preparare e mandare il link del portale |
| Invio dell'e-mail «Prepara il tuo arrivo» | Manda all'ospite il link con un'e-mail col tuo marchio | Prenotazione › «Accesso ospite» › «Invia email» | gestore, amministratore | Su attivazione | Preparare e mandare il link del portale |
| Rigenerare o revocare il link | Il link vecchio smette di funzionare | «Accesso ospite» › «Impostazioni» › «Rigenera link» · «Revoca link» | gestore, amministratore | Su attivazione | Rigenerare o revocare il link |
| Configurazione del portale | Sette passaggi per ogni casa: marchio, guida, extra, fornitori, chat, recensioni, regole dei portali | Impostazioni › Portale ospiti | gestore con il permesso sul portale ospiti | Su attivazione | Configurare il portale di una casa |
| Check-in online dell'ospite | Dati degli ospiti, documento, tassa di soggiorno, verifica d'identità, consensi | Portale › «Check-in online» | ospite | Su attivazione | Come l'ospite fa il check-in |
| Guida della casa | Istruzioni di arrivo, Wi-Fi, regole, consigli sulla zona, contatti | Portale › «Guida della casa» | ospite | Su attivazione | Scrivere la guida della casa |
| Servizi ed extra | Gli extra che offri, ordinabili e pagabili dal portale | Portale › «Servizi e extra» | ospite | Su attivazione | Configurare il portale di una casa |
| Chat con l'host | Messaggi tra ospite e host; risposte automatiche opzionali | Portale › «Chat con l'host» | ospite, gestore | Su attivazione | Guida della casa e chat |
| Pagamenti e documenti | Saldo, tassa di soggiorno, ricevute e documenti in PDF | Portale › «Pagamenti», «Documenti e ricevute» | ospite | Su attivazione | Come funziona |
| Modifica del soggiorno | L'ospite chiede nuove date o ospiti, tu approvi o rifiuti | Portale › «Informazioni sulla prenotazione» | ospite, gestore | Su attivazione | Rispondere a una richiesta di modifica |
| Cancellazione e recensione | L'ospite annulla (prenotazioni dirette) e, dopo il soggiorno, recensisce | Portale | ospite | Su attivazione | Come funziona |
| Richieste privacy | L'ospite chiede copia o cancellazione dei suoi dati | Portale › «Privacy e dati personali» | ospite, gestore | Su attivazione | Gestire una richiesta privacy dal portale |

## Come funziona

### Chi riceve un link e quando
- Hanno un link le prenotazioni **confermate**, con **check-in effettuato** o con **check-out effettuato**, di **qualsiasi origine**: tuo sito, Airbnb, Booking.com, inserite da te.
- **Non** hanno un link le richieste (da accettare), le prenotazioni annullate, quelle segnate «Non è arrivato» e quelle finite da più di 30 giorni.
- Il link funziona **fino alla fine del 30° giorno dopo la partenza**. Se sposti la partenza più avanti, il link si allunga.
- Ogni prenotazione ha **un solo link attivo** alla volta. L'indirizzo è lungo e casuale: chiunque lo abbia può aprire il portale, quindi mandalo solo all'ospite.
- Se un link già mandato resta aperto per una prenotazione poi annullata, l'ospite vede la prenotazione com'è (annullata), ma non le informazioni riservate.

### Come arriva il link all'ospite
- Dentro l'**e-mail di conferma** della prenotazione e dentro i messaggi del check-in online.
- Con l'e-mail **«Prepara il tuo arrivo»**, che mandi tu quando vuoi con **«Invia email»** (col tuo marchio e nella lingua dell'ospite).
- A mano: **«Copia link»** e lo mandi tu (WhatsApp, SMS…). Serve per le prenotazioni dei portali senza indirizzo e-mail dell'ospite.
- Per le prenotazioni dei portali che ci danno la chat, anche nella chat del portale.

### Cosa vede l'ospite
Il portale si apre sulla **pagina del soggiorno**: «Il tuo soggiorno» con arrivo, partenza, ospiti e codice prenotazione, e il **prossimo passo** da fare («Completa il check-in», «Paga la tassa di soggiorno» o «Guida della casa»). Sotto, le sezioni; sul telefono c'è una barra in basso con «Soggiorno», «Guida», «Servizi», «Chat» e «Altro».

| Sezione | Cosa c'è |
|---|---|
| **Check-in online** | Il modulo per i dati degli ospiti (vedi sotto). Prima che si apra: «L'host ti avviserà quando potrai fare il check-in»; dopo l'invio: «Check-in completato» |
| **Guida della casa** | Indirizzo, istruzioni di arrivo, la casa, partenza, parcheggio, numeri utili, consigli sulla zona e regole della casa. L'indirizzo completo, le istruzioni di accesso e il Wi-Fi compaiono **solo dopo il check-in**; per i soggiorni già finiti o annullati non compaiono |
| **Servizi e extra** | Gli extra che offri tu; con i fornitori, anche i loro servizi (su attivazione) |
| **Chat con l'host** | I messaggi con te; se la conversazione è chiusa l'ospite li rilegge soltanto |
| **Informazioni sulla prenotazione** | Orario di arrivo (salvabile: «Arrivo tardi» o un'ora), modifica del soggiorno, «Cancella prenotazione», pagamenti, documenti, privacy, «I miei soggiorni» |
| **Pagamenti** | Totale del soggiorno, già versato, saldo con «Paga ora», tassa di soggiorno, pagamenti dei servizi |
| **Documenti e ricevute** | I PDF del soggiorno da scaricare; «Chiedi una correzione» per un dato sbagliato |
| **Recensione** | Dopo la partenza: «Scrivi una recensione», entro 14 giorni, con voto, commento facoltativo e «Mostra il mio nome» |
| **Privacy e dati personali** | «Richiedi una copia dei dati» e «Richiedi la cancellazione dei dati» |

Le **lingue**: il portale si apre nella lingua della prenotazione, altrimenti in quella del telefono, altrimenti in italiano; l'ospite la cambia dal menu in alto (IT, EN, DE, FR, ES).
Il **marchio** (nome, logo e colore) è quello del tuo sito di prenotazione: [[sito-prenotazione#personalizzare-l-aspetto-del-sito]].

Per i soggiorni arrivati da **un portale** (Airbnb, Booking.com…) valgono i limiti del portale: l'ospite non può annullare né cambiare le date da qui («Per modificare o cancellare, usa il canale su cui hai prenotato») e i pagamenti restano sul portale. Può però aggiungere il soggiorno al suo account.

### Il check-in online dell'ospite, passo per passo
L'ospite apre il portale e preme **«Fai il check-in»** (oppure il link del check-in che ha ricevuto). Il modulo ha fino a sei passi, in cinque lingue:
1. **Documento** (facoltativo): con **«Scatta o carica la foto»** carica una foto del documento (JPG, PNG o WebP, fino a 5 MB). CasaZen legge i dati e li propone: l'ospite li controlla. Se il nome letto è diverso da quello della prenotazione deve confermarlo. Può anche scegliere **«Inserisci i dati a mano»**.
2. **Ospiti**: i dati anagrafici di tutte le persone che soggiornano (minori compresi), come richiede la legge.
3. **Documento d'identità**: tipo, numero, luogo di rilascio e scadenza, solo per chi deve lasciarlo (ospite singolo, capofamiglia o capogruppo).
4. **Tassa di soggiorno** (su attivazione): se è dovuta e puoi incassarla online, l'ospite la paga con la carta; altrimenti gli viene detto che la pagherà all'host in struttura.
5. **Verifica dell'identità** (su attivazione): foto del documento e **selfie**, fatto solo da chi lascia il documento. Se non riesce, può riprovare o chiedere che a verificarlo sia una persona. Il **codice di accesso** della casa arriva solo dopo la verifica, e dopo il pagamento della tassa se è dovuta.
6. **Informativa e consensi**: legge l'informativa privacy («Ho preso visione dell'informativa») e, se la casa ha delle regole, le accetta («Accetto queste regole della casa»); il consenso al marketing è facoltativo. Poi preme **«Invia check-in»**.

Alla fine vede **«Check-in completato!»**. Se riapre il link, i dati non vengono più mostrati (privacy): per correggerli deve scriverti. Non c'è nessuna firma da fare nel modulo.

Cosa succede dopo, dal tuo lato: [[ospiti-checkin#il-check-in-online-dal-lato-del-gestore]] e [[alloggiati-istat]].

### Come lo prepari: i sette passaggi di una casa
In **Impostazioni › Portale ospiti** scegli la casa e completi i passaggi (ognuno si salva con **«Salva il passaggio»**). I passaggi fatti hanno un segno di spunta e, finiti tutti, compare «Configurazione del portale completata».

| Passaggio | Cosa fai |
|---|---|
| **Marchio** | Controlli il nome, il logo e il colore che gli ospiti vedranno (si cambiano in [[sito-prenotazione]]) |
| **Guida della casa** | Scrivi le informazioni per il soggiorno. Puoi premere «Genera suggerimenti» o «Cerca consigli sulla zona» e usarli con «Usa nella bozza della guida» |
| **Extra dell'host** | Controlli gli extra e i listini che offri; confermi con «Ho verificato gli extra e i prezzi.» |
| **Fornitori** | Scegli se offrire agli ospiti i servizi dei fornitori regionali di CasaZen (Sì/No) ([[marketplace]]) |
| **Chat** | Imposti le risposte automatiche dalle informazioni della guida; confermi con «Ho verificato le impostazioni della chat.» |
| **Recensioni** | Scegli se far lasciare una recensione dal portale (Sì/No) |
| **Regole OTA** | Controlli le condizioni dei canali per i servizi a pagamento; puoi nascondere i servizi a pagamento ai soggiorni Airbnb. Il rispetto delle condizioni resta tua responsabilità |

Il passaggio **Guida della casa** non si può confermare se la guida è vuota: aggiungi almeno un'informazione e salva.

### La guida della casa
I campi della guida sono raggruppati così: **Arrivo e parcheggio** (come arrivare, orari di check-in, parcheggio), **Durante il soggiorno** (la casa, numeri utili, consigli sulla zona, Wi-Fi), **Partenza** (istruzioni, orari di check-out) e **Informazioni riservate** (istruzioni di accesso e Wi-Fi: visibili solo dopo il check-in). Le regole della casa si scrivono nella scheda dell'immobile. Con **«Compila la guida con l'AI»** una bozza si prepara dai dati dell'alloggio: controllala e premi **«Salva guida»** per renderla visibile agli ospiti.

> **Nota:** il codice di accesso che l'ospite vede con «Mostra il codice di accesso» è quello che hai fornito tu: CasaZen non crea né revoca codici d'accesso.

### Chat e risposte automatiche
La chat del portale arriva nella tua casella **Messaggi** ([[messaggi-recensioni]]) e si chiude 7 giorni dopo la partenza. Se attivi l'assistente per l'organizzazione (su attivazione) e per la casa, le domande pratiche sugli orari di check-in e check-out, sul parcheggio e su dove trovare il Wi-Fi ricevono una risposta automatica presa dalla guida, **solo se la risposta è nella guida**; tutte le altre domande arrivano a te.

### Cosa vedi tu delle azioni dell'ospite
- **Check-in**: lo stato lo leggi nella scheda «Check-in online» della prenotazione ([[ospiti-checkin]]).
- **Messaggi**: arrivano in **Messaggi**.
- **Richieste di modifica del soggiorno**: compaiono nella prenotazione con ospiti, totale attuale e totale proposto: «Approva la modifica» o «Rifiuta la richiesta».
- **Richieste privacy** dal portale: compaiono nella scheda dell'ospite come «Richiesta di copia dei dati» o «Richiesta di cancellazione dei dati», con il pulsante «Chiudi richiesta» da premere dopo aver risposto all'ospite.
- **Ordini di servizi ed extra**: nella prenotazione, sotto «Servizi e ordini».
- **Recensione** scritta dopo il soggiorno: in **Messaggi › Recensioni** e sul tuo sito.
- **Orario di arrivo** salvato dall'ospite: è un'informazione per te, non una regola.

### Il QR della porta e «I miei soggiorni»
- Se l'immobile ha un QR sulla porta, l'ospite che arriva lo inquadra, scrive codice prenotazione (o cognome) e data di arrivo e prosegue fino alla verifica dell'identità (su attivazione): [[ospiti-checkin]], [[immobili#stampare-il-codice-qr]].
- L'ospite con un account può usare **«Aggiungi questo soggiorno al mio account»** e ritrovare i suoi soggiorni in **«I miei soggiorni»**: ci arriva dal portale (richiede l'accesso).

## Come fare

### Preparare e mandare il link del portale
1. Apri **Affitti brevi › Prenotazioni** e la prenotazione.
2. Cerca il riquadro **«Accesso ospite»** (nella scheda «Check-in online» si chiama «Link personale dell'ospite»).
3. Premi **«Genera link»** (se non c'è ancora). Nella scheda del check-in il pulsante può chiamarsi «Abilita il check-in nel portale».
4. Per mandarlo: **«Invia email»** (compare «Email messa in coda») oppure **«Copia link»** e lo mandi tu.
5. Per vedere cosa vede l'ospite premi **«Apri il portale»**.
6. Se il riquadro non compare o dice «Il link del soggiorno non è disponibile», la prenotazione non ha diritto a un link (richiesta, annullata, non arrivato, finita da oltre 30 giorni) o il portale non è attivo.

Cosa succede dopo: l'ospite apre il portale; non devi fare altro. Con «Invia email» l'ospite riceve «Prepara il tuo arrivo»; non si può rimandare più volte nello stesso minuto.

### Rigenerare o revocare il link
1. Nel riquadro **«Accesso ospite»** apri **«Impostazioni»**.
2. Premi **«Rigenera link»** o **«Revoca link»**.
3. Leggi l'avviso («Il link già condiviso smetterà di funzionare») e premi **«Conferma rigenerazione»** (o «Conferma revoca»), oppure «Annulla».

Cosa succede dopo: il link vecchio non apre più nulla. Se rigeneri, mandi il nuovo; se revochi, l'ospite non ha più accesso finché non ne generi uno. Non si annulla.

### Configurare il portale di una casa
Serve il permesso di gestione del portale ospiti (la pagina compare solo con la funzione attiva).
1. Apri **Impostazioni › Portale ospiti**.
2. Scegli la casa nel menu **«Alloggio»**.
3. Apri il primo passaggio, fai quello che dice («Marchio», «Guida della casa»…) e premi **«Salva il passaggio»**.
4. Vai avanti fino all'ultimo («Regole OTA»). A fine percorso leggi «Configurazione del portale completata».
5. Ripeti per le altre case.

Si può riprendere in qualsiasi momento dal passaggio che hai lasciato; i passaggi già fatti restano segnati.

### Scrivere la guida della casa
1. In **Impostazioni › Portale ospiti**, scegli la casa e apri il passaggio **«Guida della casa»**.
2. Compila i campi (arrivo, orari, la casa, partenza, parcheggio, numeri utili, consigli, istruzioni di accesso, Wi-Fi). Per una bozza premi **«Compila la guida con l'AI»**: controlla i testi.
3. Premi **«Salva guida»**: compare «Guida aggiornata». Poi premi «Salva il passaggio».

La guida non è visibile agli ospiti finché non la salvi.

### Rispondere a una richiesta di modifica del soggiorno
1. Apri la prenotazione: nel riquadro della richiesta leggi gli ospiti e i due totali.
2. Premi **«Approva la modifica»** o **«Rifiuta la richiesta»**.
3. Se compare «Impossibile aggiornare la richiesta», controlla date, prezzo e permessi e riprova.

Cosa succede dopo: se approvi, le nuove date o i nuovi ospiti sostituiscono i vecchi e l'ospite vede la differenza da pagare; se rifiuti, resta la prenotazione originale. L'ospite vede lo stato («In attesa di approvazione», «Modifica approvata», «Richiesta rifiutata»).

### Gestire una richiesta privacy dal portale
1. Apri la scheda dell'ospite: sotto **«Richieste privacy dal portale»** vedi la richiesta.
2. Gestiscila: per la copia o la cancellazione dei dati vedi [[ospiti-checkin#esportare-anonimizzare-o-cancellare-i-dati-di-un-ospite]].
3. Rispondi all'ospite.
4. Premi **«Chiudi richiesta»** e confermi: l'ospite vede la richiesta chiusa.

## Flussi completi

### Flusso: dalla prenotazione al soggiorno con il portale
1. **L'ospite** prenota (dal tuo sito o da un portale): [[sito-prenotazione]].
2. **CasaZen** manda la conferma con il link del portale (se il portale è attivo).
3. **Tu** controlli la scheda «Accesso ospite» e, se serve, mandi «Prepara il tuo arrivo».
4. **L'ospite** apre il portale e, quando il check-in si apre, completa il modulo.
5. **CasaZen** prepara i dati per la comunicazione alla Questura: [[alloggiati-istat]]; **tu** verifichi e invii.
6. **L'ospite** dopo il check-in vede indirizzo, istruzioni di accesso e Wi-Fi.
7. **Durante il soggiorno** usa guida, chat ed extra; **tu** rispondi dalla casella Messaggi.
8. **Dopo la partenza** l'ospite scarica i documenti e può scrivere la recensione, entro 14 giorni.

## Regole e limiti
- Il link vale fino alla fine del 30° giorno dopo la partenza; uno solo attivo per prenotazione.
- Nessun link per richieste, prenotazioni annullate, «non arrivato» o finite da più di 30 giorni.
- Il portale cambia lingua tra **italiano, inglese, tedesco, francese e spagnolo**. Il resto dell'app e il sito di prenotazione sono in italiano e inglese.
- Indirizzo preciso, accesso e Wi-Fi solo dopo il check-in e solo per soggiorni in corso o in arrivo.
- Annullare e cambiare le date dal portale vale solo per le **prenotazioni dirette**; per i portali si usa il canale.
- La recensione si scrive entro **14 giorni dopo la partenza**.
- La chat di una prenotazione si chiude 7 giorni dopo la partenza.
- Le foto dei documenti nel check-in sono JPG, PNG o WebP fino a 5 MB.
- CasaZen non crea né revoca codici d'accesso fisici.
- Il portale non è indicizzato dai motori di ricerca.

## Domande frequenti

### Il link del portale è lo stesso del check-in?
Con il portale attivo, il link del check-in porta dentro la sezione «Check-in online» del portale. Un check-in già inviato non si riapre.

### L'ospite dice che il link non funziona.
Probabilmente è scaduto o è stato revocato o rigenerato. Genera di nuovo il link dalla prenotazione e mandalo.

### L'ospite non ha un'e-mail: come gli mando il link?
Con **«Copia link»**: lo incolli in WhatsApp o in un SMS.

### L'ospite può cambiare lingua?
Sì, dal menu in alto del portale. La lingua iniziale è quella della prenotazione.

### Cosa vede un ospite di Airbnb o Booking.com?
Il portale con check-in, guida, chat (se il portale la permette), documenti e privacy. Non può annullare né cambiare date da qui e i pagamenti restano sul portale.

### Posso togliere gli extra a pagamento ai soggiorni Airbnb?
Sì: nel passaggio «Regole OTA» spunta «Nascondi i servizi a pagamento ai soggiorni Airbnb».

## Glossario
- **Portale ospite**: la pagina personale del soggiorno.
- **Link personale**: l'indirizzo privato del portale di una prenotazione.
- **Prossimo passo**: l'azione che il portale propone all'ospite («Completa il check-in», «Paga la tassa di soggiorno», «Guida della casa»).
- **Guida della casa**: le informazioni per il soggiorno che scrivi tu.
- **Check-in online**: il modulo con i dati degli ospiti, prima dell'arrivo.

## Vedi anche
- [[ospiti-checkin]]: il check-in dal lato del gestore e cosa succede ai dati.
- [[sito-prenotazione]]: la prenotazione che porta al portale.
- [[dominio-incorpora]]: il portale ospite sul tuo dominio.
- [[messaggi-recensioni]]: chat e recensioni.
- [[alloggiati-istat]]: la comunicazione degli ospiti alla Questura.
