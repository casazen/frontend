---
id: immobili
titolo: Immobili
sezione: Affitti brevi
ordine: 10
riassunto: Come aggiungere e gestire le case che affitti a notte. L'elenco, la procedura guidata «Aggiungi immobile», la scheda, l'attivazione (con il CIN), la pausa, l'eliminazione, il passaggio tra affitto breve e lungo e il codice QR.
chi: [gestore, amministratore]
dove: Affitti brevi › Immobili
parole_chiave: [immobile, appartamento, aggiungere appartamento, inserire casa, aggiungere immobile, procedura guidata, attivazione, non riesco ad attivare, Da completare, mostra sul sito, pausa, eliminare immobile, foto, dotazioni, regole della casa, capienza, CIN, chi invia, cambio modalità, affitto lungo, QR]
copre: [/app/short-rent/properties, /app/short-rent/properties/create, /app/short-rent/properties/:id, /app/short-rent/properties/:id/edit, /app/short-rent/properties/:id/mode, /app/short-rent/properties/:propertyId/qr, /app/short-rent/activation, /app/long-rent/properties/:id/mode]
stato: disponibile
fonte_codice: [frontend/src/features/properties/properties-page.tsx, frontend/src/features/properties/properties-list.tsx, frontend/src/features/properties/property-create-page.tsx, frontend/src/features/properties/components/quick-property-form.tsx, frontend/src/features/properties/wizard/property-wizard.tsx, frontend/src/features/properties/wizard/property-wizard-model.ts, frontend/src/features/properties/property-detail-page.tsx, frontend/src/features/properties/property-edit-page.tsx, frontend/src/features/properties/property-activation-page.tsx, frontend/src/features/properties/mode/property-mode-wizard-page.tsx, frontend/src/pages/PropertyQrCode.tsx, frontend/src/i18n/locales/it.json, frontend/src/i18n/locales/property-setup.it.json, backend/Casazen.Web/Controllers/PropertiesController.cs, backend/Casazen.Core/Entities/Property.cs, backend/docs/runbooks/property-rental-mode.md]
---

## In breve
**Immobili** è l'elenco delle case che affitti a notte. Da qui aggiungi una casa con una procedura guidata a passi, la attivi quando è tutto a posto e la gestisci nel tempo: modifica, pausa, eliminazione, passaggio all'affitto lungo.
Una casa nuova nasce «Da completare» e non riceve prenotazioni finché non la attivi. Ogni passo della procedura viene salvato: puoi chiudere e riprendere quando vuoi.

**Prima di attivare tieni pronti:** il prezzo base, il **CIN** (il codice nazionale che ogni casa in affitto breve in Italia deve avere: si chiede sul portale del Ministero del Turismo, quindi **se non ce l'hai chiedilo subito**: vedi «Cosa serve per attivare una casa»), i documenti richiesti dalla tua regione e la scelta di chi invia i dati degli ospiti a Polizia e ISTAT.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Elenco immobili | Mostra le tue case con stato, camere e ospiti, prezzo base e (se collegato un channel manager) lo stato sui canali | Affitti brevi › Immobili | gestore, amministratore | Disponibile | Leggere l'elenco degli immobili |
| Aggiungi immobile | Procedura guidata a passi che crea la casa e la porta fino all'attivazione | Immobili › «Aggiungi immobile» | gestore, amministratore (permesso di modifica degli immobili) | Disponibile | Aggiungere un immobile con la procedura guidata |
| Primo immobile (modulo breve) | Dopo la registrazione chiede solo i dati essenziali | Si apre da solo al primo accesso | gestore, amministratore | Disponibile | Aggiungere il primo immobile |
| Riprendi configurazione | Riapre la procedura dall'ultimo passo aperto | Immobili (riquadro in alto) o «Completa» sulla riga | gestore, amministratore | Disponibile | Riprendere una configurazione lasciata a metà |
| Scheda dell'immobile | Panoramica, foto, prenotazioni e interventi, calendari, documenti | Immobili › nome della casa › «Scheda completa» | gestore, amministratore | Disponibile | Leggere la scheda di un immobile |
| Modifica immobile | Cambia i dati della casa in un solo modulo | Scheda › «⋯» › «Modifica» | gestore, amministratore (permesso di modifica) | Disponibile | Modificare i dati di un immobile in affitto breve |
| Attivazione dell'immobile | Passa la casa da «Da completare» ad «Attivo» | Ultimo passo della procedura; Immobili › Attivazione | gestore, amministratore (permesso di modifica) | Disponibile | Completare l'attivazione di un immobile |
| Pausa e riattivazione | Toglie la casa dalla vendita senza cancellarla | Riga › «⋯» › «Metti in pausa» / «Riattiva» | gestore, amministratore (permesso di modifica) | Disponibile | Mettere in pausa e riattivare un immobile |
| Elimina immobile | Nasconde la casa dall'elenco | Riga o scheda › «⋯» › «Elimina immobile» | gestore, amministratore (permesso di modifica) | Disponibile | Eliminare un immobile |
| Cambia modalità | Programma il passaggio da affitto breve a lungo (e viceversa) | Scheda › «⋯» › «Cambia modalità» | gestore, amministratore (permesso di modifica) | Disponibile | Passare un immobile all'affitto lungo (o breve) |
| Codice QR | Foglio stampabile con il codice QR per gli ospiti | Pagina del codice QR dell'immobile | gestore, amministratore | Disponibile | Stampare il codice QR |
| Chi invia Polizia e ISTAT, fatturazione | Due passi della procedura, presenti solo dove le funzioni sono attive | Procedura «Aggiungi immobile» | gestore, amministratore | Su attivazione | Vedi [[alloggiati-istat]] e [[fisco-documenti]] |

## Come funziona
**Gli stati di un immobile.** Ogni casa ha un solo stato, che vedi nell'elenco e nella scheda:
- **Da completare**: manca qualcosa (di solito il prezzo, il CIN o un documento). Non può ancora ricevere prenotazioni.
- **Attivo**: è tutto a posto e la casa è in vendita. Compare sul tuo sito di prenotazione se «Mostra la casa sul sito» è acceso.
- **In pausa**: l'hai messa tu in pausa; non è pubblicata. L'elenco scrive «In pausa dal» e la data.
- **Sospeso**: CasaZen ha trovato un punto obbligatorio non più a posto. La scheda dice «L'immobile è sospeso» e il pulsante «Risolvi i punti obbligatori» ti porta a correggerlo.

**Cosa serve per attivare una casa.** Lo decide CasaZen, non il modulo: ad ogni salvataggio ricalcola cosa manca. I punti che possono bloccare l'attivazione sono:
- i dati di base e il **prezzo base per notte**;
- il **CIN** (per le case in Italia). **Non ce l'hai?** Chiedilo subito, perché la casa resta «Da completare» finché non lo inserisci. Il CIN si chiede sul portale del Ministero del Turismo (BDSR): in CasaZen apri **Adempimenti › CIN** e premi «Richiedi il CIN sul portale» (in un avviso sul CIN il pulsante si chiama «Richiedi il CIN su BDSR»). Nel frattempo compili foto, testi e prezzi. Come si chiede, passo per passo: [[cin-identificazione-ticino#chiedere-il-cin]];
- i **documenti** richiesti dalla tua regione;
- il comune e, in Ticino, il numero della struttura, che servono per notificare gli ospiti.

La **scheda di sicurezza** (estintori e rilevatori) è un tuo obbligo di legge, ma non blocca l'attivazione: resta tra le cose da completare («Da completare (non blocca l'attivazione)»). Per l'attivazione serve anche accettare i Termini. Per il significato del CIN, della scheda di sicurezza e dell'invio dei dati degli ospiti vai a [[cin-identificazione-ticino]] e [[alloggiati-istat]].

**La procedura «Aggiungi immobile».** È un percorso a passi. L'immobile viene creato quando premi «Continua» alla fine del primo passo; da quel momento ogni passo successivo viene salvato e puoi uscire con «Salva e chiudi». Alcuni passi compaiono solo dove la funzione è attiva («su attivazione», vedi [[per-iniziare#cosa-significa-su-attivazione]]). I passi sono:

| Passo | Cosa chiede | Obbligatorio? |
|---|---|---|
| Dati base | Tipo, nome, indirizzo, comune, spazi, camere e letti | Sì |
| Proprietario | Chi è il proprietario (solo per le agenzie) | Sì, per le agenzie |
| Foto | Le foto della casa, con didascalie | No, consigliato |
| Dotazioni | Cosa trovano gli ospiti; scheda di sicurezza | No |
| Testi | Titolo e descrizione in italiano e inglese | Sì dove è collegato un channel manager, altrimenti no |
| Regole | Orari, fumo, animali, feste, bambini, silenzio, cancellazione | No |
| Prezzi | Prezzo base, weekend, pulizia, soggiorno minimo, sconti | Il prezzo serve per attivare |
| Canali | Dove pubblicare l'annuncio | No; compare solo con un channel manager collegato |
| Adempimenti | Chi invia i dati degli ospiti a Polizia e ISTAT | Solo case in Italia, dove la funzione è attiva |
| Fatturazione | Chi emette i documenti del soggiorno | Solo dove la funzione è attiva |
| Attivazione | Calendari, CIN, documenti, riepilogo, Termini | Sì, per attivare |

**Chi può fare cosa.** Vedere l'elenco e le schede richiede il permesso di lettura degli immobili. Aggiungere, modificare, mettere in pausa, eliminare, cambiare modalità e attivare richiedono il permesso di modifica degli immobili: senza, i pulsanti non compaiono. Aprire il calendario di una casa richiede il permesso sulle prenotazioni.

**Il tuo piano conta gli immobili.** In fondo all'elenco leggi, per esempio, «Piano Pro: 3 di 50 immobili (brevi e lunghi)». Gli immobili in affitto breve e quelli in affitto lungo si sommano. Se hai raggiunto il limite, il primo passo della procedura è bloccato e un avviso rosso ti porta alla pagina del piano; vedi [[account-team-piano]].

## Come fare

### Leggere l'elenco degli immobili
1. Apri **Affitti brevi › Immobili**.
2. Ogni riga mostra la foto, il nome e dove si trova la casa; poi lo stato, «Camere e ospiti» (per esempio «2 camere · 4 ospiti»; un monolocale è «Monolocale») e il «Prezzo base» a notte. Se non hai ancora messo un prezzo leggi «Non impostato».
3. Con un channel manager collegato compare anche la colonna «Canali». Se non c'è ancora una pubblicazione leggi «Non pubblicato».
4. Per filtrare usa i riquadri «Tutti», «Attivi», «Da completare» (con l'indicazione «Non possono ancora ricevere prenotazioni») e «In pausa». Puoi anche scrivere in «Cerca per nome, città o indirizzo» e scegliere una «Città».
5. Premi il nome della casa: si apre un pannello con i dati chiave (indirizzo, CIN, prezzo base, spazi, prenotazioni) e il pulsante «Completa l'attivazione» se serve.
6. Il pulsante di ogni riga dipende dallo stato: «Completa» per una casa da completare o sospesa, «Riattiva» per una casa in pausa, «Apri calendario» per una casa attiva. Gli altri comandi sono nel menu «⋯»: «Scheda completa», «Modifica», «Richiedi intervento», «Metti in pausa», «Elimina immobile».

> **Nota:** se l'elenco non si carica vedi «Impossibile caricare gli immobili»: premi il pulsante per riprovare.

### Aggiungere il primo immobile
Subito dopo la registrazione CasaZen ti mostra un modulo breve, «Aggiungi il tuo primo immobile». **Ti serve:** il nome che vuoi dare alla casa, il suo indirizzo con numero civico, il comune, il numero massimo di ospiti e il prezzo per notte.
1. Scrivi il nome in «Come si chiama?», per esempio «Appartamento Duomo».
2. Scegli il «Comune» dall'elenco e scrivi l'«Indirizzo» (via e numero civico, per esempio «Via Roma 123») e il «CAP».
3. Scrivi «Ospiti max» (quante persone al massimo) e «Prezzo per notte» (in euro). I campi con l'asterisco (*) sono obbligatori. Il prezzo potrai cambiarlo in ogni momento e aggiungere tariffe stagionali.
4. Premi «Crea immobile e continua». L'immobile viene creato e CasaZen ti guida a completare il resto (foto, CIN, pagamenti) un passo alla volta.
5. Se preferisci inserire tutto subito, premi «Preferisco inserire tutti i dettagli ora»: si apre la procedura completa.

Errori frequenti: «Scegli il comune dall'elenco» (il comune va scelto dall'elenco ufficiale) ed «Esiste già un immobile con questo indirizzo» (se sono appartamenti diversi dello stesso edificio, indica l'interno o la scala).

### Aggiungere un immobile con la procedura guidata
**Ti serve:** il permesso di modifica degli immobili e l'indirizzo con numero civico (o «snc»). Per attivare la casa alla fine ti serviranno anche il prezzo, il CIN e i documenti richiesti dalla tua regione: se non hai il CIN chiedilo subito (vedi «Cosa serve per attivare una casa»); intanto puoi completare foto, testi e prezzi.
1. Apri **Affitti brevi › Immobili** e premi «Aggiungi immobile».
2. **Dati base.** Scegli «Che tipo di immobile è?» (Appartamento, Casa o villa, Loft o attico, Stanza o suite, Trullo o masseria). Scrivi il «Nome dell'immobile» (da 3 a 100 caratteri).
3. Scrivi l'«Indirizzo» con via e numero civico. Se il numero non c'è, scrivi «snc». Senza numero civico il passo non va avanti.
4. In «Piano e interno» (facoltativo, al massimo 30 caratteri) indica la scala o l'interno se nello stesso edificio hai più appartamenti: ognuno deve averne uno diverso.
5. Scegli il «Comune» dall'elenco ufficiale per le case in Italia: da lui seguono le regole, i documenti richiesti e l'imposta di soggiorno. Il «CAP» è facoltativo: in Italia ha 5 cifre, in Svizzera 4. Per una casa in Svizzera scegli il Paese e la località dall'elenco.
6. Sotto «Spazi» compila «Ospiti massimi» (da 1 a 100), «Camere da letto» (da 0 a 100: 0 per un monolocale), «Letti» (da 1 a 100: il matrimoniale conta 1) e «Bagni» (da 1 a 50). La «Superficie» in metri quadri è facoltativa (da 1 a 9999).
7. In «Camere e letti» puoi elencare le stanze (fino a 20), con tipo («Camera da letto», «Soggiorno», «Monolocale», «Altra stanza con letti») e letti (Singolo, Matrimoniale, Queen size, King size, Letto a castello, Divano letto, Culla; da 1 a 10 per tipo, al massimo 100 in tutto). È facoltativo, ma i canali lo chiedono. Se lo compili, «Camere da letto» e «Letti» si calcolano da questo elenco.
8. Premi «Continua». L'immobile esiste da questo momento ed è «Da completare». Se la tua organizzazione è un'agenzia, il passo successivo è «Proprietario» (a chi appartiene la casa, vedi [[agenzie-proprietari]]); altrimenti vai direttamente alle foto.
9. **Foto** (facoltativo). Trascina le foto o premi «Scegli le foto»: fino a 20 per immobile, 10 alla volta, in formato JPEG, PNG o WebP, al massimo 10 MB ciascuna. La prima foto è la copertina. Sotto «Didascalie e camere» puoi scrivere una didascalia in italiano e in inglese (al massimo 200 caratteri; quella in inglese non basta da sola) e dire in quale camera è stata scattata.
10. **Dotazioni** (facoltativo). Cerca con «Cerca una dotazione» (per esempio «lavatrice») e scegli solo ciò che c'è davvero: gli ospiti lo leggono prima di prenotare. Premi «Compila la scheda» per la **scheda di sicurezza**: poche risposte (gas o fiamme in casa, attività d'impresa, piani) e l'elenco di ciò che hai già in casa; CasaZen precompila quello che sa. CasaZen registra ciò che dichiari, non lo verifica né lo certifica.
11. **Testi.** Scrivi «Titolo (Italiano)» (fino a 60 caratteri) e «Descrizione (Italiano)» (fino a 10.000), poi gli stessi in inglese. Le altre lingue sono facoltative. Con «Suggerisci con l'AI» l'AI scrive una bozza guardando fino a 6 foto, il comune (non l'indirizzo) e gli annunci simili della zona; «Rigenera» ne chiede un'altra, «Annulla» torna al testo di prima. Rileggi sempre il testo. Se l'AI non è disponibile CasaZen compone il testo con i dati inseriti.
12. **Regole.** Scegli «Check-in dalle» e «Check-out entro le» (già impostati alle 15:00 e alle 10:00), le regole su «Fumare», «Animali», «Feste ed eventi» e «Bambini», gli «Orari di silenzio» (vanno indicati tutti e due o nessuno), il «Supplemento per ospite in più (€ a notte)» (lascia vuoto se non accetti ospiti in più), la politica «Se l'ospite cancella» (vedi [[prezzi-tariffe#impostare-la-politica-di-cancellazione]]) e «Altre regole» (fino a 1000 caratteri).
13. **Prezzi.** Scrivi il «Prezzo base per notte (€)». Senza prezzo la casa resta «Da completare». Il resto (weekend, pulizia, soggiorno minimo, sconti, calcolo con l'AI) è spiegato in [[prezzi-tariffe]].
14. **Canali, Adempimenti, Fatturazione.** Compaiono solo dove la funzione è attiva. In «Adempimenti» devi confermare **chi invia i dati degli ospiti a Polizia e ISTAT**: per legge ogni ospite va comunicato alla Polizia con il portale Alloggiati Web, e i dati statistici vanno ai portali regionali. Alla domanda «Chi invia i dati alla Polizia?» le scelte sono tre: **«Lo faccio io»** (scarichi tu da CasaZen i file dei soggiorni e li carichi sul portale della Polizia; CasaZen ti ricorda le scadenze), **il tuo channel manager** (Octorate: invia lui, dopo il collegamento e la verifica di ogni immobile) e **CasaZen**, che compare nell'elenco ma per ora non si può scegliere da qui. La scelta di partenza è il channel manager se la casa è collegata a Octorate (annuncio abbinato e confermato), altrimenti «Lo faccio io»: una scelta di partenza non vale come conferma, quindi devi confermarla tu. **Attenzione:** anche con Octorate collegato l'invio automatico degli ospiti è spento di partenza, quindi non dare per scontato che Octorate comunichi gli ospiti alla Polizia: controlla «Chi invia» e lo stato dell'invio. Puoi cambiare scelta quando vuoi. Scadenze, cosa fa CasaZen e cosa resta a te: [[alloggiati-istat#comunicare-gli-ospiti-alla-questura-alloggiati-web]].
15. **Attivazione.** Nell'ultimo passo trovi: «Collega i calendari» (consigliato: le date prenotate su Airbnb o Booking.com risultano occupate anche da te, vedi [[canali-octorate#collegare-un-calendario-ical]]), «Codice CIN» con «Salva il CIN», i «Documenti richiesti», il «Riepilogo» (ogni sezione ha «Modifica») e «Cosa manca».
16. Decidi «Mostra la casa sul sito»: di partenza è **acceso**. Acceso, gli ospiti possono prenotare dal tuo sito; spento, la casa sarà attiva ma non comparirà.
17. Se non c'è nessun blocco, accetta i Termini (e conferma di sapere che documenti e scheda di sicurezza ancora aperti sono tuoi obblighi) e premi «Attiva l'immobile».
18. Se manca ancora qualcosa premi «Finisci dopo»: l'immobile resta «Da completare» e lo attivi appena è tutto a posto. Alla fine vedi «È salvato» o «È pronto», con i pulsanti «Apri il calendario», «Completa l'attivazione», «Aggiungi un altro immobile» o «Vai agli immobili».

> **Nota:** in ogni passo c'è «Salva e chiudi»: salva ciò che hai scritto e ti riporta all'elenco. Dal primo passo, prima di «Continua», esce senza creare la casa e ti ricorda che le risposte restano qui.
> **Attenzione:** se compare «Non siamo riusciti a salvare l'immobile. Controlla i dati e riprova.» controlla i campi segnati in rosso.

### Riprendere una configurazione lasciata a metà
1. Apri **Affitti brevi › Immobili**.
2. In alto compare il riquadro «Configurazione di» con il nome della casa e «Ultimo passaggio aperto». Premi «Riprendi configurazione».
3. In alternativa premi «Completa» sulla riga della casa: la procedura si apre sul primo passo che ha ancora un punto aperto.

### Leggere la scheda di un immobile
1. Dall'elenco premi il nome e poi «Scheda completa», oppure apri il menu «⋯» della riga.
2. In alto vedi il nome, un riassunto (camere · ospiti · città) e lo stato.
3. «Cosa fare ora» è il riquadro che ti dice il prossimo passo: «Completa l'attivazione» (con «Mancano:» e l'elenco), «Manca il codice CIN», «Il CIN non è nel formato ufficiale», «Aggiungi le foto», «L'immobile è in pausa», «L'immobile è sospeso» oppure «Tutto in ordine» con il prossimo arrivo.
4. Le schede: **Panoramica** (dati, prezzi, canali, invio a Polizia e ISTAT), **Foto**, **Prenotazioni e interventi**, **Calendari iCal** (si chiama «Canali OTA» dove è attiva l'integrazione diretta; vedi [[canali-octorate]]) e **Documenti e adempimenti** (documenti, CIN).
5. Se la casa è pubblicata, «Vedi sul sito pubblico» apre la sua pagina sul tuo sito di prenotazione.

#### Gestire le foto dalla scheda
1. Apri la scheda **Foto**.
2. Premi «Carica foto» (o «Carica la prima foto»). Valgono gli stessi limiti della procedura: 20 foto, JPEG, PNG o WebP, 10 MB.
3. «Imposta come copertina» sceglie la foto che gli ospiti vedono per prima nel sito di prenotazione e nei risultati di ricerca. Usa «Sposta la foto … prima / dopo» per cambiare l'ordine.
4. «Elimina la foto» chiede conferma: la foto sparisce dalla galleria e dal sito e **non si può annullare**.

### Modificare i dati di un immobile in affitto breve
Serve il permesso di modifica degli immobili.
1. Apri la scheda della casa e il menu «⋯», poi «Modifica» (oppure «⋯» sulla riga dell'elenco).
2. Si apre «Modifica immobile» con tutti i dati in un solo modulo: nome, descrizione, posizione, camere, bagni, ospiti, prezzo per notte, servizi, CIN, pulizie, «Deposito cauzionale», regole della casa, fuso orario e policy di cancellazione.
3. Premi «Aggiorna immobile». Per tornare indietro senza salvare premi «Annulla».
4. Per cambiare un solo passo della procedura (per esempio le foto) puoi anche usare «Completa» o «Riprendi configurazione».

### Completare l'attivazione di un immobile
**Ti serve:** il permesso di modifica degli immobili, il prezzo base, il CIN (se la casa è in Italia), i documenti richiesti dalla tua regione e la scelta di chi invia i dati degli ospiti.
1. Apri la procedura sull'ultimo passo: da Immobili premi «Completa» sulla riga, oppure «Completa l'attivazione» nel pannello della casa.
2. Leggi «Cosa manca»: ogni voce ha un pulsante «Correggi» che ti porta al passo giusto. Le voci «Consigliato» non bloccano.
3. Quando «Cosa manca» dice «Tutto a posto: manca solo la conferma finale», accetta i Termini e premi «Attiva l'immobile».
4. Se il servizio rifiuta l'attivazione leggi «Non si può ancora attivare: il servizio segnala questi punti» e correggi quelli.
5. Dopo l'attivazione la casa è «Attivo». Se hai spento «Mostra la casa sul sito» gli ospiti non possono prenotarla dal tuo sito finché non lo accendi.

La pagina **Immobili › Attivazione** raccoglie tutte le case da seguire in un unico punto. Scegli una casa dall'elenco «Immobili da seguire» (con «Cerca per nome o città»): vedi «Controllo dei dati e pubblicazione» con il pulsante «Rivedi la scheda» o «Apri la scheda», l'elenco dei «Portali di prenotazione» con «Collega» o «Riprendi» (porta alle procedure di [[canali-octorate]]) e gli «Adempimenti» (Alloggiati e ISTAT), dove puoi chiedere allo staff CasaZen di configurarli. Per un annuncio importato da un channel manager la pagina elenca i campi da rivedere («Da compilare», «Da confermare», «Da mappare»).

> **Nota:** la procedura guidata degli adempimenti di un immobile («Chi invia a Polizia e ISTAT?», credenziali, deleghe) è spiegata in [[alloggiati-istat]].

### Mettere in pausa e riattivare un immobile
1. Dall'elenco apri il menu «⋯» della riga e scegli «Metti in pausa» (compare solo per le case attive), oppure fai lo stesso dal menu «⋯» della scheda.
2. La casa passa a «In pausa» e non è più pubblicata.
3. Per rimetterla in vendita premi «Riattiva» sulla riga o nella scheda.

La pausa si può sempre annullare. Non cancella nulla.

### Eliminare un immobile
**Ti serve:** il permesso di modifica degli immobili.
1. Apri il menu «⋯» della riga o della scheda e scegli «Elimina immobile».
2. Si apre «Eliminare l'immobile?». Leggi cosa succede: «L'immobile non sarà più visibile nell'elenco» e «Non puoi eliminarlo se ha prenotazioni future o locazioni attive».
3. Nel campo di conferma scrivi il **nome della casa**, come compare nell'elenco (non una parola fissa): il pulsante «Elimina immobile» si attiva solo quando il nome coincide. Poi premilo.
4. Se l'immobile ha un soggiorno non ancora concluso (in attesa, confermato o con check-in fatto) o un contratto in corso, CasaZen rifiuta e te lo dice. Prima concludi o annulla quei soggiorni o contratti.

> **Attenzione:** dall'app non esiste un pulsante per ripristinare una casa eliminata. Se vuoi solo fermare le vendite per un po' usa la pausa.

### Passare un immobile all'affitto lungo (o breve)
Un immobile sta in una sola modalità alla volta. Il passaggio è programmato per un giorno preciso, non è immediato. Serve il permesso di modifica degli immobili.
1. Apri la scheda dell'immobile (in Affitti brevi) e il menu «⋯», poi «Cambia modalità». Per il passaggio inverso apri l'immobile in **Affitti lunghi** e usa lo stesso comando.
2. **Scelta.** Scegli «Passa all'affitto lungo» (contratti e canoni al posto delle prenotazioni: la casa esce dal sito di prenotazione) oppure «Passa all'affitto breve» (prenotazioni e sito di prenotazione al posto dei contratti). Premi «Scegli la data».
3. **Data.** Indica «Primo giorno in affitto lungo» (o «breve»). Si può partire da domani; CasaZen suggerisce il primo giorno possibile («Usa il …») in base all'ultimo soggiorno, all'ultimo blocco di date sui portali o all'ultimo contratto. La data più lontana è tra dieci anni. Il passaggio avviene all'inizio del giorno scelto. Premi «Controlla la data».
4. **Controlli.** CasaZen guarda soggiorni, date occupate sui portali e contratti. Se qualcosa impedisce il passaggio in quel giorno vedi «Il … non è possibile» con le cause e un pulsante per ciascuna: «Apri la prenotazione», «Apri il contratto», «Apri i calendari», «Apri la bozza». Risolvi o scegli un altro giorno. Le date dei portali si liberano quando finiscono o se scolleghi il calendario. Una bozza di contratto va eliminata prima del passaggio. Quando è libero leggi «Tutto a posto per il …». Premi «Rivedi e conferma».
5. **Conferma.** Controlla il riepilogo («Cosa succede») e premi «Programma il passaggio all'affitto lungo» (o «breve»).
6. Vedi «Passaggio programmato» e ricevi un'email di conferma.

Cosa succede, verso l'affitto lungo: da subito il sito e i portali non accettano più prenotazioni con partenza dalla data scelta in poi; dal giorno scelto il sito di prenotazione non mostra più l'immobile e la casa compare in Affitti lunghi; i soggiorni già prenotati che finiscono prima di quel giorno restano validi. Le notti chiuse per il passaggio compaiono nel calendario come «Passaggio all'affitto lungo» e non si riaprono da lì.
Verso l'affitto breve: fino alla data contratti e canoni restano come sono; dal giorno scelto l'immobile compare in Affitti brevi e, per accettare prenotazioni, dovrai completare l'annuncio: prezzi, ospiti e CIN.

**Si può tornare indietro?** Sì, fino al giorno prima: nella scheda dell'immobile un avviso («Passaggio all'affitto lungo il …») ti dice che fino ad allora la casa resta dov'è; premi «Annulla il passaggio». Il calendario si riapre. Finché c'è un passaggio in programma non se ne può programmare un altro («C'è già un passaggio in programma»).

### Stampare il codice QR
1. Apri la pagina del codice QR dell'immobile (si apre dai link dell'app per l'immobile).
2. Dove la verifica dell'identità degli ospiti è attiva vedi «Codice QR della porta»: gli ospiti lo inquadrano alla porta, scrivono il codice della prenotazione e la data di arrivo e proseguono con il check-in. Altrimenti vedi «Codice QR per verifica ospiti», che porta alla pagina di verifica dell'ospite.
3. Premi «Stampa» (il browser apre un foglio pronto; se lo blocca, consenti le finestre) oppure «Scarica PNG».
4. Per sostituire il codice del «Codice QR della porta» premi «Rigenera» e conferma con «Rigenera il codice»: **quello stampato prima smette di funzionare subito**. Solo chi può modificare l'immobile vede il codice e può rigenerarlo.

## Flussi completi

### Flusso: dalla prima casa alla prima prenotazione possibile
1. Dopo la registrazione compili il modulo breve «Aggiungi il tuo primo immobile» ([[immobili#aggiungere-il-primo-immobile]]). Se non hai ancora il CIN, chiedilo subito sul portale del Ministero del Turismo ([[cin-identificazione-ticino]]).
2. Completi la procedura: foto, dotazioni, testi, regole, prezzo ([[immobili#aggiungere-un-immobile-con-la-procedura-guidata]], [[prezzi-tariffe]]).
3. Colleghi i calendari di Airbnb e Booking.com o il tuo channel manager ([[canali-octorate]]).
4. Inserisci il CIN e carichi i documenti richiesti ([[cin-identificazione-ticino]]), scegli chi invia i dati degli ospiti ([[alloggiati-istat]]).
5. Accetti i Termini e premi «Attiva l'immobile»: la casa è «Attivo» ([[immobili#completare-l-attivazione-di-un-immobile]]).
6. Accendi «Mostra la casa sul sito» (di partenza è già acceso) e condividi il tuo sito di prenotazione ([[sito-prenotazione]]). Le prenotazioni si gestiscono in [[prenotazioni]].

### Flusso: da affitto breve ad affitto lungo
1. Controlli in [[prenotazioni]] i soggiorni in corso e futuri della casa.
2. Programmi il passaggio da «Cambia modalità» scegliendo un giorno dopo l'ultimo soggiorno.
3. CasaZen chiude le notti da quel giorno in poi e ti scrive una conferma.
4. Nel giorno scelto la casa passa in Affitti lunghi, dove prepari il contratto ([[affitti-lunghi]], [[contratti]]).

## Regole e limiti
- Il tuo piano limita il numero di immobili (brevi e lunghi insieme). Il server decide: una pagina non aggiornata non aggira il limite.
- Nome: da 3 a 100 caratteri. Indirizzo: con numero civico o «snc». Piano e interno: al massimo 30 caratteri. Ospiti da 1 a 100, camere da letto da 0 a 100, letti da 1 a 100, bagni da 1 a 50, superficie da 1 a 9999 m², al massimo 20 camere elencate.
- Foto: 20 per immobile, 10 per volta, JPEG, PNG o WebP, 10 MB ciascuna. La didascalia al massimo 200 caratteri.
- Titolo dell'annuncio al massimo 60 caratteri; descrizione al massimo 10.000; «Altre regole» al massimo 1000.
- Una casa «Da completare» o «Sospeso» non riceve prenotazioni. Una casa in pausa non è pubblicata.
- Si elimina un immobile solo se non ha soggiorni da concludere né contratti in corso; per confermare si scrive il nome della casa.
- Il passaggio di modalità si programma al massimo tra dieci anni, parte all'inizio del giorno scelto e si può annullare fino al giorno prima.
- Il CIN ha questo formato: IT + codice ISTAT del comune (6 cifre) + categoria (2 caratteri) + fino a 8 caratteri; spazi e trattini sono ignorati. Esempio: IT015146C2ABCDEFGH. Lasciare il campo vuoto rimuove il CIN registrato.
- Per le case in Svizzera il CIN italiano non si applica; CasaZen non verifica la registrazione cantonale (vedi [[cin-identificazione-ticino]]).

## Domande frequenti

### Come aggiungo il mio appartamento?
Apri **Affitti brevi › Immobili** e premi «Aggiungi immobile» (la prima volta compare «Aggiungi il tuo primo immobile»). Ti servono nome, comune, indirizzo con numero civico, ospiti massimi e prezzo per notte. Vedi [[immobili#aggiungere-il-primo-immobile]].

### Perché il mio immobile è «Da completare»?
Perché manca almeno un punto che blocca l'attivazione: di solito il prezzo base, il CIN, un documento o il comune. Apri «Completa» sulla riga e leggi «Cosa manca».

### Non riesco ad attivare la casa: cosa devo fare?
Premi «Completa» sulla riga della casa e leggi «Cosa manca»: di solito sono prezzo base, CIN, documenti o comune. Premi «Correggi» su ogni voce, poi accetta i Termini e premi «Attiva l'immobile». Vedi [[immobili#completare-l-attivazione-di-un-immobile]].

### Non ho il CIN: dove lo ottengo?
Si chiede sul portale del Ministero del Turismo (BDSR). In CasaZen apri **Adempimenti › CIN** e premi «Richiedi il CIN sul portale». Finché non lo inserisci la casa resta «Da completare»; nel frattempo puoi compilare foto, testi e prezzi. Vedi [[cin-identificazione-ticino#chiedere-il-cin]].

### Posso salvare a metà e continuare dopo?
Sì. Dopo il primo «Continua» l'immobile esiste e ogni passo si salva. Usa «Salva e chiudi» e poi «Riprendi configurazione».

### La casa è attiva ma i miei ospiti non la vedono sul sito
Controlla l'interruttore «Mostra la casa sul sito» (ultimo passo della procedura; di partenza è acceso) e che la casa non sia in pausa. Vedi [[sito-prenotazione#quando-una-casa-compare-sul-sito]].

### Posso avere due appartamenti allo stesso indirizzo?
Sì, se indichi l'interno o la scala in «Piano e interno»: ognuno deve averne uno diverso. Altrimenti CasaZen dice «Esiste già un immobile con questo indirizzo».

### Posso eliminare una casa che ha prenotazioni future?
No. Prima concludi o annulla i soggiorni e i contratti. Se vuoi solo fermare le vendite usa «Metti in pausa».

### Il pulsante «Elimina immobile» resta spento: perché?
Nella finestra di conferma devi scrivere il nome della casa, come compare nell'elenco. Quando il nome coincide, il pulsante si attiva.

### Cosa succede alle prenotazioni quando metto in pausa?
La pausa toglie la casa dalla pubblicazione. Le prenotazioni già registrate restano nel tuo elenco: gestiscile in [[prenotazioni]].

### Posso cambiare idea dopo aver programmato il passaggio all'affitto lungo?
Sì, fino al giorno prima, con «Annulla il passaggio».

## Glossario
- **Da completare**: stato di una casa a cui manca almeno un punto per essere attivata.
- **Attivazione**: conferma finale che rende la casa «Attivo».
- **Mostra la casa sul sito**: interruttore che decide se la casa compare sul tuo sito di prenotazione.
- **CIN**: Codice Identificativo Nazionale: il codice che identifica una casa in affitto breve in Italia. Va esposto fuori dalla casa e scritto in ogni annuncio; si chiede sul portale del Ministero del Turismo (BDSR).
- **Scheda di sicurezza**: elenco delle dotazioni di sicurezza che dichiari per la casa.
- **Cambia modalità**: passaggio programmato tra affitto breve e affitto lungo.

## Vedi anche
- [[prezzi-tariffe]]: prezzo base, weekend, pulizia, sconti e prezzi per data.
- [[canali-octorate]]: calendari iCal, channel manager e canali.
- [[alloggiati-istat]]: chi invia i dati degli ospiti e la procedura di attivazione degli adempimenti.
- [[cin-identificazione-ticino]]: CIN e regole per il Ticino.
- [[prenotazioni]]: calendario e prenotazioni della casa.
- [[affitti-lunghi]]: gestione degli immobili in affitto lungo.
