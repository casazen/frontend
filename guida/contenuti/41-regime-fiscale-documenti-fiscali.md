---
id: fisco-documenti
titolo: Regime fiscale e documenti fiscali
sezione: Incassi e fisco
ordine: 41
riassunto: Come scegli il regime fiscale degli immobili, come imposti la fatturazione e come CasaZen prepara, emette e invia fatture, ricevute e note di credito agli ospiti.
chi: [gestore, amministratore]
dove: Affitti brevi › Incassi › Regime fiscale e Documenti fiscali
parole_chiave: [regime fiscale, cedolare secca, partita IVA, fattura, ricevuta, nota di credito, bozza, SDI, fattura elettronica, numerazione, bollo, ritenute, report fiscali, fatturazione]
copre: [/app/short-rent/fiscal, /app/short-rent/fiscal/wizard, /app/short-rent/fiscal/setup, /app/short-rent/fiscal/issuer (non-utente), /app/short-rent/fiscal/documents, /app/short-rent/fiscal/reports]
stato: disponibile
fonte_codice: [frontend/src/features/fiscal/fiscal-dashboard-page.tsx, frontend/src/features/fiscal/fiscal-wizard-page.tsx, frontend/src/features/fiscal/fiscal-reports-page.tsx, frontend/src/features/fiscal/billing-wizard/billing-wizard-page.tsx, frontend/src/features/fiscal/billing-wizard/steps, frontend/src/features/fiscal/documents/fiscal-documents-page.tsx, frontend/src/features/fiscal/documents/document-actions.tsx, frontend/src/features/fiscal/documents/document-batch.tsx, frontend/src/features/fiscal/documents/document-sdi-panel.tsx, backend/Casazen.Core/Entities/Enums/DocumentIssuerMode.cs, backend/Casazen.Infrastructure/Services/FiscalDocumentService.Automation.cs, backend/Casazen.Web/Controllers/FiscalDocumentsController.cs, backend/Casazen.Web/Controllers/FiscalDocumentSdiController.cs, backend/Casazen.Web/Controllers/OctorateDocumentsController.cs, backend/Casazen.Web/appsettings.json]
---

## In breve
In **Affitti brevi › Incassi** ci sono due parti per il fisco. «**Regime fiscale**» ti fa scegliere, immobile per immobile, come paghi le tasse sugli affitti brevi dell'anno (per esempio cedolare secca) e ti dà i report da portare al commercialista. «**Documenti fiscali**» è l'elenco delle fatture, delle ricevute e delle note di credito che **CasaZen emette per te** agli ospiti.

Il commercialista **non emette niente**: riceve soltanto i dati (vedi [[report-commercialista]]). CasaZen non presenta dichiarazioni, non prepara F24 e non sostituisce il commercialista.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Regime fiscale per immobile | Mostra il regime consigliato dell'anno e ti fa scegliere quello giusto | Incassi › Regime fiscale | gestore, amministratore | Disponibile | Scegliere il regime fiscale di un immobile |
| Profilo fiscale | Salva partita IVA e codice fiscale del titolare | Regime fiscale › «Profilo fiscale» | gestore, amministratore | Disponibile | Inserire partita IVA e codice fiscale |
| Report fiscali | Riepilogo per immobile, ritenute e tassa di soggiorno, da scaricare in CSV o PDF | Regime fiscale › «Apri i report» | gestore, amministratore | Disponibile | Scaricare un report fiscale |
| Impostare la fatturazione | Percorso guidato: chi emette, IVA, numerazione, emissione, commercialista | Regime fiscale › «Imposta la fatturazione» | gestore, amministratore | Su attivazione | Impostare la fatturazione |
| Bozze dei documenti | A fine soggiorno CasaZen prepara da sola la bozza del documento | Documenti fiscali | gestore, amministratore | Su attivazione | Scegliere se emettere da sola o con la tua conferma |
| Emissione di un documento | Dà il numero al documento e lo emette a nome della tua organizzazione | Documenti fiscali › «Emetti» | gestore, amministratore | Su attivazione | Emettere un documento |
| Emissione in blocco | Emette più bozze insieme | Documenti fiscali › «Emetti selezionate» | gestore, amministratore | Su attivazione | Emettere più bozze insieme |
| Invio all'ospite | Manda all'ospite una e-mail con il link per scaricare il documento | Documenti fiscali › «Invia al cliente» | gestore, amministratore | Su attivazione | Inviare il documento all'ospite per e-mail |
| Nota di credito | Corregge un documento già emesso | Documenti fiscali › «Nota di credito» | gestore, amministratore | Su attivazione | Correggere un documento emesso con una nota di credito |
| Scarto di una bozza | Elimina una bozza che non serve | Documenti fiscali › «Scarta» | gestore, amministratore | Su attivazione | Scartare una bozza |
| Invio allo SDI | Invia la fattura elettronica e ne segue l'esito | Dettaglio del documento › «Invio allo SDI» | gestore, amministratore | Su attivazione | Inviare una fattura allo SDI o dichiarare l'invio a mano |
| Correzione di una fattura scartata | Rifà la fattura scartata con lo stesso numero | Dettaglio del documento › «Correggi» | gestore, amministratore | Su attivazione | Correggere una fattura scartata dallo SDI |
| Scaricare PDF, XML ed elenco | PDF e XML di ogni documento; CSV ed Excel dell'elenco | Documenti fiscali | gestore, amministratore | Su attivazione | Scaricare PDF, XML e l'elenco |
| Documenti dal channel manager | Mostra in sola lettura i documenti emessi dal tuo channel manager (Octorate) | Documenti fiscali, filtro «Emesso da» | gestore, amministratore | Su attivazione | Capire i documenti «Dal tuo channel manager» |

## Come funziona

### Chi emette i documenti
**CasaZen emette ogni documento a nome della tua organizzazione**: per ogni prenotazione, qualunque sia il canale da cui arriva. Il commercialista riceve gli export (il «pacchetto»), non emette niente. Lo stesso vale per il tuo channel manager: i documenti che emette lui sono mostrati in sola lettura e non bloccano mai quelli di CasaZen.

Cosa emetti dipende dal tuo regime, che dici nel percorso «Fatturazione»:
- **Privato** (senza partita IVA): una **ricevuta**.
- **Partita IVA**, regime forfettario o ordinario: una **fattura elettronica**.
- **Svizzera**: documenti in franchi svizzeri; con iscrizione all'IVA una fattura con IVA e numero UID, senza iscrizione una ricevuta senza IVA.

### Dalla bozza al documento
1. **A fine soggiorno** CasaZen prepara sempre la **bozza** del documento. Non è una scelta.
2. Se hai scelto «Emetti in automatico», CasaZen **emette da sola** i documenti dei soggiorni finiti, con i dati della prenotazione di quel momento, senza chiederti conferma. Altrimenti la bozza aspetta la tua conferma e la emetti tu (da soli o in blocco).
3. All'emissione il documento riceve il suo **numero**, in ordine e senza buchi, nella sua serie. Dopo l'emissione **non si modifica più**: per correggerlo serve una nota di credito.
4. Se hai scelto «Invia il documento all'ospite per e-mail», l'ospite riceve il link per scaricarlo (quando la prenotazione ha un indirizzo).

CasaZen non prepara bozze finché il percorso «Fatturazione» non è completo nelle parti che servono (chi emette e IVA). Se il documento di una prenotazione è bloccato, la scheda della prenotazione ti dice cosa fare e mostra i pulsanti «Controlla il regime IVA» e «Controlla i dati emittente». Per i soggiorni già finiti, CasaZen ricontrolla ogni giorno e prepara le bozze mancanti; il controllo giornaliero non considera i soggiorni segnati come mancato arrivo.

### Gli stati di un documento
| Stato | Cosa vuol dire |
|---|---|
| **Bozza** | Preparata da CasaZen, ancora modificabile e senza numero |
| **Emessa** | Ha il suo numero e non si modifica più |
| **Emessa - da inviare allo SDI** | Fattura elettronica emessa, non ancora trasmessa |
| **Inviata allo SDI** | Presa in carico: aspettiamo la risposta |
| **Consegnata** | Lo SDI l'ha consegnata |
| **Scartata dallo SDI** | Lo SDI l'ha rifiutata: la si corregge |
| **Inviata fuori da CasaZen (dichiarata)** | L'hai caricata a mano e l'hai dichiarato |
| **Pagata** o **Da incassare** | Se la prenotazione è saldata o no |
| **Bozza eliminata** | Scartata da te: non consuma numeri |
| **Gestito dal tuo channel manager** | Documento importato in sola lettura |

### Il regime fiscale degli immobili
La pagina **Regime fiscale [anno]** elenca gli immobili in affitto breve dell'anno. Per ognuno CasaZen indica il regime **consigliato** e tu lo **confermi** o ne scegli un altro. Un regime **non viene mai applicato da solo**: finché non lo confermi, l'immobile risulta «Non assegnato».

I regimi disponibili sono:
- **Cedolare secca 21% (unità designata)**: vale per una sola unità del titolare. Se la assegni a un altro immobile, quella già designata passa al 26%.
- **Cedolare secca 26%**.
- **IRPEF ordinaria senza partita IVA**: CasaZen non calcola l'imposta, la calcola il contribuente o il commercialista.
- **Impresa, regime ordinario (partita IVA)** e **Impresa, regime forfettario (partita IVA)**: richiedono la partita IVA nel profilo fiscale. Anche qui CasaZen non stima l'imposta.

Se un titolare destina agli affitti brevi più appartamenti del numero indicato nella pagina, si presume un'attività d'impresa, con partita IVA: la cedolare secca non è più disponibile e la pagina ti avvisa («Un titolare supera la soglia degli affitti brevi»). In questi casi, verifica il regime con il tuo commercialista: il prodotto stesso scrive che la raccomandazione è informativa, non è consulenza fiscale.

### Il percorso «Fatturazione»
È un percorso guidato che salva da solo ogni passo: puoi uscire con «Salva ed esci» e riprendere quando vuoi. Ci si arriva da **Regime fiscale** (riquadro «Fatturazione», pulsante «Imposta la fatturazione»). I passi che vedi dipendono dal tuo caso (per esempio «Italia» c'è solo se emetti dall'Italia, e i passi dei proprietari solo per le agenzie). In ogni passo c'è «Aiuto». Alla fine il «Riepilogo» dice cosa manca e mostra un documento di esempio.

- **Chi emette**: scegli il paese («Italia»: ricevuta o fattura elettronica in euro; «Svizzera»: documento secondo la legge svizzera, in franchi) e scrivi il «Nome sui documenti» e l'indirizzo completo (via, numero civico, CAP, città, provincia o cantone).
- **IVA**: in Italia scegli il tuo regime («Privato», «Forfettario», «Regime ordinario») e scrivi partita IVA (11 cifre) e codice fiscale. Scegli anche l'IVA del soggiorno («IVA al 10%» o «Esente, art. 10 n. 8») e se le pulizie sono «Parte del soggiorno» o «Un servizio a parte». Sono scelte da **confermare con il commercialista**. In Svizzera dici se sei iscritto all'IVA e scrivi il numero UID.
- **Italia**: due promemoria che CasaZen non può controllare per te: l'adesione gratuita alla conservazione dei documenti (servizio dell'Agenzia delle Entrate) e l'autorizzazione al bollo virtuale con il suo numero. Senza numero né conferma, sui documenti con bollo compare «imposta di bollo da assolvere».
- **Emissione**: scegli se emettere in automatico («Emetti in automatico») e se mandare il documento all'ospite («Invia il documento all'ospite per e-mail»).
- **Numerazione**: controlla la «Serie dei documenti agli ospiti» (può contenere l'anno): vedi un esempio di numero. Il numero vero continua da quello dell'ultimo documento emesso; la serie la confermi con questo passo, anche se lasci quella proposta.
- **Tassa di soggiorno**: in Italia le regole di ogni comune le tiene CasaZen e ti chiede solo se un portale la incassa al posto tuo. In Svizzera scegli per ogni portale «La incassa il portale» o «La incasso io». Dettagli in [[imposta-soggiorno-documenti]].
- **Invio allo SDI**: non c'è nulla da compilare. Vedi se CasaZen è collegata allo SDI e a che punto è ogni emittente.
- **Commercialista** (facoltativo): a chi mandare il pacchetto ogni mese ([[report-commercialista#mandare-il-pacchetto-al-commercialista-ogni-mese]]).
- **Riepilogo**: l'elenco di ciò che manca (ogni voce apre il suo passo) e un documento di esempio con le aliquote in vigore.

Se hai solo il permesso di guardare, il percorso mostra «Puoi solo guardare». Lo stesso succede se il tuo accesso riguarda solo alcuni immobili: la fatturazione è di tutta l'organizzazione.

### L'invio delle fatture allo SDI
Le fatture elettroniche italiane passano dallo **SDI**.
- Se CasaZen è **collegata allo SDI** (su attivazione), nel dettaglio del documento premi «Invia»: CasaZen manda la fattura, aspetta la risposta e te la mostra («Consegnata» o «Scartata dallo SDI»). Se viene scartata, trovi l'avviso nel «Da fare».
- Se **il collegamento non è ancora attivo**, la fattura resta «Emessa - da inviare allo SDI». In questo caso scarichi il file «XML», lo carichi sul portale «Fatture e Corrispettivi» dell'Agenzia delle Entrate e poi premi «Dichiara inviato a mano». CasaZen non controlla quello che dichiari: scrive quello che scrivi tu.
- Per una **fattura già consegnata** non si fa una correzione: si annulla con una nota di credito.

### Imposta di soggiorno sul documento
Se il portale incassa l'imposta di soggiorno al posto tuo, il documento per l'ospite lo scrive; altrimenti la riga è «Da pagare in struttura». Come si imposta e si versa: [[imposta-soggiorno-documenti]].

## Come fare

### Scegliere il regime fiscale di un immobile
Serve il permesso di modificare gli immobili. Chi può solo guardare vede lo stato di ogni immobile.
1. Apri **Affitti brevi › Incassi › Regime fiscale**.
2. Nel riquadro in alto vedi cosa fare per primo: «Conferma il regime fiscale di [immobile]» oppure «Scegli il regime fiscale di [immobile]».
3. Per accettare il consiglio premi «Conferma il regime consigliato».
4. Per scegliere un altro regime apri «Regime per quest'anno» («Scegli un regime») e selezionalo. Un regime non disponibile è indicato con il motivo («titolare oltre la soglia degli affitti brevi» o «manca la partita IVA»).
5. Se scegli la cedolare secca al 21% per un immobile, CasaZen ti avvisa che l'unità designata finora passa al 26%.
6. Vedi «Regime fiscale aggiornato». Il regime vale per quell'immobile e per quell'anno.

Se non c'è nessun immobile in affitto breve, vedi «Nessun immobile con affitti brevi» e il pulsante «Aggiungi un immobile».

### Inserire partita IVA e codice fiscale
1. In **Regime fiscale** premi «Profilo fiscale» (in alto).
2. Se hai la partita IVA, spunta «Ho una Partita IVA» e scrivila (11 cifre).
3. Scrivi il «Codice fiscale» (16 caratteri; 11 cifre per una società).
4. Premi «Salva». Vedi «Profilo fiscale salvato». Se non hai cambiato nulla vedi «Nessuna modifica da salvare».

Con la partita IVA nel profilo diventano disponibili i regimi d'impresa.

### Scaricare un report fiscale
1. In **Regime fiscale** premi «Apri i report» (oppure vai a **Incassi › Report** e scegli il report).
2. Scegli l'«Anno d'imposta» e il «Periodo» («Anno intero», «1° trimestre»…«4° trimestre»).
3. Scegli la sezione: «Riepilogo per immobile» (incassi del periodo, tassa di soggiorno, ritenute, imponibile e imposta stimata secondo il regime), «Ritenute subite» (le ritenute degli intermediari per canale e per pagamento, da riconciliare con la Certificazione Unica), «Tassa di soggiorno per comune e periodo».
4. Premi «Scarica CSV» o «Scarica PDF».

Come leggerli:
- L'**incassato lordo** conta i pagamenti completati nel periodo, rimborsi tolti. Comprende la tassa di soggiorno, che è esclusa dall'imponibile.
- Le **commissioni** dei portali non sono registrate in CasaZen: compaiono come «n.d.». Riportale dagli estratti conto dei portali; con la cedolare secca non sono deducibili.
- L'**imposta stimata** c'è solo per la cedolare secca (canone lordo per l'aliquota; aliquota ridotta per l'unità designata). Per IRPEF ordinaria, regimi d'impresa, immobili senza regime e titolari sopra la soglia vedi «Non calcolata».
- Le **ritenute** dei portali sono sempre a titolo d'acconto: si scomputano in dichiarazione.
- Il file è un **pacchetto di dati per il commercialista**: non è una dichiarazione, un F24 o una Certificazione Unica ufficiale.

### Impostare la fatturazione
Serve il permesso di modificare gli immobili e l'accesso a tutti gli immobili dell'organizzazione.
1. Apri **Incassi › Regime fiscale** e premi «Imposta la fatturazione» nel riquadro «Fatturazione».
2. Compila i passi uno alla volta (vedi «Il percorso Fatturazione» sopra) e premi «Continua».
3. Se devi fermarti, premi «Salva ed esci»: ciò che è corretto viene salvato, ciò che non lo è resta fuori e lo correggi quando riprendi.
4. Nell'ultimo passo, «Controlla e finisci», guarda se «Manca ancora» qualcosa: ogni voce ti porta al suo passo. Quando è tutto a posto vedi «Tutto a posto» e la schermata «La fatturazione è pronta».

Cosa succede dopo: da quel momento CasaZen può preparare e (se l'hai scelto) emettere i documenti. Puoi cambiare ogni scelta quando vuoi, dallo stesso percorso. I documenti già emessi non cambiano.

### Scegliere se emettere da sola o con la tua conferma
1. Apri il percorso «Fatturazione» e vai al passo «Emissione».
2. Con «Emetti in automatico» acceso, CasaZen emette i documenti a fine soggiorno senza chiederti conferma. Spento, ti chiede conferma prima di emettere.
3. Con «Invia il documento all'ospite per e-mail» acceso, il documento emesso parte per e-mail quando c'è un indirizzo.
4. Premi «Continua».

### Emettere un documento
Serve il permesso di modificare i pagamenti e la funzione attiva.
1. Apri **Incassi › Documenti fiscali**. Per vedere solo le bozze apri «Stato» e scegli «Bozze».
2. Controlla la bozza (premila per aprire il dettaglio: righe, IVA, totali, intestatario). Se i dati della prenotazione sono cambiati, premi «Aggiorna» per rifare la bozza.
3. Premi «Emetti». Vedi numero previsto, serie e totale.
4. Premi «Emetti» per confermare.

Cosa succede dopo: il documento ha il suo numero e **non si modifica più**. Non si annulla: per correggerlo emetti una nota di credito. Il numero definitivo lo assegna CasaZen all'emissione, in ordine e senza buchi.

### Emettere più bozze insieme
1. In **Documenti fiscali** imposta i filtri («Dal», «Al», «Tipo», «Stato»).
2. Premi «Seleziona tutte le bozze del periodo» oppure spunta le bozze una per una. Le note di credito si spuntano una per una.
3. Premi «Emetti selezionate». Nella finestra «Emettere N documenti?» leggi l'avviso e premi «Emetti N documenti».
4. Leggi il risultato: per ogni documento vedi se è stato emesso e, se no, perché. Gli altri vengono emessi lo stesso.

C'è un massimo di documenti per volta: se ne selezioni troppi, deseleziona quelli in più. Se resta qualche bozza, ripeti l'emissione.

### Inviare il documento all'ospite per e-mail
1. In **Documenti fiscali** trova il documento emesso.
2. Premi «Invia al cliente».
3. Conferma con «Invia l'e-mail».

Cosa succede dopo: l'ospite riceve una e-mail con un link per aprire e scaricare il documento (non è allegato). L'e-mail va a una persona vera, all'indirizzo lasciato nella prenotazione. Per rimandarla premi «Rinvia e-mail»: ogni invio manda un nuovo link, i vecchi funzionano fino alla loro scadenza.

### Correggere un documento emesso con una nota di credito
1. In **Documenti fiscali** trova il documento emesso e premi «Nota di credito».
2. Scegli «Tutto quello che resta da stornare» oppure «Solo una parte» e scrivi l'«Importo da stornare» con i centesimi (per esempio 120,50). Non può superare quanto resta da stornare.
3. Scrivi il «Motivo» (compare sulla nota di credito).
4. Premi «Emetti la nota di credito».

Cosa succede dopo: la nota di credito è emessa subito, con il suo numero, e il documento originale non cambia. Non è reversibile.

### Scartare una bozza
1. In **Documenti fiscali** trova la bozza e premi «Scarta».
2. Conferma con «Scarta la bozza».

La bozza scartata non consuma nessun numero e la prenotazione potrà avere una nuova bozza.

### Inviare una fattura allo SDI o dichiarare l'invio a mano
1. Apri il documento emesso e guarda il riquadro «Invio allo SDI».
2. Se il collegamento è attivo, premi «Invia». Aspetta la risposta: lo stato si aggiorna; se non succede, usa «Controlla di nuovo».
3. Se il collegamento non è attivo, premi «XML» per scaricare il file, caricalo sul portale «Fatture e Corrispettivi» dell'Agenzia delle Entrate e poi premi «Dichiara inviato a mano».
4. Scegli «L'ho inviato io, a mano» (e scrivi il «Giorno dell'invio» e il «Riferimento dell'invio») oppure «Lo SDI l'ha scartato» (e scrivi il «Codice dello scarto» e il «Testo della notifica»).
5. Premi «Dichiara».

Puoi vedere lo stato anche con un ruolo di sola lettura; per inviare o dichiarare serve chi può modificare i documenti.

### Correggere una fattura scartata dallo SDI
1. Apri la fattura «Scartata dallo SDI» (dal «Da fare» o dall'elenco) e premi «Correggi».
2. Passo «Che cosa facciamo»: leggi la spiegazione e premi «Inizia la correzione». Una fattura scartata non è mai arrivata a chi la riceve, quindi non serve una nota di credito: viene sostituita.
3. Passo «Controlla i dati»: controlla il codice fiscale o la partita IVA di chi riceve la fattura, spesso lo scarto dipende da lì.
4. Passo «Emetti di nuovo la fattura»: la fattura corretta prende il posto di quella scartata **con lo stesso numero**.
5. Passo «Fatto»: ora è «da inviare» allo SDI: aprila e premi «Invia».

Puoi chiudere quando vuoi con «Chiudi e riprendi dopo»: la bozza resta nell'elenco e la riprendi da lì.

### Scaricare PDF, XML e l'elenco
1. In **Documenti fiscali** premi «PDF» o «XML» sulla riga del documento. L'XML c'è solo per le fatture e le note di credito emesse da CasaZen.
2. Per l'intero elenco premi «CSV» o «Excel» (sotto «Scarica l'elenco»). I file contengono solo i documenti **emessi**, con gli stessi giorni, tipo e origine dei filtri: se hai un filtro sullo stato, toglilo.

### Capire i documenti «Dal tuo channel manager»
1. In **Documenti fiscali** apri il filtro «Emesso da» e scegli «Dal tuo channel manager».
2. Questi documenti sono in **sola lettura** e portano il badge «Gestito dal tuo channel manager». Il PDF si scarica tramite CasaZen.

## Flussi completi

### Flusso: dal check-out al documento per l'ospite
1. L'ospite fa il check-out e il soggiorno finisce ([[prenotazioni]]).
2. CasaZen prepara la bozza del documento, con intestatario, righe, IVA e imposta di soggiorno.
3. Se «Emetti in automatico» è acceso, CasaZen emette il documento da sola; se no, tu apri **Incassi › Documenti fiscali** e premi «Emetti».
4. Se «Invia il documento all'ospite per e-mail» è acceso, l'ospite riceve il link per scaricarlo.
5. Per una fattura elettronica: CasaZen la invia allo SDI, oppure la scarichi in XML e la carichi tu.
6. Il documento finisce nel pacchetto per il commercialista ([[report-commercialista#scaricare-il-pacchetto-per-il-commercialista]]).
7. Se c'è un errore, emetti una nota di credito.

### Flusso: fattura scartata dallo SDI
1. Lo SDI scarta la fattura: CasaZen ti avvisa nel «Da fare».
2. Premi «Correggi», controlla i dati del destinatario e rifai la fattura con lo stesso numero.
3. Da «da inviare» premi «Invia» (o dichiara l'invio a mano).

### Flusso: prima volta con la fatturazione
1. Apri **Regime fiscale** e premi «Imposta la fatturazione».
2. Completa i passi fino a «Tutto a posto» (in particolare «Chi emette» e «IVA»).
3. Scegli «Emissione» (automatica o con conferma).
4. Dopo il primo soggiorno finito trovi la bozza in **Documenti fiscali**.

## Regole e limiti
- CasaZen emette i documenti a nome della tua organizzazione; il commercialista non emette niente.
- Un documento emesso non si modifica: si corregge con una nota di credito. Una fattura scartata dallo SDI si sostituisce con lo stesso numero. Una bozza scartata non consuma numeri.
- La numerazione è progressiva, senza salti, per ogni serie.
- Senza il percorso «Fatturazione» completo (chi emette e IVA), CasaZen non prepara le bozze.
- Chi può cosa: vedere regime e report serve poter vedere gli immobili; cambiare il regime serve poter modificarli; vedere i documenti serve vedere i pagamenti e gli immobili; emettere, inviare, correggere e scartare serve poter modificare i pagamenti, con la funzione attiva. La fatturazione è dell'intera organizzazione: chi vede solo alcuni immobili la guarda ma non la cambia.
- L'ospite riceve il documento per e-mail solo se lo scegli e se la prenotazione ha un indirizzo.
- Il regime fiscale è per anno e per immobile; la cedolare secca al 21% vale per una sola unità del titolare.
- I report fiscali coprono un solo anno e partono dall'anno indicato nella pagina.
- CasaZen **non presenta dichiarazioni, non prepara F24 né Certificazioni Uniche**: i report sono dati per il commercialista. Per scelte fiscali (regime, IVA, bollo) confermale con il tuo commercialista.
- Per l'invio allo SDI: se il collegamento non è attivo, l'invio è a mano e CasaZen scrive solo ciò che dichiari.

## Domande frequenti

### Chi emette le fatture e le ricevute ai miei ospiti?
CasaZen, a nome della tua organizzazione. Il commercialista riceve gli export e non emette niente.

### Posso modificare un documento già emesso?
No. Per correggerlo emetti una nota di credito dal documento. Se è una fattura scartata dallo SDI, premi «Correggi».

### Perché non vedo «Documenti fiscali» o «Imposta la fatturazione»?
La funzione di emissione dei documenti è su attivazione: finché non è attiva per te, queste voci non compaiono. Servono anche i permessi giusti (vedere i pagamenti e gli immobili).

### Perché non trovo la bozza di un soggiorno finito?
Controlla che il percorso «Fatturazione» sia completo, che il soggiorno sia finito (non è un mancato arrivo) e che non esista già un documento per quella prenotazione.

### Cosa devo fare con «Emessa - da inviare allo SDI»?
Se vedi «Invia», premilo. Altrimenti scarica l'«XML», caricalo sul portale «Fatture e Corrispettivi» dell'Agenzia delle Entrate e premi «Dichiara inviato a mano».

### Una prenotazione di Airbnb o Booking.com ha un documento?
CasaZen emette i documenti di ogni prenotazione, qualunque sia il canale. Per le prenotazioni dei portali che incassano per te, il documento indica che il pagamento è avvenuto tramite il portale.

### Che cos'è il regime «Raccomandato»?
È il regime che CasaZen propone in base ai tuoi dati (per esempio la partita IVA o quanti appartamenti destini agli affitti brevi). Non è applicato finché non lo confermi, ed è solo un'indicazione, non una consulenza.

### CasaZen calcola e versa le mie tasse?
No. CasaZen stima l'imposta solo per la cedolare secca e solo come dato per il commercialista. Non presenta dichiarazioni, non prepara F24 né Certificazioni Uniche e non versa nulla.

## Glossario
- **Bozza**: il documento preparato da CasaZen prima dell'emissione.
- **Nota di credito**: il documento che corregge o annulla in tutto o in parte un documento già emesso.
- **SDI**: il Sistema di Interscambio dell'Agenzia delle Entrate, da cui passano le fatture elettroniche.
- **Serie**: la sequenza di numeri di un tipo di documento.
- **Cedolare secca**: la tassa sostitutiva sugli affitti, al 21% o al 26% secondo l'unità.
- **Ritenuta**: la somma che un portale trattiene sugli incassi e versa per tuo conto, a titolo d'acconto.
- **Bollo virtuale**: il modo di pagare l'imposta di bollo sui documenti in PDF, con autorizzazione dell'Agenzia delle Entrate.
- **UID**: il numero di identificazione delle imprese in Svizzera.

## Vedi anche
- [[incassi]]: i pagamenti e i rimborsi da cui nascono i documenti.
- [[report-commercialista]]: il pacchetto di dati e i report per il commercialista.
- [[imposta-soggiorno-documenti]]: l'imposta di soggiorno sul documento e i suoi versamenti.
- [[prenotazioni]]: il fine soggiorno che fa partire la bozza.
- [[agenzie-proprietari]] e [[chiusura-mensile]]: fatture ai proprietari, autofatture e rendiconti delle agenzie.
- [[canali-octorate]]: il channel manager da cui arrivano i documenti in sola lettura.
