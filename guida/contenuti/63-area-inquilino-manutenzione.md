---
id: area-inquilino
titolo: Area conduttore e richieste di manutenzione
menu: Area inquilino (conduttore)
sezione: Sito e portali
ordine: 63
riassunto: Cosa vede e fa l'inquilino nella sua area (contratto, scadenze da pagare, documenti, richieste di manutenzione), come entra davvero e come, da proprietario o gestore, lo fai entrare e gestisci le sue richieste.
chi: [inquilino, gestore]
dove: Area conduttore (pagina dell'inquilino) · lato proprietario: Affitti lunghi › contratto › Manutenzione
parole_chiave: [inquilino, conduttore, area conduttore, portale inquilino, entrare, accesso, e-mail del contratto, pagamenti, bonifico, link di pagamento, SEPA, documenti, manutenzione, richiesta, guasto, emergenza, approvare, rifiutare, preventivo, conguaglio, contratto, scadenze]
copre: [/app/long-rent/leases/:id/manutenzione, /portale-conduttore, /portale-conduttore/contratti/:leaseId, /portale-conduttore/contratti/:leaseId/scadenze/:dueId?, /portale-conduttore/contratti/:leaseId/documenti, /portale-conduttore/contratti/:leaseId/manutenzione, /portale-conduttore/contratti/:leaseId/manutenzione/nuova, /portale-conduttore/contratti/:leaseId/manutenzione/:requestId, /portale-conduttore/contratti/:leaseId/richiesta-manutenzione, /rent/pay/:installmentId]
stato: disponibile
fonte_codice: [frontend/src/routes/tenantAreaRoutes.tsx, frontend/src/features/tenant-area/tenant-area-shell.tsx, frontend/src/features/tenant-area/tenant-contract-page.tsx, frontend/src/features/tenant-area/tenant-dues-page.tsx, frontend/src/features/tenant-area/tenant-documents-page.tsx, frontend/src/features/tenant-area/tenant-maintenance-pages.tsx, frontend/src/features/tenant-area/tenant-bank-details.tsx, frontend/src/features/tenant-area/tenant-sepa.tsx, frontend/src/features/maintenance-requests/landlord-page.tsx, frontend/src/features/maintenance-requests/tenant-wizard.tsx, frontend/src/features/maintenance-requests/model.ts, frontend/src/features/public-rent/rent-payment-page.tsx, backend/Casazen.Web/Controllers/TenantAreaController.cs, backend/Casazen.Web/Controllers/TenantAreaController.Sepa.cs, backend/Casazen.Web/Controllers/LeaseMaintenanceRequestsController.cs]
---

## In breve
L'**area conduttore** è la pagina riservata dell'inquilino. Entra con un suo account CasaZen e vede solo i **suoi** contratti (non le bozze): le scadenze con gli importi da pagare, i documenti che il gestore condivide e le **richieste di manutenzione** che può mandare. Il proprietario (o l'agenzia) le riceve nel contratto e nella scheda della casa, le **approva o rifiuta** e, se approvate, le **paga**. L'inquilino non entra mai nell'organizzazione del proprietario e non vede altri contratti.

**Nessun invito parte da solo**: l'area ha un indirizzo proprio e sei tu (o l'agenzia) a comunicarlo all'inquilino. Per entrare l'inquilino deve usare un account con la **stessa e-mail** scritta nel contratto.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Entrare nell'area conduttore | Mostra i contratti dell'inquilino | Area conduttore (indirizzo di CasaZen che finisce con `/portale-conduttore`; non c'è un link nel menu dell'app) | inquilino | Disponibile | Entrare nella tua area |
| Far entrare il conduttore | Il gestore scrive l'e-mail giusta nel contratto e comunica l'indirizzo all'inquilino | Contratto › passo «Parti» | gestore, amministratore | Disponibile | Far entrare il conduttore nella sua area |
| Contratto e prossima scadenza | Mostra casa, durata e la prossima scadenza | Area conduttore › Contratto | inquilino | Disponibile | Vedere il contratto e le scadenze |
| Pagamenti | Elenco delle scadenze, importi e stato | Area conduttore › Pagamenti | inquilino | Disponibile | Pagare una scadenza |
| Link di pagamento del canone | Paga una rata con la carta, dal link dell'e-mail | Link ricevuto per e-mail | inquilino | Disponibile con Stripe attivo | Pagare una scadenza |
| Dichiarazione «Ho effettuato il bonifico» | Avvisa il gestore di un bonifico fatto; non segna la rata pagata | Pagamenti › scadenza | inquilino | Disponibile | Pagare una scadenza |
| Conto collegato e addebito SEPA | Bonifico guidato da Stripe e addebito automatico mensile in euro | Pagamenti › scadenza | inquilino | Su attivazione | Pagare una scadenza |
| Documenti condivisi | Preventivo, consuntivo, conguaglio, resoconto | Area conduttore › Documenti | inquilino | Disponibile | Scaricare un documento condiviso |
| Segnalare un guasto | Il conduttore manda al gestore una richiesta con urgenza, descrizione e foto | Area conduttore › Manutenzione › «Nuova richiesta» | inquilino | Disponibile | Segnalare un guasto |
| Richieste di manutenzione (proprietario) | Legge, approva o rifiuta le richieste di un contratto | Affitti lunghi › contratto › Manutenzione; casa › Manutenzione | gestore, amministratore | Disponibile | Approvare o rifiutare una richiesta di manutenzione |
| Pagamento di una richiesta approvata | Avvia il pagamento di una richiesta approvata | Manutenzione › «Paga» | gestore, amministratore | Disponibile | Pagare una richiesta approvata |

## Come funziona

### Chi può entrare e come
L'area conduttore non ha un invito separato e **non c'è nessun link nel menu dell'app né un'e-mail di CasaZen che porti l'inquilino lì**: l'area ha un indirizzo proprio, quello di CasaZen (lo stesso con cui apri l'app) seguito da `/portale-conduttore`, e **lo comunichi tu al conduttore**. Funziona così:
- il conduttore apre l'indirizzo. Se non è ancora entrato, CasaZen lo porta alla pagina di accesso e, dopo l'accesso, torna all'area;
- usa un **account CasaZen con l'e-mail verificata**. Se non ha un account lo crea dalla pagina di accesso: la verifica avviene con un messaggio che riceve per e-mail;
- **quell'e-mail deve essere la stessa scritta nel contratto** per quel conduttore (passo «Parti», senza distinguere maiuscole e minuscole), e il conduttore deve essere ancora attivo nel contratto (non anonimizzato);
- se l'e-mail dell'account è verificata ma non coincide, il contratto non compare: l'inquilino vede «Non hai un contratto attivo da consultare. Il contratto compare qui quando il gestore ti aggiunge.»;
- se l'e-mail dell'account non è ancora verificata, l'area non si carica: l'inquilino vede «Non riesco a caricare la tua area.» e sotto «Per aprire l'area conduttore devi prima confermare il tuo indirizzo e-mail con il messaggio di verifica. Dopo averlo fatto, ricarica la pagina.»;
- se il contratto è ancora una **bozza**, l'area non lo mostra e non si può aprire: l'inquilino vede lo stesso «Non hai un contratto attivo da consultare». Un contratto compare appena non è più una bozza, cioè quando parte la firma elettronica o quando viene caricata la copia firmata; un contratto scaricato da firmare a mano resta bozza finché non carichi la copia firmata. Restano visibili anche i contratti in attesa di firma o firmati in parte.

L'inquilino **non deve usare «Registrati su CasaZen»** dalla pagina iniziale: è la registrazione di chi gestisce case, e porta alla scelta del profilo e del piano. Deve entrare sempre dall'indirizzo dell'area.

Per questo, da proprietario, la cosa più importante è scrivere **l'e-mail giusta** del conduttore quando fai il contratto. L'inquilino non diventa mai un membro della tua organizzazione e ogni richiesta è controllata contratto per contratto: un conduttore non può vedere contratti degli altri.

Il link per pagare un singolo canone arriva invece per e-mail (richiesta di pagamento o sollecito): si apre su una pagina pubblica e non richiede l'area.

Da telefono: l'area si apre anche dal browser del telefono; per l'app di CasaZen vedi [[app-mobile]].

### Cosa vede l'inquilino
L'area ha cinque sezioni nella barra: **Contratti** (l'elenco), **Contratto**, **Pagamenti**, **Documenti** e **Manutenzione**.
- **Contratti**: una scheda per ogni contratto, con il nome e la casa e il pulsante «Apri il contratto».
- **Contratto**: nome del contratto, casa e indirizzo, durata («Dal [data] al [data]»). Se c'è una scadenza da pagare vede «Prossima scadenza» con il pulsante «Paga la scadenza» (o «Vedi la scadenza»). Se non c'è nulla da pagare vede «Non c'è nulla da pagare».
- **Pagamenti**: «Qui vedi se hai pagato tutto e paghi la scadenza. Canone, acconto condominiale e conguaglio sono già sommati.» Due riquadri riassumono «Ancora da pagare» e «Pagate». Ogni scadenza ha uno stato: **Da pagare**, **In verifica**, **Pagata**, **Addebito non riuscito**, **Annullata**; se è passata la data vede anche «In ritardo».
- **Documenti**: «Preventivo», «Conguaglio», «Consuntivo», «Resoconto» o «Documento» che il gestore ha condiviso, con «Scarica».
- **Manutenzione**: le richieste inviate e il pulsante «Nuova richiesta».

### Come si compone una scadenza
Una scadenza è la somma di più voci già sommate: il **canone**, l'**acconto condominiale** (la quota del mese) e l'eventuale **conguaglio**. Un conguaglio a debito si aggiunge alla scadenza; uno a credito riduce quanto resta da pagare. Se il saldo è zero vede «Sei in pari su questa scadenza. Non c'è nulla da versare.» Le spese straordinarie restano a parte e non diventano un addebito.

### Come può pagare il conduttore
Una scadenza risulta **pagata** solo quando il pagamento è confermato, mai in base a una semplice dichiarazione.
1. **Con la carta, dal link dell'e-mail** (pagina «Pagamento del canone»): vede casa, periodo, scadenza e importo, preme «Paga [importo]» e paga con Stripe. Il denaro va direttamente sul conto Stripe del locatore. Se il link non è più valido o è stato sostituito dal gestore con uno più recente, vede «Il link di pagamento non è valido…». Se il pagamento non va a buon fine può riprovare, anche con un altro metodo.
2. **Con bonifico**: gli estremi per il bonifico **non compaiono nell'area**: nella scadenza, sotto «Bonifico manuale», il conduttore legge «Se non colleghi un conto, paga con bonifico come ti ha indicato il gestore e poi avvisalo.» e «CasaZen non mostra qui l'IBAN: usa quello che ti ha dato il gestore.». CasaZen non ha un campo dove scrivere il tuo IBAN per l'inquilino: l'IBAN è quello che hai concordato con lui, per esempio scritto a mano nella riga in bianco del contratto stampato, oppure da te comunicato nel messaggio del sollecito. Il conduttore fa il bonifico dalla sua banca e poi preme **«Ho effettuato il bonifico»** (importo, data, riferimento, nota e ricevuta facoltativi). **La dichiarazione avvisa il gestore ma non segna la scadenza come pagata**: il gestore la verifica e registra l'incasso. Una dichiarazione può essere «Inviata», «Verificata», «Respinta» o «Sostituita»; se è respinta se ne può mandare un'altra.
3. **Con il conto collegato** (su attivazione, solo in euro): «Bonifico con Stripe» → «Collega il conto» → «Avvia il bonifico». La scadenza non risulta pagata finché Stripe non conferma il bonifico («Bonifico avviato. La scadenza non è segnata come pagata»).
4. **Con addebito SEPA** (su attivazione, solo in euro): l'inquilino autorizza il mandato con Stripe («Autorizza mandato con Stripe») e sceglie «Attiva automatico mensile» oppure «Mantieni pagamento manuale». Prima di ogni addebito legge l'importo, la commissione indicata e il «Totale da addebitare». Non vengono addebitati gli arretrati precedenti all'attivazione. Si può spegnere con «Disattiva automatico».

Le funzioni «su attivazione» ([[per-iniziare#cosa-significa-su-attivazione]]) dipendono da CasaZen: se all'inquilino non compaiono, scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»).

### Richieste di manutenzione
Il conduttore può segnalare un guasto. **Cosa succede dopo l'invio**: la richiesta arriva al **gestore del contratto** (il proprietario o l'agenzia), non a un fornitore e non a CasaZen. Il conduttore non sceglie il fornitore e non può né approvarla né pagarla. Il gestore la legge, la approva o la rifiuta (con il motivo) e, se la approva, può pagarla. L'area lo ricorda: «La richiesta va al gestore del contratto. Non assegni tu un fornitore.»

**Tempi e urgenze**: CasaZen non fissa un tempo di risposta: dipende dal gestore. L'urgenza («Normale», «Alta» o «Emergenza») serve solo a dire al gestore quanto è importante, e **non è un servizio di pronto intervento**: l'area stessa lo ricorda quando scegli «Emergenza»: «Aprire la richiesta non significa che qualcuno stia già intervenendo: CasaZen non è un pronto intervento e non chiama nessuno. Con un pericolo (acqua che allaga, odore di gas, scintille) chiama subito un tecnico o i soccorsi.» Per un'emergenza (perdita d'acqua, fuga di gas, corto circuito, pericolo per le persone) il conduttore deve **chiamare subito il proprietario o l'agenzia** e, se c'è pericolo, i soccorsi (112): la richiesta in CasaZen è in più, non al posto della telefonata.

Ci sono due schermate per aprire la richiesta, che portano alla stessa richiesta del gestore:
- dall'area, **Manutenzione › «Nuova richiesta»** (è la strada normale): sceglie la **Categoria**, l'**Urgenza** («Normale», «Alta» o «Emergenza»), scrive la **Descrizione** e può allegare foto («Allegati»), poi preme «Invia al gestore»;
- da un link «richiesta di manutenzione» (indirizzo che finisce con `/richiesta-manutenzione`): una procedura a passi pensata per il telefono: «Cosa non funziona?» (il guasto in poche parole), «Quanto è urgente?» («Normale», «Alta» o «Emergenza», le stesse parole dell'area; con «Emergenza» compare l'avviso «CasaZen non è un pronto intervento e non chiama nessuno: con un pericolo (acqua che allaga, odore di gas, scintille) chiama subito un tecnico o i soccorsi.»), «Aggiungi una nota», «Una foto, se ce l'hai» (facoltativa) e «Controlla e invia» con «Invia la richiesta». Nell'area non c'è un pulsante che porta a questa procedura: la raggiungi solo se qualcuno ti manda il link.

Gli stati che vede il conduttore nell'area sono: «Inviata al gestore», «In valutazione», «Servono altre informazioni», «Presa in carico dal gestore», «In corso», «Chiusa», «Non accettata». Il proprietario vede invece «In attesa», «Approvata», «Rifiutata», «Pagata» (vedi sotto): i due elenchi non coincidono parola per parola.

### La parte del proprietario
Nel contratto, alla voce **Manutenzione** (e nella scheda della casa), il proprietario o l'agenzia vede le richieste con titolo, descrizione, urgenza, stato ed eventuale foto (le foto sono private e non hanno un indirizzo pubblico). Con il filtro stato («Tutti», «In attesa», «Approvata», «Rifiutata», «Pagata») le ordina. Per ogni richiesta:
- **«Approva»**: la richiesta passa ad «Approvata».
- **«Rifiuta»**: devi scrivere il motivo («Perché la rifiuti?»), poi «Conferma il rifiuto». Il conduttore lo legge.
- **«Paga»**: compare **solo dopo l'approvazione**. Avvia l'addebito in euro dal conto collegato e **la richiesta diventa «Pagata» solo quando Stripe lo conferma**, non quando premi il pulsante.

Una richiesta «In attesa» mostra «In attesa della tua decisione. Il pagamento non è ancora disponibile.»

## Come fare

### Entrare nella tua area
Per l'inquilino.

**Ti serve:** l'indirizzo della tua area (te lo dà il proprietario o l'agenzia: è l'indirizzo di CasaZen che finisce con `/portale-conduttore`); l'e-mail che hai dato per il contratto e la possibilità di leggerla; se non hai un account, qualche minuto per crearlo.
1. Apri l'indirizzo che ti ha dato il proprietario o l'agenzia. Se non hai ancora fatto l'accesso, ti porta alla pagina di accesso.
2. Se hai già un account CasaZen con **la stessa e-mail del contratto**, accedi. Se non ce l'hai, creane uno dalla pagina di accesso con **la stessa e-mail del contratto**. Non usare «Registrati su CasaZen» dalla pagina iniziale: serve a chi gestisce case e ti porta alla scelta di un piano.
3. Apri il messaggio di conferma che ti arriva per e-mail e conferma l'indirizzo. Poi torna all'indirizzo della tua area.
4. Vedi l'elenco dei tuoi contratti: premi «Apri il contratto».

Se vedi «Non hai un contratto attivo da consultare», l'e-mail del tuo account non coincide con quella scritta nel contratto, oppure il contratto è ancora una bozza (le bozze non compaiono nell'area): chiedi al proprietario o all'agenzia quale e-mail hanno scritto e se il contratto è pronto. Se vedi «Non riesco a caricare la tua area», conferma prima l'e-mail con il messaggio di verifica che ti è arrivato, poi ricarica la pagina.

> **Suggerimento:** per pagare un solo canone non serve entrare nell'area: basta il link che ti arriva per e-mail.

### Far entrare il conduttore nella sua area
Serve poter creare i contratti.

**Ti serve:** l'e-mail del conduttore (quella che userà per entrare), scritta nel contratto; un modo per scrivergli (e-mail o messaggio).
1. Quando crei il contratto, nel passo «Parti» scrivi l'«Email» di ogni conduttore: è quella che userà per entrare ([[contratti#creare-un-contratto-con-casazen]]). Controllala bene: se è sbagliata il conduttore non vedrà il contratto. Scrivi anche il «Numero di telefono» con prefisso internazionale.
2. Scrivi tu al conduttore, perché CasaZen non gli manda un invito. Puoi usare queste parole: «Nella tua area di CasaZen puoi vedere il contratto, le scadenze e i documenti e segnalarmi i guasti. Apri [l'indirizzo di CasaZen]/portale-conduttore, accedi o crea un account con questa stessa e-mail, conferma il messaggio che ti arriva e premi «Apri il contratto». Per pagare un solo canone ti basta il link che ricevi per e-mail.» Al posto di [l'indirizzo di CasaZen] scrivi l'indirizzo con cui apri tu CasaZen.
3. Se non vede il contratto, controlla che l'e-mail dell'account sia la stessa del contratto e verificata, che il conduttore sia ancora tra le parti del contratto e che il contratto non sia ancora una bozza (compare quando parte la firma elettronica o quando carichi la copia firmata). Se l'e-mail scritta nel contratto è sbagliata o non è più in uso, scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza») per sapere come correggerla.

### Vedere il contratto e le scadenze
Per l'inquilino.

**Ti serve:** di essere entrato nella tua area ([[area-inquilino#entrare-nella-tua-area]]).
1. Entra nell'area conduttore.
2. Scegli il contratto con «Apri il contratto».
3. Leggi «Prossima scadenza» e premi «Paga la scadenza», oppure apri **Pagamenti** per l'elenco completo.

### Pagare una scadenza
Per l'inquilino.

**Ti serve:** l'e-mail con il link di pagamento (se paghi con la carta) oppure l'IBAN del proprietario (se paghi con bonifico: te lo ha dato il proprietario o è scritto nel contratto).
1. Apri **Pagamenti** e premi la scadenza da pagare (o «Paga questa scadenza»).
2. Se hai ricevuto un'e-mail con il link, aprilo e premi «Paga [importo]».
3. Altrimenti, per il bonifico, usa l'IBAN che ti ha dato il proprietario, fai il bonifico dalla tua banca e premi «Ho effettuato il bonifico» (scrivi importo e data).
4. Controlla lo stato della scadenza: «In verifica» finché il pagamento non è confermato, poi «Pagata». La dichiarazione del bonifico **non** la segna pagata: la verifica il proprietario.

Se la scadenza risulta «Addebito non riuscito» puoi riprovare con il conto collegato oppure usare il bonifico.

### Scaricare un documento condiviso
Per l'inquilino.
1. Apri **Documenti**.
2. Premi «Scarica» sul documento.

Se non c'è niente vedi «Nessun documento condiviso»: preventivo, consuntivo e conguaglio compaiono quando il gestore li condivide.

### Segnalare un guasto
Per l'inquilino.

**Ti serve:** di essere entrato nella tua area; categoria, urgenza e una descrizione di cosa non funziona; una foto, se puoi. **Se c'è un'emergenza** (perdita d'acqua, gas, corto circuito, pericolo per le persone) chiama subito il proprietario o l'agenzia e, se c'è pericolo, il 112: CasaZen non è un pronto intervento e la richiesta non significa che qualcuno stia già intervenendo.
1. Apri **Manutenzione** e premi «Nuova richiesta».
2. Scegli la «Categoria» e l'«Urgenza», scrivi la «Descrizione» e, se vuoi, aggiungi una foto in «Allegati».
3. Premi «Invia al gestore» (o «Invia la richiesta» se usi il link a passi).
4. Segui lo stato nell'elenco: «Inviata al gestore» all'inizio; se serve altro, il gestore te lo chiede («Servono altre informazioni»).

### Approvare o rifiutare una richiesta di manutenzione
Per il proprietario o l'agenzia. Serve il permesso di creare i contratti sulla casa del contratto.
1. Apri il contratto e scegli **Manutenzione** (oppure apri la casa › scheda «Manutenzione»).
2. Leggi la richiesta e guarda la foto, se c'è.
3. Premi «Approva», oppure «Rifiuta» e scrivi il motivo, poi «Conferma il rifiuto».
4. Se hai approvato, ora puoi pagare; per il pagamento vedi sotto.

Reversibile: una decisione non si annulla da qui. Se il guasto richiede un tecnico puoi chiederlo a un fornitore con gli Interventi ([[affitti-lunghi#chiedere-un-intervento-a-un-fornitore-per-una-casa-in-affitto-lungo]]).

### Pagare una richiesta approvata
Per il proprietario o l'agenzia.
1. Nella richiesta «Approvata» premi «Paga».
2. Controlla lo stato: la richiesta diventa «Pagata» quando Stripe conferma l'addebito.

## Flussi completi

### Flusso: il conduttore segnala un guasto
1. Il conduttore apre **Manutenzione › «Nuova richiesta»** e invia la richiesta con foto (in un'emergenza telefona prima al proprietario).
2. Il proprietario la trova in **Manutenzione** del contratto: la legge e preme «Approva» o «Rifiuta» con il motivo.
3. Se approvata, la richiesta può essere pagata con «Paga»; CasaZen la segna «Pagata» solo con la conferma di Stripe.
4. Il conduttore vede lo stato nella sua area.

### Flusso: il conduttore paga il canone
1. Il gestore attiva il piano dei canoni e, se vuole, il pagamento online ([[canoni-scadenze#attivare-il-piano-dei-canoni]]).
2. Qualche giorno prima della scadenza il conduttore riceve l'e-mail con il link; apre la pagina «Pagamento del canone» e paga con la carta.
3. In alternativa paga con bonifico e dichiara «Ho effettuato il bonifico»; il gestore verifica e registra l'incasso ([[canoni-scadenze#registrare-un-incasso-del-canone]]).
4. Quando il pagamento è confermato la rata diventa «Pagata» per tutti e due.

## Regole e limiti
- L'area è riservata a chi ha un account con **e-mail verificata uguale a quella di un conduttore attivo** del contratto, e mostra solo i contratti che non sono più bozze. Il conduttore non diventa membro dell'organizzazione e non vede altri contratti.
- CasaZen non manda un invito all'area e non mette un link nell'app: l'indirizzo lo comunica il proprietario.
- Una scadenza risulta pagata solo con la conferma del pagamento (Stripe) o con l'incasso registrato dal gestore. La dichiarazione «Ho effettuato il bonifico» non la segna pagata.
- Gli estremi del bonifico (IBAN del proprietario) non sono mostrati nell'area: vanno comunicati fuori da CasaZen.
- Bonifico con il conto collegato e addebito SEPA: **solo in euro**; l'addebito non copre gli arretrati precedenti all'attivazione.
- La richiesta di manutenzione va al gestore: il conduttore non può approvarla né pagarla. Chi decide deve poter creare i contratti sulla casa. Il rifiuto richiede il motivo, in italiano. Nessun tempo di risposta è garantito e non è un pronto intervento.
- Le foto delle richieste sono private: le vede il conduttore e chi può leggere il contratto.
- L'indirizzo dell'area e i link di pagamento sono legati a un contratto e a una rata: un link sostituito smette di funzionare.

## Domande frequenti

### Come fa l'inquilino a entrare nella sua area?
Apre l'indirizzo che gli comunichi tu (l'indirizzo di CasaZen che finisce con `/portale-conduttore`), accede o crea un account con la **stessa e-mail scritta nel contratto**, conferma l'e-mail e preme «Apri il contratto». CasaZen non manda un invito. Vedi [[area-inquilino#entrare-nella-tua-area]].

### Il conduttore non vede il suo contratto: perché?
Quasi sempre l'e-mail del suo account è diversa da quella scritta nel contratto (vede «Non hai un contratto attivo da consultare»), oppure non è verificata (l'area non si carica e chiede di confermare l'e-mail con il messaggio di verifica). Verifica nel contratto (scheda «Inquilini») e fagli usare la stessa e-mail. Una terza causa: il contratto è ancora una bozza, e le bozze non compaiono nell'area (vede lo stesso «Non hai un contratto attivo da consultare»). Il contratto compare quando parte la firma elettronica o quando carichi la copia firmata.

### Mi sono registrato da «Registrati su CasaZen» invece che dall'indirizzo dell'area: che faccio?
Non serve completare la configurazione per chi gestisce case. Apri l'indirizzo dell'area che ti ha dato il proprietario e accedi con un account che abbia **la stessa e-mail scritta nel contratto**: se ti sei registrato con un'altra e-mail, l'area non mostrerà il contratto. Poi premi «Apri il contratto».

### Il conduttore ha dichiarato il bonifico: la rata è pagata?
No. La dichiarazione avvisa il gestore, che deve verificarla. La rata passa a «Pagata» solo quando il gestore registra l'incasso (o importa l'estratto conto) o il pagamento è confermato.

### Dove trova l'inquilino l'IBAN per il bonifico?
Non nell'area: gli estremi del bonifico non vengono mostrati («CasaZen non mostra qui l'IBAN: usa quello che ti ha dato il gestore.»). L'IBAN glielo comunichi tu o lo scrivi a mano nel contratto stampato; puoi anche scriverlo nel messaggio di un sollecito.

### Ho una perdita d'acqua: come segnalo il guasto?
Chiama subito il proprietario o l'agenzia (e il 112 se c'è pericolo): la richiesta in CasaZen non è un pronto intervento. Poi apri **Manutenzione › «Nuova richiesta»** con urgenza «Emergenza» e scrivi cosa è successo, così il gestore lo ha per iscritto. Vedi [[area-inquilino#segnalare-un-guasto]].

### Quanto ci mette il proprietario a rispondere a una richiesta di manutenzione?
CasaZen non fissa un tempo: dipende dal gestore. L'area avverte che aprire la richiesta non significa che qualcuno stia già intervenendo.

### Il conduttore può scegliere il fornitore per un guasto?
No. La richiesta va al gestore del contratto, che decide.

### Perché non vedo il pulsante «Paga» su una richiesta?
Compare solo dopo l'approvazione. Una richiesta «In attesa» non si può pagare.

### Il conduttore vede i miei documenti?
Solo quelli che condividi: preventivo, consuntivo, conguaglio, resoconto.

## Glossario
- **Area conduttore**: la pagina riservata dell'inquilino, con indirizzo proprio (finisce con `/portale-conduttore`).
- **Conduttore**: l'inquilino, chi prende la casa in affitto. **Inquilino**: lo stesso del conduttore.
- **Scadenza**: una rata da pagare con importo e data, che può includere canone, acconto condominiale e conguaglio.
- **Dichiarazione di bonifico**: la comunicazione del conduttore «Ho effettuato il bonifico»: serve al gestore per verificare, non segna la rata pagata.
- **Mandato SEPA**: l'autorizzazione all'addebito automatico in euro sul conto del conduttore.
- **Gestore (del contratto)**: chi riceve le richieste del conduttore: il proprietario o l'agenzia.

## Vedi anche
- [[canoni-scadenze]]: canoni, piano delle rate, incassi e solleciti dal lato del proprietario.
- [[contratti]]: dove scrivi l'e-mail del conduttore.
- [[affitti-lunghi]]: immobili e interventi.
- [[incassi]]: come funziona Stripe.
- [[app-mobile]]: l'app di CasaZen.
