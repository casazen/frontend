---
id: contratti
titolo: Contratti di locazione
sezione: Affitti lunghi
ordine: 61
riassunto: Come creare un contratto in CasaZen o caricarne uno già firmato, farlo firmare e registrarlo, preparare le lettere (disdetta, recesso, rinnovo, ISTAT, cauzione) e chiudere il contratto.
chi: [gestore, amministratore]
dove: Affitti lunghi › Immobili › scheda della casa › Contratti
parole_chiave: [contratto, locazione, bozza, canone libero, canone concordato, transitorio, cedolare secca, firma, registrazione, RLI, Questura, disdetta, recesso, rinnovo, ISTAT, cauzione, riconsegna, contratto già firmato, contratto guidato, pratica di registrazione, sovrapposizione]
copre: [/app/long-rent/leases, /app/long-rent/leases/new, /app/long-rent/leases/:id, /app/long-rent/leases/:id/edit, /app/long-rent/documents/upload, /app/long-rent/leases/:id/guided-contract, /app/long-rent/leases/:id/concordatofacile]
stato: disponibile
fonte_codice: [frontend/src/features/leases/lease-create-page.tsx, frontend/src/features/leases/lease-wizard-page.tsx, frontend/src/features/leases/wizard/lease-wizard.tsx, frontend/src/features/leases/wizard/wizard-model.ts, frontend/src/features/leases/wizard/import-step.tsx, frontend/src/features/leases/wizard/signing-step.tsx, frontend/src/features/leases/wizard/after-signature-step.tsx, frontend/src/features/leases/components/start-way-choice.tsx, frontend/src/features/leases/lease-detail-page.tsx, frontend/src/features/leases/lease-documents-upload-page.tsx, frontend/src/features/leases/components/lease-signing-panel.tsx, frontend/src/features/leases/components/registration-status-panel.tsx, frontend/src/features/leases/components/questura-communication-panel.tsx, frontend/src/features/leases/operations, frontend/src/features/leases/lifecycle, frontend/src/features/leases/guide, frontend/src/features/leases/legacy-leases-redirect.tsx, frontend/src/pages/long-rent/leases/concordatofacile-offer-page.tsx, frontend/src/pages/long-rent/leases/guided-contract-redirect.tsx, backend/Casazen.Core/Leases/LongRentRules.cs, backend/Casazen.Core/Leases/LeaseContractTerms.cs, backend/Casazen.Core/Leases/LeaseOperationRules.cs, backend/Casazen.Core/Leases/LongRentDeadlineRules.cs, backend/Casazen.Infrastructure/Services/LeaseLetters/LeaseLetterCatalog.cs, backend/Casazen.Web/Controllers/LeaseMaintenanceRequestsController.cs]
---

## In breve
In CasaZen un contratto di locazione nasce da una **bozza** che si salva da sola passo dopo passo: casa, parti, condizioni, date, revisione, firma. Se il contratto è già firmato lo carichi e CasaZen legge il file e compila i dati. Dopo la firma ti seguono la **registrazione** (scadenza di 30 giorni), l'eventuale comunicazione alla Questura, i canoni e le lettere per disdetta, rinnovo, recesso e cauzione. **CasaZen prepara le lettere ma non le invia mai al conduttore**: le firmi e le spedisci tu.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Creare un contratto con CasaZen | Procedura guidata a passi, con bozza salvata in automatico (canone libero e transitorio) | Immobili › casa › Contratti › «Nuovo contratto» | chi può creare i contratti | Disponibile | Creare un contratto con CasaZen |
| Caricare un contratto già firmato | CasaZen legge il file, compila i dati e ti chiede solo ciò che manca | «Nuovo contratto» › «Ho già i documenti» | chi può creare i contratti | Disponibile | Caricare un contratto già firmato |
| Contratto guidato per il canone concordato | Pratica con modulo guidato: il contratto viene preparato per te e poi lo carichi | «Nuovo contratto» › «Canone concordato (3+2)» › «Parto da zero» | chi può creare i contratti | Su attivazione | Creare un contratto a canone concordato con il contratto guidato |
| Riprendere una bozza | Riapre la procedura dal punto in cui eri, anche da un altro dispositivo | Scheda del contratto › «Continua la compilazione» | chi può creare i contratti | Disponibile | Riprendere una bozza |
| Firma su carta | Scarichi il contratto, lo fai firmare a mano e carichi la copia firmata | Passo «Firma», o scheda del contratto › Documenti | chi può creare i contratti | Disponibile | Far firmare il contratto e caricare la copia firmata |
| Firma elettronica | Un link personale per ogni parte | Scheda del contratto › Documenti | chi può creare i contratti | Su attivazione | Far firmare il contratto e caricare la copia firmata |
| Registrazione del contratto | Scadenza, checklist, precompilazione e dichiarazione degli estremi | Scheda del contratto › Scadenze | chi può creare i contratti | Disponibile | Registrare il contratto |
| Registrazione affidata a un servizio | I dati vengono inviati in automatico per la registrazione, a pagamento | Scheda del contratto › «Dati per la registrazione» | chi può creare i contratti | Su attivazione | Registrare il contratto |
| Comunicazione alla Questura | Promemoria e dichiarazione per conduttore extra-UE | Scheda del contratto › Scadenze | chi può creare i contratti | Disponibile | Comunicare alla Questura (inquilino extra-UE) |
| Lettere e operazioni | Bozze di disdetta, presa d'atto del recesso, rinnovo, conferma esigenza, ISTAT, cedolare, riconsegna, cauzione | Scheda del contratto › Guida › Operazioni | chi può creare i contratti | Disponibile | Preparare una lettera al conduttore |
| Controllo del canone concordato | Calcola la fascia consentita dall'accordo del comune | Scheda del contratto › Guida › «Controlla il canone» | chi può leggere i contratti | Disponibile (dati solo per alcuni comuni) | Controllare il canone concordato |
| Disdetta, termine anticipato, eliminazione bozza | Azioni sulla vita del contratto | Scheda del contratto › menu | chi può creare i contratti | Disponibile | Terminare un contratto in anticipo |
| Cancellazione dei dati | Anonimizza i dati delle persone di un contratto | Scheda del contratto › menu | chi può creare i contratti | Disponibile | Chiedere la cancellazione dei dati di un contratto |

## Come funziona

### I tipi di contratto
| Tipo | Prima durata | Se nessuno disdice | Disdetta |
|---|---|---|---|
| Canone libero (4+4) | 4 anni (48 mesi) | si rinnova da solo per altri 4 anni | scritta, almeno 6 mesi prima della fine; alla prima scadenza serve uno dei motivi previsti dalla legge |
| Canone concordato (3+2) | 3 anni (36 mesi) | si proroga per altri 2 anni (24 mesi) | come sopra |
| Transitorio | da 1 a 18 mesi | finisce da solo, non si rinnova | non serve; serve invece l'esigenza scritta nel contratto |

Il «Contratto per studenti» compare ma non è ancora disponibile.

### Cosa si può fare in CasaZen e cosa no
- **Contratto fatto in CasaZen**: oggi è possibile per il **canone libero** e per il **transitorio**. Se il modello di contratto non c'è, la scelta «Lo preparo con CasaZen» resta chiusa e ti dice di caricare il tuo contratto.
- **Canone concordato**: puoi caricare un contratto già firmato oppure, **su attivazione**, usare il contratto guidato.
- **Contratto già firmato**: vale per tutti e tre i tipi. CasaZen lo legge, lo tiene con le sue scadenze e non ne controlla la fascia di canone.
- Se il **modello di contratto di CasaZen non è ancora approvato** nel tuo ambiente, vedi solo l'anteprima con la scritta BOZZA: non puoi scaricare il contratto da firmare finché il modello non è approvato.

### La bozza e il salvataggio automatico
Tutto quello che scrivi si salva da solo («Salvato alle 10:42»): la bozza è sul tuo account, non sul dispositivo. Puoi uscire con «Salva e continua dopo» e riprendere da un altro dispositivo. Se la stessa bozza viene salvata da due schede, CasaZen ti avvisa («Questo contratto è stato modificato in un'altra scheda») e ti fa ricaricare la versione più recente: quello che hai scritto nell'altra scheda dopo l'ultimo salvataggio non è salvato.

### I passi di un contratto fatto in CasaZen
1. **Immobile**: scegli la casa. Servono APE e dati catastali (vedi [[affitti-lunghi#completare-ape-e-dati-catastali]]). Se la casa è in affitto breve puoi preparare il contratto, ma per usarlo deve passare in affitto lungo.
2. **Parti**: chi affitta (locatore) e chi prende in affitto (conduttore). Per ognuno nome, cognome, codice fiscale o partita IVA (16 caratteri per una persona, 11 cifre per una società), residenza o sede, e-mail, telefono. Per il conduttore anche la cittadinanza. Puoi aggiungere più locatori e più conduttori.
3. **Condizioni**: regime fiscale, canone mensile e deposito cauzionale (al massimo 3 mensilità; scrivi 0 se non c'è). Per il transitorio anche l'esigenza che giustifica il contratto. Facoltativo: spese condominiali.
4. **Date**: data di inizio e, per il transitorio, ultimo giorno. CasaZen ti mostra «In parole semplici» durata, rinnovo, ultimo giorno per la disdetta e scadenza di registrazione.
5. **Revisione**: ricontrolli tutto; CasaZen segnala cosa non va.
6. **Firma**: scarichi, fai firmare e carichi la copia firmata.
7. **Dopo la firma**: registrazione, Questura, piano dei canoni.

Il pulsante principale dice sempre cosa fa («Salva e vai alle parti», «Salva e vai alle condizioni», «Salva e vai al controllo», «Conferma e vai alla firma»). Se manca qualcosa, la riga sotto i campi dice «Manca: …» e il link «Vai al campo» ti porta nel posto giusto.

### Regime fiscale: cedolare secca o ordinario
- **Cedolare secca**: imposta fissa sul canone, al posto dell'imposta sul reddito, dell'imposta di registro e del bollo. **Con una società come conduttore non è ammessa** (un conduttore con codice di 11 cifre è una società): scegli il regime ordinario. Con la cedolare secca il canone **non si aggiorna** (niente ISTAT) per tutta la durata dell'opzione.
- **Ordinario**: il canone si somma al tuo reddito e si paga l'imposta di registro.
- Nella scheda «Guida» del contratto trovi una stima di imposta di registro e cedolare per il tuo caso, con le avvertenze («Da sapere»). È una stima: per scegliere il regime chiedi al tuo commercialista.

### Il contratto transitorio
Il transitorio si può fare solo per un'esigenza precisa e temporanea. Nel passo «Condizioni» indichi:
- **Chi ha l'esigenza**: il locatore o il conduttore;
- **Quale esigenza**, in poche parole (una di quelle previste dall'accordo territoriale del comune: per esempio lavoro o studio per un periodo limitato);
- se il contratto dura più di **30 giorni**, la **documentazione che alleghi** per provarla (per esempio una lettera di assunzione).

Nei comuni con più di 10.000 abitanti il canone di un transitorio deve rientrare nelle fasce dell'accordo territoriale: CasaZen te lo ricorda nella revisione. Alla scadenza il transitorio finisce da solo.

### Caricare un contratto già firmato
Se il contratto esiste già, lo carichi e CasaZen **lo legge e compila i dati**, chiedendoti solo ciò che non riesce a leggere. Puoi caricare un PDF o le foto delle pagine. Se il file contiene anche l'attestazione e la scheda di calcolo (canone concordato), le riconosce da solo («Nel file abbiamo riconosciuto: contratto, attestazione, scheda di calcolo»).
- I dati letti sono segnati: «Letto dal contratto — controlla» e «Calcolato dal contratto — controlla». Se il contratto dice una cosa diversa da quella che hai scritto, vedi «Il contratto riporta un valore diverso da quello inserito: controlla».
- CasaZen segnala cosa non torna sotto «Da controllare» (per esempio un codice fiscale non valido, un canone concordato più corto di tre anni, un'attestazione che dice che il canone NON rispetta l'accordo).
- Se la lettura non riesce (foto illeggibile, nessun testo, file troppo lungo, servizio non disponibile) ti viene detto e inserisci i dati a mano: il contratto resta caricato e lo userai alla fine.
- Il file resta nel tuo spazio.

I passi sono gli stessi (Immobile, Parti, Condizioni, Date) ma al posto di «Revisione» e «Firma» c'è un solo passo **Contratto firmato**: il PDF con le firme di tutte le parti, il **giorno della firma** (quello in cui ha firmato l'ultima parte, non dopo oggi) e la domanda «È già stato registrato?». Con «Sì» ti chiediamo numero di registrazione e ricevuta dopo l'inserimento; con «No, o non lo so» il contratto resta «Firmato», appare la scadenza di registrazione e, finché non dichiari la registrazione, **CasaZen ti manda un promemoria per e-mail** (se hai indicato un indirizzo). Per un contratto già firmato APE e dati catastali mancanti sono solo avvisi.

> **Attenzione:** confermando «Inserisci il contratto» il contratto passa a «Firmato» e **da quel momento non si può più modificare né eliminare**. Il file e il giorno della firma non si possono correggere dopo l'inserimento.

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
- **Su attivazione**, se è attiva la firma elettronica, puoi premere «Invia per firma elettronica»: ogni parte riceve un link personale (valido fino a una data indicata) che condividi con la parte; il contratto risulta firmato solo quando tutte le parti hanno firmato.

### Registrazione
Il contratto va registrato all'**Agenzia delle Entrate** (modello RLI) **entro 30 giorni dalla firma di tutte le parti o dall'inizio del contratto, se anteriore**. CasaZen calcola la scadenza e la mostra («Scadenza per la registrazione: …»). Se manca la data di firma la scadenza è «Da determinare» finché non la dichiari.

Ci sono tre modi, a seconda del contratto:
1. **Da te, sul canale ufficiale** (sempre disponibile): scarichi la precompilazione RLI, registri il contratto sul sito dell'Agenzia delle Entrate o tramite un intermediario abilitato, poi inserisci qui gli estremi e la ricevuta. **CasaZen non è un intermediario abilitato e non trasmette la RLI per tuo conto.**
2. **Affidata a un servizio** (su attivazione): premi «Dati per la registrazione», controlli i dati precompilati, aggiungi ciò che manca (anche i documenti di identità, che servono per la registrazione e vengono inviati con il contratto), paghi il costo del servizio (lo vedi prima di pagare; imposte di registro e bollo, se dovute, sono escluse) e confermi la delega con «Autorizza e invia». Finché la ricevuta non arriva il contratto resta «Registrazione in corso», **non registrato**. Se fallisce vedi il motivo e puoi riprovare o registrare tu.
3. **Contratto guidato**: se hai fatto il contratto con la pratica guidata, la registrazione la esegue il servizio che ha preparato il contratto: quando ricevi la ricevuta la carichi nei Documenti e dichiari la registrazione.

Con la cedolare secca non si pagano imposta di registro e bollo, ma il contratto va comunque registrato. Dopo la registrazione la scadenza sparisce e i promemoria si fermano. **Una registrazione dichiarata dal locatore non è verificata da CasaZen:** controlla tu la ricevuta.

### Comunicazione alla Questura
Se un conduttore **non è cittadino dell'Unione europea** (la cittadinanza si chiede nel passo «Parti»), il locatore deve comunicare per iscritto all'autorità locale di pubblica sicurezza di aver ceduto l'immobile, **entro 48 ore dalla consegna delle chiavi**. È un obbligo diverso dalla registrazione: la registrazione non lo sostituisce. **CasaZen non invia la comunicazione**: ti mostra il termine, ti rimanda alle informazioni della Polizia di Stato, e tu premi «Segna come comunicata» con la data e (facoltativa) la ricevuta. La data di consegna è per impostazione la data di inizio: se hai consegnato un altro giorno la cambi con «Modifica data di consegna». L'ufficio competente e il modo di invio cambiano da provincia a provincia.

### Lettere e operazioni
Nella scheda **Guida** del contratto, sezione **Operazioni**, CasaZen prepara le lettere che servono nella vita del contratto. In ogni caso:
- **è una bozza**: la firmi e la spedisci tu (raccomandata, PEC, a mano); CasaZen non la invia e non scrive al conduttore;
- se il testo della lettera non è ancora approvato, il PDF porta la scritta **BOZZA**: fallo rivedere prima di mandarlo;
- dopo averla spedita premi «Segna come inviata» e scegli il giorno e «Come l'hai mandata» («Raccomandata», «PEC», «Consegna a mano», «Altro mezzo»): resta nella cronologia. Non allega la ricevuta di spedizione: conservala tu.

| Lettera | Quando compare | Cosa ti chiede | Cosa fa CasaZen |
|---|---|---|---|
| **Disdetta** («Prepara la disdetta») | contratto in vigore che si rinnova (non il transitorio), senza disdetta del conduttore | alla prima scadenza il **motivo** previsto dalla legge (uso proprio, vendita, ristrutturazione…), poi nessun motivo | scrive la lettera; ti dice entro quando va spedita (6 mesi prima della fine) |
| **Presa d'atto del recesso** | contratto in vigore e iniziato | giorno in cui è arrivata la lettera del conduttore e perché recede | calcola il giorno in cui finisce il contratto |
| **Rinnovo** («Registra il rinnovo») | nell'ultimo tratto: dall'ultimo giorno utile per la disdetta, se non c'è una disdetta | «Rinnovo standard» o «Proroga a un giorno concordato» | sposta la fine e allunga il piano dei canoni; ti prepara l'accordo da far firmare |
| **Conferma dell'esigenza** | solo contratto transitorio, se l'esigenza è del locatore | nulla | scrive la lettera da mandare prima della scadenza |
| **Aggiornamento ISTAT** («Calcola l'aggiornamento») | contratto in vigore **non** sotto cedolare secca | la variazione dell'indice FOI (%) e la quota riconosciuta dal tuo contratto | calcola il nuovo canone e scrive la richiesta |
| **Opzione cedolare** («Prepara la comunicazione») | contratto in vigore sotto cedolare secca | il giorno da cui vale (facoltativo) | scrive la comunicazione di scelta e di rinuncia agli aggiornamenti |
| **Riconsegna** («Prepara il verbale») | contratto in fase di fine (disdetta registrata, terminato in anticipo, o tipo che non si rinnova) | il giorno della riconsegna (facoltativo) | prepara il verbale da compilare e firmare insieme al conduttore |
| **Restituzione cauzione** («Prepara il prospetto») | contratto in fase di fine e con un deposito | tasso legale di ogni anno, interessi già pagati, trattenute | calcola gli interessi e quanto restituire; prepara il prospetto |

Nota: «Aggiornamento ISTAT»: il tasso FOI lo scrivi tu (CasaZen non lo cerca) e **CasaZen non cambia da solo il canone nel piano dei pagamenti**: le rate già emesse restano come sono. «Opzione cedolare»: se il tuo contratto lo scrive già (come il modello di CasaZen), la lettera non serve. «Restituzione cauzione»: puoi trattenere solo ciò che documenti (canoni o spese non pagati, danni oltre il normale uso), fino a 20 voci, ciascuna con il suo motivo; il denaro lo restituisci tu, CasaZen **non muove denaro** e non cambia il deposito.

### Chiudere un contratto
Dal menu della scheda:
- **Elimina la bozza**: per le bozze in compilazione o in revisione; cancella persone, date e canone e **non si recupera**. Hai pochi secondi per cambiare idea con «Annulla».
- **Annulla lo scarico per la firma**: per un contratto scaricato per la firma su carta, lo riporta in revisione.
- **Registra una disdetta**: registra (non invia) una disdetta mandata da te o dal conduttore; il contratto finisce alla fine del periodo in corso. Si toglie con **Togli la disdetta** finché il periodo non è finito.
- **Termina il contratto**: lo chiude in anticipo, a un giorno che scegli (anche passato). Si conferma scrivendo la parola «TERMINA». **Non si può annullare.** I canoni futuri non ancora pagati non vengono più richiesti; la casa torna libera dal giorno dopo; **la cessazione di un contratto registrato va comunicata all'Agenzia delle Entrate** (con la cedolare secca la relativa imposta fissa non è dovuta). Un contratto non ancora iniziato non si termina così: serve la risoluzione consensuale, da comunicare all'Agenzia delle Entrate.
- **Passa ad affitto breve**: solo per un contratto in scadenza; vedi [[affitti-lunghi#passare-un-immobile-da-affitto-lungo-ad-affitto-breve]].
- **Chiedi la cancellazione dei dati**: vedi sotto.

Un contratto **firmato non si modifica e non si elimina**: si chiude con disdetta, recesso o «Termina il contratto».

### Sovrapposizioni
Due contratti sulla stessa casa non possono coprire gli stessi giorni. Se le date che inserisci si sovrappongono a un contratto esistente, CasaZen te lo dice («Per questo immobile c'è già un contratto dal … al …») e puoi aprirlo con «Apri il contratto esistente» o cambiare le date. Una casa che ha già un soggiorno o una prenotazione di affitto breve nello stesso periodo si risolve col passaggio di modalità ([[affitti-lunghi#passare-un-immobile-da-affitto-breve-ad-affitto-lungo]]).

### Contratto guidato per il canone concordato (su attivazione)
Per il canone concordato puoi scegliere «Parto da zero»: attivi un servizio, compili un modulo guidato e **il contratto viene preparato per te**. Resti sempre dentro CasaZen; i dati del modulo e i documenti si ritrovano nella scheda del contratto. È **su attivazione**: finché non è attivo vedi «Disponibile a breve».

Il percorso è in cinque passi (come lo mostra la pagina «Crea il contratto»): paghi (al momento € 119,00 IVA compresa; registro e bollo, se dovuti, sono esclusi) o usi la «pratica omaggio» se ne hai una; compili il modulo guidato; il contratto viene preparato; lo ricevi per e-mail, pronto da firmare; lo carichi in CasaZen e CasaZen lo legge e compila i dati. Nella scheda del contratto vedi lo **«Stato della pratica»** («In lavorazione», «In attesa dell'utente», «Bozza inviata», «Inviato all'associazione», «Attestato», «Firmato ricevuto», «Registrato», «Sospeso», «Chiuso senza attestazione»). Se la pratica è «In attesa dell'utente» o «Sospesa» ti hanno scritto per e-mail per chiederti dati o documenti: controlla la posta, anche lo spam. Il modulo si apre in una pagina dedicata: se lo interrompi, riprende solo dallo stesso dispositivo e browser.

Alla fine carichi i documenti (contratto firmato con attestazione, ricevuta di registrazione) con «Carica i documenti» e poi «Completa e importa il contratto»: la bozza diventa un contratto firmato, con lo stesso riferimento. La registrazione la esegue il servizio che ha preparato il contratto: quando hai la ricevuta la carichi e premi «Dichiara la registrazione».

### Dati personali di un contratto
Con «Chiedi la cancellazione dei dati» registri la richiesta di cancellare i dati delle persone del contratto. Se il contratto è finito i dati sono **anonimizzati subito**; se non è finito, dal giorno dopo la sua fine; se una persona ha un altro contratto in corso, i suoi dati restano finché quel contratto non finisce. **L'anonimizzazione non si annulla.** Il contratto firmato e le ricevute non vengono toccati.

## Come fare

### Creare un contratto con CasaZen
Serve poter creare i contratti. Vale per il canone libero e il transitorio.
1. Apri **Affitti lunghi › Immobili**, scegli la casa e nella scheda «Contratti» premi «Nuovo contratto» (oppure dalla Panoramica «Crea contratto»).
2. Alla domanda «Che contratto vuoi fare?» scegli «Canone libero (4+4)» o «Transitorio».
3. Alla domanda «Come vuoi procedere?» scegli «Lo preparo con CasaZen» e premi «Continua: scegli la casa».
4. Scegli la casa (se non c'è, «Aggiungi un nuovo immobile»). Leggi «Cosa serve per il contratto»: APE e dati catastali devono esserci.
5. Passo **Parti**: compila locatore e conduttore. Il codice fiscale è controllato e due persone non possono avere lo stesso. Per il conduttore l'e-mail serve per il link di pagamento, i solleciti e l'area del conduttore ([[area-inquilino]]); il telefono per il promemoria WhatsApp. Premi «Salva e vai alle condizioni».
6. Passo **Condizioni**: scegli il regime fiscale, scrivi il canone mensile e il deposito. Per il transitorio compila l'esigenza. Facoltativo: nel riquadro «Spese condominiali» premi «Calcola l'importo» (da consuntivo e preventivo) o scrivi l'«Importo per rata», poi «Usa questo importo»: è una proposta, non un pagamento. Premi «Salva e vai alle date».
7. Passo **Date**: scegli la «Data di inizio» (per il transitorio anche «Ultimo giorno del contratto»). Leggi «In parole semplici». Premi «Salva e vai al controllo».
8. Passo **Revisione**: leggi «Il contratto in parole». Sistema ciò che è in «Da sistemare» con «Vai al passo» e leggi «Da controllare» e «Da sapere». Quando vedi «Tutto a posto: puoi confermare la revisione», premi «Conferma e vai alla firma». Compare «Revisione confermata» con «Annulla» per ripensarci.
9. Continua con [[contratti#far-firmare-il-contratto-e-caricare-la-copia-firmata]].

Se esci prima, premi «Salva e continua dopo»: la bozza resta tra i contratti della casa.

### Riprendere una bozza
1. Apri la scheda della casa › «Contratti» e apri il contratto in bozza (stato «Bozza»).
2. Premi «Continua la compilazione»: la procedura si apre sul primo passo che non è completo.
3. Se la bozza non serve più, dal menu scegli «Elimina la bozza».

Se il contratto non è più una bozza vedi «Questo contratto non è più una bozza: non si può più modificare da qui».

### Caricare un contratto già firmato
1. In **Immobili › casa › Contratti** premi «Nuovo contratto».
2. Scegli il tipo («Canone libero (4+4)», «Canone concordato (3+2)» o «Transitorio»).
3. Scegli «Ho già i documenti» (per il canone concordato: «Ho già il contratto e i documenti») e premi «Continua: carica i documenti».
4. Scegli la casa, poi carica il contratto firmato (PDF o foto delle pagine). Premi «Leggi il contratto». Se non hai il file scegli «Non ho il file: inserisco i dati a mano».
5. Aspetta la lettura («Stiamo leggendo il contratto…», di solito meno di un minuto). Puoi lasciare aperta la pagina o premere «Continua a mano».
6. La procedura si apre sul primo passo con qualcosa da controllare. Controlla i campi segnati «Letto dal contratto — controlla» e compila ciò che manca.
7. Nel passo **Contratto firmato** controlla il PDF (o «Usa un altro file»), scrivi il «Giorno della firma», rispondi a «È già stato registrato?» e premi «Inserisci il contratto».
8. Leggi «Inserire il contratto firmato?» e conferma con «Inserisci il contratto».
9. Se hai risposto «Sì, è già registrato», nel passo **Dopo la firma** ti chiediamo numero e ricevuta della registrazione.

Cosa succede dopo: il contratto è «Firmato», con le sue scadenze e il piano dei canoni da attivare. **Non si può più modificare né eliminare.**

### Far firmare il contratto e caricare la copia firmata
1. Nel passo **Firma** («Stampa, firma e carica») premi «Leggi l'anteprima (non valida per la firma)» se vuoi vedere il testo.
2. Premi «Scarica da firmare» e stampa il PDF. Il contratto passa a «In firma».
3. Fai firmare a mano ogni pagina da tutte le parti.
4. Premi «Carica la copia firmata», scegli il PDF firmato da tutte le parti (al massimo 20 MB) e indica la **data di stipula** (non dopo oggi).
5. Spunta la dichiarazione («Dichiaro che il file è il contratto firmato da tutte le parti…») e premi «Salva la firma».

Se devi correggere qualcosa dopo aver scaricato, premi «Annulla lo scarico per modificare»: la copia scaricata non vale più. Se il modello di contratto non è approvato, il pulsante «Scarica da firmare» non è disponibile: vedi solo l'anteprima.

### Registrare il contratto
1. Apri il contratto e vai alla scheda **Scadenze**: trovi «Registrazione del contratto (RLI)» con la scadenza.
2. Premi «Esporta precompilazione RLI»: scarichi un PDF precompilato. **Non è un deposito.**
3. Registra il contratto sul sito dell'Agenzia delle Entrate (o tramite un intermediario abilitato). Segui «Come registrare il contratto».
4. Quando hai la ricevuta premi «Inserisci estremi di registrazione».
5. Scrivi «Numero o protocollo di registrazione» e «Data di registrazione» (non dopo oggi), carica la «Ricevuta di registrazione (PDF, al massimo 10 MB)», spunta la dichiarazione e premi «Salva registrazione».

Cosa succede dopo: il contratto diventa «Registrato», la scadenza sparisce e il promemoria per e-mail si ferma. Se hai affidato la registrazione a un servizio (su attivazione), segui «Dati per la registrazione» e poi, a ricevuta arrivata, il contratto si aggiorna da solo.

### Comunicare alla Questura (inquilino extra-UE)
1. Nel passo «Segna quando hai consegnato le chiavi» (o nella scheda **Scadenze**) controlla la «Data di consegna dell'immobile». Se è diversa dall'inizio del contratto, premi «Modifica data di consegna» e salva.
2. Invia la comunicazione all'autorità locale di pubblica sicurezza, nel modo previsto dalla tua Questura (sportello, PEC, raccomandata).
3. Premi «Segna come comunicata», scegli la data di invio, carica la ricevuta (facoltativa) e conferma.

### Creare un contratto a canone concordato con il contratto guidato
Disponibile solo se il servizio è attivo.
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
1. Apri il contratto › scheda **Guida** › **Operazioni** e premi il pulsante della lettera («Prepara la disdetta», «Calcola l'aggiornamento», «Prepara il verbale», …). Le operazioni compaiono solo quando hanno senso per quel contratto.
2. Compila i dati che chiede. Per un importo scrivi per esempio 25,50.
3. Premi «Scarica la bozza»: ottieni il PDF.
4. Firma e spedisci la lettera.
5. Torna in CasaZen e premi «Segna come inviata», scegli «Il giorno dell'invio» e «Come l'hai mandata».

### Registrare una disdetta
1. Apri il menu della scheda e scegli «Registra una disdetta».
2. Scegli «L'ho mandata io» o «L'ha mandata il conduttore» e il «Giorno in cui è stata mandata» (tra l'inizio del contratto e oggi).
3. Premi «Registra la disdetta». CasaZen avvisa se potrebbe essere arrivata troppo tardi.

Cosa succede: il contratto finisce alla fine del periodo in corso. CasaZen **registra** la disdetta, non la invia. Si toglie con «Togli la disdetta».

### Registrare il recesso del conduttore
1. Nella scheda **Guida** › **Operazioni** premi «Registra il recesso».
2. Scegli il giorno in cui è arrivata la lettera e «Perché recede»: «Gravi motivi» o «Facoltà prevista dal contratto» (in questo caso scrivi il preavviso del contratto in mesi).
3. Scrivi la parola «RECESSO» per confermare e premi «Registra il recesso».
4. Scarica «la presa d'atto» e mandala al conduttore.

Cosa succede: CasaZen calcola il giorno in cui il contratto finisce; **non si può rimettere in vigore**; le rate non pagate dopo quel giorno sono annullate. La fine del contratto va comunicata all'Agenzia delle Entrate.

### Registrare il rinnovo
1. Nella scheda **Guida** › **Operazioni** premi «Registra il rinnovo» (compare dall'ultimo giorno utile per la disdetta, se non c'è una disdetta registrata).
2. Scegli «Rinnovo standard» (stesse condizioni, per 48 mesi nel 4+4 o 24 nel 3+2) oppure «Proroga a un giorno concordato» e scrivi l'«Ultimo giorno del contratto».
3. Premi «Registra il rinnovo».
4. Scarica l'accordo da far firmare se vuoi metterlo per iscritto.

Cosa succede: la fine del contratto si sposta davvero e il piano dei canoni si allunga; le rate già emesse non cambiano. **Non si annulla da qui.** Il rinnovo va comunicato all'Agenzia delle Entrate.

### Restituire la cauzione
1. Quando il contratto sta finendo, nella scheda **Guida** › **Operazioni** premi «Prepara il prospetto».
2. Controlla «Deposito versato il» e scegli «Restituito il».
3. Per ogni anno scrivi il «Tasso legale [anno] (%)» fissato dal Ministero: CasaZen non lo conosce. Aggiungi gli «Interessi già pagati (€)» se ce ne sono.
4. Se vuoi trattenere somme premi «Aggiungi una trattenuta», scrivi importo e motivo (le trattenute devono essere documentate).
5. Leggi «Da restituire …» e premi «Scarica il prospetto» per darlo al conduttore.
6. Quando hai restituito il denaro premi «Registra la restituzione» e conferma («Sì, registra»).

La restituzione si registra dal giorno della restituzione. CasaZen non muove denaro.

### Terminare un contratto in anticipo
1. Apri il menu della scheda e scegli «Termina il contratto».
2. Scegli l'«Ultimo giorno del contratto».
3. Leggi le conseguenze (non si annulla, i canoni futuri non vengono più richiesti, la casa torna libera, va fatta la comunicazione all'Agenzia delle Entrate).
4. Scrivi «TERMINA» e premi «Termina il contratto».

### Eliminare una bozza
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
4. Registri il contratto entro 30 giorni ([[contratti#registrare-il-contratto]]) e, se il conduttore è extra-UE, comunichi alla Questura entro 48 ore dalla consegna delle chiavi.
5. Attivi il piano dei canoni ([[canoni-scadenze#attivare-il-piano-dei-canoni]]): CasaZen segue chi paga e ti avvisa dei ritardi.
6. Il conduttore entra nella sua area e paga le scadenze ([[area-inquilino]]).

### Flusso: contratto già firmato
1. «Nuovo contratto» › «Ho già i documenti» › carichi il PDF.
2. CasaZen legge e compila i dati; tu controlli i campi segnati.
3. Nel passo «Contratto firmato» indichi il giorno della firma e se è già registrato.
4. Se non è registrato, registri entro la scadenza mostrata e dichiari la registrazione.
5. Attivi il piano dei canoni.

### Flusso: fine del contratto
1. A sei mesi dalla fine (canone libero e concordato) compare l'ultimo giorno per la disdetta in [[canoni-scadenze#controllare-le-scadenze]].
2. Decidi: registri una disdetta ([[contratti#registrare-una-disdetta]]) oppure rinnovi ([[contratti#registrare-il-rinnovo]]). Se il conduttore recede, [[contratti#registrare-il-recesso-del-conduttore]].
3. Concordi la riconsegna: prepari il verbale.
4. Restituisci la cauzione ([[contratti#restituire-la-cauzione]]).
5. Comunichi la cessazione all'Agenzia delle Entrate.
6. Se vuoi, passi la casa ad affitto breve ([[affitti-lunghi#passare-un-immobile-da-affitto-lungo-ad-affitto-breve]]).

## Regole e limiti
- Il **deposito cauzionale** è al massimo di **3 mensilità** di canone.
- **Registrazione**: 30 giorni dalla firma di tutte le parti o dall'inizio del contratto, se anteriore. Il contratto non è «Registrato» finché la registrazione non è dichiarata con la ricevuta.
- **Disdetta**: almeno 6 mesi prima della fine (canone libero e concordato); alla prima scadenza serve un motivo previsto dalla legge, scritto nella lettera. CasaZen non giudica se una disdetta è valida: la registra e ti ricorda le date.
- **Rinnovo**: 48 mesi (canone libero) o 24 (canone concordato). Il transitorio non si rinnova.
- **Questura**: comunicazione entro 48 ore dalla consegna, se un conduttore non è cittadino UE. CasaZen non la invia.
- **Cedolare secca**: non con una società come conduttore; sospende gli aggiornamenti del canone.
- **Un contratto firmato non si modifica né si elimina.** Si chiude con disdetta, recesso o termine anticipato; gli errori nel file o nella data di firma non si correggono dopo l'inserimento.
- **Un solo contratto per periodo**: i contratti sulla stessa casa non si sovrappongono.
- Tutte le **lettere sono bozze**: CasaZen non le spedisce e non scrive mai al conduttore; il PDF può portare la scritta BOZZA finché il testo non è approvato.
- Chi può farlo: leggere i contratti serve il permesso di lettura dei contratti; creare, modificare, firmare, registrare, preparare lettere e chiudere serve poter creare i contratti.

## Domande frequenti

### Posso modificare un contratto già firmato?
No. Un contratto «Firmato» non si modifica e non si elimina. Per chiuderlo usa la disdetta, il recesso o «Termina il contratto».

### Perché non posso scaricare il contratto da firmare?
Probabilmente il modello di contratto non è ancora approvato nel tuo ambiente (puoi vedere solo l'anteprima con la scritta BOZZA), oppure mancano dati richiesti dal modello: apri l'anteprima e guarda cosa è segnato «DATO MANCANTE».

### CasaZen registra il contratto al posto mio?
Di norma no: lo registri tu sul canale ufficiale e dichiari la registrazione con la ricevuta. CasaZen non è un intermediario abilitato. Su attivazione puoi affidare la registrazione a un servizio; per il contratto guidato la esegue il servizio che ha preparato il contratto.

### Cosa succede se non registro il contratto in tempo?
CasaZen ti manda un promemoria per e-mail (se hai indicato un indirizzo) e mostra la scadenza come superata. Le conseguenze di legge dipendono dalla tua situazione: chiedi al commercialista.

### Devo registrare anche con la cedolare secca?
Sì: con la cedolare secca non si pagano imposta di registro e bollo, ma il contratto va comunque registrato entro il termine.

### CasaZen manda le lettere al conduttore?
No. CasaZen scrive la bozza, tu la firmi e la spedisci; poi segni l'invio.

### Cosa serve per una disdetta valida?
Dipende dal tipo di contratto e dal periodo: alla prima scadenza serve uno dei motivi previsti dalla legge, scritto nella lettera, con almeno 6 mesi di preavviso. CasaZen prepara la lettera e ti dice entro quando spedirla, ma non giudica la validità.

### Posso fare un contratto per più locatori o più conduttori?
Sì: nel passo «Parti» usi «Aggiungi un altro locatore» e «Aggiungi un altro conduttore».

### Il canone concordato può essere fatto in CasaZen?
Puoi caricare un contratto concordato già firmato oppure, su attivazione, usare il contratto guidato. CasaZen non prepara direttamente il testo del concordato con la sua procedura.

## Glossario
- **Bozza**: il contratto in compilazione, salvato da solo.
- **Stipula**: il giorno in cui ha firmato l'ultima parte.
- **RLI**: il modello dell'Agenzia delle Entrate per registrare un contratto di locazione.
- **Cedolare secca**: imposta sostitutiva sul canone.
- **Attestazione di rispondenza**: documento, rilasciato dalle organizzazioni dell'accordo del comune, che dice che il canone rispetta l'accordo e dà diritto alle agevolazioni del canone concordato.
- **Disdetta**: la comunicazione che ferma il rinnovo del contratto.
- **Recesso**: la scelta del conduttore di lasciare il contratto prima della scadenza.
- **FOI**: l'indice dei prezzi al consumo usato per aggiornare il canone con l'ISTAT.
- **Deposito cauzionale**: somma lasciata dal conduttore a garanzia, restituita a fine contratto con gli interessi legali meno le trattenute documentate.

## Vedi anche
- [[affitti-lunghi]]: immobili, panoramica, report fiscale.
- [[canoni-scadenze]]: canoni, incassi, scadenze e inquilini.
- [[area-inquilino]]: cosa vede il conduttore.
- [[fisco-documenti]]: documenti fiscali degli affitti brevi.
