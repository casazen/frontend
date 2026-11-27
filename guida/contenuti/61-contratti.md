---
id: contratti
titolo: Contratti di locazione
sezione: Affitti lunghi
ordine: 61
riassunto: Come creare un contratto in CasaZen o caricarne uno già firmato, farlo firmare e registrarlo, preparare le lettere (disdetta, recesso, rinnovo, ISTAT, cauzione) e chiudere il contratto. Cosa fa CasaZen e cosa resta a te con l'Agenzia delle Entrate, la Questura e l'inquilino.
chi: [gestore, amministratore]
dove: Affitti lunghi › Immobili › scheda della casa › Contratti
parole_chiave: [contratto, contratto di affitto, locazione, bozza, canone libero, canone concordato, transitorio, cedolare secca, firma, registrazione del contratto, Agenzia delle Entrate, ricevuta di registrazione, RLI, Questura, cessione di fabbricato, disdetta, recesso, rinnovo, ISTAT, cauzione, deposito cauzionale, inquilino, contratto già firmato, contratto guidato, sovrapposizione]
copre: [/app/long-rent/leases, /app/long-rent/leases/new, /app/long-rent/leases/:id, /app/long-rent/leases/:id/edit, /app/long-rent/documents/upload, /app/long-rent/leases/:id/guided-contract, /app/long-rent/leases/:id/concordatofacile]
stato: disponibile
fonte_codice: [frontend/src/features/leases/lease-create-page.tsx, frontend/src/features/leases/lease-wizard-page.tsx, frontend/src/features/leases/wizard/lease-wizard.tsx, frontend/src/features/leases/wizard/wizard-model.ts, frontend/src/features/leases/wizard/import-step.tsx, frontend/src/features/leases/wizard/signing-step.tsx, frontend/src/features/leases/wizard/after-signature-step.tsx, frontend/src/features/leases/components/start-way-choice.tsx, frontend/src/features/leases/lease-detail-page.tsx, frontend/src/features/leases/lease-documents-upload-page.tsx, frontend/src/features/leases/components/lease-signing-panel.tsx, frontend/src/features/leases/components/registration-status-panel.tsx, frontend/src/features/leases/components/questura-communication-panel.tsx, frontend/src/features/leases/operations, frontend/src/features/leases/lifecycle, frontend/src/features/leases/guide, frontend/src/features/leases/legacy-leases-redirect.tsx, frontend/src/pages/long-rent/leases/concordatofacile-offer-page.tsx, frontend/src/pages/long-rent/leases/guided-contract-redirect.tsx, backend/Casazen.Core/Leases/LongRentRules.cs, backend/Casazen.Core/Leases/LeaseContractTerms.cs, backend/Casazen.Core/Leases/LeaseOperationRules.cs, backend/Casazen.Core/Leases/LongRentDeadlineRules.cs, backend/Casazen.Core/Leases/LeaseRenewal.cs, backend/Casazen.Core/Leases/LeaseIstatRules.cs, backend/Casazen.Core/Leases/LeaseDepositRules.cs, backend/Casazen.Core/Leases/LeaseTemplateApproval.cs, backend/Casazen.Core/Regulatory/RliRegistrationDeadline.cs, backend/Casazen.Core/Regulatory/QuesturaCommunicationDeadline.cs, backend/Casazen.Web/BackgroundJobs/RliDeadlineReminderJob.cs, backend/Casazen.Web/BackgroundJobs/LeaseNoticeReminderJob.cs, backend/Casazen.Infrastructure/Services/LeaseLetters/LeaseLetterCatalog.cs, backend/Casazen.Web/Controllers/LeaseMaintenanceRequestsController.cs]
---

## In breve
In CasaZen un contratto di locazione nasce da una **bozza** che si salva da sola passo dopo passo: casa, parti, condizioni, date, revisione, firma. Se il contratto è già firmato lo carichi e CasaZen legge il file e compila i dati. Dopo la firma ti seguono la **registrazione** (scadenza di 30 giorni), l'eventuale comunicazione alla Questura, i canoni e le lettere per disdetta, rinnovo, recesso e cauzione.

**CasaZen non registra il contratto, non comunica nulla all'Agenzia delle Entrate né alla Questura e non invia lettere al conduttore (l'inquilino)**: prepara i moduli e le bozze, calcola le date e ti avvisa per e-mail di alcune scadenze. Registrare, comunicare, firmare e spedire resta a te.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Creare un contratto con CasaZen | Procedura guidata a passi, con bozza salvata in automatico (canone libero e transitorio) | Immobili › casa › Contratti › «Nuovo contratto» | chi può creare i contratti | Disponibile | Creare un contratto con CasaZen |
| Caricare un contratto già firmato | CasaZen legge il file, compila i dati e ti chiede solo ciò che manca | «Nuovo contratto» › «Ho già i documenti» | chi può creare i contratti | Disponibile | Caricare un contratto già firmato |
| Contratto guidato per il canone concordato | Pratica con modulo guidato: il contratto viene preparato per te e poi lo carichi | «Nuovo contratto» › «Canone concordato (3+2)» › «Parto da zero» | chi può creare i contratti | Su attivazione | Creare un contratto a canone concordato con il contratto guidato |
| Riprendere una bozza | Riapre la procedura dal punto in cui eri, anche da un altro dispositivo | Scheda del contratto › «Continua la compilazione» | chi può creare i contratti | Disponibile | Riprendere la bozza di un contratto |
| Firma su carta | Scarichi il contratto, lo fai firmare a mano e carichi la copia firmata | Passo «Firma», o scheda del contratto › Documenti | chi può creare i contratti | Disponibile (il contratto da scaricare richiede un modello approvato) | Far firmare il contratto e caricare la copia firmata |
| Firma elettronica | Un link personale per ogni parte | Scheda del contratto › Documenti | chi può creare i contratti | Su attivazione | Far firmare il contratto e caricare la copia firmata |
| Registrazione del contratto | Scadenza, checklist, precompilazione del modulo, promemoria per e-mail e dichiarazione degli estremi. La registrazione vera la fai tu | Scheda del contratto › Scadenze | chi può creare i contratti | Disponibile | Registrare il contratto e dichiarare la registrazione in CasaZen |
| Registrazione affidata a un servizio | I dati vengono inviati in automatico per la registrazione, a pagamento | Scheda del contratto › «Dati per la registrazione» | chi può creare i contratti | Su attivazione | Registrare il contratto e dichiarare la registrazione in CasaZen |
| Comunicazione alla Questura | Promemoria e dichiarazione per conduttore extra-UE | Scheda del contratto › Scadenze | chi può creare i contratti | Disponibile | Comunicare alla Questura (inquilino extra-UE) |
| Lettere e operazioni | Bozze di disdetta, presa d'atto del recesso, rinnovo, conferma esigenza, ISTAT, cedolare, riconsegna, cauzione | Scheda del contratto › Guida › Operazioni | chi può creare i contratti | Disponibile | Preparare una lettera al conduttore |
| Controllo del canone concordato | Calcola la fascia consentita dall'accordo del comune | Scheda del contratto › Guida › «Controlla il canone» | chi può leggere i contratti | Disponibile (dati solo per alcuni comuni) | Controllare il canone concordato |
| Disdetta, recesso, rinnovo e termine anticipato | Le quattro cose che puoi fare quando il rapporto finisce o continua | Scheda del contratto › menu, e Guida › Operazioni | chi può creare i contratti | Disponibile | Scegliere tra disdetta, recesso, rinnovo e termine anticipato |
| Restituzione della cauzione | Calcola gli interessi, prepara il prospetto e registra la restituzione | Scheda del contratto › Guida › Operazioni | chi può creare i contratti | Disponibile | Restituire la cauzione |
| Eliminazione della bozza | Cancella un contratto non ancora firmato | Scheda del contratto › menu | chi può creare i contratti | Disponibile | Eliminare la bozza di un contratto |
| Cancellazione dei dati | Anonimizza i dati delle persone di un contratto | Scheda del contratto › menu | chi può creare i contratti | Disponibile | Chiedere la cancellazione dei dati di un contratto |

## Come funziona

### I tipi di contratto
| Tipo | Prima durata | Se nessuno disdice | Disdetta |
|---|---|---|---|
| Canone libero (4+4) | 4 anni (48 mesi) | si rinnova da solo per altri 4 anni | scritta, almeno 6 mesi prima della fine; alla prima scadenza serve uno dei motivi previsti dalla legge |
| Canone concordato (3+2) | 3 anni (36 mesi) | si proroga per altri 2 anni (24 mesi) | come sopra |
| Transitorio | da 1 a 18 mesi | finisce da solo, non si rinnova | non serve; serve invece l'esigenza scritta nel contratto |

Il «Contratto per studenti» compare ma non è ancora disponibile.

Non sai quale scegliere? **Canone libero (4+4)**: le condizioni (canone, regole) le decidete voi, entro i limiti di legge; 4 anni più 4. **Canone concordato (3+2)**: il canone deve stare dentro le fasce dell'accordo del comune; 3 anni più 2, e dà diritto alle agevolazioni previste per questo tipo di contratto. **Transitorio**: solo per un'esigenza precisa e temporanea, da 1 a 18 mesi. Nel dubbio chiedi al tuo commercialista: CasaZen non consiglia il tipo.

### Cosa si può fare in CasaZen e cosa no
- **Contratto fatto in CasaZen**: oggi è possibile per il **canone libero** e per il **transitorio**. Se il modello di contratto non c'è, la scelta «Lo preparo con CasaZen» resta chiusa e ti dice di caricare il tuo contratto.
- **Canone concordato**: puoi caricare un contratto già firmato oppure, **su attivazione** ([[per-iniziare#cosa-significa-su-attivazione]]), usare il contratto guidato.
- **Contratto già firmato**: vale per tutti e tre i tipi. CasaZen lo legge, lo tiene con le sue scadenze e non ne controlla la fascia di canone.
- **Se il modello di contratto di CasaZen non è ancora approvato**: leggi il paragrafo qui sotto.

### Il modello di contratto: approvato o ancora bozza
Il testo del contratto che CasaZen prepara parte da un **modello**. Per la procedura «Lo preparo con CasaZen» i modelli sono: canone libero con cedolare secca, canone libero con regime ordinario e transitorio. Quale usa il tuo contratto lo decide il tipo e il **regime fiscale** che scegli nel passo «Condizioni». Ogni modello deve essere **approvato da CasaZen** prima di poter essere usato per la firma: non lo approvi tu e non dipende dalle impostazioni della tua organizzazione.
- **Modello approvato**: nel passo «Firma» il pulsante «Scarica da firmare» funziona.
- **Modello ancora bozza**: puoi compilare tutta la procedura e leggere l'anteprima con la scritta **BOZZA**, ma «Scarica da firmare» non è disponibile. Lo vedi già alla «Revisione» («Il modello di contratto di CasaZen è ancora una bozza: potrai scaricare il contratto da firmare quando sarà approvato») e nel passo «Firma» («Il modello di contratto è in approvazione: puoi leggere l'anteprima ma non ancora scaricare il contratto da firmare»). Se cambi regime fiscale, può cambiare anche il modello e quindi la situazione.
- **Cosa fare se è ancora bozza**: da qui non puoi farlo firmare. Se hai già un contratto tuo, caricalo con «Ho già i documenti» (vale per il canone libero, il concordato e il transitorio). Altrimenti scrivi all'assistenza di CasaZen e chiedi se il modello del tuo tipo di contratto e del tuo regime è già approvato: in alto premi **Guida** e scegli «Scrivi all'assistenza».
- **Righe da completare a mano**: il contratto stampato può avere righe in bianco, che CasaZen non compila (nei modelli attuali, per esempio il giorno di pagamento e l'IBAN del locatore: la procedura non li chiede). Scrivile a mano prima della firma.

### La bozza e il salvataggio automatico
Tutto quello che scrivi si salva da solo («Salvato alle 10:42»): la bozza è sul tuo account, non sul dispositivo. Puoi uscire con «Salva e continua dopo» e riprendere da un altro dispositivo. Se la stessa bozza viene salvata da due schede, CasaZen ti avvisa («Questo contratto è stato modificato in un'altra scheda») e ti fa ricaricare la versione più recente: quello che hai scritto nell'altra scheda dopo l'ultimo salvataggio non è salvato.

### I passi di un contratto fatto in CasaZen
1. **Immobile**: scegli la casa. Servono APE e dati catastali (vedi [[affitti-lunghi#completare-ape-e-dati-catastali]]). Se la casa è in affitto breve puoi preparare il contratto, ma per usarlo deve passare in affitto lungo.
2. **Parti**: chi affitta (locatore) e chi prende in affitto (conduttore, cioè l'inquilino). Per ognuno nome, cognome, codice fiscale o partita IVA (16 caratteri per una persona, 11 cifre per una società), residenza o sede, e-mail, telefono. Per il conduttore anche la cittadinanza. Puoi aggiungere più locatori e più conduttori. **Scrivi anche la tua e-mail di locatore**: è l'indirizzo a cui CasaZen manda i promemoria (registrazione, Questura, ultimo giorno per la disdetta); senza, non ti avvisa.
3. **Condizioni**: regime fiscale, canone mensile e deposito cauzionale (al massimo 3 mensilità; scrivi 0 se non c'è). Per il transitorio anche l'esigenza che giustifica il contratto. Facoltativo: spese condominiali.
4. **Date**: data di inizio e, per il transitorio, ultimo giorno. CasaZen ti mostra «In parole semplici» durata, rinnovo, ultimo giorno per la disdetta e scadenza di registrazione.
5. **Revisione**: ricontrolli tutto; CasaZen segnala cosa non va.
6. **Firma**: scarichi, fai firmare e carichi la copia firmata.
7. **Dopo la firma**: registrazione, Questura, piano dei canoni.

Il pulsante principale dice sempre cosa fa («Salva e vai alle parti», «Salva e vai alle condizioni», «Salva e vai al controllo», «Conferma e vai alla firma»). Se manca qualcosa, la riga sotto i campi dice «Manca: …» e il link «Vai al campo» ti porta nel posto giusto.

### Regime fiscale del contratto: cedolare secca o ordinario
- **Cedolare secca sugli affitti lunghi**: imposta fissa sul canone, al posto dell'imposta sul reddito, dell'imposta di registro e del bollo. **Con una società come conduttore non è ammessa** (un conduttore con codice di 11 cifre è una società): scegli il regime ordinario. Con la cedolare secca il canone **non si aggiorna** (niente ISTAT) per tutta la durata dell'opzione; la sua scelta si comunica al conduttore (lettera «Opzione cedolare», vedi sotto). Le regole della cedolare sugli affitti brevi sono un'altra cosa: [[fisco-documenti]].
- **Ordinario**: il canone si somma al tuo reddito e si paga l'imposta di registro.
- Nella scheda «Guida» del contratto trovi una stima di imposta di registro e cedolare per il tuo caso, con le avvertenze («Da sapere»). È una stima: per scegliere il regime chiedi al tuo commercialista.

### Il contratto transitorio
Il transitorio si può fare solo per un'esigenza precisa e temporanea. Nel passo «Condizioni» indichi:
- **Chi ha l'esigenza**: il locatore o il conduttore;
- **Quale esigenza**, in poche parole (una di quelle previste dall'accordo territoriale del comune: per esempio lavoro o studio per un periodo limitato);
- se il contratto dura più di **30 giorni**, la **documentazione che alleghi** per provarla (per esempio una lettera di assunzione).

Nei comuni con più di 10.000 abitanti il canone di un transitorio deve rientrare nelle fasce dell'accordo territoriale: CasaZen te lo ricorda nella revisione. Alla scadenza il transitorio finisce da solo.

### Come CasaZen legge un contratto già firmato
Se il contratto esiste già, lo carichi e CasaZen **lo legge e compila i dati**, chiedendoti solo ciò che non riesce a leggere. Puoi caricare un PDF o le foto delle pagine. Se il file contiene anche l'attestazione e la scheda di calcolo (canone concordato), le riconosce da solo («Nel file abbiamo riconosciuto: contratto, attestazione, scheda di calcolo»).
- I dati letti sono segnati: «Letto dal contratto — controlla» e «Calcolato dal contratto — controlla». Se il contratto dice una cosa diversa da quella che hai scritto, vedi «Il contratto riporta un valore diverso da quello inserito: controlla».
- CasaZen segnala cosa non torna sotto «Da controllare» (per esempio un codice fiscale non valido, un canone concordato più corto di tre anni, un'attestazione che dice che il canone NON rispetta l'accordo).
- Se la lettura non riesce (foto illeggibile, nessun testo, file troppo lungo, servizio non disponibile) ti viene detto e inserisci i dati a mano: il contratto resta caricato e lo userai alla fine.
- Il file resta nel tuo spazio.

I passi sono gli stessi (Immobile, Parti, Condizioni, Date) ma al posto di «Revisione» e «Firma» c'è un solo passo **Contratto firmato**: il PDF con le firme di tutte le parti, il **giorno della firma** (quello in cui ha firmato l'ultima parte, non dopo oggi) e la domanda «È già stato registrato?». Con «Sì» ti chiediamo numero di registrazione e ricevuta dopo l'inserimento; con «No, o non lo so» il contratto resta «Firmato», appare la scadenza di registrazione e, finché non dichiari la registrazione, **CasaZen ti manda un promemoria per e-mail** (se hai indicato un indirizzo). Per un contratto già firmato APE e dati catastali mancanti sono solo avvisi.

> **Attenzione:** confermando «Inserisci il contratto» il contratto passa a «Firmato» e **da quel momento non si può più modificare né eliminare**. Il file e il giorno della firma non si possono correggere dopo l'inserimento: controllali prima.

La pagina **Carica i documenti in CasaZen** è invece il posto dove aggiungere documenti a un contratto che esiste già (contratto firmato con attestazione, ricevuta di registrazione, documento per la registrazione, altro): PDF fino a 20 MB. Ci arrivi dal pulsante «Carica i documenti» della scheda del contratto o dal link dell'e-mail della pratica guidata. Se arrivi da un link esterno, CasaZen ti chiede prima di **confermare il contratto giusto** (nome della casa) o di sceglierne un altro, e solo dopo permette il caricamento. Un documento si può scaricare («Scarica») o eliminare («Elimina»): l'eliminazione toglie il file dal contratto.

### La scheda del contratto
Il titolo è il nome del conduttore; sotto c'è la casa. Il badge in alto a destra mostra lo **stato** («Bozza», «In attesa di firma», «Firmato», «Registrato») e, se lo tocchi, spiega cosa significa. Le sei schede:
- **Dati**: tipo, durata, canone, regime fiscale, deposito, parti, e la cronologia degli eventi («Ultimi eventi»);
- **Inquilini**: le persone del contratto, con i contatti e, se serve, il segnale «Extra-UE»;
- **Documenti**: «Contratto e ricevute», i documenti caricati, la firma;
- **Canoni**: il piano dei canoni (vedi [[canoni-scadenze]]);
- **Scadenze**: le date del contratto, la registrazione e la Questura;
- **Guida**: i consigli del tuo contratto («Cedolare secca e ISTAT», «Attestazione», «Comune ad alta tensione abitativa»…) e le **Operazioni** (lettere).

In alto vedi anche il blocco **Cosa devi fare ora**: l'unico passo che tocca a te, scelto da CasaZen. I passi possibili vanno da «Completa la bozza del contratto» a «Controlla il contratto e conferma», «Scarica il contratto e fallo firmare», «Carica la copia firmata», «Registra il contratto», «Segna quando hai consegnato le chiavi», «Fai la comunicazione alla Questura», «Attiva il piano dei canoni», «Un canone è in ritardo», «Decidi se dare la disdetta». Quando il contratto è in ordine vedi «È tutto in regola».

Il menu della scheda (tre puntini) ha i link «Leggi il contratto» (o «Leggi la bozza del contratto»), «Vai ai documenti», «Apri l'immobile» e le azioni sulla vita del contratto, descritte più sotto.

### Le fasi del contratto
Nell'elenco dei contratti di una casa i filtri rapidi ti dicono a che punto sono: «Attivi» (registrati e non ancora terminati), «In scadenza» (registrati, con meno di sei mesi alla fine), «In preparazione» (non ancora registrati: bozze, in firma, da registrare), «In firma», «Terminati» (arrivati alla data di fine, o con la registrazione rifiutata), «Con un canone in ritardo», «Da fare» (contratti con un passo che tocca a te). Una colonna «Avanzamento» mostra «Mese 3 di 48» o «2 di 5 passi».

### Firma
Per un contratto fatto in CasaZen la firma è **su carta**: scarichi il PDF, lo fai firmare a mano su ogni pagina da tutte le parti (o con la loro firma digitale) e carichi la copia firmata con la data di stipula, cioè il giorno in cui ha firmato l'ultima parte. **CasaZen conserva il PDF ma non verifica le firme che contiene.** Il contratto risulta firmato solo quando registra la firma di tutte le parti.
- Dopo «Scarica da firmare» il contratto è «In firma». Puoi «Annullare lo scarico per modificare»: la copia da firmare non vale più e il contratto torna in revisione.
- Prima della firma CasaZen ti ricorda di controllare tu un **documento d'identità** di ogni parte: CasaZen non lo conserva.
- **Su attivazione**, se è attiva la firma elettronica, puoi premere «Invia per firma elettronica»: ogni parte riceve un link personale (valido fino a una data indicata) che condividi con la parte; il contratto risulta firmato solo quando tutte le parti hanno firmato. Per chiedere l'attivazione scrivi all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza».

### Cosa fa CasaZen e cosa comunichi tu a enti e inquilino
| Adempimento | Chi lo fa | CasaZen te lo ricorda? |
|---|---|---|
| Registrazione del contratto all'Agenzia delle Entrate (30 giorni) | tu | Sì: scheda Scadenze, «Cosa devi fare ora» e promemoria per e-mail |
| Comunicazione alla Questura (48 ore dalla consegna delle chiavi, conduttore extra-UE) | tu | Sì: scheda Scadenze e promemoria per e-mail finché non la dichiari |
| Ultimo giorno per la disdetta (6 mesi prima della fine) | tu | Sì: Scadenze, Panoramica e, per i contratti registrati, promemoria per e-mail (30 giorni prima, 7 giorni prima e il giorno stesso) |
| Comunicazione all'Agenzia delle Entrate di proroga, rinnovo o fine del contratto | tu | **No**: non compare tra le Scadenze e non arriva nessun promemoria |
| Pagamento dell'imposta di registro e del bollo (senza cedolare secca) | tu | No |
| Lettere al conduttore (disdetta, recesso, ISTAT, riconsegna, cauzione) | tu: firmi e spedisci | Solo come operazione disponibile nella scheda «Guida» |

I promemoria per e-mail vanno ai locatori che hanno un indirizzo e-mail nel contratto e **mai al conduttore**.

### Registrazione
Il contratto va registrato all'**Agenzia delle Entrate** (modello RLI, la richiesta di registrazione) **entro 30 giorni dalla firma di tutte le parti o dall'inizio del contratto, se anteriore**. **CasaZen non registra il contratto e non è un intermediario abilitato** (cioè una persona o uno studio autorizzato a registrare per conto di altri, per esempio il commercialista). Cosa fa CasaZen: calcola la scadenza e la mostra («Scadenza per la registrazione: …»; se manca la data di firma è «Da determinare» finché non la dichiari), prepara la precompilazione del modulo, ti mostra la checklist e ti manda un promemoria per e-mail. Cosa resta a te: registrare, pagare le imposte dovute, caricare la ricevuta e dichiarare la registrazione.

Ci sono tre modi, a seconda del contratto:
1. **Da te, sul canale ufficiale** (sempre disponibile): scarichi la precompilazione RLI, registri il contratto sul sito dell'Agenzia delle Entrate o tramite un intermediario abilitato, poi inserisci qui gli estremi e la ricevuta. Per accedere ai servizi online dell'Agenzia servono di solito SPID, CIE o CNS; con un intermediario non ti serve. **CasaZen non trasmette la RLI per tuo conto.**
2. **Affidata a un servizio** (su attivazione): premi «Dati per la registrazione», controlli i dati precompilati, aggiungi ciò che manca (anche i documenti di identità, che servono per la registrazione e vengono inviati con il contratto), paghi il costo del servizio (lo vedi prima di pagare; imposte di registro e bollo, se dovute, sono escluse) e confermi la delega con «Autorizza e invia». Finché la ricevuta non arriva il contratto resta «Registrazione in corso», **non registrato**. Se fallisce vedi il motivo e puoi riprovare o registrare tu. Per chiedere l'attivazione scrivi all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza».
3. **Contratto guidato**: se hai fatto il contratto con la pratica guidata, la registrazione la esegue il servizio che ha preparato il contratto: quando ricevi la ricevuta la carichi nei Documenti e dichiari la registrazione.

Le imposte (imposta di registro e bollo, quando dovute) le paghi tu all'Agenzia delle Entrate: CasaZen non le paga. Con la **cedolare secca** non si pagano imposta di registro e bollo, ma il contratto va comunque registrato: ricordati di indicare la cedolare anche nella richiesta di registrazione, perché la scelta fatta in CasaZen non viene comunicata all'Agenzia. Dopo la registrazione la scadenza sparisce e i promemoria si fermano.

> **Attenzione:** **una registrazione dichiarata dal locatore non è verificata da CasaZen.** Se dichiari «Registrato» senza aver registrato, il contratto risulta registrato, la scadenza sparisce e i promemoria si fermano: nessuno te lo ricorderà più. Dichiaralo solo con la ricevuta in mano.

### Comunicazione alla Questura
Se un conduttore **non è cittadino dell'Unione europea** (la cittadinanza si chiede nel passo «Parti»), il locatore deve comunicare per iscritto all'autorità locale di pubblica sicurezza di aver ceduto l'immobile (molti la chiamano «cessione di fabbricato»), **entro 48 ore dalla consegna delle chiavi**. È un obbligo diverso dalla registrazione: la registrazione non lo sostituisce. CasaZen la ricorda solo per un conduttore extra-UE: se hai dubbi su altri casi, chiedi al tuo commercialista.

**CasaZen non invia la comunicazione**: ti mostra il termine, ti rimanda alle informazioni della Polizia di Stato, ti manda un promemoria per e-mail finché non dichiari di averla fatta, e tu premi «Segna come comunicata» con la data e (facoltativa) la ricevuta. CasaZen conosce il giorno della consegna, non l'ora: come scadenza mostra il secondo giorno dopo la consegna, ma le 48 ore sono ore vere, quindi comunica prima. La data di consegna è per impostazione la data di inizio: se hai consegnato un altro giorno la cambi con «Modifica data di consegna». «Segna come comunicata» registra solo che l'hai fatto: CasaZen non controlla l'invio. L'ufficio competente e il modo di invio cambiano da provincia a provincia.

### Lettere e operazioni
Nella scheda **Guida** del contratto, sezione **Operazioni**, CasaZen prepara le lettere che servono nella vita del contratto. In ogni caso:
- **è una bozza**: la firmi e la spedisci tu (raccomandata, PEC, a mano); CasaZen non la invia e non scrive al conduttore;
- se il testo della lettera non è ancora approvato, il PDF porta la scritta **BOZZA**: fallo rivedere prima di mandarlo;
- dopo averla spedita premi «Segna come inviata» e scegli il giorno e «Come l'hai mandata» («Raccomandata», «PEC», «Consegna a mano», «Altro mezzo»): resta nella cronologia. Non allega la ricevuta di spedizione: conservala tu. **«Segna come inviata» non registra la disdetta e non ferma il rinnovo**: per quello serve «Registra una disdetta» (vedi sotto).

| Lettera | Quando compare | Cosa ti chiede | Cosa fa CasaZen |
|---|---|---|---|
| **Disdetta** («Prepara la disdetta») | contratto in vigore che si rinnova (non il transitorio), senza disdetta del conduttore | alla prima scadenza il **motivo** previsto dalla legge (uso proprio, vendita, ristrutturazione…), poi nessun motivo | scrive la lettera; ti dice entro quando va spedita (6 mesi prima della fine) |
| **Presa d'atto del recesso** | contratto in vigore e iniziato | giorno in cui è arrivata la lettera del conduttore e perché recede | calcola il giorno in cui finisce il contratto |
| **Rinnovo** («Registra il rinnovo») | nell'ultimo tratto: dall'ultimo giorno utile per la disdetta, se non c'è una disdetta | «Rinnovo standard» o «Proroga a un giorno concordato» | sposta la fine e allunga il piano dei canoni; ti prepara l'accordo da far firmare |
| **Conferma dell'esigenza** | solo contratto transitorio, se l'esigenza è del locatore | nulla | scrive la lettera da mandare prima della scadenza |
| **Aggiornamento ISTAT (affitti lunghi)** («Calcola l'aggiornamento») | contratto in vigore **non** sotto cedolare secca | la variazione dell'indice FOI (%) e la quota riconosciuta dal tuo contratto | calcola il nuovo canone e scrive la richiesta |
| **Opzione cedolare** («Prepara la comunicazione») | contratto in vigore sotto cedolare secca | il giorno da cui vale (facoltativo) | scrive la comunicazione di scelta e di rinuncia agli aggiornamenti |
| **Riconsegna** («Prepara il verbale») | contratto in fase di fine (disdetta registrata, terminato in anticipo, o tipo che non si rinnova) | il giorno della riconsegna (facoltativo) | prepara il verbale da compilare e firmare insieme al conduttore |
| **Restituzione cauzione** («Prepara il prospetto») | contratto in fase di fine e con un deposito | tasso legale di ogni anno, interessi già pagati, trattenute | calcola gli interessi e quanto restituire; prepara il prospetto |

### Aggiornamento ISTAT (affitti lunghi)
È l'aumento del canone che il contratto può prevedere, in base alla variazione dell'indice dei prezzi (indice FOI). CasaZen **non lo applica mai da solo**: non cerca l'indice, non cambia il canone e non scrive al conduttore. Quando premi «Calcola l'aggiornamento» scrivi tu la variazione dell'indice FOI (%) e la quota che il tuo contratto riconosce; CasaZen calcola il nuovo canone (aumenta soltanto: una variazione zero o negativa non dà nulla da chiedere) e prepara la lettera con la richiesta. **Le rate già emesse restano come sono e il piano dei canoni non cambia.** Sotto **cedolare secca** l'aggiornamento è sospeso per tutta la durata dell'opzione: la lettera non viene preparata.

### Chiudere un contratto
Dal menu della scheda:
- **Elimina la bozza**: per le bozze in compilazione o in revisione; cancella persone, date e canone e **non si recupera**. Hai pochi secondi per cambiare idea con «Annulla».
- **Annulla lo scarico per la firma**: per un contratto scaricato per la firma su carta, lo riporta in revisione.
- **Registra una disdetta**: registra (non invia) una disdetta mandata da te o dal conduttore; il contratto finisce alla fine del periodo in corso. Si toglie con **Togli la disdetta** finché il periodo non è finito.
- **Termina il contratto**: lo chiude in anticipo, a un giorno che scegli (anche passato). Si conferma scrivendo la parola «TERMINA». **Non si può annullare.** I canoni futuri non ancora pagati non vengono più richiesti; la casa torna libera dal giorno dopo; **la cessazione di un contratto registrato va comunicata all'Agenzia delle Entrate** entro 30 giorni (è il termine che CasaZen ti mostra nella finestra; con la cedolare secca l'imposta fissa relativa non si paga: per il resto chiedi al commercialista). Un contratto non ancora iniziato non si termina così: serve la risoluzione consensuale, da comunicare all'Agenzia delle Entrate.
- **Passa ad affitto breve**: solo per un contratto in scadenza; vedi [[affitti-lunghi#passare-un-immobile-da-affitto-lungo-ad-affitto-breve]].
- **Chiedi la cancellazione dei dati**: vedi sotto.

Un contratto **firmato non si modifica e non si elimina**: si chiude con disdetta, recesso o «Termina il contratto».

Se non fai nulla, il contratto che si rinnova **si rinnova da solo anche in CasaZen**: il giorno dopo la fine del periodo, se non c'è una disdetta registrata, CasaZen sposta la fine al nuovo periodo (48 mesi nel canone libero, 24 nel concordato). Un contratto che inserisci quando è già finito resta «Terminato» e non si rinnova.

### Sovrapposizioni
Due contratti sulla stessa casa non possono coprire gli stessi giorni. Se le date che inserisci si sovrappongono a un contratto esistente, CasaZen te lo dice («Per questo immobile c'è già un contratto dal … al …») e puoi aprirlo con «Apri il contratto esistente» o cambiare le date. Una casa che ha già un soggiorno o una prenotazione di affitto breve nello stesso periodo si risolve col passaggio di modalità ([[affitti-lunghi#passare-un-immobile-da-affitto-breve-ad-affitto-lungo]]).

### Contratto guidato per il canone concordato (su attivazione)
Per il canone concordato puoi scegliere «Parto da zero»: attivi un servizio, compili un modulo guidato e **il contratto viene preparato per te**. Resti sempre dentro CasaZen; i dati del modulo e i documenti si ritrovano nella scheda del contratto. È **su attivazione** ([[per-iniziare#cosa-significa-su-attivazione]]): finché non è attivo vedi «Disponibile a breve». Per chiederlo scrivi all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza».

Il percorso è in cinque passi (come lo mostra la pagina «Crea il contratto»): paghi (il prezzo lo vedi prima di pagare; registro e bollo, se dovuti, sono esclusi) o usi la «pratica omaggio» se ne hai una; compili il modulo guidato; il contratto viene preparato; lo ricevi per e-mail, pronto da firmare; lo carichi in CasaZen e CasaZen lo legge e compila i dati. Nella scheda del contratto vedi lo **«Stato della pratica»** («In lavorazione», «In attesa dell'utente», «Bozza inviata», «Inviato all'associazione», «Attestato», «Firmato ricevuto», «Registrato», «Sospeso», «Chiuso senza attestazione»). Se la pratica è «In attesa dell'utente» o «Sospesa» ti hanno scritto per e-mail per chiederti dati o documenti: controlla la posta, anche lo spam. Il modulo si apre in una pagina dedicata: se lo interrompi, riprende solo dallo stesso dispositivo e browser.

Alla fine carichi i documenti (contratto firmato con attestazione, ricevuta di registrazione) con «Carica i documenti» e poi «Completa e importa il contratto»: la bozza diventa un contratto firmato, con lo stesso riferimento. La registrazione la esegue il servizio che ha preparato il contratto: quando hai la ricevuta la carichi e premi «Dichiara la registrazione».

### Dati personali di un contratto
Con «Chiedi la cancellazione dei dati» registri la richiesta di cancellare i dati delle persone del contratto. Se il contratto è finito i dati sono **anonimizzati subito**; se non è finito, dal giorno dopo la sua fine; se una persona ha un altro contratto in corso, i suoi dati restano finché quel contratto non finisce. **L'anonimizzazione non si annulla.** Il contratto firmato e le ricevute non vengono toccati.

## Come fare

### Creare un contratto con CasaZen
**Ti serve:** il permesso di creare i contratti; una casa in affitto lungo con APE e dati catastali; per ogni parte nome, codice fiscale, residenza, e-mail e telefono (e la cittadinanza del conduttore); canone, deposito (al massimo 3 mensilità) e date; il regime fiscale scelto con il tuo commercialista. Se hai già il contratto firmato, usa invece [[contratti#caricare-un-contratto-gia-firmato]].
1. Apri **Affitti lunghi › Immobili**, scegli la casa e nella scheda «Contratti» premi «Nuovo contratto» (oppure dalla Panoramica «Crea contratto»).
2. Alla domanda «Che contratto vuoi fare?» scegli «Canone libero (4+4)» o «Transitorio» (se non sai quale, leggi «I tipi di contratto» qui sopra).
3. Alla domanda «Come vuoi procedere?» scegli «Lo preparo con CasaZen» e premi «Continua: scegli la casa».
4. Scegli la casa (se non c'è, «Aggiungi un nuovo immobile»). Leggi «Cosa serve per il contratto»: APE e dati catastali devono esserci.
5. Passo **Parti**: compila locatore e conduttore. Il codice fiscale è controllato e due persone non possono avere lo stesso. **Scrivi la tua e-mail di locatore**: ci arrivano i promemoria. Per il conduttore l'e-mail serve per il link di pagamento, i solleciti e l'area del conduttore ([[area-inquilino]]): scrivila uguale a quella che userà per entrare; il telefono serve per il promemoria WhatsApp. Premi «Salva e vai alle condizioni».
6. Passo **Condizioni**: scegli il regime fiscale, scrivi il canone mensile e il deposito. Per il transitorio compila l'esigenza. Facoltativo: nel riquadro «Spese condominiali» premi «Calcola l'importo» (da consuntivo e preventivo) o scrivi l'«Importo per rata», poi «Usa questo importo»: è una proposta, non un pagamento. Premi «Salva e vai alle date».
7. Passo **Date**: scegli la «Data di inizio» (per il transitorio anche «Ultimo giorno del contratto»). Leggi «In parole semplici». Premi «Salva e vai al controllo».
8. Passo **Revisione**: leggi «Il contratto in parole». Sistema ciò che è in «Da sistemare» con «Vai al passo» e leggi «Da controllare» e «Da sapere». Se vedi «Il modello di contratto di CasaZen è ancora una bozza…», dopo non potrai scaricare il contratto da firmare: leggi «Il modello di contratto: approvato o ancora bozza». Quando vedi «Tutto a posto: puoi confermare la revisione», premi «Conferma e vai alla firma». Compare «Revisione confermata» con «Annulla» per ripensarci.
9. Continua con [[contratti#far-firmare-il-contratto-e-caricare-la-copia-firmata]].

Se esci prima, premi «Salva e continua dopo»: la bozza resta tra i contratti della casa.

### Riprendere la bozza di un contratto
1. Apri la scheda della casa › «Contratti» e apri il contratto in bozza (stato «Bozza»).
2. Premi «Continua la compilazione»: la procedura si apre sul primo passo che non è completo.
3. Se la bozza non serve più, dal menu scegli «Elimina la bozza».

Se il contratto non è più una bozza vedi «Questo contratto non è più una bozza: non si può più modificare da qui».

### Caricare un contratto già firmato
**Ti serve:** il permesso di creare i contratti; il PDF del contratto con le firme di tutte le parti (o le foto delle pagine); il giorno in cui ha firmato l'ultima parte; se è già registrato, il numero (o protocollo) e la ricevuta di registrazione.
1. In **Immobili › casa › Contratti** premi «Nuovo contratto».
2. Scegli il tipo («Canone libero (4+4)», «Canone concordato (3+2)» o «Transitorio»).
3. Scegli «Ho già i documenti» (per il canone concordato: «Ho già il contratto e i documenti») e premi «Continua: carica i documenti».
4. Scegli la casa, poi carica il contratto firmato (PDF o foto delle pagine). Premi «Leggi il contratto». Se non hai il file scegli «Non ho il file: inserisco i dati a mano».
5. Aspetta la lettura («Stiamo leggendo il contratto…», di solito meno di un minuto). Puoi lasciare aperta la pagina o premere «Continua a mano».
6. La procedura si apre sul primo passo con qualcosa da controllare. Controlla i campi segnati «Letto dal contratto — controlla» e compila ciò che manca.
7. Nel passo **Contratto firmato** controlla il PDF (o «Usa un altro file»): deve essere il contratto completo, con tutte le firme. Scrivi il «Giorno della firma» (quello dell'ultima firma) e rispondi a «È già stato registrato?». **Attenzione: dopo il passo successivo non potrai correggere né il file né il giorno, e non potrai eliminare il contratto.** Controlla anche il tipo di contratto. Poi premi «Inserisci il contratto».
8. Leggi «Inserire il contratto firmato?» e conferma con «Inserisci il contratto».
9. Se hai risposto «Sì, è già registrato», nel passo **Dopo la firma** ti chiediamo numero e ricevuta della registrazione. Se il contratto è registrato ma non hai la ricevuta, chiedila a chi l'ha registrato (il commercialista, un CAF) o cercala tra le e-mail che ti ha mandato l'Agenzia delle Entrate. Con «No, o non lo so» CasaZen continua a ricordarti la registrazione finché non la dichiari.

Cosa succede dopo: il contratto è «Firmato», con le sue scadenze e il piano dei canoni da attivare. **Non si può più modificare né eliminare.** Se ti accorgi di un errore nel file o nella data dopo l'inserimento, non c'è un comando per correggerlo: scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»).

### Far firmare il contratto e caricare la copia firmata
**Ti serve:** il contratto con il modello approvato (altrimenti vedi solo l'anteprima BOZZA); una stampante; i documenti d'identità delle parti da controllare; una penna per le eventuali righe in bianco.
1. Nel passo **Firma** («Stampa, firma e carica») premi «Leggi l'anteprima (non valida per la firma)» se vuoi vedere il testo.
2. Premi «Scarica da firmare» e stampa il PDF. Il contratto passa a «In firma».
3. Completa a mano le righe in bianco, se ci sono, e fai firmare a mano ogni pagina da tutte le parti.
4. Premi «Carica la copia firmata», scegli il PDF firmato da tutte le parti (al massimo 20 MB) e indica la **data di stipula** (non dopo oggi).
5. Spunta la dichiarazione («Dichiaro che il file è il contratto firmato da tutte le parti…») e premi «Salva la firma».

Se devi correggere qualcosa dopo aver scaricato, premi «Annulla lo scarico per modificare»: la copia scaricata non vale più. **Se «Scarica da firmare» manca e vedi solo l'anteprima con la scritta BOZZA**, il modello di contratto non è ancora attivo: vedi «Il modello di contratto: approvato o ancora bozza» per cosa fare (usare un contratto tuo con «Ho già i documenti» oppure scrivere all'assistenza di CasaZen).

### Registrare il contratto e dichiarare la registrazione in CasaZen
**Ti serve:** il contratto firmato in PDF; un accesso ai servizi online dell'Agenzia delle Entrate (di solito SPID, CIE o CNS) oppure un intermediario abilitato, per esempio il commercialista; i soldi per imposta di registro e bollo, se non hai scelto la cedolare secca; alla fine, la ricevuta di registrazione. CasaZen non registra: precompila il modulo e ricorda la scadenza.
1. Apri il contratto e vai alla scheda **Scadenze**: trovi «Registrazione del contratto (RLI)» con la scadenza.
2. Premi «Esporta precompilazione RLI»: scarichi un PDF precompilato. **Non è un deposito.**
3. Registra il contratto sul sito dell'Agenzia delle Entrate (o tramite un intermediario abilitato). Segui «Come registrare il contratto». Se hai scelto la cedolare secca, indicala nella richiesta.
4. Quando hai la ricevuta premi «Inserisci estremi di registrazione».
5. Scrivi «Numero o protocollo di registrazione» e «Data di registrazione» (non dopo oggi), carica la «Ricevuta di registrazione (PDF, al massimo 10 MB)», spunta la dichiarazione e premi «Salva registrazione».

Cosa succede dopo: il contratto diventa «Registrato», la scadenza sparisce e il promemoria per e-mail si ferma. Se hai affidato la registrazione a un servizio (su attivazione), segui «Dati per la registrazione» e poi, a ricevuta arrivata, il contratto si aggiorna da solo. **Non dichiarare la registrazione prima di averla fatta davvero**: CasaZen non lo controlla.

### Comunicare alla Questura (inquilino extra-UE)
**Ti serve:** la data in cui hai consegnato le chiavi; il modo di invio previsto dalla Questura della tua provincia (sportello, PEC o raccomandata); poi la ricevuta, se ce l'hai. Ricorda: il termine è di 48 ore.
1. Nel passo «Segna quando hai consegnato le chiavi» (o nella scheda **Scadenze**) controlla la «Data di consegna dell'immobile». Se è diversa dall'inizio del contratto, premi «Modifica data di consegna» e salva.
2. Invia la comunicazione all'autorità locale di pubblica sicurezza, nel modo previsto dalla tua Questura (sportello, PEC, raccomandata).
3. Premi «Segna come comunicata», scegli la data di invio, carica la ricevuta (facoltativa) e conferma.

### Creare un contratto a canone concordato con il contratto guidato
Disponibile solo se il servizio è attivo (su attivazione: [[per-iniziare#cosa-significa-su-attivazione]]).

**Ti serve:** il permesso di creare i contratti; una casa con i dati; una carta per il pagamento (o una pratica omaggio); il tempo per compilare il modulo guidato.
1. In «Nuovo contratto» scegli «Canone concordato (3+2)». Alla domanda «Hai già il contratto e i documenti?» scegli «Parto da zero» e premi «Continua: scegli la casa».
2. Scegli la casa e premi «Salva la bozza e vai al contratto».
3. Nella scheda del contratto premi «Procedi con la creazione del contratto». La prima volta accetti l'informativa privacy.
4. Nella pagina «Crea il contratto» leggi il prezzo e i cinque passi e premi «Paga … e continua» (oppure «Usa la pratica omaggio e continua»). Il pagamento è con carta e sicuro.
5. Tornato in CasaZen (messaggio «Pagamento ricevuto, attivo il modulo…») si apre il modulo guidato: compilalo fino in fondo.
6. Segui lo «Stato della pratica» nella scheda del contratto.
7. Quando ricevi i documenti per e-mail, vai a [[contratti#caricare-i-documenti-della-pratica]].

Se il pagamento viene annullato vedi «Il pagamento è stato annullato»: riprova con «Riprova». Se non si apre il modulo premi «Apri il modulo».

### Caricare i documenti della pratica
1. Apri il contratto e premi «Carica i documenti» (o il pulsante dell'e-mail della pratica).
2. Conferma che il contratto è quello giusto («Conferma»), oppure scegline un altro.
3. Carica il contratto firmato con l'attestazione e, a parte, la ricevuta di registrazione (PDF fino a 20 MB).
4. CasaZen legge i file e compila i dati («Sto leggendo il contratto…»). Poi premi «Completa e importa il contratto» e controlla i dati che chiede.
5. Se hai caricato la ricevuta, dichiara la registrazione («Dichiara la registrazione»).

### Controllare il canone concordato
1. Apri il contratto › scheda **Guida** › «Il canone rispetta l'accordo del comune?» › «Controlla il canone».
2. Scrivi la «Superficie (mq)», la «Zona» o il «Foglio catastale», gli «Elementi tipo A/B/C/D», l'arredo, le pertinenze, l'aria condizionata e il riscaldamento a stufe. Servono le date di inizio e fine del contratto.
3. Premi «Calcola fascia»: vedi il canone annuo e mensile consentiti e la sub-fascia.

Per alcuni comuni CasaZen non ha i dati («Dato non disponibile per questo comune»): chiedi a un'associazione firmataria. Il risultato è una **stima**: l'attestazione la rilascia l'associazione. Vedi anche «Associazioni per l'attestazione» nella scheda Guida: CasaZen **non** invia richieste e non attesta la conformità.

### Preparare una lettera al conduttore
**Ti serve:** il permesso di creare i contratti; i dati che la lettera chiede (per esempio il motivo della disdetta); un modo per spedirla con prova di consegna (raccomandata o PEC).
1. Apri il contratto › scheda **Guida** › **Operazioni** e premi il pulsante della lettera («Prepara la disdetta», «Calcola l'aggiornamento», «Prepara il verbale», …). Le operazioni compaiono solo quando hanno senso per quel contratto.
2. Compila i dati che chiede. Per un importo scrivi per esempio 25,50.
3. Premi «Scarica la bozza»: ottieni il PDF.
4. Firma e spedisci la lettera.
5. Torna in CasaZen e premi «Segna come inviata», scegli «Il giorno dell'invio» e «Come l'hai mandata». Ricorda: così resta scritto nella cronologia, ma non cambia lo stato del contratto.

### Scegliere tra disdetta, recesso, rinnovo e termine anticipato
Quando il rapporto con il conduttore (l'inquilino) finisce, o continua, ci sono quattro azioni con nomi simili. **Registrare non avvisa nessuno**: le lettere e le comunicazioni agli enti le fai tu.
1. Trova nella tabella la riga che descrive la tua situazione.
2. Premi la voce indicata nella colonna «Cosa premi» (i passi di ogni voce sono nei compiti qui sotto).
3. Fai tu, fuori da CasaZen, ciò che c'è nella colonna «Cosa fai tu»: lettere, spedizioni e comunicazioni agli enti.

| Cosa è successo | Cosa premi | Cosa fa CasaZen | Cosa fai tu | Si annulla? |
|---|---|---|---|---|
| Il conduttore ti ha scritto che non rinnova alla scadenza | Menu della scheda › «Registra una disdetta» › «L'ha mandata il conduttore» | Fa finire il contratto alla fine del periodo in corso; avvisa se la disdetta potrebbe essere tardiva | Verifica che sia arrivata per iscritto; dopo la fine, comunichi la cessazione all'Agenzia delle Entrate | Sì, con «Togli la disdetta», finché il periodo non è finito |
| Sei tu a non voler rinnovare | **Prima** Guida › Operazioni › «Prepara la disdetta»: firmi e spedisci (raccomandata o PEC), poi «Segna come inviata». **Poi** menu › «Registra una disdetta» › «L'ho mandata io» | Scrive la lettera, calcola l'ultimo giorno utile (6 mesi prima della fine), fa finire il contratto a fine periodo | Spedisci la lettera con prova di spedizione, con il motivo di legge se è la prima scadenza; comunichi la cessazione | «Segna come inviata» resta nella cronologia; la disdetta si toglie con «Togli la disdetta» |
| Il conduttore vuole andare via prima della scadenza | Guida › Operazioni › «Registra il recesso» | Calcola il giorno in cui finisce il contratto (giorno di arrivo della lettera più il preavviso) e annulla le rate non pagate dopo quel giorno | Scarichi la presa d'atto e la mandi al conduttore; comunichi la fine del contratto all'Agenzia delle Entrate | **No**: non si può rimettere in vigore |
| Il contratto continua | Guida › Operazioni › «Registra il rinnovo» (compare dall'ultimo giorno utile per la disdetta, se non c'è una disdetta) | Sposta la fine, allunga il piano dei canoni, prepara l'accordo | Fai firmare l'accordo; comunichi la proroga all'Agenzia delle Entrate | **No**, «non si annulla da qui» |
| Vi accordate per chiudere subito | Menu › «Termina il contratto» (scrivi «TERMINA») | Chiude al giorno scelto; i canoni futuri non pagati non vengono più richiesti; la casa torna libera il giorno dopo | Comunichi la cessazione all'Agenzia delle Entrate entro 30 giorni; riconsegna e cauzione | **No** |

La comunicazione all'Agenzia delle Entrate per proroga o fine contratto **CasaZen non la invia e non te la ricorda**: segnala tu la data nel calendario. Il termine che CasaZen mostra per la cessazione è di 30 giorni; per tutto il resto (modulo, imposta, cedolare) chiedi al tuo commercialista.

### Registrare una disdetta
**Ti serve:** la data in cui la disdetta è stata spedita o ricevuta (tra l'inizio del contratto e oggi); se la disdetta è tua, la lettera già spedita con raccomandata o PEC, con almeno 6 mesi di preavviso e, alla prima scadenza, il motivo previsto dalla legge.
1. Apri il menu della scheda e scegli «Registra una disdetta».
2. Scegli «L'ho mandata io» o «L'ha mandata il conduttore» e il «Giorno in cui è stata mandata» (tra l'inizio del contratto e oggi).
3. Premi «Registra la disdetta». Se compare «La disdetta potrebbe essere arrivata troppo tardi per questa scadenza: chiedi al tuo commercialista», significa che il giorno è dopo l'ultimo utile (6 mesi prima della fine): la disdetta potrebbe non fermare il rinnovo. CasaZen la registra comunque e considera il contratto in chiusura, ma **non giudica se è valida**: senti il commercialista prima di fare altro.

Cosa succede: il contratto finisce alla fine del periodo in corso. CasaZen **registra** la disdetta, non la invia: la lettera la prepari con «Prepara la disdetta» e la spedisci tu. Si toglie con «Togli la disdetta» finché il periodo non è finito (il contratto torna a rinnovarsi da solo).

### Registrare il recesso del conduttore
**Ti serve:** la lettera del conduttore e il giorno in cui ti è arrivata; il motivo («Gravi motivi» o «Facoltà prevista dal contratto», e in questo caso il preavviso scritto nel contratto, in mesi).
1. Nella scheda **Guida** › **Operazioni** premi «Registra il recesso».
2. Scegli il giorno in cui è arrivata la lettera e «Perché recede»: «Gravi motivi» o «Facoltà prevista dal contratto» (in questo caso scrivi il preavviso del contratto in mesi).
3. Scrivi la parola «RECESSO» per confermare e premi «Registra il recesso».
4. Scarica «la presa d'atto» e mandala al conduttore.

Cosa succede: CasaZen calcola il giorno in cui il contratto finisce (giorno di arrivo della lettera più il preavviso: 6 mesi per i gravi motivi, oppure i mesi che scrivi); **non si può rimettere in vigore**; le rate non pagate dopo quel giorno sono annullate. La fine del contratto va comunicata all'Agenzia delle Entrate: CasaZen non lo fa e non te lo ricorda.

### Registrare il rinnovo
**Ti serve:** l'accordo con il conduttore: stesse condizioni per il periodo standard, oppure una data di fine concordata.
1. Nella scheda **Guida** › **Operazioni** premi «Registra il rinnovo» (compare dall'ultimo giorno utile per la disdetta, se non c'è una disdetta registrata).
2. Scegli «Rinnovo standard» (stesse condizioni, per 48 mesi nel 4+4 o 24 nel 3+2) oppure «Proroga a un giorno concordato» e scrivi l'«Ultimo giorno del contratto».
3. Premi «Registra il rinnovo».
4. Scarica l'accordo da far firmare se vuoi metterlo per iscritto.

Cosa succede: la fine del contratto si sposta davvero e il piano dei canoni si allunga; le rate già emesse non cambiano. **Non si annulla da qui.** Il rinnovo va comunicato all'Agenzia delle Entrate: CasaZen non lo fa e non te lo ricorda. Se non registri nulla, il contratto si rinnova comunque da solo alla fine del periodo (vedi «Chiudere un contratto»).

### Restituire la cauzione
**Ti serve:** il contratto in fase di fine (disdetta registrata o contratto terminato in anticipo, oppure transitorio) e con un deposito; il verbale di riconsegna (lo prepari con «Prepara il verbale»); il tasso di interesse legale di ogni anno in cui hai tenuto il deposito (lo fissa ogni anno il Ministero dell'Economia e delle Finanze: cerca «tasso di interesse legale» e l'anno; CasaZen non lo conosce e usa quello che scrivi tu); l'elenco delle somme che vuoi trattenere, con i motivi documentati; l'IBAN del conduttore per il bonifico (che fai tu, fuori da CasaZen).
1. Quando il contratto sta finendo, nella scheda **Guida** › **Operazioni** premi «Prepara il prospetto». Se non vedi il pulsante, il contratto non è ancora in fase di fine o non ha un deposito.
2. Controlla «Deposito versato il» e scegli «Restituito il».
3. Per ogni anno scrivi il «Tasso legale [anno] (%)». Aggiungi gli «Interessi già pagati (€)» se ce ne sono.
4. Se vuoi trattenere somme premi «Aggiungi una trattenuta», scrivi importo e motivo (le trattenute devono essere documentate: fino a 20 voci, ciascuna con il suo motivo).
5. Leggi «Da restituire …» e premi «Scarica il prospetto» per darlo al conduttore.
6. Quando hai restituito il denaro premi «Registra la restituzione» e conferma («Sì, registra»).

CasaZen calcola gli interessi anno per anno (deposito × tasso dell'anno × giorni di quell'anno in cui hai tenuto il deposito ÷ giorni dell'anno): i giorni si contano dal giorno del versamento al giorno prima della restituzione. Se le trattenute superano deposito e interessi, il prospetto non si calcola. «Registra la restituzione» scrive solo nella cronologia del contratto che hai restituito quell'importo in quel giorno: **CasaZen non muove denaro e non cambia il deposito**, e il bonifico lo fai tu. Controlla importo e giorno prima di confermare. La restituzione si registra dal giorno della restituzione.

### Terminare un contratto in anticipo
**Ti serve:** l'accordo con il conduttore sul giorno in cui finisce il contratto; il permesso di creare i contratti.
1. Apri il menu della scheda e scegli «Termina il contratto».
2. Scegli l'«Ultimo giorno del contratto».
3. Leggi le conseguenze (non si annulla, i canoni futuri non vengono più richiesti, la casa torna libera, va fatta la comunicazione all'Agenzia delle Entrate).
4. Scrivi «TERMINA» e premi «Termina il contratto».

### Eliminare la bozza di un contratto
1. Apri la bozza e dal menu scegli «Elimina la bozza».
2. Leggi cosa viene cancellato e premi «Elimina la bozza».
3. Hai pochi secondi per annullare con «Annulla».

### Chiedere la cancellazione dei dati di un contratto
1. Dal menu della scheda scegli «Chiedi la cancellazione dei dati».
2. Leggi le conseguenze e premi «Chiedi la cancellazione».

Vedi anche la cancellazione dalla scheda dell'inquilino in [[canoni-scadenze#esportare-o-cancellare-i-dati-di-un-inquilino]].

## Flussi completi

### Flusso: contratto nuovo, dalla bozza al canone incassato
1. Prepari la casa con APE e dati catastali ([[affitti-lunghi#aggiungere-un-immobile-in-affitto-lungo]]).
2. Crei il contratto e lo confermi in revisione ([[contratti#creare-un-contratto-con-casazen]]).
3. Lo scarichi, lo fai firmare e carichi la copia firmata ([[contratti#far-firmare-il-contratto-e-caricare-la-copia-firmata]]).
4. Registri il contratto entro 30 giorni ([[contratti#registrare-il-contratto-e-dichiarare-la-registrazione-in-casazen]]) e, se il conduttore è extra-UE, comunichi alla Questura entro 48 ore dalla consegna delle chiavi.
5. Attivi il piano dei canoni ([[canoni-scadenze#attivare-il-piano-dei-canoni]]): CasaZen segue chi paga e ti avvisa dei ritardi.
6. Il conduttore entra nella sua area e paga le scadenze ([[area-inquilino]]).

### Flusso: contratto già firmato
1. «Nuovo contratto» › «Ho già i documenti» › carichi il PDF.
2. CasaZen legge e compila i dati; tu controlli i campi segnati.
3. Nel passo «Contratto firmato» indichi il giorno della firma e se è già registrato.
4. Se non è registrato, registri entro la scadenza mostrata e dichiari la registrazione.
5. Attivi il piano dei canoni.

### Flusso: fine del contratto
1. A sei mesi dalla fine (canone libero e concordato) compare l'ultimo giorno per la disdetta in [[canoni-scadenze#controllare-le-scadenze]] e ti arriva un promemoria per e-mail.
2. Decidi con la tabella di [[contratti#scegliere-tra-disdetta-recesso-rinnovo-e-termine-anticipato]]: registri una disdetta ([[contratti#registrare-una-disdetta]]) oppure rinnovi ([[contratti#registrare-il-rinnovo]]). Se il conduttore recede, [[contratti#registrare-il-recesso-del-conduttore]].
3. Concordi la riconsegna: prepari il verbale.
4. Restituisci la cauzione ([[contratti#restituire-la-cauzione]]).
5. Comunichi la cessazione all'Agenzia delle Entrate (CasaZen non lo fa e non te lo ricorda).
6. Se vuoi, passi la casa ad affitto breve ([[affitti-lunghi#passare-un-immobile-da-affitto-lungo-ad-affitto-breve]]).

## Regole e limiti
- Il **deposito cauzionale** è al massimo di **3 mensilità** di canone.
- **Registrazione**: 30 giorni dalla firma di tutte le parti o dall'inizio del contratto, se anteriore. Il contratto non è «Registrato» finché la registrazione non è dichiarata; CasaZen non verifica che sia vera. La registrazione e il pagamento delle imposte sono a tuo carico.
- **Disdetta**: almeno 6 mesi prima della fine (canone libero e concordato); alla prima scadenza serve un motivo previsto dalla legge, scritto nella lettera. CasaZen non giudica se una disdetta è valida: la registra e ti ricorda le date.
- **Rinnovo**: 48 mesi (canone libero) o 24 (canone concordato). Il transitorio non si rinnova.
- **Questura**: comunicazione entro 48 ore dalla consegna, se un conduttore non è cittadino UE. CasaZen non la invia.
- **Comunicazioni all'Agenzia delle Entrate** di proroga o cessazione: a tuo carico; CasaZen non le invia e non le ricorda.
- **Cedolare secca sugli affitti lunghi**: non con una società come conduttore; sospende gli aggiornamenti del canone.
- **Un contratto firmato non si modifica né si elimina.** Si chiude con disdetta, recesso o termine anticipato; gli errori nel file o nella data di firma non si correggono dopo l'inserimento.
- **Un solo contratto per periodo**: i contratti sulla stessa casa non si sovrappongono.
- Tutte le **lettere sono bozze**: CasaZen non le spedisce e non scrive mai al conduttore; il PDF può portare la scritta BOZZA finché il testo non è approvato.
- Il **modello di contratto** lo approva CasaZen: finché non è approvato non si scarica il contratto da firmare.
- **Promemoria per e-mail**: registrazione, Questura e ultimo giorno per la disdetta, solo ai locatori con un indirizzo e-mail; mai al conduttore.
- Chi può farlo: leggere i contratti serve il permesso di lettura dei contratti; creare, modificare, firmare, registrare, preparare lettere e chiudere serve poter creare i contratti.

## Domande frequenti

### Posso modificare un contratto già firmato?
No. Un contratto «Firmato» non si modifica e non si elimina. Per chiuderlo usa la disdetta, il recesso o «Termina il contratto».

### Perché non posso scaricare il contratto da firmare?
Per uno di questi motivi: il modello di contratto non è ancora approvato da CasaZen (vedi solo l'anteprima con la scritta BOZZA e il messaggio «Il modello di contratto è in approvazione…»); mancano dati richiesti dal modello (apri l'anteprima e guarda cosa è segnato «DATO MANCANTE»); oppure il contratto non è disponibile in quel momento. Nel primo caso da qui non puoi farlo firmare: usa un contratto tuo con «Ho già i documenti» o scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»).

### CasaZen registra il contratto al posto mio?
Di norma no: lo registri tu sul canale ufficiale (sul sito dell'Agenzia delle Entrate o con un intermediario) e dichiari la registrazione con la ricevuta. CasaZen non è un intermediario abilitato. Su attivazione puoi affidare la registrazione a un servizio; per il contratto guidato la esegue il servizio che ha preparato il contratto.

### Ho dichiarato «Registrato» ma non ho la ricevuta: che succede?
CasaZen non controlla la ricevuta: il contratto risulta registrato e i promemoria si fermano. Se il contratto non è davvero registrato, nessuno te lo ricorda più. Se non hai la ricevuta, chiedila a chi ha registrato (commercialista, CAF) o cercala nelle e-mail dell'Agenzia delle Entrate.

### Cosa succede se non registro il contratto in tempo?
CasaZen ti manda un promemoria per e-mail (se hai indicato il tuo indirizzo e-mail di locatore) e mostra la scadenza come superata. Le conseguenze di legge dipendono dalla tua situazione: chiedi al commercialista.

### Devo registrare anche con la cedolare secca?
Sì: con la cedolare secca non si pagano imposta di registro e bollo, ma il contratto va comunque registrato entro il termine.

### CasaZen manda le lettere al conduttore?
No. CasaZen scrive la bozza, tu la firmi e la spedisci; poi segni l'invio.

### L'inquilino mi ha dato la disdetta: cosa faccio?
Apri il menu del contratto e scegli «Registra una disdetta» › «L'ha mandata il conduttore», con il giorno in cui l'hai ricevuta. Il contratto finirà alla fine del periodo in corso. Poi preparati a riconsegnare la casa e a restituire la cauzione ([[contratti#restituire-la-cauzione]]) e ricorda la comunicazione all'Agenzia delle Entrate: CasaZen non la fa.

### Devo restituire la cauzione all'inquilino: come faccio?
Quando il contratto sta finendo (disdetta registrata o contratto terminato), nella scheda Guida › Operazioni premi «Prepara il prospetto»: scrivi il tasso di interesse legale di ogni anno e le eventuali trattenute documentate, poi il bonifico lo fai tu e premi «Registra la restituzione». Vedi [[contratti#restituire-la-cauzione]].

### Che differenza c'è tra disdetta, recesso e «Termina il contratto»?
Disdetta: dici che non rinnovi alla scadenza e il contratto finisce a fine periodo (si può togliere). Recesso: il conduttore se ne va prima della scadenza, con il preavviso (non si rimette in vigore). «Termina il contratto»: lo chiudi subito di comune accordo, a un giorno che scegli (non si annulla). Vedi la tabella in [[contratti#scegliere-tra-disdetta-recesso-rinnovo-e-termine-anticipato]].

### Cosa serve per una disdetta valida?
Dipende dal tipo di contratto e dal periodo: alla prima scadenza serve uno dei motivi previsti dalla legge, scritto nella lettera, con almeno 6 mesi di preavviso. CasaZen prepara la lettera e ti dice entro quando spedirla, ma non giudica la validità.

### Posso fare un contratto per più locatori o più conduttori?
Sì: nel passo «Parti» usi «Aggiungi un altro locatore» e «Aggiungi un altro conduttore».

### Il canone concordato può essere fatto in CasaZen?
Puoi caricare un contratto concordato già firmato oppure, su attivazione, usare il contratto guidato. CasaZen non prepara direttamente il testo del concordato con la sua procedura.

### Ho sbagliato il file o il giorno della firma di un contratto già firmato: come correggo?
Non si può correggere dopo «Inserisci il contratto», e il contratto non si elimina. Scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»). Per evitarlo, controlla file, giorno e tipo prima di confermare.

## Glossario
- **Locatore**: chi affitta la casa. **Conduttore**: chi la prende in affitto. **Inquilino**: lo stesso del conduttore (nei menu e nei contratti CasaZen scrive «conduttore»).
- **Bozza**: il contratto in compilazione, salvato da solo.
- **Canone libero (4+4)**: contratto con condizioni decise tra le parti, 4 anni più altri 4. **Canone concordato (3+2)**: canone dentro le fasce dell'accordo del comune, 3 anni più 2. **Transitorio**: contratto da 1 a 18 mesi per un'esigenza precisa e temporanea, che finisce da solo.
- **Stipula**: il giorno in cui ha firmato l'ultima parte.
- **Registrazione del contratto**: la comunicazione del contratto all'Agenzia delle Entrate, entro 30 giorni, con il pagamento delle imposte dovute. È un obbligo di legge a tuo carico: CasaZen non registra.
- **RLI**: il modello dell'Agenzia delle Entrate per chiedere la registrazione di un contratto di locazione.
- **Intermediario abilitato**: chi può registrare il contratto per tuo conto, per esempio un commercialista.
- **Imposta di registro e bollo**: le imposte della registrazione; con la cedolare secca non si pagano.
- **Cedolare secca sugli affitti lunghi**: imposta sostitutiva sul canone (al posto dell'imposta sul reddito, del registro e del bollo); non ammessa con una società come conduttore; sospende l'aggiornamento ISTAT. Per gli affitti brevi vedi [[fisco-documenti]].
- **Aggiornamento ISTAT (affitti lunghi)**: l'aumento del canone, se il contratto lo prevede, in base alla variazione dell'indice FOI; CasaZen lo calcola ma non lo applica mai da solo.
- **FOI**: l'indice dei prezzi al consumo usato per aggiornare il canone con l'ISTAT; lo scrivi tu.
- **Attestazione di rispondenza**: documento, rilasciato dalle organizzazioni dell'accordo del comune, che dice che il canone rispetta l'accordo e dà diritto alle agevolazioni del canone concordato.
- **Disdetta**: la comunicazione che ferma il rinnovo del contratto.
- **Recesso**: la scelta del conduttore di lasciare il contratto prima della scadenza.
- **Comunicazione alla Questura**: l'avviso scritto all'autorità di pubblica sicurezza quando affitti a un cittadino non UE, entro 48 ore dalla consegna delle chiavi (molti la chiamano «cessione di fabbricato»); CasaZen non la invia.
- **PEC**: posta elettronica certificata, con valore di raccomandata.
- **Deposito cauzionale** (o **cauzione**): somma lasciata dal conduttore a garanzia, restituita a fine contratto con gli interessi legali meno le trattenute documentate.
- **Tasso di interesse legale**: la percentuale annua che fissa ogni anno il Ministero dell'Economia e delle Finanze; la scrivi tu nel prospetto della cauzione.

## Vedi anche
- [[affitti-lunghi]]: immobili, panoramica, report fiscale.
- [[canoni-scadenze]]: canoni, incassi, scadenze e inquilini.
- [[area-inquilino]]: cosa vede il conduttore e come entra.
- [[fisco-documenti]]: documenti fiscali e cedolare degli affitti brevi.
