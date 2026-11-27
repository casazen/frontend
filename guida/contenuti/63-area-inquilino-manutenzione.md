---
id: area-inquilino
titolo: Area conduttore e richieste di manutenzione
sezione: Sito e portali
ordine: 63
riassunto: Cosa vede e fa l'inquilino nella sua area (contratto, scadenze da pagare, documenti, richieste di manutenzione) e come, da proprietario o gestore, lo fai entrare e gestisci le sue richieste.
chi: [inquilino, gestore]
dove: Area conduttore (pagina dell'inquilino) · lato proprietario: Affitti lunghi › contratto › Manutenzione
parole_chiave: [inquilino, conduttore, area conduttore, portale inquilino, pagamenti, bonifico, SEPA, link di pagamento, documenti, manutenzione, richiesta, guasto, approvare, rifiutare, preventivo, conguaglio]
copre: [/app/long-rent/leases/:id/manutenzione, /portale-conduttore, /portale-conduttore/contratti/:leaseId, /portale-conduttore/contratti/:leaseId/scadenze/:dueId?, /portale-conduttore/contratti/:leaseId/documenti, /portale-conduttore/contratti/:leaseId/manutenzione, /portale-conduttore/contratti/:leaseId/manutenzione/nuova, /portale-conduttore/contratti/:leaseId/manutenzione/:requestId, /portale-conduttore/contratti/:leaseId/richiesta-manutenzione, /rent/pay/:installmentId]
stato: disponibile
fonte_codice: [frontend/src/routes/tenantAreaRoutes.tsx, frontend/src/features/tenant-area/tenant-area-shell.tsx, frontend/src/features/tenant-area/tenant-contract-page.tsx, frontend/src/features/tenant-area/tenant-dues-page.tsx, frontend/src/features/tenant-area/tenant-documents-page.tsx, frontend/src/features/tenant-area/tenant-maintenance-pages.tsx, frontend/src/features/tenant-area/tenant-bank-details.tsx, frontend/src/features/tenant-area/tenant-sepa.tsx, frontend/src/features/maintenance-requests/landlord-page.tsx, frontend/src/features/maintenance-requests/tenant-wizard.tsx, frontend/src/features/maintenance-requests/model.ts, frontend/src/features/public-rent/rent-payment-page.tsx, backend/Casazen.Web/Controllers/TenantAreaController.cs, backend/Casazen.Web/Controllers/TenantAreaController.Sepa.cs, backend/Casazen.Web/Controllers/LeaseMaintenanceRequestsController.cs]
---

## In breve
L'**area conduttore** è la pagina riservata dell'inquilino. Entra con il suo account CasaZen e vede solo i **suoi** contratti: le scadenze con gli importi da pagare, i documenti che il gestore condivide e le **richieste di manutenzione** che può mandare. Il proprietario (o l'agenzia) le riceve nel contratto e nella scheda della casa, le **approva o rifiuta** e, se approvate, le **paga**. L'inquilino non entra mai nell'organizzazione del proprietario e non vede altri contratti.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Entrare nell'area conduttore | Mostra i contratti dell'inquilino | Area conduttore (indirizzo che finisce con `/portale-conduttore`) | inquilino | Disponibile | Far entrare il conduttore nella sua area |
| Contratto e prossima scadenza | Mostra casa, durata e la prossima scadenza | Area conduttore › Contratto | inquilino | Disponibile | Vedere il contratto e le scadenze |
| Pagamenti | Elenco delle scadenze, importi e stato | Area conduttore › Pagamenti | inquilino | Disponibile | Pagare una scadenza |
| Link di pagamento del canone | Paga una rata con la carta, dal link dell'e-mail | Link ricevuto per e-mail | inquilino | Disponibile con Stripe attivo | Pagare una scadenza |
| Bonifico manuale e dichiarazione | Estremi per il bonifico e comunicazione «Ho effettuato il bonifico» | Pagamenti › scadenza | inquilino | Disponibile | Pagare una scadenza |
| Conto collegato e addebito SEPA | Bonifico guidato da Stripe e addebito automatico mensile in euro | Pagamenti › scadenza | inquilino | Su attivazione | Pagare una scadenza |
| Documenti condivisi | Preventivo, consuntivo, conguaglio, resoconto | Area conduttore › Documenti | inquilino | Disponibile | Scaricare un documento condiviso |
| Richieste di manutenzione (inquilino) | Segnala un guasto con urgenza, descrizione e foto | Area conduttore › Manutenzione › «Nuova richiesta» | inquilino | Disponibile | Inviare una richiesta di manutenzione |
| Richieste di manutenzione (proprietario) | Legge, approva o rifiuta le richieste di un contratto | Affitti lunghi › contratto › Manutenzione; casa › Manutenzione | gestore, amministratore | Disponibile | Approvare o rifiutare una richiesta di manutenzione |
| Pagamento di una richiesta approvata | Avvia il pagamento di una richiesta approvata | Manutenzione › «Paga» | gestore, amministratore | Disponibile | Pagare una richiesta approvata |

## Come funziona

### Chi può entrare e come
L'area conduttore non ha un invito separato. Funziona così:
- il conduttore usa un **account CasaZen con l'e-mail verificata**;
- **quell'e-mail deve essere la stessa scritta nel contratto** per quel conduttore (passo «Parti»), e il conduttore deve essere ancora attivo nel contratto (non anonimizzato);
- se l'e-mail non coincide, il contratto non compare: l'inquilino vede «Non hai un contratto attivo da consultare. Il contratto compare qui quando il gestore ti aggiunge.»

Per questo, da proprietario, la cosa più importante è scrivere **l'e-mail giusta** del conduttore quando fai il contratto. L'inquilino non diventa mai un membro della tua organizzazione e ogni richiesta è controllata contratto per contratto: un conduttore non può vedere contratti degli altri.

Il link per pagare un singolo canone arriva invece per e-mail (richiesta di pagamento o sollecito): si apre su una pagina pubblica e non richiede l'area.

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
2. **Con bonifico manuale**: nella scadenza vede gli **estremi** (Intestatario, IBAN, Importo, Scadenza, Causale, con «Copia la causale»), fa il bonifico dalla sua banca e poi preme **«Ho effettuato il bonifico»** (importo, data, riferimento, nota e ricevuta facoltativi). **La dichiarazione avvisa il gestore ma non segna la scadenza come pagata**: il gestore la verifica. Una dichiarazione può essere «Inviata», «Verificata», «Respinta» o «Sostituita»; se è respinta se ne può mandare un'altra.
3. **Con il conto collegato** (su attivazione, solo in euro): «Bonifico con Stripe» → «Collega il conto» → «Avvia il bonifico». La scadenza non risulta pagata finché Stripe non conferma il bonifico («Bonifico avviato. La scadenza non è segnata come pagata»).
4. **Con addebito SEPA** (su attivazione, solo in euro): l'inquilino autorizza il mandato con Stripe («Autorizza mandato con Stripe») e sceglie «Attiva automatico mensile» oppure «Mantieni pagamento manuale». Prima di ogni addebito legge l'importo, la commissione indicata e il «Totale da addebitare». Non vengono addebitati gli arretrati precedenti all'attivazione. Si può spegnere con «Disattiva automatico».

Se un conduttore non collega nessun conto restano sempre gli estremi del bonifico e «Ho effettuato il bonifico».

### Richieste di manutenzione
Il conduttore può segnalare un guasto. Ci sono due modi di aprire la richiesta, che arrivano allo stesso posto:
- dall'area, **Manutenzione › «Nuova richiesta»**: sceglie la **Categoria**, l'**Urgenza** («Normale», «Alta» o «Emergenza»), scrive la **Descrizione** e può allegare foto («Allegati»), poi preme «Invia al gestore»;
- dal link «richiesta di manutenzione»: una procedura a passi: «Cosa non funziona?» (il guasto in poche parole), «Quanto è urgente?» («Bassa», «Normale» o «Urgente»), «Aggiungi una nota», «Una foto, se ce l'hai» (facoltativa) e «Controlla e invia» con «Invia la richiesta».

La richiesta **va al gestore del contratto**: il conduttore non sceglie un fornitore e non può né approvarla né pagarla. L'area lo ricorda («Aprire la richiesta non significa che qualcuno stia già intervenendo»). Lo stato che vede cambia così: «Inviata al gestore», «In valutazione», «Servono altre informazioni», «Presa in carico dal gestore», «In corso», «Chiusa», «Non accettata» (nell'altra procedura: «In attesa», «Approvata», «Rifiutata», «Pagata»).

### La parte del proprietario
Nel contratto, alla voce **Manutenzione** (e nella scheda della casa), il proprietario o l'agenzia vede le richieste con titolo, descrizione, urgenza, stato ed eventuale foto (le foto sono private e non hanno un indirizzo pubblico). Con il filtro stato («Tutti», «In attesa», «Approvata», «Rifiutata», «Pagata») le ordina. Per ogni richiesta:
- **«Approva»**: la richiesta passa ad «Approvata».
- **«Rifiuta»**: devi scrivere il motivo («Perché la rifiuti?»), poi «Conferma il rifiuto». Il conduttore lo legge.
- **«Paga»**: compare **solo dopo l'approvazione**. Avvia l'addebito in euro dal conto collegato e **la richiesta diventa «Pagata» solo quando Stripe lo conferma**, non quando premi il pulsante.

Una richiesta «In attesa» mostra «In attesa della tua decisione. Il pagamento non è ancora disponibile.»

## Come fare

### Far entrare il conduttore nella sua area
Serve poter creare i contratti.
1. Quando crei il contratto, nel passo «Parti» scrivi l'«Email» di ogni conduttore: è quella che userà per entrare ([[contratti#creare-un-contratto-con-casazen]]). Scrivi anche il «Numero di telefono» con prefisso internazionale.
2. Avvisa il conduttore che può entrare in CasaZen (creando un account con la stessa e-mail, che deve verificare) e aprire la sua area.
3. Se non vede il contratto, controlla che l'e-mail sia la stessa e verificata, e che il conduttore sia ancora tra le parti del contratto.

### Vedere il contratto e le scadenze
1. Entra nell'area conduttore.
2. Scegli il contratto con «Apri il contratto».
3. Leggi «Prossima scadenza» e premi «Paga la scadenza», oppure apri **Pagamenti** per l'elenco completo.

### Pagare una scadenza
1. Apri **Pagamenti** e premi la scadenza da pagare (o «Paga questa scadenza»).
2. Se hai ricevuto un'e-mail con il link, aprilo e premi «Paga [importo]».
3. Altrimenti, per il bonifico manuale, usa gli estremi, fai il bonifico e premi «Ho effettuato il bonifico» (scrivi importo e data).
4. Controlla lo stato della scadenza: «In verifica» finché il pagamento non è confermato, poi «Pagata».

Se la scadenza risulta «Addebito non riuscito» puoi riprovare con il conto collegato oppure usare il bonifico manuale.

### Scaricare un documento condiviso
1. Apri **Documenti**.
2. Premi «Scarica» sul documento.

Se non c'è niente vedi «Nessun documento condiviso»: preventivo, consuntivo e conguaglio compaiono quando il gestore li condivide.

### Inviare una richiesta di manutenzione
1. Apri **Manutenzione** e premi «Nuova richiesta».
2. Scegli la categoria e l'urgenza, scrivi cosa non funziona e, se vuoi, aggiungi una foto.
3. Premi «Invia al gestore» (o «Invia la richiesta»).
4. Segui lo stato nell'elenco: se serve altro, il gestore te lo chiede («Servono altre informazioni»).

### Approvare o rifiutare una richiesta di manutenzione
Serve il permesso di creare i contratti sulla casa del contratto.
1. Apri il contratto e scegli **Manutenzione** (oppure apri la casa › scheda «Manutenzione»).
2. Leggi la richiesta e guarda la foto, se c'è.
3. Premi «Approva», oppure «Rifiuta» e scrivi il motivo, poi «Conferma il rifiuto».
4. Se hai approvato, ora puoi pagare; per il pagamento vedi sotto.

Reversibile: una decisione non si annulla da qui. Se il guasto richiede un tecnico puoi chiederlo a un fornitore con gli Interventi ([[affitti-lunghi#chiedere-un-intervento-a-un-fornitore]]).

### Pagare una richiesta approvata
1. Nella richiesta «Approvata» premi «Paga».
2. Controlla lo stato: la richiesta diventa «Pagata» quando Stripe conferma l'addebito.

## Flussi completi

### Flusso: il conduttore segnala un guasto
1. Il conduttore apre **Manutenzione › «Nuova richiesta»** e invia la richiesta con foto.
2. Il proprietario la trova in **Manutenzione** del contratto: la legge e preme «Approva» o «Rifiuta» con il motivo.
3. Se approvata, la richiesta può essere pagata con «Paga»; CasaZen la segna «Pagata» solo con la conferma di Stripe.
4. Il conduttore vede aggiornarsi lo stato nella sua area.

### Flusso: il conduttore paga il canone
1. Il gestore attiva il piano dei canoni e, se vuole, il pagamento online ([[canoni-scadenze#attivare-il-piano-dei-canoni]]).
2. Qualche giorno prima della scadenza il conduttore riceve l'e-mail con il link; apre la pagina «Pagamento del canone» e paga con la carta.
3. In alternativa paga con bonifico e dichiara «Ho effettuato il bonifico»; il gestore verifica e registra l'incasso ([[canoni-scadenze#registrare-un-incasso]]).
4. Quando il pagamento è confermato la rata diventa «Pagata» per tutti e due.

## Regole e limiti
- L'area è riservata a chi ha un account con **e-mail verificata uguale a quella di un conduttore attivo** del contratto. Il conduttore non diventa membro dell'organizzazione e non vede altri contratti.
- Una scadenza risulta pagata solo con la conferma del pagamento (Stripe) o con l'incasso registrato dal gestore. La dichiarazione «Ho effettuato il bonifico» non la segna pagata.
- Bonifico con il conto collegato e addebito SEPA: **solo in euro**; l'addebito non copre gli arretrati precedenti all'attivazione.
- La richiesta di manutenzione va al gestore: il conduttore non può approvarla né pagarla. Chi decide deve poter creare i contratti sulla casa. Il rifiuto richiede il motivo, in italiano.
- Le foto delle richieste sono private: le vede il conduttore e chi può leggere il contratto.
- L'indirizzo dell'area e i link di pagamento sono legati a un contratto e a una rata: un link sostituito smette di funzionare.

## Domande frequenti

### Il conduttore non vede il suo contratto: perché?
Quasi sempre l'e-mail del suo account è diversa da quella scritta nel contratto, oppure non è verificata. Verifica nel contratto (scheda «Inquilini») e fagli usare la stessa e-mail.

### Il conduttore ha dichiarato il bonifico: la rata è pagata?
No. La dichiarazione avvisa il gestore, che deve verificarla. La rata passa a «Pagata» solo quando il gestore registra l'incasso (o importa l'estratto conto) o il pagamento è confermato.

### Il conduttore può scegliere il fornitore per un guasto?
No. La richiesta va al gestore del contratto, che decide.

### Perché non vedo il pulsante «Paga» su una richiesta?
Compare solo dopo l'approvazione. Una richiesta «In attesa» non si può pagare.

### Il conduttore vede i miei documenti?
Solo quelli che condividi: preventivo, consuntivo, conguaglio, resoconto.

## Glossario
- **Conduttore**: l'inquilino, chi prende la casa in affitto.
- **Scadenza**: una rata da pagare con importo e data, che può includere canone, acconto condominiale e conguaglio.
- **Dichiarazione di bonifico**: la comunicazione del conduttore «Ho effettuato il bonifico»: serve al gestore per verificare, non segna la rata pagata.
- **Mandato SEPA**: l'autorizzazione all'addebito automatico in euro sul conto del conduttore.

## Vedi anche
- [[canoni-scadenze]]: canoni, piano delle rate, incassi e solleciti dal lato del proprietario.
- [[contratti]]: dove scrivi l'e-mail del conduttore.
- [[affitti-lunghi]]: immobili e interventi.
- [[incassi]]: come funziona Stripe.
