---
id: per-iniziare
titolo: Per iniziare con CasaZen
sezione: Per iniziare
ordine: 1
riassunto: Cos'è CasaZen, come ottenere un invito o registrarti e accedere, la configurazione guidata, titolare e ruoli, cosa significa «Su attivazione», le aree di lavoro, il menu, «Cerca», la Guida, come scrivere all'assistenza e cosa fare nel primo giorno.
chi: [gestore, amministratore, fornitore]
dove: Pagina di accesso › Configurazione iniziale · Menu, Cerca e Guida in alto
parole_chiave: [registrazione, registrarsi, iscriversi, accesso, accedere, login, invito, richiedere un invito, password dimenticata, recupero password, piano, costo, prezzo, gratis, aree di lavoro, menu, cerca, guida, assistenza, aiuto, su attivazione, primi passi, da dove comincio, telefono, cos'è CasaZen]
copre: [/signup, /login, /email-verified, /onboarding, /invito-host/:token, /invite/accept, /attiva-invito, /account-inactive, /no-access, /app/choose-context, /legale, /legale/termini, /legale/privacy, /legale/dpa, /legale/sub-responsabili, /app/short-rent/onboarding, /app/short-rent/onboarding/parts/:partKey, /app/short-rent/onboarding/summary, /app/short-rent/onboarding/owners, /app/short-rent/onboarding/bulk, /app/short-rent/onboarding/panel, /app/short-rent/onboarding/panel/:kind, /app/short-rent/settings/integration, /app/short-rent/help, /app/long-rent/help, /app/account/help, /app/supplier/help, /app/admin/help (non-utente), /app/admin/onboarding-assist (non-utente)]
stato: disponibile
fonte_codice: [frontend/src/features/onboarding/onboarding-page.tsx, frontend/src/features/onboarding/commercial-signup-wizard.tsx, frontend/src/features/onboarding/onboarding-plan-page.tsx, frontend/src/features/guide/first-run-wizard.tsx, frontend/src/features/guide/guide-panel.tsx, frontend/src/features/guide/use-setup-journey.ts, frontend/src/features/help/product-guide-page.tsx, frontend/src/components/layout/context-sidebar.tsx, frontend/src/components/layout/bottom-nav.tsx, frontend/src/components/layout/more-sheet.tsx, frontend/src/components/layout/area-switcher.tsx, frontend/src/components/layout/menu-search.tsx, frontend/src/components/auth/user-menu.tsx, frontend/src/components/auth/onboarding-guard.tsx, frontend/src/pages/login-page.tsx, frontend/src/config/areas.ts, frontend/src/config/onboarding-routes.ts, frontend/src/config/route-manifest.ts]
---

## In breve
**CasaZen** è il gestionale per chi affitta case a breve o a lungo termine: regole italiane sotto controllo, un calendario solo e un sito di prenotazione diretta, insieme ai canali che già usi (Airbnb, Booking.com). Non sostituisce quei portali: tiene allineate le date. Non è una banca né un consulente fiscale o legale: ti aiuta a fare le cose e a non perdere le scadenze, ma gli obblighi di legge restano tuoi.

Per usarlo crei un account (o accetti un invito), scegli come lo userai, confermi i documenti e, se serve, attivi il piano. Poi la **Guida** in alto a destra ti dice sempre cosa fare dopo. Il lavoro quotidiano è diviso in **aree** (Affitti brevi, Affitti lunghi, Amministrazione, Portale fornitori): vedi solo quelle che il tuo ruolo permette.

- **Hai poco tempo?** Vai a [[inizia-qui]]: pochi passi per ogni tipo di utente. Qui sotto, «Il primo giorno» dice in che ordine fare le cose.
- **Quanto costa?** I piani e i prezzi li vedi prima di pagare, al passaggio «Piano e funzionalità» della registrazione, e poi in **Amministrazione › Fatturazione**. Vedi «Quanto paghi e quando».
- **Da telefono?** Puoi usare CasaZen anche dal browser del telefono: il menu diventa una barra in basso. L'app «CasaZen» per telefono non è ancora negli store e non sostituisce il sito: creare prenotazioni, prezzi, incassi, messaggi e invii agli enti restano sul sito ([[app-mobile]]). Per la configurazione iniziale, con molti moduli da compilare, è più comodo un computer.
- **Non confonderli:** «Inizia qui» è una pagina di questo manuale; «Inizia con CasaZen» è un percorso dentro l'app, su attivazione (vedi «Cosa significa «Su attivazione»?»).

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Richiesta di invito | Ti fa chiedere a CasaZen un invito, perché l'accesso è su invito | Sito pubblico di CasaZen › «Richiedi un invito» | gestore, fornitore | Disponibile | Ottenere un invito a CasaZen |
| Registrazione | Crea il tuo account e la tua attività | Pagina «Registrati su CasaZen»: si apre dal link di un invito o dall'indirizzo di registrazione | gestore, amministratore | Disponibile | Creare il tuo account e la tua attività |
| Accesso | Ti fa entrare con il tuo indirizzo email | Indirizzo di CasaZen seguito da /login, oppure pulsante «Accedi» dove c'è | gestore, amministratore, fornitore | Disponibile | Accedere a CasaZen |
| Invito a un team | Ti fa entrare nell'organizzazione di un'altra persona, con il ruolo che ti ha dato | Link ricevuto per email › «Accetta e entra» | gestore, amministratore | Disponibile | Entrare in un team con un invito |
| Invito di un amico host | Ti fa registrare dopo il consiglio di un altro host; non assegna ruoli | Link ricevuto per email › «Crea il tuo account» | gestore | Disponibile | Registrarti dopo l'invito di un amico |
| Configurazione guidata | Profilo, area, piano e pagamento in cinque passaggi (i documenti si confermano prima di pagare) | Dopo la registrazione, pagina «Come vuoi usare CasaZen?» | gestore, amministratore | Disponibile | Creare il tuo account e la tua attività |
| «Metti in pausa» | Salva le scelte per riprenderle dopo | Passaggi «Piano e funzionalità» e «Riepilogo» | gestore, amministratore | Disponibile | Mettere in pausa la configurazione |
| Benvenuto al primo accesso | Ti propone il percorso di avvio, una sola volta | Home di Affitti brevi | amministratore | Disponibile | Seguire i passi della Guida |
| Checklist «Attiva il tuo sito di prenotazione» | Elenca i passi per essere operativo | Guida in alto, Home | amministratore, gestore | Disponibile | Seguire i passi della Guida |
| Percorso «Inizia con CasaZen» | Piano guidato in parti: canali, annunci, prezzi, adempimenti, fatturazione, messaggi | Guida in alto › «Vedi tutti i passi» | amministratore, gestore | Su attivazione | Seguire il percorso «Inizia con CasaZen» |
| Aree di lavoro | Separano affitti brevi, affitti lunghi, amministrazione e fornitori | In alto nella barra laterale; su telefono «Altro» | gestore, amministratore, fornitore | Disponibile | Andare in Amministrazione o cambiare area di lavoro |
| Menu | Voci raggruppate, «Altro», impostazioni in basso, barra inferiore su telefono | Barra laterale; su telefono barra in basso | gestore, amministratore, fornitore | Disponibile | Muoverti nel menu |
| «Cerca nel menu» | Trova una pagina del menu per nome | In cima al menu | gestore, amministratore, fornitore | Disponibile | Trovare una pagina |
| «Cerca» | Cerca immobili, prenotazioni, ospiti, pagine e azioni | Barra in alto (Ctrl o Cmd + K) | gestore, amministratore, fornitore | Disponibile | Trovare una pagina |
| «Guida» | Mostra cosa fare adesso e come chiedere aiuto | In alto a destra, pulsante «Guida» | gestore, amministratore, fornitore | Disponibile | Usare la Guida |
| Manuale in app «Guida CasaZen» | 11 argomenti brevi con ricerca e il link al manuale completo | Guida › «Apri il manuale di CasaZen» | gestore, amministratore, fornitore | Disponibile | Aprire il manuale completo dall'app |
| Assistenza | Ti fa scrivere a CasaZen quando ti blocchi o ti serve una funzione «su attivazione» | Guida › «Scrivi all'assistenza» (compare solo se l'installazione ha un indirizzo di assistenza); anche in «Cerca» | gestore, amministratore, fornitore | Disponibile | Scrivere all'assistenza di CasaZen |
| «Personalizza area di lavoro» | Tabelle compatte, voci in primo piano, cruscotto con le attività prima | Menu del tuo profilo (avatar in alto a destra) | gestore, amministratore, fornitore | Disponibile | Personalizzare l'area di lavoro |

## Come funziona

### Registrazione e accesso
CasaZen non ha una sua pagina di accesso con la password. Quando premi «Accedi» o «Registrati», ti porta su una **pagina di accesso sicura gestita da un servizio esterno**. La riconosci perché l'indirizzo cambia: non sei più su CasaZen. Lì puoi:
- **entrare** con l'email e la password già create;
- **registrarti** se non hai ancora un account: scegli la voce di registrazione, inserisci email e password e conferma.

Dopo la registrazione il servizio ti manda una email di conferma. Apri il link: torni su CasaZen e vedi «Email confermata» con il pulsante «Accedi». Al primo accesso la pagina ti dice «Ti stiamo portando alla registrazione…» o «Ti stiamo portando all'accesso…» e poi apre la configurazione.

Se la pagina di accesso non si apre, CasaZen mostra «La pagina di accesso non si è aperta. Controlla la connessione e riprova da qui.» con il pulsante «Continua con l'accesso». Se il servizio è lento puoi premere «Ricarica la pagina».

Se la sessione scade, vieni portato di nuovo all'accesso e, dopo, torni alla pagina che stavi aprendo.

**Da dove arrivi alla pagina di accesso.** Se hai già un account, scrivi nel browser l'indirizzo di CasaZen seguito da **/login** (salvalo tra i preferiti): ti porta subito alla pagina di accesso sicura. Sul sito pubblico di CasaZen, per ora, non c'è il pulsante «Accedi»: CasaZen è in fase di avvio e l'accesso è su invito. Dove il pulsante c'è (in alto), puoi usarlo. Se non hai un account, vedi «Come si entra: invito o registrazione».

**Password dimenticata.** La password non la gestisce CasaZen ma la pagina di accesso sicura: cerca lì il link per reimpostarla (di solito si chiama «Password dimenticata», ma il nome lo decide il servizio di accesso) e segui le istruzioni che ricevi per email. Se non ci riesci, scrivi all'assistenza di CasaZen (vedi «Assistenza: come scrivere a CasaZen»).

> **Nota:** i nomi esatti dei campi della pagina di accesso li decide il servizio di accesso, non CasaZen: possono cambiare nel tempo.

### Come si entra: invito o registrazione
Sul sito pubblico CasaZen si presenta così: «CasaZen è in fase di avvio: per ora l'accesso è solo su invito». Dove il sito ti offre «Registrati su CasaZen» puoi registrarti da solo; dove dice «solo su invito» ti serve un invito. Le strade sono queste:
1. **Crei la tua attività.** Parti dal link di un invito (strada 3) oppure dalla pagina «Registrati su CasaZen», se il sito te la offre. Scegli profilo, area e piano, confermi i documenti e (se serve) paghi: diventi titolare della tua organizzazione.
2. **Ricevi un invito in un team.** Un amministratore ti invita nella sua organizzazione: scegli solo come entrare. Non crei un'altra attività e non compri un piano. Vedi [[account-team-piano#invitare-una-persona-nel-team]].
3. **Un altro host ti consiglia CasaZen.** Il suo invito non ti dà ruoli: ti registri come tutti gli altri e crei la tua attività.
4. **Sei un fornitore di servizi.** Nella scelta del profilo premi «Fornitore di servizi»: si apre la registrazione dei fornitori. Può essere aperta (compili i dati) oppure solo su invito: in quel caso la pagina dice «Al momento i fornitori entrano in CasaZen solo su invito. Se hai ricevuto un invito, apri il link nell'email» e ti serve l'invito di un gestore (vedi [[area-fornitore]]).

**Non hai un invito?** Puoi ottenerlo in due modi (passi in «Ottenere un invito a CasaZen»): chiederlo a CasaZen con «Richiedi un invito», oppure farlo mandare da un host che usa già CasaZen. Prima di decidere puoi provare le demo con dati di esempio, senza account («Vedi gli arrivi di oggi» e «Controlla un contratto», sul sito pubblico).

### La configurazione guidata (nuova attività)
Dopo la registrazione la pagina si chiama «Come vuoi usare CasaZen?» e ha cinque passaggi: **Il tuo profilo**, **Piano e funzionalità**, **Riepilogo**, **Pagamento**, **Inizia**. Sopra c'è la barra «Il tuo percorso»; su telefono vedi «Passaggio 2 di 5». I documenti legali non sono un passaggio a parte: li confermi tra il Riepilogo e il Pagamento (punto 3).

1. **Il tuo profilo.** Scegli una di tre carte:
   - «Agenzia / Property manager»: gestisci strutture e appartamenti per conto di altri proprietari. Crei una nuova agenzia e paghi per camera.
   - «Proprietario privato»: gestisci gli immobili di tua proprietà. Tariffe del piano, extra da Pro.
   - «Fornitore di servizi»: offri pulizie, manutenzione, check-in o altri servizi. Ti porta alla registrazione dei fornitori, che può essere aperta oppure solo su invito (vedi «Come si entra: invito o registrazione» e [[area-fornitore]]).
2. **Piano e funzionalità.** Rispondi a «Quali affitti vuoi gestire?»: «Affitti brevi», «Affitti lungo termine» o «Affitti brevi e lunghi». Poi scegli il piano (nome, prezzo, numero di immobili inclusi) e, dal piano Pro in su, gli extra. Le funzioni di base sono incluse. A destra vedi il riepilogo dei costi che si aggiorna mentre scegli.
3. **Riepilogo e documenti.** Controlli profilo, area attiva, piano ed extra. Sotto il «Totale mensile» c'è scritto se il prezzo è «IVA esclusa» o «IVA inclusa». «Nulla si attiva prima della conferma del pagamento». Poi premi «Continua al pagamento» (per l'agenzia «Continua all'attivazione») e, **prima di pagare**, leggi e confermi i documenti legali: Termini di Servizio, Informativa Privacy, accordo sul trattamento dei dati (DPA) e la presa visione dell'elenco dei sub-responsabili. Sono obbligatori. C'è una conferma facoltativa per ricevere aggiornamenti e novità. Ogni documento ha il pulsante «Leggi il documento»; se il testo non è ancora pubblicato vedi «testo in preparazione». I documenti sono pubblici, senza accesso, nelle pagine «Documenti legali» (Termini di Servizio, Informativa Privacy, Data Processing Agreement e «Sub-responsabili del trattamento»), disponibili solo in italiano, con numero di versione e data di entrata in vigore.
4. **Pagamento.** Inserisci Paese di fatturazione ed eventuale Partita IVA, poi «Vai al pagamento sicuro»: il pagamento avviene su Stripe, CasaZen non vede i dati della carta. L'accesso si attiva solo dopo la conferma del pagamento. Se torni da Stripe e la conferma non è ancora arrivata, vedi «Stiamo verificando il pagamento» e il pulsante «Verifica il pagamento».
5. **Inizia.** Quando il pagamento è confermato premi «Entra e inizia la configurazione». Se non hai ancora immobili vieni portato a «Aggiungi il tuo primo immobile».

**Agenzia.** Scegli l'area, scrivi il nome dell'agenzia (obbligatorio) e le camere previste per avere una stima. L'addebito è a fine mese, sulle unità effettivamente attive per almeno un giorno nel mese, con un minimo mensile; oltre una certa soglia di unità c'è un preventivo personalizzato. Tu sei titolare e amministratore: le altre persone entrano solo su invito, da **Amministrazione › Persone** (vedi «Titolare, amministratore e gli altri ruoli»).

**Quanto paghi e quando.** Prima di pagare vedi il riepilogo con piano, extra e «Totale mensile», e sotto la scritta «IVA esclusa» o «IVA inclusa». Il pagamento è con carta, su Stripe. Finché non confermi il pagamento non si attiva nulla. Nelle schermate della registrazione non c'è l'indicazione di un periodo di prova gratuito: l'importo che vedi nel riepilogo è quello del piano scelto. Dopo la registrazione piano, carta e fatture si gestiscono in **Amministrazione › Fatturazione** ([[account-team-piano#cambiare-piano]]).

> **Nota:** se in Fatturazione e piano vedi l'avviso «Accesso aperto», l'app dice che per ora non addebita nulla e che le funzioni sono sbloccate, e che il piano scelto vale quando riprenderà la fatturazione (ti avvisano prima). Lo trovi spiegato in [[account-team-piano#piano-limiti-e-moduli]].

### La configurazione per chi ha già un account
Se hai già un'organizzazione (per esempio sei stato invitato) non rivedi la procedura di acquisto. Puoi comunque:
- cambiare il tipo di operatore da **Profilo › Modifica tipo** («Affitti brevi», «Locazioni di lungo periodo», «Entrambi»). Il piano non cambia da qui;
- rileggere e accettare i documenti legali quando vengono aggiornati: al primo accesso dopo l'aggiornamento vedi «Documenti legali aggiornati». Finché non accetti, le funzioni per gli host restano ferme.

### Primo accesso: il benvenuto
Solo l'**amministratore dell'organizzazione**, la prima volta che arriva sulla Home di Affitti brevi con la configurazione ancora da completare, vede la finestra «Ciao [nome], iniziamo insieme». Compare una sola volta per persona su questo dispositivo. Ha tre pulsanti:
- il pulsante principale (per esempio «Inizia con CasaZen» o «Inizia: [passo]») apre il primo passo;
- «Vediamo il percorso» mostra l'elenco dei passi;
- «Più tardi» chiude la finestra. Il percorso resta nella **Guida**.

### I passi per essere operativo
La Guida mostra uno di due percorsi, secondo la tua organizzazione.

**Checklist «Attiva il tuo sito di prenotazione».** Sette passi, in ordine: «Account e consensi», «Nome e indirizzo dell'organizzazione», «Primo immobile», «CIN degli immobili», «Pagamenti con Stripe», «Sito pubblicato e prenotabile», «Prima prenotazione diretta». Se hai scelto un piano senza le prenotazioni dirette, i passi sui pagamenti e sul sito non compaiono.

**Percorso «Inizia con CasaZen» (su attivazione).** Sei passi: «Collega i canali», «Controlla gli annunci», «Prezzi e calendario», «Check-in online e adempimenti», «Fatturazione», «Messaggi e AI». Dietro i passi c'è un piano in parti. Per ogni parte vedi lo stato: **Da fare**, **Fatto**, **Rimandato**, **In attesa** (un'altra parte viene prima) o **Non disponibile**.

Le parti del piano sono: «Collega Octorate», «I tuoi immobili», «I tuoi canali», «Controlla gli annunci», «Prezzi e regole», «Adempimenti», «Identificazione e accesso», «Fatturazione», «Messaggi e AI», «Servizi collegati», «Notifica degli ospiti (Svizzera)» e, per ultima, «Riepilogo e attivazione». Quelle che non servono alla tua situazione non compaiono. Per i canali e Octorate vedi [[canali-octorate]].

- **Prossimo passo.** In alto vedi una carta con il perché e due pulsanti: «Continua» e «Più tardi». Con «Più tardi» il passo finisce in **Da fare** e lo ritrovi lì.
- **Salva ed esci.** Esci dal piano in qualsiasi momento: quello che resta lo trovi in Da fare.
- **Rimandare una parte.** Scegli quando vuoi il promemoria: «Stasera alle 20:00», «Domani alle 09:00» oppure «Tra una settimana, alle 09:00». Serve l'amministratore dell'organizzazione.
- **Riepilogo e attivazione.** Vedi i sei flussi (Prenotazioni, Check-in e adempimenti, Documenti fiscali, Annunci sui canali, Messaggi, Report) immobile per immobile, con stato «Attivo», «Da completare» o «Non disponibile». Con «Fai la prova finale» CasaZen fa passare una prenotazione importata di recente dai flussi **in sola lettura: non viene inviato nulla**. Poi «Attiva» accende i flussi pronti. Prima di accendere ti dice su quanti immobili si attiva; quello che non è pronto resta in Da fare. Attivare è compito dell'amministratore.
- **Aiuto.** Su alcuni passi puoi chiedere «Fallo per me»: la richiesta arriva al supporto CasaZen, la vedi in Da fare e ti avvisiamo quando è presa in carico, fatta o annullata.
- **Passi che si fanno solo dal pannello del canale.** Per alcuni passi (comunicazioni alla Questura, ISTAT, accesso a un canale) la pagina ti spiega cosa fare nel pannello del channel manager. Li fa l'amministratore dell'organizzazione; chi non lo è legge chi se ne occupa.
- **Impostazioni › Integrazione.** Scheda riservata all'amministratore: mostra lo stato del collegamento e ti fa riaprire una parte del piano (chi invia le comunicazioni di Alloggiati, un canale, gli immobili, qualsiasi parte).
- **Molti immobili (agenzie).** Se hai più di 10 immobili il piano ti porta alla configurazione in blocco: applichi una scelta a tutti o a una selezione, compili da file i dati che cambiano per immobile, vedi quanti sono pronti e attivi prima un gruppo pilota. È riservata all'amministratore.
- **Proprietari (piano Agency).** Un passo del piano ti fa importare o completare i proprietari, le associazioni e le quote, i dati per i rendiconti e gli inviti al portale (vedi [[agenzie-proprietari]]).

### Le aree di lavoro
Un'area è un gruppo di pagine per un tipo di lavoro. Il nome e la descrizione sono quelli che vedi nel selettore:

| Area | A cosa serve | Chi la vede |
|---|---|---|
| **Affitti brevi** | Prenotazioni, calendario, prezzi e sito diretto | Chi gestisce affitti brevi |
| **Affitti lunghi** | Contratti, inquilini, scadenze e canoni | Chi gestisce affitti lunghi |
| **Amministrazione** | Persone, immobili e stato del tuo account | Titolare e amministratori; altri ruoli solo per le voci consentite |
| **Portale fornitori** | Richieste, disponibilità, servizi e vetrina | Chi ha un profilo fornitore |

C'è anche una «Console staff», riservata al personale di CasaZen: non la vedi e non serve a chi usa il prodotto.

Vedi solo le aree che il tuo ruolo permette e solo gli immobili che ti sono assegnati. Se hai una sola area, non c'è nulla da scegliere: in alto vedi solo il nome dell'area e della tua organizzazione. L'area che usi viene ricordata alla visita successiva.

### Com'è fatto il menu
- **Barra laterale (computer e tablet).** In alto c'è il selettore d'area con il nome della tua organizzazione. Sotto, le voci sono raggruppate con un titolo: per esempio in Affitti brevi «Ogni giorno», «La tua offerta» e «Gestione». In Amministrazione c'è «Il tuo account» e «Proprietari» (se attivo). Le voci hanno un numero rosso quando c'è qualcosa di urgente (per esempio gli adempimenti con rischio di sanzione o le attività urgenti).
- **Pagine collegate.** Molte voci hanno delle **schede** in alto nella pagina. Per esempio «Immobili» ha le schede «Interventi», «Fornitori fidati», «Canali e calendari», «Attivazione». Così il menu resta corto.
- **«Altro».** Raccoglie le pagine meno usate: per esempio in Affitti lunghi «Report fiscale» e «Spese condominiali», nel Portale fornitori «Profilo» e «Guida iCal». Contiene anche le pagine di una sezione che il tuo ruolo non può aprire. Si apre e si chiude con un tocco.
- **Impostazioni e inviti, in basso.** Le impostazioni dell'area (e «Consiglia CasaZen») sono fisse sotto il menu.
- **Comprimi menu / Espandi menu.** Riduce la barra alle sole icone. Sul tablet la barra è sempre ridotta; passando sopra un'icona ne vedi il nome.
- **Telefono: barra in basso.** Mostra quattro voci fisse e «Altro». In Affitti brevi sono «Cruscotto», «Calendario», «Prenotazioni», «Immobili». «Altro» apre un foglio con il resto del menu, il selettore d'area, il tuo account (profilo, lingua, «Esci»).
- **Menu del profilo.** Il cerchio con le tue iniziali in alto a destra apre: il tuo nome ed email, «Profilo», la lingua, «Le tue aree» (se ne hai più di una), «Personalizza area di lavoro» e «Esci».

**Le voci di Affitti brevi.** Le schede sono le pagine collegate che trovi in alto dentro la pagina. Non c'è una voce «Prezzi»: i prezzi si impostano dalla scheda di ogni immobile ([[prezzi-tariffe]]). In Affitti brevi la pagina iniziale si chiama «Cruscotto» (in alcune schermate «Home»).

| Gruppo | Voce | Schede in alto |
|---|---|---|
| Ogni giorno | Cruscotto | Da fare, Da approvare, Verifiche |
| Ogni giorno | Calendario | – |
| Ogni giorno | Adempimenti | Alloggiati, Report Alloggiati, CIN, Identificazione |
| Ogni giorno | Routine AI (su attivazione) | – |
| Ogni giorno | Prenotazioni | Ospiti, Recensioni, Flusso |
| Ogni giorno | Messaggi | – |
| La tua offerta | Immobili | Interventi, Fornitori fidati, Canali e calendari, Attivazione, OTA (su attivazione) |
| La tua offerta | Sito di prenotazione | – |
| La tua offerta | Marketplace | – |
| Gestione | Incassi | Ricavi, Report, Commercialista (su attivazione), Documenti, Regime fiscale, Documenti fiscali (su attivazione) |
| Gestione | CRM Ospiti (su attivazione) | Pubblici, Campagne, Duplicati |
| In fondo | Impostazioni | Organizzazione, Consiglia CasaZen, Aspetto sito, Dominio pubblico, Incorpora nel tuo sito (su attivazione), Documenti sito, Stripe Connect, Piano, Fatturazione, Portale ospiti (su attivazione), AI |

Non vedi tutte le voci: dipendono da ruolo, permessi e funzioni attive. In Amministrazione trovi «Home», «Persone», «Immobili», in fondo «Fatturazione» e «Impostazioni» (con il piano Agency anche «Proprietari» e «Chiusura mensile»). Affitti lunghi ha «Panoramica», «Immobili» e, in fondo, «Impostazioni» (schede «Organizzazione», «Consiglia CasaZen», «Piano», «Fatturazione»).

### «Cerca» e «Cerca nel menu»
- **«Cerca»** è la barra in alto («Cerca immobili, prenotazioni, ospiti, pagine…»; su telefono è la lente). Da computer si apre anche con **Ctrl + K** (su Mac **Cmd + K**). I risultati sono divisi in Azioni, Prenotazioni, Ospiti, Pagine, Immobili e Recenti. Scegli con le frecce, apri con Invio, chiudi con Esc. Fra le azioni ci sono «Aggiungi un immobile», «Crea una prenotazione», «Registra un pagamento», «Nuovo contratto», «Cambia area: [nome dell'area]», il cambio di lingua, «Esci» e, solo se la tua installazione ha un indirizzo di assistenza, «Scrivi all'assistenza». L'azione «Collega Airbnb o Booking.com» compare solo se il collegamento diretto con i portali è attivo (su attivazione): per collegare un calendario usa i calendari iCal ([[canali-octorate]]). Vedi solo ciò che il tuo ruolo permette.
- **«Cerca nel menu»** è il campo in cima al menu: trova le pagine e le loro schede per nome. Se non trova nulla vedi «Nessuna pagina trovata».
- Accanto a «Cerca» c'è il pulsante **«Chiedi a CasaZen»**: lo trovi in [[cruscotto-notifiche-assistente#chiedi-a-casazen]].

### La Guida e il manuale in app
Il pulsante **Guida** è in alto a destra. Se c'è qualcosa di urgente porta un numero. Si apre il pannello «La tua guida» con:
- **I passi per configurare CasaZen** (la checklist o il percorso, solo finché non è completo), con «Adesso», l'avanzamento («3 di 7 passi fatti») e «Continua» o «Vedi tutti i passi»;
- **Da fare adesso**: le prime cose da fare, dalla più urgente, con «Vedi tutte le cose da fare» (vedi [[cruscotto-notifiche-assistente#da-fare]]);
- **Ti serve una mano?**: «Apri il manuale di CasaZen» e, se la tua installazione ha un indirizzo di assistenza, «Scrivi all'assistenza».

Il manuale in app si chiama **Guida CasaZen** e ha 11 argomenti brevi: primi passi e aree di lavoro, immobili e pubblicazione, prenotazioni e calendario, calendari esterni e iCal, ospiti, check-in e privacy, Alloggiati e adempimenti, pagamenti e comunicazioni agli ospiti, organizzazione persone e permessi, affitti lunghi e contratti, fornitori e richieste di servizio, problemi frequenti e assistenza. Usa «Cerca nella guida» per filtrare e «Torna agli argomenti» per tornare all'elenco. Questo manuale lo approfondisce.

### Modalità demo
Esiste una modalità dimostrativa con dati di esempio, ma è una versione di prova dell'app: nella versione normale non c'è. Se vedi un avviso di dati dimostrativi, quello che inserisci non è reale.

### Titolare, amministratore e gli altri ruoli
Ogni persona di un'organizzazione ha **uno dei cinque ruoli** (tabella completa in [[account-team-piano#ruoli-e-permessi]]):
- **Titolare**: la persona che ha creato l'organizzazione. È **una sola**, non si può togliere né disattivare e oggi non si può cambiare. Fa tutto ciò che fa l'amministratore e in più è l'unica che nomina e modifica gli amministratori. **Occupa un posto del piano**, come ogni persona attiva.
- **Amministratore**: gestisce persone, permessi, piano, fatture e impostazioni come il titolare, ma non nomina né modifica altri amministratori e non chiude l'account.
- **Property manager**: gestisce immobili, prenotazioni, contratti, incassi e fornitori; niente piano e fatture.
- **Collaboratore**: lavora ogni giorno sugli immobili che gli assegni (arrivi, ospiti, interventi); vede i prezzi ma non li cambia e non vede gli incassi.
- **Contabile**: sola lettura su prenotazioni, incassi, contratti, canoni e fatture; è il ruolo adatto al commercialista.

Quando una pagina del manuale dice «serve essere amministratore», vale anche per il titolare. Se hai creato tu l'account sei il titolare e hai già tutti i permessi: le frasi «serve il permesso di…» riguardano le altre persone del team. Non confondere il ruolo «Property manager» con il profilo «Agenzia / Property manager» della registrazione: il profilo dice come usi CasaZen, il ruolo dice cosa può fare una persona.

### Cosa significa «Su attivazione»?
Nelle tabelle «Funzionalità» la colonna «Disponibilità» ha tre valori:
- **Disponibile**: la funzione c'è e la usi subito, se il tuo ruolo lo permette.
- **Su attivazione**: la funzione esiste ma **non è accesa di partenza**. Finché non è accesa non vedi la voce di menu, la scheda o il pulsante: non è un errore e non hai sbagliato niente.
- **In arrivo**: la funzione non c'è ancora. Non si può chiedere né attivare.

**Come si accende una funzione «su attivazione».** Dipende dalla funzione; la pagina che la spiega dice quale caso vale.
1. **La accende CasaZen.** Per esempio le routine AI, il CRM e le campagne, l'assistente per i messaggi, il pacchetto per il commercialista, l'emissione dei documenti fiscali, il portale ospiti e l'incorporamento nel tuo sito. Non c'è un'impostazione per farlo da te: la chiedi all'assistenza.
2. **Serve anche un modulo nel tuo piano.** Alcune funzioni fanno parte di un modulo («AI Agents», «CRM e Marketing», «Documenti fiscali», «Assistente AI per i messaggi», «Identificazione ospiti», «Prezzi e ricavi»…). Lo vedi in **Amministrazione › Fatturazione**, riquadro «Stato dei moduli» («Attivo» o «Disattivo»). Se una pagina ne richiede uno che non hai vedi «Aggiungi questo modulo al tuo piano», con «Gestisci piano e moduli» se sei amministratore. Quali moduli include ogni piano: [[account-team-piano#piano-limiti-e-moduli]].
3. **La configuri tu, quando è disponibile.** Alcune funzioni, una volta disponibili, vanno anche impostate da te (per esempio «Assistente acceso» in Impostazioni › AI).

**Non confonderla con altre «attivazioni»:** l'attivazione di un immobile (stato «Attivo») è la conferma finale che rende la casa prenotabile; «Attiva» nel percorso «Inizia con CasaZen» accende i flussi pronti; «Cosa manca nell'attivazione» è l'elenco di ciò che manca a un proprietario. Le fai tu e non c'entrano con «Su attivazione».

**Come vedi se una funzione è accesa.** Se la voce di menu o la scheda c'è, la funzione è accesa. Se manca, controlla se la riga del manuale dice «Su attivazione» e guarda lo «Stato dei moduli».

**A chi chiedere.** Se la pagina dice «Aggiungi questo modulo al tuo piano»: a chi gestisce il piano (titolare o amministratore), con «Gestisci piano e moduli». Se la funzione non c'è e non c'è un modulo da aggiungere: scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»), dicendo quale funzione ti serve e il nome della tua organizzazione. L'app non indica i tempi di attivazione. Se è «In arrivo» non c'è nulla da chiedere.

> **Nota:** «Accesso aperto» (Amministrazione › Fatturazione) alza i limiti del piano per un periodo, ma non accende le funzioni che CasaZen non ha ancora attivato.

### Assistenza: come scrivere a CasaZen
Il pulsante **Guida** (in alto a destra; su schermi stretti è l'icona della bussola) apre il pannello «La tua guida». In fondo, sotto «Ti serve una mano?», trovi «Apri il manuale di CasaZen» e, **se la tua installazione ha un indirizzo di assistenza**, «Scrivi all'assistenza». La stessa azione c'è in **«Cerca»**: scrivi «assistenza» o «aiuto».
- Premendola si apre il programma di posta del computer o del telefono con un messaggio già indirizzato all'assistenza (da «Cerca» con oggetto «Richiesta di assistenza»). Serve quindi un programma di posta impostato. Non è una chat: non parte nulla finché non invii tu il messaggio.
- Scrivi cosa stavi facendo, cosa ti aspettavi e cosa è successo, e il nome della tua organizzazione. **Non scrivere** password, dati di carte o documenti degli ospiti.
- Se non vedi «Scrivi all'assistenza», la tua installazione non ha un indirizzo di assistenza: rivolgiti a chi ti ha dato accesso a CasaZen o a chi amministra il tuo account.
- Usala per una funzione «su attivazione» che ti serve, per un problema che non risolvi con il manuale, o per chiedere la chiusura dell'account o la cancellazione dei dati.

## Come fare

### Ottenere un invito a CasaZen
**Ti serve:** un indirizzo e-mail che controlli.
1. Sul sito pubblico di CasaZen premi «Richiedi un invito». Si apre un'e-mail già pronta, con oggetto «Richiesta di invito a CasaZen».
2. Controlla il messaggio e invialo. Nulla parte finché non lo invii tu: il pulsante apre solo il tuo programma di posta.
3. Aspetta la risposta: CasaZen ti ricontatta. Il link dell'invito arriva per e-mail: aprilo e segui «Creare il tuo account e la tua attività».
4. Se non vedi «Richiedi un invito», chiedi a un host che usa già CasaZen di invitarti da **Impostazioni › Consiglia CasaZen** (vedi «Registrarti dopo l'invito di un amico»), oppure scrivi alla persona che ti ha presentato CasaZen.

### Creare il tuo account e la tua attività
**Ti serve:** un invito (o la pagina «Registrati su CasaZen», se il sito te la offre), un indirizzo e-mail che controlli, una carta per il pagamento su Stripe e, se ce l'hai, la Partita IVA.

> **Suggerimento:** prima di cominciare tieni pronti: l'e-mail con cui entrerai e una password; il Paese di fatturazione e la Partita IVA, se ce l'hai; per un'agenzia, il nome e il numero di camere previste; per la prima casa, nome, indirizzo con civico, comune, numero di ospiti, camere, letti e bagni. Il CIN (il codice nazionale della casa) non serve per iscriverti ma senza di lui non puoi attivare la casa: se non ce l'hai, chiedilo subito (vedi «Il primo giorno»).

1. Apri il link del tuo invito oppure la pagina di registrazione («Registrati su CasaZen»): ti dice «Ti stiamo portando alla registrazione…» e ti porta alla pagina di accesso sicura. Se la procedura si ferma, premi «Continua la registrazione».
2. Scegli la voce per registrarti, inserisci email e password e conferma.
3. Apri la email di conferma che ti arriva e premi il link. Vedi «Email confermata».
4. Premi «Accedi». Appare «Come vuoi usare CasaZen?».
5. Scegli la carta del tuo profilo: «Agenzia / Property manager» oppure «Proprietario privato». Se offri servizi, scegli «Fornitore di servizi» (vedi [[area-fornitore]]).
6. In «Quali affitti vuoi gestire?» scegli l'area. Per un'agenzia scrivi anche il nome e le camere previste.
7. Scegli il piano e gli eventuali extra, poi premi «Vai al riepilogo».
8. Controlla il riepilogo e premi «Continua al pagamento» (agenzia: «Continua all'attivazione»).
9. Leggi e spunta i documenti obbligatori, poi continua.
10. Inserisci Paese e, se ce l'hai, Partita IVA. Premi «Vai al pagamento sicuro» e completa su Stripe.
11. Tornato su CasaZen premi «Entra e inizia la configurazione».

Se qualcosa non va, il messaggio resta in alto: «Le tue scelte restano qui: riprova». Se i documenti legali sono cambiati mentre li leggevi, rileggili e accettali di nuovo.

> **Attenzione:** se vedi «La configurazione è salvata. Non riusciamo ancora a verificare l'accesso allo spazio di lavoro», non devi rifare nulla: premi «Verifica e continua».

### Accedere a CasaZen
**Ti serve:** un account già creato, con l'e-mail confermata. Se non ne hai uno, vedi «Come si entra: invito o registrazione».
1. Scrivi nel browser l'indirizzo di CasaZen seguito da **/login** (oppure premi «Accedi» dove c'è, o apri il link che ti serve: dopo l'accesso torni a quella pagina). Ti porta direttamente alla pagina di accesso sicura.
2. Nella pagina di accesso sicura inserisci email e password. Se hai dimenticato la password, cerca lì il link per reimpostarla (vedi «Password dimenticata»).
3. Se hai più aree, scegli quella da cui partire (vedi «Andare in Amministrazione o cambiare area di lavoro»).

Se la pagina ti dice che l'email non è verificata, apri il messaggio di conferma che hai ricevuto e riprova. Messaggi che puoi incontrare:
- «Questa pagina è riservata»: il tuo ruolo non include quella pagina. Premi «Chiedi l'accesso» o rivolgiti a chi amministra il tuo account; se l'account lo gestisci solo tu, scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»). Se ti hanno appena dato un nuovo ruolo, esci e accedi di nuovo per aggiornarlo.
- «Nessun accesso disponibile»: il tuo account non è ancora collegato a un'area di lavoro. Premi «Accedi di nuovo» o contatta l'amministratore per l'assegnazione dei ruoli.
- «Account disattivato»: un amministratore ha disattivato il tuo account. Premi «Esci» e, se pensi sia un errore, scrivi al supporto CasaZen o alla persona che ti ha dato accesso.
- «Seleziona workspace»: hai più aree e devi sceglierne una. Se non hai ancora un'organizzazione vedi «Attiva affitti brevi e lunghi», che ti porta alla configurazione.

### Entrare in un team con un invito
1. Apri la email di invito e premi il link. Vedi «[Organizzazione] ti ha invitato su CasaZen» con ruolo, aree e scadenza dell'invito.
2. Premi «Crea il tuo account» se sei nuovo, oppure «Ho già un account: accedi».
3. Accedi con **lo stesso indirizzo a cui è arrivato l'invito**. Se sei collegato con un altro indirizzo, premi «Esci e accedi con l'indirizzo invitato».
4. Se il tuo indirizzo non è ancora verificato, apri la email di conferma e poi premi «Ho verificato l'email, accedi di nuovo».
5. Premi «Accetta e entra». Entrando accetti di nuovo Termini, Privacy e DPA.
6. Vedi «Benvenuto in [Organizzazione]».

L'invito vale 7 giorni. Se è scaduto, usato, annullato o non valido, te lo dice e devi chiederne uno nuovo a chi ti ha invitato. Se hai già un'organizzazione con dei dati, l'invito non si può accettare con quell'account: usa un altro indirizzo o scrivi al supporto.

### Registrarti dopo l'invito di un amico
1. Apri il link ricevuto per email: vedi «[Nome] ti ha invitato su CasaZen».
2. Premi «Crea il tuo account» (o «Ho già un account»), con la stessa email dell'invito.
3. Dopo l'accesso vedi «Invito accettato». Premi «Continua» e prosegui con la configurazione.

Se non riesce a collegare l'invito, puoi premere «Continua senza invito»: il tuo account funziona comunque.

### Mettere in pausa la configurazione
1. Nei passaggi «Piano e funzionalità» o «Riepilogo» premi «Metti in pausa».
2. Vedi «Configurazione in pausa». Le scelte restano **in questa scheda del browser per 24 ore**.
3. Per riprendere premi «Riprendi la configurazione», oppure riapri la pagina: riparti dal passaggio salvato e vedi «Abbiamo recuperato le scelte salvate in questa scheda».

> **Attenzione:** dopo una ricarica devi confermare di nuovo i documenti. Se chiudi la scheda o passa più di un giorno, le scelte si perdono: ripeti i passaggi.

### Seguire i passi della Guida
1. Premi **Guida** in alto a destra.
2. Leggi «Adesso» e premi «Continua»: si apre la procedura giusta.
3. Quando finisci un passo, ti proponiamo il successivo. Puoi fermarti quando vuoi: riprendi da dove eri.
4. Per vedere tutti i passi premi «Vedi tutti i passi».

### Seguire il percorso «Inizia con CasaZen»
Disponibile su attivazione. Lo apri da **Guida › Vedi tutti i passi** o dal benvenuto.
1. Nella pagina «Inizia con CasaZen» leggi la carta «Prossimo passo» e premi «Continua».
2. Ogni parte spiega cosa fa, cosa ti serve e cosa manca immobile per immobile. Premi «Fai ora» o «Riprendi» per aprire la procedura guidata.
3. Se non puoi farlo adesso premi «Lo faccio dopo», scegli quando ricordartelo e conferma. Lo trovi in **Da fare**.
4. Per uscire premi «Salva ed esci».
5. Alla fine apri «Riepilogo e attivazione», fai la prova finale e premi «Attiva» (solo l'amministratore).

### Andare in Amministrazione o cambiare area di lavoro
**Ti serve:** più di un'area. Se ne hai una sola non c'è nulla da scegliere. «Amministrazione» la vedono il titolare e gli amministratori: se non c'è nell'elenco, il tuo ruolo non la include.
1. Apri il selettore d'area. **Computer o tablet:** in alto nella barra laterale premi il nome dell'area attuale («Cambia area»). **Telefono:** premi «Altro» nella barra in basso, poi il selettore d'area in cima al foglio.
2. Scegli l'area nell'elenco: si apre la sua pagina iniziale.

In alternativa, da qualsiasi pagina: menu del profilo, sotto «Le tue aree», oppure «Cerca» con l'azione «Cambia area: [nome dell'area]».

### Muoverti nel menu
1. Usa le voci della barra laterale (o della barra in basso su telefono).
2. Dentro una pagina usa le schede in alto per le pagine collegate.
3. Cerca nell'elenco con «Cerca nel menu».
4. Per ridurre la barra premi «Comprimi menu»; per riaprirla «Espandi menu».

### Trovare una pagina
1. Premi la barra «Cerca» in alto, oppure **Ctrl + K** (Mac: **Cmd + K**).
2. Scrivi il nome di un immobile, di un ospite, di una prenotazione o di una pagina.
3. Scegli il risultato con le frecce e premi Invio.

### Usare la Guida
1. Premi **Guida** in alto a destra (su schermi stretti è l'icona della bussola).
2. Segui «Adesso» o apri una «cosa da fare».
3. Per la guida breve dell'app premi «Apri il manuale di CasaZen»; «Torna alla pagina di partenza» ti riporta dove eri.

### Aprire il manuale completo dall'app
1. In alto a destra premi **Guida** e, sotto «Ti serve una mano?», premi «Apri il manuale di CasaZen»: si apre la pagina «Guida CasaZen» (11 argomenti brevi).
2. In quella pagina cerca il link «Apri il manuale completo: guide passo passo, elenco delle funzionalità e domande frequenti» (oggi è in fondo alla pagina).
3. Premilo: il manuale si apre in una nuova scheda. Il manuale è pubblico: lo apri anche senza accedere, con l'indirizzo di CasaZen seguito da /guida/.

### Scrivere all'assistenza di CasaZen
**Ti serve:** un programma di posta impostato sul computer o sul telefono, e che la tua installazione abbia un indirizzo di assistenza.
1. In alto a destra premi **Guida**.
2. In fondo, sotto «Ti serve una mano?», premi «Scrivi all'assistenza» (oppure apri «Cerca» e scegli «Scrivi all'assistenza»).
3. Si apre un messaggio già indirizzato all'assistenza: scrivi cosa stavi facendo, cosa ti aspettavi e cosa è successo, poi invialo.

Se non vedi «Scrivi all'assistenza», vedi «Assistenza: come scrivere a CasaZen».

### Personalizzare l'area di lavoro
1. Apri il menu del profilo (avatar in alto a destra) e premi «Personalizza area di lavoro».
2. Scegli le voci da tenere in primo piano: le altre restano in «Altre funzioni» e nella ricerca.
3. Opzioni: «Tabelle e margini compatti», «Mostra prima le attività nel cruscotto», «Nei percorsi guidati, tieni chiuso l'elenco dei passaggi», «Configurazione per immobile».
4. Premi «Fine». Per tornare indietro usa «Ripristina vista iniziale».

Le preferenze si salvano **su questo dispositivo**, per il tuo profilo e per l'area in cui sei.

### Cambiare lingua
1. Apri il menu del profilo.
2. Sotto «Lingua» scegli quella che vuoi.

## Flussi completi

### Flusso: dalla registrazione al primo giorno di lavoro (gestore di affitti brevi)
1. **Tu:** crei l'account e scegli profilo, area Affitti brevi e piano (vedi «Creare il tuo account e la tua attività»).
2. **Tu:** confermi i documenti e paghi su Stripe.
3. **CasaZen:** crea la tua organizzazione e ti porta sulla Home di Affitti brevi; se non hai immobili ti apre «Aggiungi il tuo primo immobile» (con il percorso guidato, se attivo, apre «Inizia con CasaZen»).
4. **Tu:** completi l'immobile ([[immobili]]) e segui i passi della Guida.
5. **Tu:** colleghi i calendari e imposti prezzi ([[canali-octorate]], [[prezzi-tariffe]]).
6. **Tu:** controlli ogni giorno **Cruscotto** e **Da fare** ([[cruscotto-notifiche-assistente]]).

### Flusso: entrare in un team
1. **Un amministratore** apre **Amministrazione › Persone › Invita**, sceglie ruolo, aree e immobili e invia ([[account-team-piano#invitare-una-persona-nel-team]]).
2. **CasaZen** manda l'email (dopo 3 giorni un promemoria).
3. **Tu** apri il link, accedi con lo stesso indirizzo e premi «Accetta e entra».
4. **CasaZen** ti porta nelle aree che ti sono state assegnate.

## Il primo giorno: cosa fare e in che ordine
Il primo giorno non basta mezz'ora. **Account e prima casa** richiedono di solito circa mezz'ora (è una stima); **il resto** (CIN, calendari, prezzi, attivazione della casa, pagamenti, sito, adempimenti, team) lo fai nei giorni dopo, un passo alla volta: la **Guida** ti ricorda a che punto sei. Se manca il CIN, la casa resta «Da completare» finché non lo inserisci. L'ordine consigliato è questo; [[inizia-qui]] lo riassume.

### Gestore di affitti brevi
1. **Registrazione.** Crea l'account e la tua attività come in «Creare il tuo account e la tua attività». Tieni pronti i dati della prima casa.
2. **La prima casa.** In «Aggiungi il tuo primo immobile» inserisci nome, indirizzo con civico, comune, ospiti, camere, letti e bagni; foto e testi puoi aggiungerli dopo ([[immobili]]).
3. **Chiedi subito il CIN, se non ce l'hai.** Il CIN è il codice nazionale che identifica ogni casa in affitto breve in Italia: va esposto fuori dalla casa e scritto in ogni annuncio. Apri **Adempimenti › CIN** e premi «Richiedi il CIN sul portale»: si apre il sito del Ministero del Turismo (BDSR), dove segui la procedura (nella richiesta dichiari anche i requisiti di sicurezza della casa). Il rilascio non dipende da CasaZen e i tempi li decide il Ministero. Per le case in Svizzera il CIN non serve ([[cin-identificazione-ticino]]).
4. **Collega i calendari.** Se affitti anche su Airbnb o Booking.com, collega i calendari iCal dalla scheda dell'immobile (non dalla barra «Cerca») e incolla il link di CasaZen sui portali, così le date restano allineate. Se non usi portali, inserisci a mano le prenotazioni ([[canali-octorate]], [[prenotazioni]]).
5. **Imposta il prezzo.** Prezzo per notte, pulizie e soggiorno minimo si impostano dalla scheda dell'immobile ([[prezzi-tariffe]]).
6. **Attiva la casa.** In Immobili premi «Completa», leggi «Cosa manca» e correggi punto per punto; poi accetta i Termini e premi «Attiva l'immobile». Finché non è «Attivo» la casa non riceve prenotazioni; se «Mostra la casa sul sito» è spento gli ospiti non la prenotano dal tuo sito ([[immobili]]).
7. **Se vuoi le prenotazioni dirette:** collega Stripe (**Impostazioni › Stripe Connect**: Stripe ti guida nella verifica dei dati dell'attività e del conto su cui ricevere i pagamenti) e pubblica l'informativa privacy e i termini del tuo sito ([[incassi]], [[sito-prenotazione]]).
8. **Adempimenti di legge.** Imposta chi invia i dati degli ospiti e le credenziali per Alloggiati Web e, dove serve, ISTAT ([[alloggiati-istat]]).
9. **Abitudini di ogni giorno.** Apri **Cruscotto** e **Da fare**, imposta **Profilo › Notifiche** ([[cruscotto-notifiche-assistente]], [[account-team-piano]]) e, se lavori con altre persone, invitale da **Amministrazione › Persone** dopo aver aggiunto le case.

### Gestore di affitti lunghi
1. **Registrazione.** Scegli l'area «Affitti lungo termine» nel piano (o «Affitti brevi e lunghi»).
2. **Il primo immobile.** Nella Panoramica premi «Aggiungi immobile». Per aggiungerlo bastano indirizzo e comune; l'APE (attestato di prestazione energetica) e i dati catastali puoi completarli dopo, ma **ti servono prima di «Crea contratto»** ([[affitti-lunghi]]).
3. **Il primo contratto.** Premi «Crea contratto»: ti accompagna fino a firma e registrazione, con cedolare secca e scadenze. La registrazione all'Agenzia delle Entrate resta a te ([[contratti]]).
4. **Scadenze e canoni.** Apri «Scadenze» e «Canoni» per vedere cosa ti aspetta ([[canoni-scadenze]]).

### Fornitore di servizi
1. **Registrazione.** Nella scelta del profilo premi «Fornitore di servizi»: si apre la registrazione dei fornitori, che può essere aperta oppure solo su invito (vedi «Come si entra: invito o registrazione»).
2. **Attivazione del profilo.** Cinque passi: «Dati dell'attività», «Servizi e comuni», «Vetrina e foto», «Presentazione», «Termini e attivazione». Premi «Attiva profilo». Puoi interrompere e riprendere ([[area-fornitore]]).
3. **Non hai finito.** Perché gli host ti trovino servono anche gli orari di lavoro e almeno un servizio con il prezzo; collega il calendario ([[area-fornitore]], [[vetrina-fornitore]]).

## Regole e limiti
- La pagina di accesso non è di CasaZen: password e conferma dell'email sono gestite dal servizio di accesso.
- **Invito in un team**: vale 7 giorni; dopo 3 giorni CasaZen manda un promemoria; si accetta solo con l'indirizzo a cui è arrivato; non si accetta con un account che ha già un'organizzazione con dati; gli account dello staff CasaZen non possono entrare in un'organizzazione cliente.
- **Invito di un amico host**: non assegna ruoli né sconti sul piano; vale come presentazione.
- **Pausa**: le scelte restano in quella scheda per 24 ore; dopo una ricarica i documenti vanno confermati di nuovo.
- **Pagamento**: avviene su Stripe; l'accesso si attiva dopo la conferma. Gli importi sono quelli mostrati nelle pagine dei piani, IVA esclusa o inclusa come indicato.
- **Benvenuto**: solo all'amministratore dell'organizzazione, una volta per persona su questo dispositivo, solo sulla Home di Affitti brevi.
- **Rimandare o attivare** nel percorso «Inizia con CasaZen»: solo l'amministratore.
- **Documenti legali aggiornati**: vanno riaccettati per continuare a usare le funzioni per gli host.
- **Barra inferiore su telefono**: al massimo quattro voci più «Altro». Il menu di un'area ha al massimo 11 voci principali.
- Le aree e le pagine dipendono da ruolo, immobili assegnati, piano e funzioni attivate: se una voce manca, non è un errore.

## Domande frequenti

### Non vedo l'area che mi serve. Perché?
Vedi solo le aree consentite dal tuo ruolo. Chiedi a chi amministra il tuo account di controllare ruolo e aree da **Amministrazione › Persone** ([[account-team-piano]]).

### Ho chiuso la scheda durante la configurazione. Ho perso tutto?
Se premi «Metti in pausa» e riapri la pagina nella stessa scheda entro 24 ore, riparti dal passaggio salvato. Se la scheda è stata chiusa, devi rifare i passaggi.

### Posso cambiare piano o area dopo la registrazione?
Sì. Il piano e le aree si gestiscono in **Amministrazione › Fatturazione** ([[account-team-piano#piano-limiti-e-moduli]]). Il tipo di operatore lo cambi dal Profilo.

### Il link di invito non funziona.
Può essere scaduto (vale 7 giorni), già usato, annullato o sostituito da uno più recente. Apri l'ultima email o chiedi un nuovo invito a chi ti ha invitato.

### Come cambio la lingua?
Dal menu del profilo, sotto «Lingua».

### Come scrivo all'assistenza? Non c'è un numero di telefono.
Non c'è un numero: si scrive. In alto premi **Guida**: nel pannello, sotto «Ti serve una mano?», trovi «Scrivi all'assistenza» se la tua installazione ha un indirizzo configurato. In «Cerca» c'è la stessa azione. Passi e cosa scrivere: «Scrivere all'assistenza di CasaZen».

### Cos'è CasaZen e cosa posso farci?
È il gestionale per chi affitta case a breve o a lungo termine: calendario e prenotazioni, ospiti e check-in, adempimenti, incassi e documenti, e un sito per le prenotazioni dirette. Affianca Airbnb e Booking.com, non li sostituisce. Non è una banca né un consulente fiscale o legale.

### Da dove comincio?
Leggi «Il primo giorno» in questa pagina oppure [[inizia-qui]]: account, prima casa, CIN, calendari, prezzi, attivazione, sito, team. Il pulsante **Guida** in alto a destra ti dice sempre il prossimo passo.

### Devo pagare per usare CasaZen? Quanto costa?
I piani (Starter, Pro, Scale, Agency) e i prezzi li vedi prima di pagare, al passaggio «Piano e funzionalità», e poi in **Amministrazione › Fatturazione**. Si paga con carta su Stripe. Se in «Fatturazione e piano» leggi «Accesso aperto», l'app dice che per ora non addebita nulla. Vedi «Quanto paghi e quando».

### Non ho un invito: come faccio a registrarmi?
Premi «Richiedi un invito» sul sito pubblico di CasaZen, oppure chiedi a un host che usa già CasaZen di invitarti. Passi in «Ottenere un invito a CasaZen».

### Ho dimenticato la password. Cosa faccio?
La password la gestisce la pagina di accesso sicura, non CasaZen. In quella pagina cerca il link per reimpostarla (di solito «Password dimenticata») e segui le istruzioni che ricevi per email.

### Posso usare CasaZen dal telefono?
Sì, dal browser del telefono: il menu diventa una barra in basso. L'app «CasaZen» per telefono non è ancora negli store e non sostituisce il sito ([[app-mobile]]).

### Non vedo un pulsante o una voce di menu di cui parla il manuale. Perché?
Dipende da ruolo, immobili assegnati, piano e funzioni attive. Se la funzione è «Su attivazione» o il tuo ruolo non la include, non compare: non è un errore. Vedi «Cosa significa «Su attivazione»?» e chiedi a chi amministra l'account o all'assistenza.

### Una funzione dice «Su attivazione»: cosa devo fare?
Controlla se serve un modulo nel tuo piano («Stato dei moduli» in Amministrazione › Fatturazione); se non c'è un modulo da aggiungere, scrivi all'assistenza dicendo quale funzione ti serve. Dettagli in «Cosa significa «Su attivazione»?».

### Qual è la differenza tra titolare e amministratore?
Il titolare è uno solo (chi ha creato l'organizzazione), non si può togliere né cambiare e nomina gli amministratori; l'amministratore gestisce persone, piano, fatture e impostazioni ma non nomina altri amministratori. Entrambi occupano un posto del piano.

## Glossario
- **Area**: gruppo di pagine per un tipo di lavoro (Affitti brevi, Affitti lunghi, Amministrazione, Portale fornitori). Nel selettore d'area può comparire anche come «workspace».
- **Organizzazione**: la tua attività su CasaZen; ha un titolare, persone e immobili.
- **Titolare**: chi ha creato l'organizzazione; uno solo, non si può togliere né disattivare e oggi non si può cambiare. Ha tutti i permessi dell'amministratore e nomina gli amministratori. Occupa un posto del piano.
- **Amministratore**: persona con tutti i permessi sull'organizzazione, tranne la nomina o la modifica di altri amministratori (solo il titolare).
- **Collaboratore**: ruolo di chi lavora ogni giorno sugli immobili assegnati: vede i prezzi ma non li cambia e non vede gli incassi. Non è un modo generico per dire «persona del team».
- **Property manager**: come ruolo, chi gestisce immobili, prenotazioni, contratti, incassi e fornitori senza toccare piano e fatture; come profilo della registrazione («Agenzia / Property manager»), chi gestisce case per conto di altri.
- **Contabile**: ruolo di sola lettura su prenotazioni, incassi, contratti, canoni e fatture, adatto al commercialista.
- **Su attivazione**: funzione non accesa di partenza: la accende CasaZen, oppure serve un modulo del piano. Se non la vedi non è un errore. Vedi «Cosa significa «Su attivazione»?».
- **In arrivo**: funzione che non c'è ancora; non si può chiedere né attivare.
- **Modulo**: funzione extra del piano (per esempio «CRM e Marketing»); lo stato dei moduli sta in Amministrazione › Fatturazione.
- **Piano**: l'abbonamento (Starter, Pro, Scale, Agency) che stabilisce quante case e persone puoi avere e quali funzioni usi.
- **Accesso aperto**: avviso in «Fatturazione e piano» con cui l'app dice che per ora non addebita nulla e sblocca i limiti del piano.
- **Stripe**: il servizio di pagamento con carta usato da CasaZen; i dati della carta restano a Stripe.
- **CIN**: codice nazionale che identifica ogni casa in affitto breve in Italia; va esposto fuori dalla casa e scritto negli annunci. Lo chiedi sul portale del Ministero del Turismo (BDSR).
- **Cruscotto / Home**: la pagina iniziale di un'area; in Affitti brevi si chiama «Cruscotto».
- **Immobile**: la casa o l'appartamento che affitti. In alcune schermate si chiama anche «casa», «alloggio», «struttura» o «proprietà»; l'«annuncio» è invece la pagina della casa su un portale come Airbnb o Booking.com.
- **Host**: chi gestisce case e prenotazioni su CasaZen, di solito il proprietario o chi lavora per lui. Il manuale lo chiama «gestore»; l'app e il sito usano spesso «host».
- **Conduttore**: l'inquilino, cioè chi prende la casa in affitto con un contratto. I contratti e l'«Area conduttore» dicono «conduttore»; il manuale dice anche «inquilino».
- **Portale**: parola con più sensi. Può essere un sito di prenotazione come Airbnb o Booking.com; una pagina riservata di CasaZen per una persona (portale ospite, «Portale proprietari», «Portale fornitori»); il sito di un ente pubblico, come Alloggiati Web o quello del Ministero del Turismo per il CIN.
- **Scheda** (di una pagina): voce collegata, mostrata in alto nella pagina.
- **Guida**: tre cose con lo stesso nome: il pulsante **Guida** in alto a destra (cosa fare adesso e come chiedere aiuto), la pagina «Guida CasaZen» (11 argomenti brevi dentro l'app) e questo manuale completo.

## Vedi anche
- [[account-team-piano]]: persone, ruoli, piano e fatturazione.
- [[cruscotto-notifiche-assistente]]: cosa vedi ogni giorno, notifiche e «Chiedi a CasaZen».
- [[immobili]]: aggiungere e attivare un immobile.
- [[area-fornitore]]: attivazione e lavoro del fornitore.
