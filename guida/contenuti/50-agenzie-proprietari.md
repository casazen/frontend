---
id: agenzie-proprietari
titolo: Agenzie e proprietari, dati finanziari e portale del proprietario
menu: Agenzie e proprietari
sezione: Agenzie e proprietari
ordine: 50
riassunto: Come un'agenzia fa lavorare i proprietari in CasaZen, con l'elenco Proprietari, i dati finanziari e il mandato, gli inviti, il portale che il proprietario usa per rendiconti, documenti e calendario, e le commissioni dei canali.
chi: [amministratore, proprietario]
dove: Amministrazione › Proprietari
parole_chiave: [agenzia, piano Agency, piano Agenzia, property manager, proprietario, proprietari, mandato, provvigione, quote, dati finanziari, IBAN, regola fiscale, ritenuta, commercialista, invito, portale proprietari, rendiconto, commissioni dei canali, soggiorno del proprietario, impresa presunta, importare proprietari, attivazione proprietari, Serve il piano Agenzia]
copre: [/app/account/owners, /app/account/owners/:ownerId/financial, /app/account/channel-commissions, /app/short-rent/onboarding/owners, /portale-proprietari, /portale-proprietari/accedi, /portale-proprietari/accesso-negato, /portale-proprietari/invito, /portale-proprietari/contatto, /portale-proprietari/immobili/:propertyId, /portale-proprietari/calendario, /portale-proprietari/calendario/:propertyId, /portale-proprietari/contabilita, /portale-proprietari/contabilita/:statementId, /portale-proprietari/rendiconti, /portale-proprietari/documenti, /portale-proprietari/documenti-emessi, /portale-proprietari/messaggi, /portale-proprietari/messaggi/:conversationId, /portale-proprietari/contatti]
stato: su-attivazione
fonte_codice: [frontend/src/features/owners/owners-list-page.tsx, frontend/src/features/owners/owner-financial-profile-page.tsx, frontend/src/features/owners/components/owner-mandate-form.tsx, frontend/src/features/owners/components/owner-address-form.tsx, frontend/src/features/owners/components/owner-issuer-profile-form.tsx, frontend/src/features/owners/components/owner-tax-checks-section.tsx, frontend/src/features/owner-accounting/channel-commission-rules-page.tsx, frontend/src/features/onboarding/owner-onboarding-page.tsx, frontend/src/components/finance/agency-finance-gate.tsx, frontend/src/routes/ownerPortalRoutes.tsx, frontend/src/features/owner-portal/owner-portal-shell.tsx, frontend/src/features/owner-portal/paths.ts, frontend/src/pages/owner-portal/OwnerStatements.tsx, frontend/src/pages/owner-portal/OwnerCalendar.tsx, frontend/src/config/feature-flags.ts, frontend/src/config/route-manifest.ts, backend/Casazen.Core/Authorization/AgencyPermissions.cs, backend/Casazen.Core/Authorization/OrgRoleCatalog.cs, backend/Casazen.Web/Authorization/AgencyTierAuthorizationHandler.cs, backend/Casazen.Web/Controllers/OwnersController.cs, backend/Casazen.Web/Controllers/OwnerCollaborationController.cs, backend/Casazen.Web/Controllers/OwnerStaysController.cs, backend/Casazen.Web/Controllers/AdminOwnerLoginHostsController.cs, backend/Casazen.Core/Services/IOwnerCollaborationService.cs]
---

## In breve
> **Sei un proprietario invitato da un'agenzia?** Vai a [[agenzie-proprietari#entrare-nel-portale-per-la-prima-volta-per-il-proprietario]]: il resto della pagina è per l'agenzia. Il portale si apre dal browser, anche del telefono. Il link dell'invito si usa una volta sola: salva tra i preferiti l'indirizzo del portale.

Chi gestisce gli immobili di altre persone usa il **piano Agency** (in questo manuale si chiama sempre così; qualche schermata dice «piano Agenzia»: è lo stesso). Ogni immobile ha uno o più **proprietari**, ciascuno con la sua quota e il suo **mandato** (la provvigione dell'agenzia). Con questi dati CasaZen prepara ogni mese il **rendiconto** di ogni proprietario. Il proprietario lo trova nel suo **portale**, dove può anche leggere i documenti, guardare il calendario, chiedere un soggiorno e scrivere all'agenzia.

In **Amministrazione › Proprietari** vedi l'elenco e, per ognuno, apri i **Dati finanziari**. Questa parte è **su attivazione** ([[per-iniziare#cosa-significa-su-attivazione]]): la accende CasaZen, per ambiente. Serve il **piano Agency** (si guarda in **Amministrazione › Fatturazione**) e il ruolo di titolare o di amministratore dell'organizzazione. Come si chiude il mese e come si pagano i proprietari lo trovi in [[chiusura-mensile]]; ruoli e piani sono spiegati in [[account-team-piano]].

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Elenco dei proprietari | Mostra ogni proprietario con tipo, valuta, immobili e mandato in vigore | Amministrazione › Proprietari | amministratore | Su attivazione | Controllare l'elenco dei proprietari |
| Stato dell'attivazione dei proprietari | Dice a che punto sono proprietari, quote, dati per i rendiconti e inviti | Guida › «Vedi tutti i passi» › «Proprietari e rendiconti» | amministratore | Su attivazione | Vedere a che punto è l'attivazione dei proprietari |
| Aggiungere proprietari da file | Importa i proprietari da un file .csv o .xlsx e li associa agli immobili già in CasaZen, con le quote | Guida › «Vedi tutti i passi» › «Proprietari e rendiconti» | amministratore | Su attivazione | Aggiungere i proprietari da un file |
| Aggiungere un proprietario a mano | Controlla e importa una sola riga scritta nella pagina | «Proprietari e rendiconti» › «Aggiungi a mano» | amministratore | Su attivazione | Aggiungere un proprietario a mano |
| Dati finanziari | Profilo fiscale, conto di pagamento, mandato, regola fiscale e cosa manca | Proprietari › «Dati finanziari» | amministratore | Su attivazione | Completare i dati finanziari di un proprietario |
| Mandato | Provvigione, IVA, forfait e commissioni sui pagamenti, a versioni nel tempo | Dati finanziari › Mandato | amministratore | Su attivazione | Registrare il mandato di un proprietario |
| Regola fiscale | Dice se c'è una ritenuta al pagamento; l'approvazione del commercialista si registra qui | Dati finanziari › Regola fiscale e approvazione | amministratore | Su attivazione | Creare una regola fiscale e registrarne l'approvazione |
| Indirizzo di fatturazione | Indirizzo per fattura, QR-fattura e bonifico al proprietario | Dati finanziari › Indirizzo di fatturazione | amministratore | Su attivazione | Salvare l'indirizzo di fatturazione |
| Emittente dei documenti dei soggiorni | Dice chi emette il documento del soggiorno per questo proprietario | Dati finanziari › Emittente dei documenti dei soggiorni | amministratore | Su attivazione | Impostare chi emette i documenti dei soggiorni |
| Affitti brevi fuori dall'agenzia | Conta gli appartamenti che il proprietario affitta senza di te, per la regola dell'«impresa presunta» | Dati finanziari › Affitti brevi fuori dall'agenzia | amministratore | Su attivazione | Dichiarare gli appartamenti affittati fuori dall'agenzia |
| Inviti al portale | Invia ai proprietari il link per entrare nel portale | Proprietari e rendiconti › «4. Accesso al portale» | amministratore | Su attivazione | Invitare i proprietari al portale |
| Portale del proprietario | Rendiconti, calendario, documenti, messaggi e contatti, dalla parte del proprietario | Indirizzo del portale (arriva con l'invito) | proprietario | Su attivazione | Usare il portale (parte «Il portale del proprietario») |
| Commissioni dei canali | Dice quanto trattiene un portale quando la prenotazione non riporta la commissione | Amministrazione › Chiusura mensile › Commissioni dei canali | amministratore | Su attivazione | Impostare le commissioni dei canali |
| Messaggi, documenti e richieste di soggiorno dei proprietari, lato agenzia | Leggere e rispondere, caricare documenti, decidere le richieste | Nell'app, solo come avviso in «Da fare» | amministratore | In arrivo | Vedi «Come funziona» |

## Come funziona

### Chi ha il piano Agency e cosa sblocca
Non è un ruolo: è il **piano Agency** dell'organizzazione, che si paga per camera. Nell'elenco dei piani si chiama «Agency»; il messaggio che compare a chi non lo ha dice «Serve il piano Agenzia»: è lo stesso piano. Lo scegli quando crei l'organizzazione con il profilo «Agenzia / Property manager» ([[per-iniziare]]): chi la crea ne è titolare e le altre persone entrano solo su invito. Il piano si guarda in **Amministrazione › Fatturazione**; piani, ruoli e persone sono in [[account-team-piano]]. Come si passa al piano Agency da un'organizzazione già esistente il manuale non lo descrive: se ti serve, scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»).

Questa parte è **su attivazione**: la accende CasaZen per ambiente ([[per-iniziare#cosa-significa-su-attivazione]]). Quando è accesa, il titolare e gli amministratori trovano nell'area **Amministrazione** queste voci:
- **Proprietari** (questa pagina);
- **Chiusura mensile**, con le schede «Rendiconti», «Fatture ai proprietari», «Autofatture (TD17)», «Ritenute d'acconto», «Bonifici proprietari» e «Commissioni dei canali» (vedi [[chiusura-mensile]]).

Cosa vedi se qualcosa manca:
- Se la funzione non è accesa sul tuo ambiente, o se non sei titolare o amministratore, le due voci non ci sono nel menu.
- Se la funzione è accesa e sei titolare o amministratore ma l'organizzazione non ha il piano Agency, le voci ci sono e, aprendole, vedi «Serve il piano Agenzia» con il pulsante «Vai al piano», che porta a **Amministrazione › Fatturazione**.
- Se apri una di queste pagine con un altro ruolo (gestore, collaboratore, contabile…), vedi «Serve l'amministratore dell'organizzazione».
- «Questa pagina non è disponibile per il tuo accesso» vuol dire che il server ha rifiutato la pagina (ruolo o piano cambiati da poco): esci e rientra, o chiedi a un amministratore.

### Chi può fare cosa
| Ruolo nell'organizzazione | Cosa può fare con i proprietari |
|---|---|
| Titolare e amministratori | Tutto: vedere e modificare i dati finanziari (anche gli identificativi e il conto, che per gli altri sono nascosti), registrare il mandato, invitare al portale, approvare e pubblicare i rendiconti, registrare i pagamenti e chiudere il mese |
| Gestore, collaboratore, contabile, commercialista | Niente: le voci non sono nel menu e, se apri le pagine, vedi «Serve l'amministratore dell'organizzazione» |

Chi ha accesso solo ad **alcune strutture** non può usare le pagine dei soldi dei proprietari (rendiconti, ritenute, bonifici): riguardano tutti i proprietari dell'organizzazione. Un amministratore con accesso a tutte le strutture può aprirle.

### Dal proprietario al rendiconto: i quattro passi
Il passo «Proprietari e rendiconti» di **Inizia con CasaZen** (vedi [[per-iniziare]]) è la guida per mettere in ordine i proprietari. Lo apri da **Guida** (in alto) › «Vedi tutti i passi», premendo «Apri» sulla riga «Proprietari e rendiconti»: la riga la vede solo il titolare o l'amministratore di un'organizzazione con il piano Agency, e solo se il percorso «Inizia con CasaZen» è attivo sul tuo ambiente. Se in **Amministrazione › Proprietari** non c'è ancora nessun proprietario, la pagina ti porta qui da sola.

**Regola della data.** Le date che incontri (qui «Proprietario dal», nei dati finanziari «Vale dal», nel mandato «Valido dal») scegli per tutte il **primo giorno del primo mese che devi ancora chiudere**: i mesi prima restano bloccati e il primo profilo finanziario non si sposta indietro.

Il passo ha quattro fasi, che CasaZen ricontrolla a ogni visita:
1. **Proprietari**: chi sono. Li importi da un file o li aggiungi a mano.
2. **Associazioni e quote**: per ogni immobile, chi lo possiede e con quale quota. Le quote in vigore devono fare esattamente 100%.
3. **Dati per rendiconti**: dati fiscali, indirizzo di fatturazione e conto di pagamento di ogni proprietario.
4. **Accesso al portale**: gli inviti, che partono solo quando li confermi tu.

In alto, sotto «Come stanno le due parti dell'attivazione», vedi due riquadri separati di proposito:
- **Strutture operative**: gli immobili funzionano con i canali anche se i dati dei proprietari non sono completi.
- **Rendicontazione proprietari**: finché questa parte è da completare **i rendiconti non partono**. Il riquadro elenca gli immobili e i proprietari che mancano, con il motivo.

La fase in evidenza è la prima ancora da completare. Ogni fase dice a parole se è «Da iniziare», «Da completare» o «Completato».

> **Nota:** in questa pagina «attivazione» vuol dire mettere in ordine i dati dei proprietari perché i rendiconti possano partire. Non è l'«Attivo» di un immobile e non è «su attivazione», la funzione che accende CasaZen.

### Quote, mandato e dati finanziari
- **Quota**: la percentuale dell'immobile che spetta a un proprietario in un periodo. Se un immobile ha due proprietari, le due quote insieme devono fare 100%. CasaZen segnala i buchi («Periodo senza proprietario»), le quote sotto o sopra il 100% e lo stesso proprietario due volte negli stessi giorni.
- **Mandato**: l'accordo con l'agenzia. Dice la **provvigione** in percentuale, se l'IVA è «+ IVA» o «IVA inclusa», su quale base si calcola (l'incasso del soggiorno senza imposta di soggiorno, con o senza pulizie), gli eventuali **forfait** di pulizie e biancheria per soggiorno, chi paga le commissioni sui pagamenti con carta e l'indirizzo del mandato firmato. Il mandato ha **versioni**: ognuna vale da un giorno e chiude quella in vigore il giorno prima. Quello che è già registrato non cambia.
- **Dati finanziari** (profilo): chi è il proprietario (persona fisica o società), residenza e dati fiscali, valuta e conto per i pagamenti, ruolo e periodo del mandato, e come si contabilizzano ricavi e spese.
- **Regola fiscale**: dice se al pagamento al proprietario c'è una **ritenuta** (la parte che l'agenzia trattiene per il fisco e versa con l'F24) e come si calcola. La regola la sceglie l'agenzia tra quelle **approvate dal commercialista**: CasaZen non approva niente e non propone aliquote o codici tributo, registra soltanto chi ha approvato e quando. Una regola vale per tutti i proprietari che la scelgono nei loro dati: non la rifai per ognuno.

I dati sensibili (nome legale, indirizzo, codice fiscale, partita IVA, identificativo estero, conto) sono **mascherati**: vedi solo le ultime cifre. Titolare e amministratori li vedono per intero con «Mostra i dati per intero» e possono cambiarli.

### Il portale del proprietario
È uno spazio a parte, con il suo indirizzo e il suo accesso, separato dall'app dell'agenzia. Il proprietario entra con un **invito** per e-mail e crea il suo account con lo stesso indirizzo. Vede **solo** gli immobili a cui è associato con una quota in vigore, mai i dati di altri proprietari e mai i dati personali degli ospiti (nel calendario compaiono solo date e una parola, come «Occupato»).

Il menu del portale ha queste voci:
| Voce | Cosa trova il proprietario |
|---|---|
| Panoramica | I suoi immobili e le prenotazioni recenti. Aprendo un immobile vede il riepilogo, le prenotazioni recenti (con i dati degli ospiti mascherati: solo date, canale e stato) e i pulsanti «Calendario e soggiorni» e «Scrivi all'agenzia». I numeri su occupazione e ricavi non sono ancora mostrati: se ti servono, scrivi all'agenzia dai «Messaggi» |
| Immobili e calendario | Notti libere, occupate e bloccate dei prossimi 3, 6 o 12 mesi, i suoi soggiorni e la richiesta di un nuovo soggiorno |
| Contabilità | I rendiconti pubblicati con il PDF, le fatture del gestore, le fatture collegate, i documenti contabili e, in fondo, le ritenute dell'anno e i dati della Certificazione Unica quando l'agenzia li ha verificati |
| Documenti | Mandato, contratti, assicurazioni e altro che l'agenzia condivide, con versione, date e scadenza |
| Documenti emessi | Le ricevute e le fatture che CasaZen ha emesso a nome del proprietario per i suoi soggiorni, con il file da dare al commercialista (su attivazione) |
| Messaggi | Le conversazioni con l'agenzia, con allegati PDF, JPEG o PNG fino a 10 MB. L'agenzia riceve il tuo messaggio come avviso ma, per ora, non può rispondere da una schermata dell'app: se non ricevi risposta o è urgente, scrivile o chiamala tu |
| Contatti | Le altre persone che il proprietario fa entrare (solo per il proprietario, non per i suoi contatti) |

Cosa fa CasaZen da sola: quando l'agenzia pubblica un rendiconto, il proprietario riceve un'e-mail **senza importi**; il PDF del rendiconto compare anche tra i suoi documenti. Le e-mail di avviso dei messaggi dicono solo che c'è un messaggio e non contengono mai le parole del messaggio.

Quello che il proprietario non può fare: modificare un rendiconto, vedere i dati di altri proprietari o degli ospiti, o aprire pagine dell'agenzia.

### Il lato dell'agenzia di messaggi, documenti e soggiorni dei proprietari
Il proprietario può scrivere all'agenzia, chiedere un soggiorno nel proprio immobile e ricevere documenti. Nell'app dell'agenzia, per ora, questa parte si vede solo come avviso nel «Da fare» (per esempio «Soggiorno del proprietario da decidere» o «Documento del proprietario in scadenza»). Una schermata dove l'agenzia legge e risponde ai messaggi, carica documenti o decide le richieste dentro CasaZen **non è ancora disponibile**.

### Commissioni dei canali
Quando una prenotazione arriva da un portale (per esempio Airbnb o Booking.com) di solito porta con sé la commissione che il portale ha trattenuto. Se non la porta, CasaZen ha bisogno di sapere quanto trattiene quel portale. Lo dici con una **percentuale per portale**, valida **dal giorno** che scegli. Senza una regola, i proprietari di quell'immobile restano fermi alla chiusura del mese con l'anomalia «Manca la commissione di un portale».

La regola vale in base al giorno di **partenza** (check-out) del soggiorno. I mesi già chiusi non si ricalcolano.

## Come fare

### Capire se la tua organizzazione ha il piano Agency
**Ti serve:** essere titolare o amministratore dell'organizzazione.
1. Apri **Amministrazione › Fatturazione** e, in «Il tuo piano», leggi il nome del piano. Se è «Agency», il piano c'è.
2. Apri il menu dell'area **Amministrazione** e guarda se ci sono **Proprietari** e **Chiusura mensile**.
3. Se le voci ci sono ma, aprendole, vedi «Serve il piano Agenzia», l'organizzazione non ha il piano Agency. Come passarci da un'organizzazione già esistente il manuale non lo descrive: scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»).
4. Se il piano è Agency ma le voci non ci sono, la funzione non è ancora accesa sul tuo ambiente (o non sei titolare né amministratore): scrivi all'assistenza nello stesso modo e chiedi l'attivazione.

### Vedere a che punto è l'attivazione dei proprietari
**Ti serve:** essere titolare o amministratore, il piano Agency e il percorso «Inizia con CasaZen» attivo.
1. Apri **Guida** (in alto) › «Vedi tutti i passi» e, nella pagina «Inizia con CasaZen», premi «Apri» sulla riga «Proprietari e rendiconti». La riga dice quanti proprietari ci sono e quanti hanno dati da completare.
2. Leggi «Come stanno le due parti dell'attivazione»: «Strutture operative» (gli immobili funzionano con i canali) e «Rendicontazione proprietari» (finché è da completare, i rendiconti non partono; il riquadro elenca gli immobili e i proprietari che mancano, con il motivo).
3. Leggi le quattro fasi («1. Proprietari», «2. Associazioni e quote», «3. Dati per rendiconti», «4. Accesso al portale»): ognuna è «Da iniziare», «Da completare» o «Completato». Parti dalla prima che non è completata.
4. Per un solo proprietario apri **Amministrazione › Proprietari › «Dati finanziari»**: il riquadro in alto dice se i dati sono pronti o cosa manca, e più sotto «Cosa manca nell'attivazione» ha il pulsante «Completa nell'attivazione».

### Controllare l'elenco dei proprietari
1. Apri **Amministrazione › Proprietari**.
2. Scrivi nel campo di ricerca sopra l'elenco per filtrare per nome.
3. Leggi la scheda di ogni proprietario: il nome, il tipo e la valuta (per esempio «Persona fisica · valuta EUR»), quanti immobili ha e il mandato in vigore (per esempio «Provvigione 20% + IVA, dal 1 gennaio 2026»).
4. Se vedi «Manca il mandato», il proprietario non ha un mandato valido oggi: apri i suoi dati finanziari e registralo.
5. L'elenco mostra i primi 20: premi «Mostra tutti (N)» per vederli tutti e «Mostra meno» per richiuderli.
6. Premi il nome o «Dati finanziari» per aprire la pagina del proprietario.

Se non hai ancora nessun proprietario, la pagina ti porta da sola al passo «Proprietari e rendiconti».

### Aggiungere i proprietari da un file
**Ti serve:** essere titolare o amministratore; gli **immobili già in CasaZen** (il file non li crea: li cerca, e se non li trova scrive «Struttura non trovata»); per ogni riga il proprietario (codice proprietario o codice fiscale, nome o ragione sociale, persona o società, e-mail), l'immobile (il suo **id**, che vedi nella scheda dell'immobile, oppure il suo **CIN**), la quota e la data da cui vale. L'importazione **non invia nessun invito**.
> **Attenzione:** come data di partenza scegli il primo giorno del primo mese che devi ancora chiudere: i mesi prima restano bloccati e non si spostano indietro.
1. Apri **Guida** (in alto) › «Vedi tutti i passi» e premi «Apri» sulla riga «Proprietari e rendiconti» di «Inizia con CasaZen». L'elenco **Amministrazione › Proprietari** non ha un pulsante per aggiungere proprietari: li aggiungi da questo passo, anche quando ne hai già (per esempio un sedicesimo).
2. Nella fase «1. Proprietari» premi «Scarica il modello» e compilalo: una riga per ogni proprietario di ogni immobile. Il file è .csv o .xlsx, fino a 2 MB e 1.000 righe. Può portare anche valuta di pagamento, IBAN e BIC del proprietario; il mandato e la regola fiscale no: quelli si scrivono nei dati finanziari.
3. Premi «Scegli il file» (o trascinalo dove vedi «Trascina qui il file dei proprietari»).
4. Premi «Controlla il file». Leggi «Righe giuste» e «Righe da correggere» e, per ogni riga, l'esito: «Crea il proprietario», «Usa un proprietario già presente», «Crea l'associazione», «Aggiorna il periodo» o «Nessuna modifica». Un proprietario già presente viene riconosciuto dal codice proprietario, dal codice fiscale o dalla partita IVA, o dall'id che scrivi nel file.
5. Se ci sono righe da correggere, leggi il motivo accanto alla riga (per esempio «Struttura non trovata», «Le quote della struttura non fanno 100%», «Più strutture corrispondono: usa l'id»). Correggi il file e ricontrollalo.
6. Premi «Importa le righe giuste» e conferma con «Importa». Il pulsante si abilita solo dopo un controllo dello stesso file con almeno una riga giusta.
7. Leggi «Righe importate» e «Righe da correggere». Le righe con errori restano fuori: correggile e importale dopo.

> **Nota:** colonne che CasaZen non conosce vengono ignorate, e la pagina te lo dice. Il file viene letto da CasaZen: l'app non ne mostra il contenuto.

### Aggiungere un proprietario a mano
1. Nel passo «Proprietari e rendiconti», fase «1. Proprietari», premi «Aggiungi a mano».
2. Compila la riga: «Codice proprietario» **oppure** «Codice fiscale» (l'e-mail da sola non basta), «Nome o ragione sociale», «Persona o società», «E-mail», «ID o CIN della struttura» (l'immobile deve già essere in CasaZen: l'id lo vedi nella sua scheda, il CIN è il suo codice), «Quota (%)» (da 0,01 a 100) e «Proprietario dal» (vale la regola della data: il primo giorno del primo mese che devi ancora chiudere).
3. Premi «Controlla questa riga». CasaZen la controlla come un file, prima di cambiare qualcosa.
4. Leggi l'esito e, se è giusto, conferma con «Importa».

I dati scritti restano nella pagina solo finché lavori lì: non vengono salvati nel browser.

### Sistemare le quote di un immobile
1. Nella fase «2. Associazioni e quote» leggi l'elenco degli immobili con quote da sistemare («Quote al 80%», «Nessun proprietario», «Lo stesso proprietario due volte»), con il periodo che riguarda.
2. Correggi il **file** (le quote non hanno un pulsante «Completa a mano») e importalo di nuovo: «Aggiorna il periodo» cambia un periodo futuro.
3. Quando tutte le quote fanno 100% vedi «Le quote di tutte le strutture fanno esattamente 100%».

### Completare i dati finanziari di un proprietario
**Ti serve:** essere titolare o amministratore. Per ogni proprietario tieni pronti: codice fiscale o partita IVA (o l'identificativo fiscale estero), residenza fiscale, nome legale e indirizzo, IBAN e valuta di pagamento, il mandato (provvigione, IVA, eventuali forfait), l'indirizzo di fatturazione e la regola fiscale approvata dal commercialista ([[agenzie-proprietari#creare-una-regola-fiscale-e-registrarne-l-approvazione]]). Si compila **un proprietario alla volta**, in sette schermate; il file dei proprietari può già portare valuta, IBAN e BIC. Con tanti proprietari prepara prima una tabella con questi dati.
1. Apri **Amministrazione › Proprietari** e premi «Dati finanziari» del proprietario. La pagina si intitola «Dati finanziari di» e il nome.
2. Leggi il riquadro in evidenza, in alto: dice se i dati sono pronti («I dati sono pronti dal…») o cosa manca («Manca la regola fiscale», «I dati finanziari sono incompleti», «La regola fiscale aspetta l'approvazione»…). Il pulsante grande è il prossimo passo: «Completa i dati», «Crea una regola» o «Registra l'approvazione».
3. Premi «Nuova versione dei dati» (in alto) oppure «Completa i dati». Si apre una procedura in sette passi: «Chi è il proprietario?», «Residenza e dati fiscali», «Come riceve i pagamenti?», «Il mandato di gestione», «Ricavi e commissioni», «La regola contabile» e «Controlla i dati». Usa «Continua» e «Indietro».
4. Scegli «Vale dal» (il primo giorno in cui i nuovi dati valgono: per il primo profilo, il primo giorno del primo mese che devi ancora chiudere) e compila i campi: tipo di soggetto, nome legale, residenza fiscale, codice fiscale o partita IVA, valuta e IBAN, ruolo e periodo del mandato («Locatore», «Proprietario» o «Usufruttuario»), «Quando contano gli incassi», «Spese e commissioni», «Fondo di cassa», giurisdizione (per esempio IT, CH o CH-TI: il paese o cantone di cui valgono le regole fiscali del proprietario) e «Regola fiscale».
   - «Quando contano gli incassi» decide in quale mese entra nel rendiconto l'incasso di un soggiorno: «Quando incassa» oppure «Alla fine del soggiorno».
   - «Spese e commissioni» («Al lordo» o «Al netto della commissione») e «Fondo di cassa» («Nessun fondo» o «Fondo di riserva») sono scelte di contabilità: se non sai quale scegliere, chiedilo al commercialista.
5. Premi «Salva la nuova versione». Compare «Dati finanziari salvati».

Cosa succede dopo: la versione vale dal giorno scelto; quella di prima finisce il giorno prima. Quello che è già registrato non cambia. La pagina mostra anche «Versioni precedenti».

> **Attenzione:** il **primo** profilo di un proprietario vale dal giorno scelto in poi: i mesi prima restano bloccati e un profilo non si può spostare indietro dopo. Fallo partire dal **primo mese che devi ancora chiudere**. Se i dati partono dopo il mese che stai chiudendo, vedi «I dati non coprono» quel mese e il suo rendiconto resta bloccato.

Sotto il riquadro in evidenza trovi anche «Cosa manca nell'attivazione»: l'elenco delle cose da completare (mandato, quote, conto, indirizzo…) con il pulsante «Completa nell'attivazione».

### Registrare il mandato di un proprietario
1. Apri i **Dati finanziari** del proprietario e vai alla sezione **Mandato**.
2. Premi «Nuova versione».
3. Scrivi «Valido dal» (deve essere dopo l'inizio dell'ultima versione) e la «Provvigione (%)», da 0 a 100.
4. Scegli «IVA sulla provvigione e sui forfait»: «+ IVA» (l'IVA si aggiunge in fattura) oppure «IVA inclusa».
5. Scegli la «Base della provvigione»: l'importo su cui si calcola la percentuale, cioè l'incasso del soggiorno senza imposta di soggiorno, con le pulizie incluse oppure senza.
6. Se ci sono, scrivi il «Forfait pulizie» e il «Forfait biancheria» (importi fissi per ogni soggiorno, come 80,00) e scegli a chi vanno le «Commissioni sui pagamenti con carta».
7. Se vuoi, scrivi dove si trova il «Mandato firmato». CasaZen non carica il file: serve l'indirizzo (che inizia con https://) di un file che hai già in un archivio online. Il documento non viene mai mostrato nell'app e contiene dati personali: usa un indirizzo con accesso riservato, non un link pubblico. Se lo lasci vuoto, la versione risulta «Mandato firmato: non registrato» e l'attivazione segnala «Documento del mandato mancante».
8. Premi «Salva la nuova versione». Compare «Nuova versione del mandato salvata».

### Creare una regola fiscale e registrarne l'approvazione
**Ti serve:** essere titolare o amministratore e un commercialista che ti dia i valori. Senza una regola approvata il pagamento a un proprietario non si registra e sul mese compaiono anomalie. Chiedi al commercialista: 1) se c'è una ritenuta e, se sì, aliquota e codice tributo; 2) quali voci entrano nella base (codici come «rent», «cleaning»); 3) l'indirizzo (https) della norma o fonte ufficiale e la sua **impronta**, il codice di 64 caratteri che identifica quel documento; 4) da quando vale; 5) per quanti anni conservare le prove. Se per quel proprietario non c'è ritenuta, lascia vuota la casella «La regola prevede una ritenuta al pagamento». La regola approvata si sceglie poi nei dati di ogni proprietario: non va rifatta ogni volta.
1. In **Dati finanziari**, sezione «Regola fiscale e approvazione», premi «Nuova regola».
2. Scrivi codice e versione della regola, la giurisdizione (per esempio IT, CH o CH-TI) e da quando vale.
3. Se la regola prevede una ritenuta al pagamento, spunta «La regola prevede una ritenuta al pagamento» e scrivi «Aliquota della ritenuta (%)», «Codice tributo» e le «Voci della base lorda».
4. Scrivi l'indirizzo della fonte ufficiale (https://) e la sua impronta (64 caratteri), l'arrotondamento e gli anni di conservazione.
5. Premi «Crea la regola». Compare «Regola creata: ora va approvata». La regola resta **«Da approvare»**.
6. Quando il commercialista l'ha approvata, premi «Registra l'approvazione», scrivi il nome di chi ha approvato e conferma.
7. Torna al profilo e scegli la regola nella «Regola fiscale».

Una regola approvata non si cambia più: per cambiare un valore serve una nuova versione della regola. Il sistema blocca una regola non approvata, non in vigore o di un'altra giurisdizione.

### Salvare l'indirizzo di fatturazione
1. Nei **Dati finanziari**, sezione «Indirizzo di fatturazione», scrivi «Via», «Numero civico», «CAP», «Località», «Provincia o cantone» e «Paese» (due lettere, per esempio IT o CH).
2. In Italia la provincia è obbligatoria (le due lettere della sigla).
3. Premi «Salva l'indirizzo». Salvandolo sostituisci quello di prima.

Serve per la fattura dell'agenzia, la QR-fattura e il bonifico al proprietario.

### Impostare chi emette i documenti dei soggiorni
Questa parte è **su attivazione**. In Italia il documento del soggiorno lo emette il proprietario, con i suoi dati e il suo sezionale: CasaZen lo emette a suo nome.
1. Nei **Dati finanziari**, sezione «Emittente dei documenti dei soggiorni», scegli «Chi emette»: «Persona fisica» (ricevuta a suo nome, con il bollo quando serve), «Regime forfettario» (fattura senza IVA) o «Società o professionista» (fattura elettronica con il suo sezionale).
2. Compila i dati richiesti: nome, codice fiscale, partita IVA se c'è, indirizzo, sezionale, «IVA sul soggiorno» e gli altri campi che vedi.
3. Premi «Salva il profilo». Se manca qualcosa leggi «Mancano ancora…»: finché il profilo non è completo **CasaZen non prepara i documenti dei suoi soggiorni**.

Le scelte «da confermare» sono valori prudenti: li conferma il commercialista e li puoi cambiare quando vuoi. Come funzionano poi i documenti è in [[fisco-documenti]].

### Dichiarare gli appartamenti affittati fuori dall'agenzia
Questa parte è **su attivazione**. Una persona fisica senza partita IVA può affittare in locazione breve un numero limitato di appartamenti. Oltre quel limite l'attività è presunta d'impresa: il proprietario appare con l'avviso «Impresa presunta» e i suoi soggiorni **non hanno la ritenuta** delle locazioni brevi. Contano anche gli appartamenti che affitta senza passare da te.
1. Apri i **Dati finanziari** del proprietario e vai a «Affitti brevi fuori dall'agenzia».
2. Scrivi in «Appartamenti che affitta fuori dall'agenzia» un numero intero da 0 al massimo indicato. Scrivi 0 se non ne ha: lasciare vuoto non vale.
3. Premi «Salva il numero».

L'avviso non blocca niente: rendiconti e pagamenti vanno avanti. La pagina suggerisce di valutare un profilo emittente d'impresa.

### Invitare i proprietari al portale
Serve essere titolare o amministratore. Un invito parte **solo** quando lo confermi tu.
1. Nel passo «Proprietari e rendiconti» vai alla fase «4. Accesso al portale».
2. Ogni proprietario ha uno stato: «Non pronto», «Pronto da invitare», «Invitato», «Accettato», «Scaduto» o «Ritirato». Puoi invitare i proprietari pronti e quelli con invito scaduto o ritirato.
3. Seleziona i proprietari da invitare.
4. Apri l'anteprima («Anteprima dell'invito»): vedi chi riceverà l'e-mail, a quale indirizzo, e cosa potrà fare. Se ne escono alcuni, vedi perché («ha già accettato», «ha già un invito in corso»).
5. Se va bene, premi «Invia N inviti». Leggi la quota del giorno: «Oggi puoi ancora inviare N inviti su M».
6. Leggi il risultato («N inviti inviati»). Se per qualcuno l'e-mail non è partita, vedi chi e l'invito per lui è ritirato.

Cosa succede dopo: ogni proprietario riceve un'e-mail con un link **valido per un solo uso** e che scade. Con quel link crea l'account e può consultare calendario, soggiorni, rendiconti, fatture e documenti, registrare i propri soggiorni e scrivere all'agenzia, solo per gli immobili a cui è associato.

Se l'e-mail non arriva o il link è scaduto: premi «Reinvia» e conferma «Reinvia l'invito» (il link di prima smette di funzionare). Per annullare un invito premi «Ritira» e conferma «Ritira l'invito»: il proprietario non potrà più usare il link, e per invitarlo di nuovo rifai l'anteprima. «Controlla di nuovo» aggiorna gli stati: la pagina non li aggiorna da sola dopo un po'.

### Impostare le commissioni dei canali
Serve essere titolare o amministratore.
1. Apri **Amministrazione › Chiusura mensile** e la scheda «Commissioni dei canali».
2. Per ogni portale scrivi la percentuale che trattiene quando la prenotazione non porta la commissione. Se non ci sono portali, vedi «Non ci sono portali per cui impostare una commissione».
3. In «Valide dal» scegli il primo giorno di **partenza** dei soggiorni a cui valgono le nuove percentuali. Di solito CasaZen propone il primo giorno del mese da chiudere, dove stanno i soggiorni fermi per la commissione che manca.
4. Premi «Salva le commissioni». Compare «Commissioni salvate. Valgono per i soggiorni che finiscono dal… in poi». Se non hai cambiato nulla vedi «Cambia una percentuale per poter salvare».

Vengono salvate solo le percentuali che scrivi tu. Se scegli un giorno che cade su un'altra regola dello stesso portale, o prima dell'inizio della regola in vigore, CasaZen ti dice quale giorno scegliere. Un mese già chiuso non cambia.

### Entrare nel portale per la prima volta (per il proprietario)
1. Apri l'e-mail dell'agenzia con l'invito e premi il link.
2. Premi «Crea il tuo account» (oppure «Ho già un account»). Usa **lo stesso indirizzo e-mail** a cui è arrivato l'invito: è l'unico con cui puoi accettarlo.
3. Se ti arriva un messaggio per confermare l'indirizzo, aprilo e poi torna sul link.
4. Compare «Stiamo attivando il tuo accesso» e poi «Apri il portale». Premi il pulsante.

Se vedi un errore:
- «Questo invito è scaduto», «già usato» o «ritirato»: chiedi all'agenzia un nuovo invito.
- «Questo invito è per un altro indirizzo e-mail»: premi «Accedi con un altro account» e usa l'indirizzo giusto. L'invito resta valido.
- «Il tuo accesso al portale non è ancora attivo»: riprova tra poco; se non si attiva scrivi all'assistenza.
- «Questo account non ha accesso all'area proprietari»: sei entrato con un account diverso da quello dell'invito. Esci e accedi con quello giusto.

Le volte dopo non serve il link dell'invito (si usa una sola volta): apri l'indirizzo del portale e premi «Accedi» (la pagina si intitola «Area proprietari»); per uscire premi «Esci». Il portale sta sullo stesso sito dell'app, all'indirizzo che finisce con /portale-proprietari: salvalo tra i preferiti. Se lo perdi, chiedilo all'agenzia. Si apre dal browser, anche del telefono.

Il portale si apre anche sull'indirizzo del sito dell'agenzia, se l'agenzia ha un dominio proprio e CasaZen ha attivato l'accesso proprietari su quel dominio. Finché non è attivo vedi «Accesso proprietari non ancora attivo» (vedi [[dominio-incorpora]]).

### Leggere un rendiconto nel portale (per il proprietario)
1. Apri **Contabilità**.
2. In «Rendiconti pubblicati» scegli il mese e premi «Apri il rendiconto». Leggi il riepilogo (soggiorni, commissioni dei canali, provvigione del gestore, addebiti e spese, rettifiche, pagamenti, ritenuta) e le righe.
3. Gli importi positivi sono a tuo favore, quelli negativi a tuo carico. L'imposta di soggiorno è solo un'informazione: non fa parte del netto.
4. Premi «Scarica il PDF» per salvare il rendiconto.
5. Per fare una domanda su quel rendiconto premi «Chiedi informazioni su questo rendiconto».

Se una versione più recente ha preso il posto di quella che guardi, vedi «Apri la versione più recente». Le fatture che il gestore ti ha emesso per i rendiconti stanno in «Fatture del gestore», ognuna con il suo PDF.

### Chiedere un soggiorno nel proprio immobile (per il proprietario)
1. Apri **Immobili e calendario** e scegli l'immobile.
2. Nel riquadro «Chiedi un soggiorno» leggi «Le regole per questo immobile»: notti a disposizione nell'anno, preavviso minimo, notti minime e massime, date non disponibili e se l'agenzia approva ogni richiesta.
3. Scegli «Arrivo» e «Partenza» e premi «Invia la richiesta».

Cosa succede dopo: vedi «Richiesta inviata». **Non è ancora un soggiorno confermato**: le date non sono bloccate finché la richiesta non è approvata e i canali di vendita non l'hanno registrata. Se le regole dell'immobile lo prevedono la richiesta viene approvata in automatico, ma il soggiorno risulta confermato solo quando le date sono bloccate. Gli stati:
- «Richiesta inviata»: in attesa di approvazione, le date non sono bloccate.
- «Approvato, date in blocco»: approvato, ma le date si stanno ancora bloccando: non è confermato.
- «Confermato»: le date sono bloccate. **Solo adesso il soggiorno è tuo.**
- «Approvato, blocco non riuscito»: l'agenzia ha detto sì ma le date non sono bloccate sui canali di vendita e l'agenzia lo sta sistemando. Non è confermato: non organizzarti e chiedile a che punto è.
- «Rifiutato» e «Annullato»: le date non sono tue.

Per annullare premi «Annulla il soggiorno» e conferma: se era già approvato, le date tornano libere sui canali di vendita. Puoi chiederne un altro quando vuoi. L'agenzia riceve la richiesta come avviso in «Da fare» («Soggiorno del proprietario da decidere»).

### Scrivere all'agenzia (per il proprietario)
1. Apri **Messaggi** e premi «Nuova conversazione».
2. Scegli «Di cosa vuoi parlare»: una domanda generale, un immobile, un soggiorno, un documento o un rendiconto. Se sei collegato a più agenzie, scegli un elemento: la conversazione va all'agenzia di quell'elemento.
3. Scrivi l'oggetto e il messaggio e premi «Invia il messaggio». Non scrivere dati di carte o di conti bancari.
4. Per rispondere apri la conversazione, scrivi in «Il tuo messaggio» e premi «Invia». Puoi allegare un PDF, JPEG o PNG fino a 10 MB.

Puoi scegliere se ricevere un'e-mail quando l'agenzia ti scrive.

### Invitare un contatto nel portale (per il proprietario)
Solo il proprietario può gestire i contatti.
1. Apri **Contatti** e premi «Invita un contatto».
2. Scrivi «Nome», «Cognome» e «Indirizzo e-mail» e scegli almeno un permesso: «Vedere la contabilità», «Vedere il calendario», «Vedere i documenti», «Usare i messaggi con l'agenzia», «Chiedere e annullare soggiorni».
3. Premi «Invia l'invito». La persona riceve un'e-mail con un link valido 7 giorni e non ha nessun accesso finché non lo accetta. Per accettarlo apre il link, crea il suo account con lo stesso indirizzo e vede solo ciò che i permessi consentono: dove manca il permesso legge «Non hai il permesso di vedere questa parte».
4. Per cambiare i permessi premi «Salva i permessi» (ne serve almeno uno). Per togliere l'accesso premi «Revoca l'accesso» e conferma: vale dalla sua richiesta successiva e resta una traccia dell'invito.

Un proprietario può avere al massimo 10 contatti. Un invito scaduto conta ancora finché non lo revochi.

## Flussi completi

### Flusso: dal nuovo proprietario al primo rendiconto
1. L'amministratore importa i proprietari, gli immobili e le quote da un file ([[agenzie-proprietari#aggiungere-i-proprietari-da-un-file]]).
2. Per ogni proprietario completa i dati finanziari: tipo, residenza, conto, mandato, indirizzo e regola fiscale approvata ([[agenzie-proprietari#completare-i-dati-finanziari-di-un-proprietario]]).
3. L'amministratore imposta le commissioni dei canali, se i portali non le riportano.
4. Il mese finisce. L'amministratore apre la **Chiusura mensile**: CasaZen controlla il mese, prepara il rendiconto, l'amministratore lo approva e lo pubblica ([[chiusura-mensile#preparare-il-rendiconto-di-un-proprietario]]).
5. CasaZen avvisa il proprietario con un'e-mail senza importi. Il rendiconto è nel portale, in «Contabilità».
6. L'amministratore registra il pagamento al proprietario, prepara il file per la banca e chiude il mese ([[chiusura-mensile#registrare-il-pagamento-a-un-proprietario]]).

### Flusso: invito al portale
1. L'amministratore apre la fase «4. Accesso al portale», sceglie i proprietari e guarda l'anteprima.
2. Conferma «Invia N inviti»: CasaZen manda a ogni proprietario un'e-mail con il suo link.
3. Il proprietario crea l'account con lo stesso indirizzo e apre il portale.
4. L'amministratore ricontrolla gli stati: «Accettato» per chi è entrato, «Scaduto» per chi non ha fatto in tempo (si reinvia).

## Regole e limiti
- Le pagine di questa parte servono il **piano Agency** e il ruolo di **titolare o amministratore**, e sono su attivazione. Se il piano Agency risulta in fase di riduzione, puoi consultare ma le modifiche vengono rifiutate.
- Chi ha accesso solo ad alcune strutture non può aprire rendiconti, ritenute e bonifici.
- Le quote in vigore di un immobile devono fare esattamente 100%: finché non tornano, gli incassi di quell'immobile restano fuori dai rendiconti.
- Il **primo profilo finanziario** di un proprietario vale dal giorno scelto in poi e non si sposta indietro. Una nuova versione di profilo o di mandato parte da un giorno dopo l'inizio dell'ultima.
- La regola fiscale deve essere approvata dal commercialista, essere in vigore il giorno del pagamento ed essere della stessa giurisdizione del profilo, altrimenti il pagamento non si registra.
- I dati sensibili sono mascherati; li vedono per intero e li cambiano solo titolare e amministratori.
- Un invito al portale: un solo uso, scade, esiste una quota giornaliera di inviti. Un invito di un contatto vale 7 giorni; un proprietario può avere al massimo 10 contatti.
- Il file dei proprietari è .csv o .xlsx, fino a 2 MB e 1.000 righe.
- Il proprietario vede solo gli immobili con una sua quota in vigore e non vede mai i dati personali degli ospiti.
- Le richieste di soggiorno del proprietario seguono le regole dell'agenzia (notti, preavviso, date chiuse) e non bloccano le date finché non sono approvate.

## Domande frequenti

### Perché non vedo la voce «Proprietari»?
Perché la funzione non è ancora accesa sul tuo ambiente, oppure perché non sei titolare o amministratore: in entrambi i casi la voce non è nel menu. Se la voce c'è ma aprendola vedi «Serve il piano Agenzia», l'organizzazione non ha il piano Agency: controllalo in **Amministrazione › Fatturazione**. In tutti i casi puoi scrivere all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»).

### Come aggiungo un proprietario quando ne ho già inseriti molti?
L'elenco **Amministrazione › Proprietari** non ha un pulsante per aggiungerne. Apri **Guida** (in alto) › «Vedi tutti i passi», premi «Apri» sulla riga «Proprietari e rendiconti» e usa «Aggiungi a mano» oppure un nuovo file ([[agenzie-proprietari#aggiungere-i-proprietari-da-un-file]]).

### Il file dice «Struttura non trovata». Cosa significa?
Che l'immobile di quella riga non è in CasaZen o che l'id o il CIN scritto non corrisponde. Il file non crea gli immobili: aggiungili prima e poi ricontrolla il file.

### Sono un proprietario: come entro nel portale?
Premi il link dell'e-mail di invito dell'agenzia e crea l'account con **lo stesso indirizzo e-mail** a cui è arrivato l'invito ([[agenzie-proprietari#entrare-nel-portale-per-la-prima-volta-per-il-proprietario]]). Le volte dopo apri l'indirizzo del portale e premi «Accedi». Se l'invito è scaduto o l'e-mail non arriva, chiedi all'agenzia di reinviarlo.

### Ho chiesto un soggiorno e vedo «Richiesta inviata»: posso andare?
No. Puoi andare solo quando lo stato è «Confermato». Con «Approvato, blocco non riuscito» o «Approvato, date in blocco» le date non sono ancora tue: chiedi all'agenzia a che punto è.

### Il proprietario vede gli importi dei rendiconti?
Sì: nel portale, in «Contabilità», legge i rendiconti pubblicati con gli importi e può scaricare il PDF. L'e-mail con cui CasaZen lo avvisa della pubblicazione, invece, non contiene importi.

### L'importazione manda subito gli inviti ai proprietari?
No. Importare non invia nessun invito. Gli inviti partono solo quando li confermi nella fase «4. Accesso al portale».

### Un proprietario mi dice che non riesce a entrare. Cosa controllo?
Che usi lo stesso indirizzo e-mail dell'invito, che l'invito non sia scaduto e che non sia stato ritirato. Se è scaduto, premi «Reinvia». Se usa un altro indirizzo, deve premere «Accedi con un altro account».

### Posso vedere l'IBAN completo di un proprietario?
Sì, se sei titolare o amministratore: nei Dati finanziari premi «Mostra i dati per intero». Gli altri ruoli vedono solo le ultime cifre.

### Perché un proprietario ha «Manca il mandato»?
Non ha un mandato che copra oggi (o ne ha uno che parte più avanti). Apri i suoi Dati finanziari e registra la nuova versione del mandato. Senza mandato la provvigione non si calcola: CasaZen non la inventa.

### Come correggo una quota sbagliata?
Correggila nel file e importalo di nuovo: la fase «2. Associazioni e quote» non ha un pulsante per modificarla.

### Il proprietario può cambiare un rendiconto?
No. Lo legge, lo scarica in PDF e, se ha dubbi, scrive all'agenzia dal pulsante «Chiedi informazioni su questo rendiconto».

### L'agenzia vede le conversazioni dei proprietari dentro CasaZen?
Non ancora in una schermata dedicata. Il proprietario può scrivere e ricevere un'e-mail di avviso quando l'agenzia scrive, ma la parte dell'agenzia non è ancora nell'app.

### Cosa sono le «commissioni dei canali»?
Sono le percentuali che un portale trattiene quando la sua prenotazione non porta la commissione. Servono a calcolare il rendiconto del proprietario.

## Glossario
- **Piano Agency** (detto anche «piano Agenzia»): il piano dell'organizzazione, a pagamento per camera, che sblocca i proprietari, i rendiconti, le ritenute e i bonifici. Non è un ruolo.
- **Agenzia / Property manager**: chi gestisce immobili per conto di altri proprietari. Come profilo della registrazione è la scelta «Agenzia / Property manager»; come ruolo del team «Property manager» è un'altra cosa (vedi [[account-team-piano]]). «PM», nella «Fattura del PM», è l'agenzia.
- **Proprietario**: il cliente dell'agenzia a cui appartiene un immobile. Non è il «Proprietario privato» della registrazione, cioè chi gestisce da solo le case sue.
- **Immobile, struttura, unità**: in queste pagine sono la casa o l'appartamento che l'agenzia gestisce; la «camera» è l'unità su cui si calcola il piano Agency.
- **Quota**: la parte dell'immobile che spetta a un proprietario in un periodo. «Quota in vigore» è quella che vale oggi.
- **Forfait**: importo fisso per soggiorno (per esempio pulizie o biancheria) che l'agenzia addebita oltre alla provvigione.
- **Giurisdizione**: il paese o cantone (per esempio IT, CH o CH-TI) di cui valgono le regole fiscali del proprietario.
- **Impronta**: codice di 64 caratteri che identifica un documento; serve a provare che non è stato cambiato.
- **Documenti emessi a nome del proprietario**: ricevute e fatture che CasaZen prepara con i dati fiscali del proprietario per i soggiorni nella sua casa (su attivazione); il proprietario le dà al commercialista.
- **Mandato**: l'accordo con l'agenzia: provvigione, IVA, forfait e commissioni sui pagamenti.
- **Provvigione**: la percentuale che l'agenzia trattiene sul ricavo del proprietario.
- **Dati finanziari**: il profilo fiscale e di pagamento del proprietario, con la regola fiscale che vale per lui.
- **Regola fiscale**: dice se al pagamento c'è una ritenuta e come si calcola; l'approva il commercialista.
- **Portale del proprietario**: lo spazio con cui il proprietario consulta rendiconti, documenti e calendario.
- **Invito**: l'e-mail con il link per creare l'accesso al portale.
- **Impresa presunta**: avviso per un proprietario che affitta più appartamenti di quanti ne può affittare una persona fisica.

## Vedi anche
- [[chiusura-mensile]]: come si prepara, si pubblica e si chiude il rendiconto di ogni proprietario, e come si pagano i proprietari.
- [[fisco-documenti]]: fatture, ricevute e invio allo SDI.
- [[report-commercialista]]: i dati per il commercialista.
- [[per-iniziare]]: la guida «Inizia con CasaZen».
- [[account-team-piano]]: piano, ruoli e persone dell'organizzazione.
- [[dominio-incorpora]]: il dominio proprio dell'agenzia.
