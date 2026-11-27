---
id: canoni-scadenze
titolo: Canoni, scadenze e inquilini
sezione: Affitti lunghi
ordine: 62
riassunto: Come tieni sotto controllo i canoni mese per mese (chi ha pagato, solleciti, estratto conto), le scadenze del contratto e le schede degli inquilini, con cauzione e spese condominiali.
chi: [gestore, amministratore]
dove: Affitti lunghi › Panoramica › Vai ai canoni
parole_chiave: [canoni, incassi, scadenziario, rata, sollecito, estratto conto, bonifico, scadenze, disdetta, registrazione, ISTAT, inquilini, conduttori, puntualità, cauzione, deposito, spese condominiali, privacy]
copre: [/app/long-rent/rents, /app/long-rent/deadlines, /app/long-rent/tenants, /app/long-rent/tenants/:id]
stato: disponibile
fonte_codice: [frontend/src/features/leases/rents-page.tsx, frontend/src/features/leases/rents-list.tsx, frontend/src/features/leases/components/rent-schedule-panel.tsx, frontend/src/features/leases/components/rent-reminder-dialog.tsx, frontend/src/features/leases/components/record-rent-payment-dialog.tsx, frontend/src/features/leases/components/mark-rent-paid-dialog.tsx, frontend/src/features/leases/components/bank-statement-import-dialog.tsx, frontend/src/features/leases/lib/bank-import.ts, frontend/src/features/leases/deadlines/long-rent-deadlines-page.tsx, frontend/src/features/leases/deadlines/deadlines-model.ts, frontend/src/features/leases/tenants/tenants-page.tsx, frontend/src/features/leases/tenants/tenant-detail-page.tsx, frontend/src/features/leases/tenants/tenant-privacy.tsx, frontend/src/features/public-rent/rent-payment-page.tsx, backend/Casazen.Core/Services/RentCharges.cs, backend/Casazen.Core/Services/IRentBillingService.cs, backend/Casazen.Core/Leases/LongRentDeadlineRules.cs, backend/Casazen.Core/Leases/LeaseOperationRules.cs]
---

## In breve
Il piano dei canoni di un contratto genera una rata per ogni periodo. Nella pagina **Canoni** vedi mese per mese chi ha pagato, chi deve ancora pagare e chi è in ritardo; registri un incasso, mandi un sollecito o importi l'estratto conto della banca per segnare i bonifici ricevuti. La pagina **Scadenze** raccoglie le date da non perdere (registrazione, disdetta, fine contratto, Questura, canoni). La pagina **Inquilini** raccoglie le persone dei tuoi contratti, con la loro puntualità.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Canoni del mese | Elenco delle rate con stato, scadenza, importo e ultimo sollecito | Panoramica › «Vai ai canoni» | gestore, amministratore | Disponibile | Vedere chi ha pagato e chi è in ritardo |
| Piano dei canoni | Genera le rate di un contratto (mensili, bimestrali, trimestrali, semestrali) | Contratto › scheda «Canoni» › «Genera lo scadenziario» | chi può creare i contratti | Disponibile | Attivare il piano dei canoni |
| Registra un incasso | Segna una rata pagata fuori da CasaZen | Canoni › «Registra un incasso» o «Registra incasso» sulla riga | chi può creare i contratti | Disponibile | Registrare un incasso |
| Sollecito | Manda un'e-mail al conduttore per una rata scaduta o in scadenza | Canoni › riga › «Invia sollecito» | chi può creare i contratti | Disponibile | Inviare un sollecito |
| Importa estratto conto | Legge un file della banca e propone quali rate segnare incassate | Canoni › «Importa estratto conto» | chi può creare i contratti | Disponibile | Importare un estratto conto bancario |
| Pagamento online ai conduttori | Il conduttore riceve un link per pagare con carta, qualche giorno prima | Contratto › «Canoni» › «Chiedi il pagamento online ai conduttori» | chi può creare i contratti | Disponibile con Stripe attivo | Chiedere il pagamento online ai conduttori |
| Scadenze | Registrazioni, fine contratto, disdette, Questura, canoni | Panoramica › Scadenze › «Vedi tutte» | gestore, amministratore | Disponibile | Controllare le scadenze |
| Scarica CSV | Le scadenze in un file | Scadenze › «Scarica CSV» | gestore, amministratore | Disponibile | Scaricare le scadenze in CSV |
| Inquilini | Elenco e scheda di ogni inquilino, con contratti e puntualità | Immobile › «Apri l'elenco degli inquilini», o contratto › «Inquilini» | gestore, amministratore | Disponibile | Trovare un inquilino e leggere la sua scheda |
| Dati dell'inquilino | Esporta o cancella i dati personali | Scheda dell'inquilino › Privacy | gestore, amministratore | Disponibile | Esportare o cancellare i dati di un inquilino |

## Come funziona

### Il piano dei canoni e le rate
Per seguire gli incassi di un contratto devi attivare il suo **piano dei canoni**. Si imposta quando il contratto è firmato da tutte le parti. Il piano genera una **rata** per ogni periodo e dice, per ciascuna, quanto va pagato e quando.
- **Periodicità**: mensile, bimestrale, trimestrale o semestrale.
- **Giorno di scadenza**: un giorno da 1 a 28 (se non lo scrivi, il giorno di inizio del contratto).
- **Importo della rata**: se lo lasci vuoto è il canone mensile del contratto per i mesi del periodo.
- **Traccia da**: per un contratto già iniziato CasaZen non conta le rate dei periodi passati, così **non si inventano ritardi**. Scegli «Dall'inizio del contratto» solo se vuoi registrare anche quelle.
- Se il contratto finisce dentro un periodo, per quel periodo non viene generata una rata: vedi un avviso e lo gestisci con il conduttore.

Ogni rata può contenere più voci: **Canone**, **Acconto condominiale**, **Conguaglio** e **Altri oneri**, con il **Totale**, il **Pagato** e il **Residuo**. Se sono presenti spese condominiali, un sollecito dice che «non è tutto canone».

### Gli stati di una rata
| Stato | Cosa vuol dire |
|---|---|
| **Da incassare** | La rata è nel piano e non è stata pagata |
| **Pagamento in corso** | Un pagamento online è partito e si aspetta l'esito |
| **Pagata** | È arrivato il pagamento online, oppure hai registrato tu l'incasso |
| **Pagamento non riuscito** | L'ultimo pagamento online non è andato a buon fine |
| **Annullata** | La rata non è più dovuta (piano disattivato, contratto terminato, recesso) |
| **Scaduta** | Etichetta che si aggiunge a una rata non pagata dopo la scadenza |

**Una rata risulta pagata solo quando Stripe conferma il pagamento online, oppure quando registri tu un incasso ricevuto fuori da CasaZen.** CasaZen non segna da solo come pagato un bonifico che vede arrivare: per questo c'è l'importazione dell'estratto conto.

### La pagina Canoni
In alto, «I numeri del mese»: «Incassati a [mese]» (con il confronto «su … attesi · 3 di 4 canoni»), «In ritardo» e «Ancora da incassare». Sotto, con le frecce «Mese precedente» e «Mese successivo» scegli il mese: **ogni canone compare nel mese della sua scadenza**. I filtri rapidi sono «Tutti», «In ritardo» (scaduti e non pagati), «In scadenza» (da incassare, non ancora scaduti) e «Pagati». Ogni riga mostra: Inquilino, Scadenza, Importo, Stato («In ritardo da 5 giorni», «Scade oggi», «Pagato il 3 novembre», «Pagamento online in corso») e «Ultimo sollecito». Le azioni della riga sono «Vedi contratto», «Registra incasso» e «Invia sollecito».

Se non hai contratti vedi «Qui segui i canoni di ogni mese» e il pulsante «Crea contratto». Se il mese non ha rate vedi «Nessun canone in questo mese».

### Pagamento online e link di pagamento
Se hai un account Stripe abilitato agli incassi (vedi [[incassi]]), il conduttore può pagare la rata con la carta. Nella scheda **Canoni** del contratto:
- con l'interruttore **«Chiedi il pagamento online ai conduttori»** acceso, qualche giorno prima di ogni scadenza i conduttori ricevono un'e-mail con il link per pagare. Spento, **non scriviamo a nessuno**, a meno che tu non mandi un sollecito o il link. Per accenderlo serve prima un account Stripe attivo;
- su ogni rata puoi premere «Invia link di pagamento» (poi «Invia di nuovo il link»): il nuovo link sostituisce quello di prima;
- quando il conduttore paga, la rata diventa «Pagata online il [data] (confermato da Stripe)» e il denaro va **direttamente sul tuo account Stripe**; CasaZen non lo trattiene.

Il link porta a una pagina pubblica «Pagamento del canone» dove il conduttore vede casa, periodo, scadenza e importo e preme «Paga [importo]». Se il link non è valido o è stato sostituito da uno più recente vede «Il link di pagamento non è valido o è stato sostituito da uno più recente».

Se non hai un indirizzo e-mail per nessun conduttore, il link non si può mandare: vedi «Nessun conduttore ha un indirizzo email». Puoi sempre registrare i pagamenti fuori da CasaZen.

### Solleciti
Un **sollecito** è un'e-mail al conduttore per una rata non pagata (scaduta o in scadenza). Nella finestra «Invia un sollecito» vedi l'anteprima («Promemoria canone di locazione — [casa], scadenza [data]»), se contiene il link per pagare online e, se hai indicato gli estremi del bonifico, anche quelli. Puoi aggiungere un tuo **messaggio per il conduttore** (compare nell'e-mail).
- L'e-mail arriva ai conduttori del contratto **che hanno un indirizzo e-mail**; dopo l'invio ti diciamo a quanti.
- Puoi mandare un solo sollecito per lo stesso canone ogni **24 ore** (la finestra lo scrive con il valore in uso).
- Hai qualche secondo per annullare: «Annulla se hai cambiato idea: l'email parte tra pochi secondi».
- Nella finestra può comparire anche «Invia via WhatsApp», se il conduttore ha un numero di telefono.

CasaZen **non manda solleciti da solo** per i canoni scaduti: li mandi tu. Quello che parte da solo è la richiesta di pagamento online, solo se l'hai accesa.

### Estratto conto bancario
**Importa estratto conto** legge il file dei movimenti che scarichi dalla tua banca e cerca i bonifici dei canoni. Non registra niente finché non confermi. Formati: CSV, Excel (.xlsx), CAMT.053 (XML) o MT940, fino a 8 MB. Il file viene letto e **non viene salvato**. Se non riconosce le colonne ti chiede quale contiene la data, la descrizione e l'importo.

CasaZen propone gli accrediti in tre gruppi:
- **Pronti da confermare**: l'importo è uguale a una rata e l'inquilino è riconosciuto (nome, cognome, immobile, mese, oppure un IBAN o un pagatore già visto su quel contratto). Sono già selezionati.
- **Da controllare**: l'importo corrisponde ma non è sicuro il canone: scegli tu a quale canone abbinare l'accredito.
- **Senza canone**: nessuna rata da incassare ha quell'importo e una scadenza vicina. Possono essere altri incassi o canoni già pagati.

Il bonifico deve avere lo **stesso importo** del canone e il canone non deve essere già pagato. Con «Conferma n incassi» CasaZen segna i canoni come incassati **con la data dell'accredito e la nota «Da estratto conto»**; hai qualche secondo per annullare. Se importi due volte lo stesso file, i movimenti già importati sono saltati («n erano già stati importati»).

### Le scadenze
La pagina **Scadenze** (titolo «Scadenze») ordina per data tutto ciò che il tuo contratto ti chiede, con la finestra «Fino al [data]». Le scadenze «Da fare subito» (già passate) stanno in cima. I tipi sono:
- **Registrazione del contratto** (30 giorni dalla firma o dall'inizio);
- **Ultimo giorno per la disdetta** (6 mesi prima della fine, per canone libero e concordato);
- **Fine del contratto**;
- **Comunicazione alla Questura** (conduttore extra-UE, 48 ore dalla consegna delle chiavi);
- **Canone di [importo]**: ogni rata da incassare.

I filtri sono «Tutte», «Firme e registrazioni», «Rinnovi e disdette», «Canoni», «Questura». Per ogni riga vedi quanto manca («tra 12 giorni», «Scaduta da 3 giorni», «oggi», «domani»). Nella Panoramica vedi le scadenze dei prossimi quattro mesi; qui di più. Se i canoni da incassare sono più di 500 vedi i primi 500 per data («Mostra le successive» per andare avanti).

**Cosa ti avvisa CasaZen**: finché non dichiari la registrazione di un contratto firmato, **manda un promemoria per e-mail ai locatori che hanno indicato un indirizzo**. Le altre date (disdetta, fine contratto, Questura) le vedi in questa pagina, nella Panoramica e nel blocco «Cosa devi fare ora» della scheda del contratto, e come passo da fare quando si avvicinano. Le rate in ritardo le vedi anche come blocco «Adesso» nella Panoramica.

### Gli inquilini
La pagina **Inquilini** elenca le persone dei tuoi contratti. Una persona è riconosciuta dal **codice fiscale**: se è scritto in modo diverso in due contratti, risultano due persone. I filtri sono «Tutti», «Attuali» (chi ha almeno un contratto non ancora concluso) e «Ex inquilini» (chi ha solo contratti conclusi), con la ricerca «Cerca per nome o immobile». Le colonne sono Inquilino, Contratto, Fine contratto e **Puntualità** («9 su 10 canoni in orario»).

La scheda di un inquilino mostra, in ordine:
- **Adesso**: se un canone non è arrivato («Il canone di [mese] non è arrivato»), con il pulsante «Vedi i canoni in ritardo»;
- **Contatti**: e-mail e cittadinanza («Cittadino UE» o «Cittadino non UE»);
- **Contratti**: i contratti della persona, con link;
- **Ultimi pagamenti**: i canoni pagati, con «Vedi i canoni»;
- **Privacy**: «Esporta i suoi dati» e «Chiedi la cancellazione».

### Cauzione e riconsegna
Il **deposito cauzionale** è la somma che il conduttore lascia a garanzia, al massimo 3 mensilità, e che gli restituisci a fine contratto con gli interessi legali, meno ciò che puoi documentare. CasaZen **non lo incassa e non lo restituisce**: calcola gli interessi, prepara il **prospetto** da dare al conduttore e registra la restituzione quando hai pagato. Allo stesso modo prepara il **verbale di riconsegna**. Procedura completa: [[contratti#restituire-la-cauzione]] e [[contratti#preparare-una-lettera-al-conduttore]].

### Spese condominiali
La quota condominiale del conduttore (acconto e conguaglio) si somma al canone nella rata. Il tuo registro delle spese condominiali con il condominio è separato: [[affitti-lunghi#registrare-le-spese-condominiali]]. Un preventivo o un conguaglio da mandare al conduttore compare nella scheda «Canoni» del contratto nel riquadro «Preventivi e conguagli da inviare»: **CasaZen non spedisce nulla da solo**; premi «Prepara l'invio», scegli il canale (e-mail o WhatsApp) e conferma con «Invia».

## Come fare

### Vedere chi ha pagato e chi è in ritardo
1. Apri **Affitti lunghi › Panoramica** e premi «Vai ai canoni» (oppure dalla casa «Verifica i canoni»).
2. Scegli il mese con le frecce.
3. Premi un filtro: «In ritardo» per i canoni scaduti, «In scadenza» per quelli ancora da incassare.
4. Per aprire il contratto premi «Vedi contratto».

### Attivare il piano dei canoni
Serve poter creare i contratti e il contratto deve essere firmato da tutte le parti.
1. Apri il contratto › scheda **Canoni**.
2. Premi «Genera lo scadenziario».
3. Scegli la «Periodicità», il «Giorno di scadenza (1-28)» e, se serve, l'«Importo della rata». Controlla «Traccia da».
4. Premi «Genera lo scadenziario» (poi, per cambiare, «Salva le modifiche»).
5. Leggi l'elenco delle rate: ogni rata mostra stato, scadenza, importo e composizione.

Per fermare il piano premi «Disattiva»: le rate non pagate sono annullate; per riattivarlo salvalo di nuovo.

### Registrare un incasso
Serve poter creare i contratti. Usalo per un pagamento ricevuto fuori da CasaZen (bonifico, assegno, contanti). Si registra la **rata intera**.
1. Apri **Canoni** e premi «Registra un incasso» (oppure «Registra incasso» sulla riga della rata).
2. Scegli il «Contratto» e il «Canone» (scadenza e importo).
3. Scegli la «Data dell'incasso»: non può essere nel futuro.
4. Se vuoi, scegli «Come ti ha pagato» («Bonifico», «Contanti», «Assegno» o «Non lo indico»): resta scritto nella nota.
5. Premi «Registra l'incasso».

Cosa succede dopo: la rata diventa «Pagata» («Incasso registrato da te: pagata il [data]»). Hai qualche secondo per annullare. Un eventuale link di pagamento online ancora aperto viene disattivato. Dalla scheda «Canoni» del contratto puoi fare lo stesso con «Segna come pagata».

Errori comuni: «Questo contratto non ha canoni da incassare» (il piano non è attivo o tutte le rate sono pagate); «Nessun contratto ha un canone da incassare».

### Inviare un sollecito
1. Apri **Canoni** e premi «Invia sollecito» sulla riga della rata.
2. Controlla l'anteprima e, se vuoi, scrivi un messaggio per il conduttore.
3. Premi «Invia sollecito». Hai qualche secondo per annullare.

Se il sollecito è troppo vicino al precedente, CasaZen te lo dice: puoi mandarne uno per lo stesso canone al massimo ogni 24 ore.

### Importare un estratto conto bancario
Serve poter creare i contratti.
1. Apri **Canoni** e premi «Importa estratto conto».
2. Premi «Scegli il file» (o trascinalo) e scegli il file dei movimenti della banca.
3. Se serve, indica le colonne di data, descrizione e importo e premi «Continua».
4. Leggi i tre gruppi. Nel gruppo «Da controllare» scegli per ogni accredito il canone giusto («Scegli il canone…»).
5. Premi «Conferma n incassi». Hai qualche secondo per annullare.

Cosa vedi dopo: «n canoni segnati come incassati». Gli incassi già pagati o cambiati nel frattempo sono saltati e ti viene detto.

### Chiedere il pagamento online ai conduttori
1. Collega Stripe e completa la verifica ([[incassi]]).
2. Apri il contratto › scheda **Canoni**.
3. Accendi «Chiedi il pagamento online ai conduttori».
4. Per una rata singola usa «Invia link di pagamento».

### Controllare le scadenze
1. Apri **Affitti lunghi › Panoramica › Scadenze › Vedi tutte** (o la voce **Scadenze** del menu, se la vedi).
2. Guarda prima «Da fare subito».
3. Filtra per tipo («Rinnovi e disdette», «Firme e registrazioni»…).
4. Premi una scadenza per aprire il contratto interessato.

### Scaricare le scadenze in CSV
1. Nella pagina **Scadenze** premi «Scarica CSV».
2. Ottieni un file con le colonne Scadenza, Data, Immobile, Conduttore, Importo e Stato («In ritardo» o «In arrivo»).

### Trovare un inquilino e leggere la sua scheda
1. Apri la casa e premi «Apri l'elenco degli inquilini» (o apri **Inquilini** dal contratto).
2. Cerca per nome o immobile, oppure usa «Attuali» / «Ex inquilini».
3. Premi «Apri la scheda».

### Esportare o cancellare i dati di un inquilino
1. Nella scheda dell'inquilino apri **Privacy**.
2. «Esporta i suoi dati» scarica un file con i suoi dati personali **in chiaro**: conservalo con cura.
3. «Chiedi la cancellazione» registra la richiesta di cancellare i suoi dati su tutti i contratti. Leggi le conseguenze e conferma.

Cosa succede: per i contratti finiti i dati sono **anonimizzati subito**, a meno che la persona abbia un altro contratto in corso. Per i contratti non ancora conclusi i dati restano fino al giorno dopo la loro fine, poi sono anonimizzati. **Non si annulla.** Il contratto firmato e le ricevute non vengono toccati.

## Flussi completi

### Flusso: dal canone alla riscossione
1. Attivi il piano dei canoni ([[canoni-scadenze#attivare-il-piano-dei-canoni]]).
2. Se hai Stripe attivo, accendi il pagamento online: qualche giorno prima della scadenza il conduttore riceve il link e paga ([[area-inquilino]]); la rata diventa «Pagata».
3. Se il conduttore paga con bonifico, importi l'estratto conto ([[canoni-scadenze#importare-un-estratto-conto-bancario]]) o registri l'incasso a mano.
4. Se la rata è scaduta, mandi un sollecito ([[canoni-scadenze#inviare-un-sollecito]]).
5. In Panoramica vedi «Incassati a [mese]» e «In ritardo».

### Flusso: fine contratto e cauzione
1. Compare in Scadenze l'«Ultimo giorno per la disdetta» ([[canoni-scadenze#controllare-le-scadenze]]).
2. Registri la disdetta o il rinnovo ([[contratti#registrare-una-disdetta]], [[contratti#registrare-il-rinnovo]]).
3. Concordi la riconsegna e prepari il verbale.
4. Prepari il prospetto della cauzione e registri la restituzione ([[contratti#restituire-la-cauzione]]).

## Regole e limiti
- Una rata è «Pagata» solo con la conferma di Stripe o con un incasso registrato da te. CasaZen non segna da solo un bonifico.
- «Registra un incasso» registra la **rata intera**, non un acconto; la data non può essere futura.
- Solleciti: al massimo uno ogni 24 ore per lo stesso canone; vanno solo ai conduttori con un indirizzo e-mail.
- Estratto conto: formati CSV, Excel, CAMT.053 e MT940, fino a 8 MB; il bonifico deve avere lo stesso importo del canone; il file non viene salvato.
- Piano dei canoni: giorno di scadenza tra 1 e 28; i periodi passati non sono tracciati se non lo chiedi.
- Pagamento online: serve un account Stripe attivo; il denaro va direttamente sul tuo account.
- Scadenze: CasaZen mostra fino a 500 canoni per volta; il resto compare avvicinandosi.
- Dati inquilino: l'esportazione contiene dati in chiaro; l'anonimizzazione non si annulla.
- Chi può cosa: vedere canoni, scadenze e inquilini serve il permesso di lettura dei contratti; registrare incassi, mandare solleciti, importare l'estratto conto e attivare il piano serve poter creare i contratti.

## Domande frequenti

### Perché una rata è «Da incassare» anche se il conduttore dice di aver pagato?
Perché CasaZen non sa del bonifico finché non lo registri o importi l'estratto conto della banca. Importa il file oppure registra l'incasso.

### Posso registrare solo un acconto del canone?
No: «Registra un incasso» registra la rata intera.

### Il conduttore riceve un sollecito da solo?
No. CasaZen non manda solleciti da solo. Se hai acceso il pagamento online, qualche giorno prima della scadenza il conduttore riceve il link per pagare.

### Cosa succede se importo due volte lo stesso estratto conto?
I movimenti già importati vengono saltati.

### Dove vedo se un conduttore paga sempre in ritardo?
Nella scheda dell'inquilino, alla riga «Puntualità» («n su N canoni in orario») e negli «Ultimi pagamenti».

### Come cancello i dati di un ex inquilino?
Dalla scheda dell'inquilino › Privacy › «Chiedi la cancellazione». I dati dei contratti finiti vengono anonimizzati subito.

## Glossario
- **Rata**: il pagamento di un periodo del piano dei canoni.
- **Scadenziario**: il piano delle rate di un contratto.
- **Sollecito**: l'e-mail che ricorda al conduttore una rata non pagata.
- **Competenza**: i mesi di un anno a cui si riferisce un canone, a prescindere da quando è pagato.
- **Acconto condominiale / conguaglio**: la parte di spese condominiali pagata a rate con il canone e la differenza regolata a fine anno.

## Vedi anche
- [[affitti-lunghi]]: panoramica, immobili, report fiscale e spese condominiali.
- [[contratti]]: creare, firmare, registrare e chiudere un contratto.
- [[area-inquilino]]: cosa vede e fa il conduttore.
- [[incassi]]: collegare Stripe e gli incassi degli affitti brevi.
- [[report-commercialista]]: report per il commercialista.
