---
id: ospiti-checkin
titolo: Ospiti e check-in online
sezione: Affitti brevi
ordine: 21
riassunto: L'anagrafica degli ospiti e il check-in online: come l'ospite compila i suoi dati e i documenti con un link, come segui lo stato, come completi tu i dati mancanti con il check-in guidato e cosa fa (e cosa non fa) «Conferma e invia» verso la Questura.
chi: [gestore, amministratore, ospite]
dove: Affitti brevi › Prenotazioni › Ospiti · scheda «Check-in online» di una prenotazione
parole_chiave: [ospiti, anagrafica, check-in online, check-in guidato, link, sollecito, documento, carta d'identità, passaporto, Questura, polizia, schedina, Alloggiati, no-show, tassa di soggiorno, privacy, GDPR, QR, codice serratura, verifica identità, selfie, ospite non ha fatto il check-in, consenso marketing, cancellare dati ospite]
copre: [/app/short-rent/guests, /app/short-rent/guests/:id, /app/short-rent/bookings/:id/check-in, /checkin/:token, /checkin/porta/:doorToken]
stato: disponibile
fonte_codice: [frontend/src/features/guests/guests-page.tsx, frontend/src/features/guests/guests-list.ts, frontend/src/features/guests/guest-detail-page.tsx, frontend/src/features/guests/components/gdpr-tab.tsx, frontend/src/features/bookings/components/checkin-link-panel.tsx, frontend/src/features/checkin/checkin-page.tsx, frontend/src/features/checkin/wizard/checkin-wizard.tsx, frontend/src/features/checkin/wizard/steps/send-step.tsx, frontend/src/features/checkin/wizard/steps/checkin-wizard-done.tsx, backend/Casazen.Web/Controllers/BookingCheckInLinkController.cs, backend/Casazen.Web/Controllers/PublicGuestCheckInController.cs, backend/Casazen.Web/Controllers/GdprController.cs, backend/Casazen.Web/Controllers/GuestsController.cs, backend/Casazen.Infrastructure/Services/GuestCheckInAccessRules.cs, backend/Casazen.Infrastructure/Services/CheckInWizardService.cs, backend/Casazen.Infrastructure/Services/AccessCodeService.cs, backend/Casazen.Core/Options/GuestCheckInOptions.cs, backend/Casazen.Core/Regulatory/CheckInReadinessRules.cs]
---

## In breve
Il **check-in online** è un modulo che l'ospite compila dal telefono, con un link personale, prima di arrivare: i dati di tutte le persone che soggiornano, il documento di chi fa da capofamiglia o è ospite singolo e qualche consenso. Tu segui lo stato dalla prenotazione e, se mancano dati, li completi con il **check-in guidato**. Gli ospiti sono raccolti nell'elenco **Ospiti**, con una scheda per ognuno.

**Attenzione:** il pulsante «Conferma e invia» del check-in guidato **non invia nulla alla Questura**. Se il mittente sei tu, la comunicazione la fai sul portale Alloggiati Web; se è il tuo channel manager, la fa lui; se è CasaZen con l'invio diretto attivo, la trasmette CasaZen con il suo processo automatico. Lo stato vero della comunicazione lo leggi in **Adempimenti › Alloggiati**. Come funziona la comunicazione lo spiega [[alloggiati-istat]].

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
| Verifica dell'identità | L'ospite fotografa il documento e segue i movimenti del viso sullo schermo; il codice d'accesso arriva dopo | Check-in dell'ospite | ospite | Su attivazione | Come funziona |
| Segmenti della verifica | Decide per struttura, tipo di documento e browser se la verifica resta in osservazione, passa in automatico o si sospende | Impostazioni › AI | amministratore | Su attivazione | Attivare la verifica automatica dell'identità |
| Codice della serratura | Mostra o manda all'ospite il codice che hai scritto tu nell'immobile, solo dopo la verifica dell'identità | Portale ospite · e-mail · routine | ospite | Su attivazione | Come funziona |
| Check-in all'ingresso con QR | L'ospite apre la pagina del QR della porta e cerca il suo soggiorno | QR dell'immobile | ospite | Su attivazione | Come funziona |
| Esporta, anonimizza, cancella dati | Diritti dell'ospite sui suoi dati, esercitati da te per lui | Scheda ospite › «Privacy» | amministratore (o chi può gestire gli ospiti) | Disponibile | Esportare, anonimizzare o cancellare i dati di un ospite |

## Come funziona

### Il check-in online dal lato del gestore
Per ogni prenotazione confermata CasaZen prepara un **link personale**, con scadenza. L'ospite lo apre dal telefono, senza creare un account.

**Quando si apre.** Il check-in online si apre alcuni giorni prima dell'arrivo (3, se non lo cambi in «Flusso») per le prenotazioni «Confermata» o «Check-in effettuato» non ancora concluse. Prima, l'ospite vede che l'host lo avviserà. Si chiude quando l'ospite ha inviato i dati o quando la comunicazione ad Alloggiati Web risulta già fatta. **Attenzione:** per CasaZen «risulta fatta» anche quando tu premi «Segna come inviato manualmente» in Alloggiati: se lo premi prima che l'ospite abbia compilato, per CasaZen il suo check-in risulta già concluso e il link non gli viene più mandato (la finestra di conferma te lo dice prima). Premilo solo dopo aver davvero comunicato l'ospite alla Questura.

**Per quanto tempo vale il link.** Il link del check-in vale **7 giorni dall'invio**. Il link personale del portale ospite, se lo hai attivo, vale invece fino alla fine del 30° giorno dopo la partenza ([[portale-ospite]]).

**Come arriva il link all'ospite.**
- Se in «Flusso» il passaggio «Link del check-in online» è in automatico, CasaZen manda il link per email, ogni giorno, alle prenotazioni che entrano nella finestra. Se non riesce a raggiungere l'ospite, te lo dice.
- Per le prenotazioni dei portali il link va per email, se il portale ci dà l'indirizzo, oppure nella chat del portale. Quando CasaZen non ha un modo automatico di raggiungere l'ospite, la scheda ti avvisa e ti offre «Copia link»: lo mandi tu (WhatsApp, SMS…).
- Puoi sempre mandarlo o rimandarlo tu dalla prenotazione.

**Cosa compila l'ospite.** I passaggi sono (alcuni compaiono solo se attivi; i passi dal lato dell'ospite sono in [[portale-ospite#fare-il-check-in-online-per-l-ospite]]):
1. **Documento** (facoltativo): una foto del documento; CasaZen legge i dati e li propone. L'ospite li controlla prima di inviarli. In alternativa scrive tutto a mano.
2. **Ospiti**: tutti quelli che soggiornano, minori compresi (la legge chiede i dati di ognuno). Per ogni persona: tipo (ospite singolo, capofamiglia, capogruppo, familiare, membro del gruppo), nome, cognome, sesso, data di nascita, luogo di nascita (comune e provincia, oppure stato estero), cittadinanza. Residenza e altri dati facoltativi, o richiesti dalla tua regione, compaiono quando servono.
3. **Documento d'identità**: tipo, numero, luogo di rilascio e scadenza. Serve **solo** all'ospite singolo, al capofamiglia o al capogruppo, non ai familiari.
4. **Imposta di soggiorno** (su attivazione): se la tassa è dovuta e puoi incassarla online, l'ospite può pagarla con la carta. Altrimenti gli viene detto che la paga a te in struttura, che è già compresa nel pagamento o che la incassa il portale.
5. **Verifica dell'identità** (su attivazione): l'ospite sceglie tra «Verifica automatica» e «Verifica con una persona». Con la verifica automatica dà il consenso al controllo del volto, fotografa il documento (fronte e retro) e segue i movimenti del viso indicati a schermo. Con la verifica con una persona non c'è nessun confronto automatico del viso. Il documento non viene archiviato. Se la verifica automatica non riesce, l'ospite può rifare i tentativi che restano oppure passare alla verifica con una persona: tu vieni avvisato e decidi tu.
6. **Informativa e consensi**: l'ospite legge l'informativa privacy; il consenso al marketing (email, WhatsApp) è facoltativo e non blocca il check-in.
7. **Fattura** (facoltativo): l'ospite può dirti se gli serve la fattura e a chi intestarla (persona o azienda, codice fiscale o partita IVA, PEC, codice destinatario). Se ora non ha i dati, li chiederai tu.

Alla fine l'ospite vede «Check-in completato!». Se riapre il link dopo l'invio, i dati non vengono più mostrati, per proteggere la sua privacy: per correggerli ti contatta.

**Il check-in all'ingresso (su attivazione).** Se l'immobile ha un codice QR sulla porta, l'ospite che arriva lo inquadra, scrive il codice della prenotazione (o il cognome) e la data di arrivo, e prosegue fino alla verifica dell'identità. Non serve nessun accesso.

### Cosa compare all'ospite solo dopo il check-in
L'indirizzo preciso, le istruzioni di accesso, il Wi-Fi e il codice della serratura si mostrano all'ospite nel portale ([[portale-ospite]]) **solo dopo che il suo check-in online risulta completato**, e solo per un soggiorno in arrivo o in corso: non per un soggiorno già finito, annullato o segnato «non arrivato». Se il check-in lo hai fatto tu al posto dell'ospite, può servire mandargli tu le istruzioni.

### Il codice della serratura: cosa manda CasaZen e cosa no
CasaZen **non apre le serrature e non crea né revoca codici**. Conserva (cifrato) il codice che scrivi tu nell'immobile e lo mostra o lo manda all'ospite solo a queste condizioni:
- la **verifica dell'identità** (su attivazione, spenta di partenza) è riuscita;
- il soggiorno è in arrivo o in corso;
- se la tua organizzazione chiede l'imposta di soggiorno prima del codice, l'imposta è stata pagata.

Se la verifica dell'identità non è attiva, da CasaZen non parte nessun codice, nemmeno con la routine «Invia codice di accesso» ([[routine-ai-crm]]). Dai tu l'accesso all'ospite: per esempio con un messaggio ([[messaggi-recensioni]]) oppure scrivendo le istruzioni nella «Guida della casa» del portale, che l'ospite legge dopo il check-in.

### Cosa fa CasaZen con i dati
- Li usa per registrare il soggiorno e per **preparare** la comunicazione degli ospiti alla Questura (Alloggiati Web). La comunicazione è un obbligo di legge (art. 109 del TULPS, il testo unico delle leggi di pubblica sicurezza): CasaZen prepara i dati; l'invio lo fai tu sul portale Alloggiati Web o lo fa il tuo channel manager, **entro 24 ore dall'arrivo** (6 ore se il soggiorno non supera una notte): [[alloggiati-istat]].
- Li usa per calcolare la tassa di soggiorno ospite per ospite, con le esenzioni ([[imposta-soggiorno-documenti]]) e, se l'ospite lo chiede, per intestare la fattura ([[fisco-documenti]]).
- Conserva documento e dati per periodi che dipendono dalla categoria (scansioni del documento, dati Alloggiati, consenso marketing, dati fiscali): li vedi nella scheda «Privacy» dell'ospite. Se per una categoria non è stato fissato un periodo, non c'è cancellazione automatica.
- Non usa i dati per il marketing se l'ospite non ha dato il consenso.

### Gli stati del link
Nella scheda «Check-in online» di una prenotazione il cartellino ha uno di questi cinque stati.

| Stato | Cosa significa | Cosa fai |
|---|---|---|
| Link inviato | L'ospite ha il link e non ha ancora iniziato | Aspetta; se serve «Invia sollecito» |
| In compilazione | L'ospite ha aperto il modulo | Aspetta |
| Completato | Ha inviato i dati | Controlla i dati degli ospiti nella sezione «Alloggiati Web» della stessa scheda |
| Alloggiati inviato | La comunicazione ha la ricevuta del portale. In questa versione il cartellino cambia di rado: lo stato vero della comunicazione leggilo in «Alloggiati Web» sotto o in Adempimenti › Alloggiati | Controlla la ricevuta |
| Scaduto | Il link non vale più (scaduto o sostituito da uno nuovo) | «Invia sollecito» o «Genera link da copiare» |

Se non c'è ancora nessun link, la scheda dice «Nessun link di check-in generato».

**Gli stessi stati nei filtri dell'elenco.** In **Prenotazioni**, il filtro «Check-in online» usa altre parole per gli stessi stati. Ecco la corrispondenza:

| Cartellino della scheda | Filtro «Check-in online» dell'elenco |
|---|---|
| Link inviato, In compilazione | «In attesa dell'ospite» (è anche la vista «Documenti da ricevere») |
| Completato, Alloggiati inviato | «Documenti ricevuti» |
| Scaduto, oppure nessun link generato o e-mail con il link non partita | «Link da inviare» |

## Come fare

### Trovare un ospite e leggere la sua scheda
1. Apri **Affitti brevi › Prenotazioni** e scegli la scheda «Ospiti».
2. Scrivi nome o email nel campo «Cerca per nome o email...». La lista mostra 20 ospiti per pagina con «Anagrafica», «Email», «Città» e «Data Creazione»; puoi aggiungere «Telefono» e «Paese».
3. Premi «Dettagli» (o sul nome). La scheda ha quattro parti: «Soggiorni» (con «In casa ora», «Prossimo soggiorno» o «Ultimo soggiorno»), «Dati dell'ospite», «Documenti» e «Privacy».
4. In «Documenti» il numero del documento è nascosto: premi «Mostra» per vederlo e «Nascondi» per coprirlo. Con «Scarica scansione documento» scarichi la copia, se l'ospite l'ha caricata.

Il comando di esportazione salva l'elenco in un file CSV. Il CRM con tag e storico spesa è un'altra cosa: [[routine-ai-crm]].

### Mandare il link per il check-in online
**Ti serve:** il permesso di modificare «Prenotazioni e calendario»; una prenotazione «Confermata» o «Check-in effettuato»; l'e-mail dell'ospite (oppure lo mandi tu con «Genera link da copiare»); il check-in già aperto (di norma da 3 giorni prima dell'arrivo).
1. Apri la prenotazione e scegli la scheda «Check-in online».
2. Se non c'è ancora un link, premi «Invia link via email»: l'ospite lo riceve all'indirizzo della prenotazione.
3. Se preferisci mandarlo tu, premi «Genera link da copiare». Compare il link con la sua data di scadenza: copialo con il pulsante e mandalo all'ospite.
4. Per ricordarlo a chi non ha compilato premi «Invia sollecito».

Un nuovo link **sostituisce** quello di prima, che smette di funzionare. Sotto il link vedi se l'email è «inviata», «in coda» o «non inviata» e perché (indirizzo mancante, rifiutato dal servizio email…). Il link si può mandare solo quando il check-in è aperto: altrimenti la scheda dice che per ora non si può emettere un nuovo link.

### Capire a che punto è il check-in online
1. Apri la prenotazione › «Check-in online».
2. Leggi il cartellino dello stato (vedi la tabella sopra) e la scadenza del link.
3. Sotto trovi «Alloggiati Web»: lo stato della comunicazione e, se mancano dati, «Dati ospite incompleti».
4. Per un elenco di tutte le prenotazioni in attesa usa, in **Prenotazioni**, il filtro «Check-in online» (Documenti ricevuti, Link da inviare, In attesa dell'ospite: la corrispondenza con i cartellini è nella tabella sopra) o la vista «Documenti da ricevere».

### Fare il check-in guidato al posto dell'ospite
**Ti serve:** il permesso di inviare i dati degli ospiti (lo stesso di Alloggiati Web: serve per salvare gli ospiti, leggere la foto del documento e premere «Conferma e invia»; per solo guardare la procedura basta poter leggere le prenotazioni); una prenotazione «Confermata» o «Check-in effettuato»; il documento dell'ospite singolo o del capofamiglia o capogruppo, e i dati di tutte le persone (minori compresi); sapere chi incassa l'imposta di soggiorno. Puoi arrivarci da «Completa il check-in» nel blocco «Cosa succede ora» o da «Apri il check-in guidato».
1. **Ospiti**: controlla i dati di ogni persona e completa quelli che mancano. Premi «Salva ospiti».
2. **Documenti**: serve il documento dell'ospite singolo o del capofamiglia o capogruppo. Puoi premere «Fotografa il documento»: CasaZen legge i dati e li propone, e la foto non viene salvata. Se la lettura dà risultati diversi da quelli già scritti, scegli «Usa i dati della foto» o «Tieni i miei».
3. **Controlli**: i problemi in rosso (per esempio documento scaduto prima dell'arrivo, un dato mancante, un numero di ospiti diverso da quello della prenotazione) vanno risolti con «Correggi» per poter proseguire. Gli avvisi puoi lasciarli e premere «Prosegui comunque».
4. **Imposta di soggiorno**: vedi il calcolo ospite per ospite. Scegli le esenzioni dove spettano. Per una prenotazione di un portale, se CasaZen non sa chi ha incassato l'imposta, ti chiede «Chi ha incassato l'imposta di soggiorno?»: scegli «La incasso io in struttura» (la riscuoti tu dall'ospite) oppure «L'ha incassata il canale» (il portale l'ha già incassata e la versa al comune: non devi incassarla di nuovo). Se mancano le tariffe del comune, puoi inserire tu l'importo («Inserisci l'imposta del tuo comune»): resta tuo.
5. **Invio**: leggi «Cosa viene inviato e come». La schermata ti dice, per il mittente scelto per quell'immobile, cosa parte e cosa resta a te. Non parte nulla finché non premi «Conferma e invia». **E nemmeno dopo arriva qualcosa alla Questura:** il pulsante conferma l'imposta di soggiorno e, dove serve, passa gli ospiti a Octorate. I dati degli ospiti sono già salvati nei passi precedenti.
6. Nella schermata «Check-in registrato» vedi, riga per riga, cosa è andato a buon fine e cosa resta da fare, compresa la riga sulla Questura. Da lì puoi premere «Registra arrivo», «Torna alla prenotazione» o «Vai agli adempimenti».

**Il riquadro «Incasso della tassa di soggiorno» (su attivazione).** Se è attivo il pagamento online dell'imposta ([[per-iniziare#cosa-significa-su-attivazione]]), nel passo «Imposta di soggiorno» compare un riquadro che dice a che punto è l'incasso: «Da incassare», «Pagata online» (anche «in parte»: ti dice quanto resta da incassare in struttura), «Pagata in struttura», «Incassata dal portale», «Compresa nel pagamento della prenotazione» oppure «Non dovuta». Finché è «Da incassare» l'ospite può ancora pagarla online dal suo check-in. Se te l'ha pagata in struttura, premi «Segna come pagata in struttura» (serve il permesso di gestire i pagamenti): da quel momento l'ospite non può più pagarla online, così non la paga due volte. Se risulta una somma da restituire all'ospite compare «Da restituire all'ospite»: CasaZen non rimborsa da sola, ti crea un'attività «Da fare» e la restituzione la fai tu. I calcoli e i rendiconti per comune sono in [[imposta-soggiorno-documenti]].

**Cosa succede alla Questura dopo «Conferma e invia», secondo chi invia.** Il mittente è quello scelto per l'immobile nella procedura «Chi invia» ([[alloggiati-istat#scegliere-chi-invia-i-dati-degli-ospiti]]). Di norma di partenza è «Lo faccio io, con il file»; per un immobile già collegato a Octorate può essere il channel manager; dove l'invio diretto è attivo è «CasaZen». Cosa fa ogni pulsante dell'invio, uno per uno, è nella tabella «Cosa fanno davvero i pulsanti» di [[alloggiati-istat#comunicare-gli-ospiti-alla-questura-alloggiati-web]].

| Chi invia | Cosa fa «Conferma e invia» | Alla Questura |
|---|---|---|
| «Lo faccio io, con il file» | Salva l'imposta di soggiorno. Non manda nulla a Octorate. Compare il collegamento «Apri la guida per la comunicazione sul portale Alloggiati Web» | **Non parte nulla.** La schermata dice «La comunicazione alla Questura la fai tu sul portale Alloggiati Web». Poi la registri con «Segna come inviato manualmente» (non invia nulla: registra solo che l'hai fatto tu) |
| «Il tuo channel manager», prenotazione collegata a Octorate | Passa gli ospiti a Octorate. Se qualcosa non arriva compare «Qualcosa non è arrivato a Octorate» con «Riprova adesso» | Li invia Octorate, **quando registri l'arrivo** («Octorate invia la comunicazione alla Questura quando registri l'arrivo»). CasaZen non mostra il verde finché non c'è la ricevuta |
| «Il tuo channel manager», ma prenotazione non collegata a Octorate | Non manda nulla (la schermata lo dice) | Non parte nulla: la comunicazione va fatta sul portale Alloggiati Web |
| «CasaZen» (invio diretto, su attivazione) | Non manda nulla a Octorate: la schermata dice «Il mittente è CasaZen (invio diretto): non mandiamo nulla a Octorate e questo pulsante non invia nulla alla Questura» | L'invio diretto non parte da questo pulsante: è un processo automatico di CasaZen, attivo solo per gli immobili in cui lo hai attivato (per i soggiorni dalla data di attivazione). In «Check-in registrato» la riga sulla Questura dice «Con l'invio diretto la comunicazione alla Questura la trasmette CasaZen, non questo pulsante: controlla lo stato in Adempimenti › Alloggiati», e non c'è il collegamento alla guida per il portale: finché lì non vedi «Inviato» con la ricevuta, consideralo ancora da fare |
| Soggiorno che non richiede la comunicazione (per esempio ospite non arrivato) o immobile non in Italia | — | La schermata dice «Per questo soggiorno non c'è nessuna comunicazione alla Questura da fare» |

Se la comunicazione era già stata inviata (la schermata dice «La comunicazione alla Questura è già stata fatta»), una correzione dei dati va fatta sul portale Alloggiati Web: compare l'avviso «I dati già inviati alla Questura potrebbero richiedere una correzione sul portale Alloggiati Web».
> **Suggerimento:** con «Salva ed esci» puoi interrompere e riprendere dopo, ma per salvare servono i dati completi degli ospiti e il documento dell'ospite singolo o del capofamiglia.

### Segnare che l'ospite non è arrivato
**Ti serve:** il permesso di modificare «Prenotazioni e calendario». Si può fare **dal giorno di arrivo**, **solo finché la prenotazione è «Confermata»** (cioè prima che l'arrivo sia registrato) e **solo se la comunicazione ad Alloggiati Web non risulta già inviata**. Con le impostazioni iniziali CasaZen registra l'arrivo da sola alla fine del giorno di arrivo: segnalo il giorno stesso.
1. Apri il check-in guidato della prenotazione.
2. Premi «L'ospite non è arrivato» e leggi «Cosa succede»: il soggiorno è segnato come «ospite non arrivato» e non c'è nessuna comunicazione alla Questura da fare.
3. Premi «Segna come non arrivato».

Se l'ospite arriva più tardi, registrando l'arrivo il segno viene tolto. Una prenotazione segnata come non arrivata non riceve inviti alla recensione e non ha il link del portale ospite. Se non lo segni in tempo e l'arrivo viene registrato, la comunicazione alla Questura risulta dovuta come per ogni ospite arrivato.

**Cosa cambia per i soldi e per i documenti.** Segnare il mancato arrivo non rimborsa e non addebita nulla: i pagamenti già fatti restano come sono e li gestisci tu ([[incassi]]). Se la prenotazione è collegata a Octorate, CasaZen lo mette in coda anche per il channel manager. È anche l'unico modo per dire a CasaZen di non trattare il soggiorno come avvenuto: il controllo giornaliero che prepara (o, con «Emetti in automatico», emette) i documenti fiscali dei soggiorni finiti salta solo quelli già segnati «non arrivato» e guarda gli ultimi 31 giorni; scartare una bozza non basta a escluderlo. Dettagli e cautele in [[fisco-documenti]].

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

### Attivare la verifica automatica dell'identità
**Ti serve:** un account con il ruolo amministratore e un piano che include l'identificazione degli ospiti.

1. Vai in **Impostazioni › AI** e accendi **«Confronto del volto con il documento»**. Se resta spento, a verificare è sempre una persona.
2. Nella sezione **«Segmenti della verifica»** premi **«Aggiungi un segmento»**. Scegli la **Struttura** (o «Tutte le strutture»), il **Tipo di documento** e il **Browser dell'ospite**, poi premi **«Aggiungi il segmento»**. Un segmento nuovo parte sempre in **Osservazione**.
3. Controlla lo stato del segmento. **«Qualificato»** vuol dire che gli amministratori di CasaZen hanno qualificato quella combinazione. La qualificazione non si fa da questa pagina.
4. Quando il segmento è qualificato, scegli la modalità **«Automatica»** e conferma con **«Attiva l'approvazione automatica»**. Da quel momento, se tutte le condizioni sono soddisfatte, il sistema approva da solo l'identità degli ospiti di quel segmento.
5. Per tornare indietro scegli **«Osservazione»** (il sistema calcola la decisione, ma decide sempre una persona) oppure premi **«Sospendi il segmento»**: scrivi il motivo, al massimo 200 caratteri.

## Flussi completi

### Flusso: dal link al check-in completato
1. La prenotazione è confermata ([[prenotazioni]]).
2. CasaZen manda il link all'ospite pochi giorni prima dell'arrivo, oppure lo mandi tu.
3. L'ospite compila i passaggi; tu vedi lo stato passare da «Link inviato» a «In compilazione» a «Completato».
4. Controlli i dati degli ospiti: se sono completi, passi alla comunicazione ([[alloggiati-istat]]); se mancano, usi il check-in guidato.
5. La comunicazione alla Questura (entro 24 ore dall'arrivo) la fai tu sul portale o la fa il tuo channel manager: «Conferma e invia» non la sostituisce.
6. Registri l'arrivo (o lo fa CasaZen a fine giornata).
7. Alla partenza si chiudono tassa di soggiorno e documenti ([[imposta-soggiorno-documenti]]).

### Flusso: verifica automatica dell'identità
1. **L'ospite** sceglie «Verifica automatica» e dà il consenso al controllo del volto. Se non lo dà, o sceglie «Passa alla verifica con una persona», a verificare è una persona.
2. **L'ospite** fotografa il fronte e il retro del documento. Il retro è quello con le righe di lettere e numeri in basso.
3. **L'ospite** preme «Inizia» e segue a schermo le indicazioni: gira la testa a sinistra e a destra, alza e abbassa lo sguardo. Dura pochi secondi.
4. **CasaZen** approva da solo se il segmento è in modalità «Automatica» e tutti i controlli riescono. Se qualcosa non va, l'ospite può riprovare: la pagina dice quanti tentativi restano.
5. **Tu** trovi in **Cruscotto › Verifiche** i casi che passano a una persona e decidi come descritto sopra.

## Regole e limiti
- Il link del check-in vale 7 giorni dall'invio e va mandato quando il check-in è aperto (3 giorni prima dell'arrivo, salvo la tua scelta in «Flusso»). Un nuovo link annulla il precedente. Il link del portale ospite dura di più: fino alla fine del 30° giorno dopo la partenza.
- Il documento serve solo all'ospite singolo, al capofamiglia o al capogruppo. I dati anagrafici servono per **tutte** le persone, minori compresi.
- Foto del documento per la lettura nel check-in guidato: JPEG o PNG, fino a 10 MB. Nel modulo dell'ospite: JPG, PNG o WebP, fino a 5 MB.
- Se la verifica dell'identità non riesce, l'ospite ha un numero limitato di tentativi (la pagina dice quanti restano).
- Esportare, anonimizzare e cancellare richiedono il permesso di gestire gli ospiti; non sono possibili con prenotazioni in corso o future.
- La comunicazione alla Questura la fai tu (o il tuo channel manager). «Conferma e invia» non la invia, e «Segna come inviato manualmente» non invia nulla: registra solo che l'hai fatta.
- Il codice della serratura parte solo dopo la verifica dell'identità riuscita: senza verifica non parte nessun codice.
- La verifica automatica approva solo se il segmento è in modalità «Automatica» e qualificato; negli altri casi decide una persona.
- Se l'approvazione automatica è disattivata per tutta la piattaforma, nessun segmento approva da solo.
- Chi ha accesso solo ad alcuni immobili vede solo gli ospiti e le prenotazioni di quelli.
- Titolare e amministratori hanno già tutti questi permessi: le frasi «serve il permesso…» riguardano i collaboratori.

## Domande frequenti

### Perché un ospite è finito in Verifiche anche se sembra tutto in regola?
Il segmento della verifica è in **Osservazione** o **Sospeso**, oppure non è ancora qualificato: in tutti questi casi decide sempre una persona. Lo stato dei segmenti è in **Impostazioni › AI**, nella sezione «Segmenti della verifica».

### Un ospite non ha fatto il check-in online: cosa faccio?
1. Apri la prenotazione › «Check-in online» e leggi il cartellino.
2. Se è «Link inviato» o «In compilazione» premi «Invia sollecito». Se è «Scaduto» premi «Invia sollecito» o «Genera link da copiare». Se non c'è nessun link, premi «Invia link via email» (o «Genera link da copiare» se non ha un'e-mail e glielo mandi tu).
3. Se l'ospite è già arrivato senza averlo fatto, fai tu il check-in guidato con i suoi documenti ([[ospiti-checkin#fare-il-check-in-guidato-al-posto-dell-ospite]]). I dati servono comunque per la comunicazione alla Questura, che va fatta entro 24 ore dall'arrivo (6 ore se il soggiorno non supera una notte).
4. Non premere «Segna come inviato manualmente» per «sistemare» la voce: dice a CasaZen che hai già comunicato: CasaZen smette di avvisarti su quel soggiorno, il check-in online dell'ospite risulta concluso e il link non gli viene più mandato. Da lì la dichiarazione non si annulla.

### L'ospite ha fatto il check-in, ma alla Questura non risulta niente. Perché?
Il check-in online raccoglie i dati: non li invia. La comunicazione alla Questura è un passaggio a parte: la fai tu sul portale Alloggiati Web, la fa il tuo channel manager o, dove è attivo l'invio diretto, la trasmette CasaZen con il suo processo automatico. Controlla lo stato in **Adempimenti › Alloggiati**: [[alloggiati-istat]].

### Dopo «Conferma e invia» è partito qualcosa verso la Questura?
No. «Conferma e invia» salva l'imposta di soggiorno e, se il mittente è il tuo channel manager e la prenotazione è collegata, passa gli ospiti a Octorate. La schermata «Check-in registrato» dice cosa deve fare ancora chi invia.

### Per quanto tempo vale il link del check-in?
7 giorni dall'invio. Un nuovo link sostituisce quello di prima. Il link personale del portale ospite vale fino alla fine del 30° giorno dopo la partenza.

### Come arriva all'ospite il codice della serratura?
CasaZen non apre serrature: manda solo il codice che hai scritto tu nell'immobile, e solo dopo la verifica dell'identità riuscita (su attivazione). Se non la usi, dai tu l'accesso all'ospite, per esempio con un messaggio.

### L'ospite non ha un'email: come gli faccio arrivare il link?
Premi «Genera link da copiare» e mandalo tu (WhatsApp, SMS…). Per i portali la scheda ti dice se il link è partito dalla chat del portale o se va consegnato a mano.

### L'ospite dice che il link non funziona.
Probabilmente è scaduto o è stato sostituito da un link più recente. Apri la scheda «Check-in online» e mandane uno nuovo.

### Posso correggere i dati dopo che l'ospite ha inviato il modulo?
Sì, dal check-in guidato della prenotazione. L'ospite, riaprendo il link, non rivede i suoi dati.

### Cosa succede se un ospite non si presenta?
Segna «L'ospite non è arrivato» dal check-in guidato, il giorno di arrivo e prima che l'arrivo sia registrato. Non c'è nessuna comunicazione alla Questura da fare per quel soggiorno.

### Chi vede i documenti degli ospiti?
Solo chi ha il permesso di leggere i dati degli ospiti. Il numero del documento è nascosto finché non premi «Mostra».

### Il documento viene salvato?
Dipende dal passaggio. La foto letta dal check-in guidato viene eliminata dopo la lettura. Nella verifica dell'identità con selfie il documento non viene archiviato. Una scansione caricata dall'ospite nel modulo resta salvata nei periodi di conservazione che vedi nella scheda «Privacy».

## Glossario
- **Alloggiati Web**: il portale della Polizia di Stato dove si comunicano i dati degli ospiti; ogni persona è una «schedina».
- **Capofamiglia / capogruppo**: la persona che per un gruppo di ospiti presenta il documento.
- **Check-in guidato**: la procedura con cui compili tu i dati degli ospiti.
- **Check-in online**: il modulo che l'ospite compila con il suo link.
- **No-show**: l'ospite che non arriva.
- **Questura (comunicazione alla)**: l'avviso che per legge (art. 109 TULPS) devi dare alla Polizia di Stato per ogni ospite, entro 24 ore dall'arrivo.
- **Verifica dell'identità**: controllo del documento con un selfie, su attivazione.

## Vedi anche
- [[prenotazioni]]: stati, arrivo e partenza.
- [[alloggiati-istat]]: comunicazione degli ospiti alla Questura.
- [[imposta-soggiorno-documenti]]: tassa di soggiorno dell'ospite.
- [[routine-ai-crm]]: profili CRM con tag e consensi marketing.
- [[portale-ospite]]: l'area dell'ospite.
