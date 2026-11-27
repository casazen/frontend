---
id: inizia-qui
titolo: Inizia qui
sezione: Per iniziare
ordine: 0
riassunto: La pagina da leggere per prima. Scegli chi sei (gestore di affitti brevi o lunghi, agenzia, proprietario di una casa gestita da un'agenzia, fornitore, ospite, inquilino o chi usa il telefono) e segui i passi nell'ordine giusto: ognuno rimanda alla guida che lo spiega.
chi: [gestore, amministratore, proprietario, commercialista, fornitore, ospite, inquilino]
dove: Guida CasaZen › Inizia qui
parole_chiave: [inizia qui, cominciare, iniziare, da dove comincio, da dove parto, primi passi, primo accesso, prima volta, sono nuovo, nuovo utente, cos'è CasaZen, a cosa serve, registrarmi, iscrivermi, quale percorso, guida rapida, host, idraulico, ospite, inquilino, proprietario, agenzia, fornitore, telefono]
copre: []
stato: disponibile
fonte_codice: [frontend/src/site/components/site-pages-content.tsx, frontend/src/routes/index.tsx, frontend/src/routes/tenantAreaRoutes.tsx, frontend/src/routes/ownerPortalRoutes.tsx, frontend/src/pages/login-page.tsx, frontend/src/pages/supplier-register-page.tsx, frontend/src/features/tenant-area/tenant-contract-page.tsx, frontend/src/i18n/locales/it.json, backend/Casazen.Core/Options/ServiceRequestOptions.cs, mobile/app.json, mobile/app/login.tsx]
---

## In breve
**CasaZen** è il gestionale per chi affitta case in Italia, a breve o a lungo termine: calendario, prenotazioni, ospiti, adempimenti di legge, incassi e documenti in un posto solo, più un sito dove gli ospiti prenotano direttamente da te. Ci lavorano insieme a te fornitori (pulizie, idraulico, manutenzione), proprietari che si affidano a un'agenzia, ospiti e inquilini.

**Cosa non fa:**
- **Non sostituisce Airbnb e Booking.com: li affianca.** Con i calendari iCal allinea le date, non i prezzi. Il collegamento a un channel manager (Octorate) è su attivazione ([[canali-octorate]]).
- **Non è una banca.** I pagamenti con carta del tuo sito passano da Stripe e arrivano sul tuo conto ([[incassi]]).
- **Non è consulenza legale o fiscale.** Ti ricorda le scadenze e prepara i dati; gli obblighi di legge restano tuoi.
- **Non è un pronto intervento.** Con acqua che allaga, odore di gas o scintille chiama subito un tecnico o i soccorsi.

Trova chi sei in «Quale percorso è il tuo?» e segui i passi.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Percorso del gestore di affitti brevi | Dall'account alla prima prenotazione | Guida › Inizia qui | gestore, amministratore | Disponibile | Iniziare come gestore di affitti brevi |
| Percorso del gestore di affitti lunghi | Dall'immobile al contratto e ai canoni | Guida › Inizia qui | gestore, amministratore | Disponibile | Iniziare come gestore di affitti lunghi |
| Percorso dell'agenzia | Dai proprietari ai rendiconti mensili | Guida › Inizia qui | amministratore, gestore | Su attivazione | Iniziare come agenzia |
| Percorso del proprietario | Entrare nel portale e leggere i rendiconti | Guida › Inizia qui | proprietario | Su attivazione | Iniziare come proprietario di un immobile gestito da un'agenzia |
| Percorso del fornitore | Dall'invito alla prima richiesta | Guida › Inizia qui | fornitore | Disponibile | Iniziare come fornitore |
| Percorso dell'ospite | Dalla ricerca al check-in online | Guida › Inizia qui | ospite | Disponibile | Iniziare come ospite |
| Percorso dell'inquilino | Entrare nella tua area, pagare, segnalare un guasto | Guida › Inizia qui | inquilino | Disponibile | Iniziare come inquilino |
| Percorso dal telefono | Browser del telefono e stato dell'app | Guida › Inizia qui | gestore, fornitore, ospite, inquilino | Disponibile | Iniziare dal telefono |

## Come funziona

### Quale percorso è il tuo?
| Chi sei | Cosa vuoi fare | Il tuo percorso |
|---|---|---|
| **Gestore di affitti brevi** | Affitti case per poche notti (come su Airbnb) e vuoi ricevere prenotazioni | [[inizia-qui#iniziare-come-gestore-di-affitti-brevi]] |
| **Gestore di affitti lunghi** | Affitti una casa a un inquilino con un contratto | [[inizia-qui#iniziare-come-gestore-di-affitti-lunghi]] |
| **Agenzia** | Gestisci le case di altri e prepari ogni mese i rendiconti | [[inizia-qui#iniziare-come-agenzia]] |
| **Proprietario** | La casa è tua, ma la gestisce un'agenzia che usa CasaZen | [[inizia-qui#iniziare-come-proprietario-di-un-immobile-gestito-da-un-agenzia]] |
| **Fornitore** | Fai pulizie, idraulica, lavori elettrici o manutenzione e vuoi ricevere lavori | [[inizia-qui#iniziare-come-fornitore]] |
| **Ospite** | Hai prenotato, o vuoi prenotare, una casa | [[inizia-qui#iniziare-come-ospite]] |
| **Inquilino** | Vivi in una casa in affitto e il tuo proprietario usa CasaZen | [[inizia-qui#iniziare-come-inquilino]] |
| **Dal telefono** | Apri CasaZen dal telefono o vuoi sapere dell'app | [[inizia-qui#iniziare-dal-telefono]] |

**Sei un commercialista?** Non hai un percorso tuo: il gestore può darti accesso con il ruolo «Contabile», di sola lettura, oppure mandarti il pacchetto di fine mese ([[report-commercialista]]).

### Quattro cose da sapere prima di cominciare
1. **Invito o registrazione.** CasaZen è in fase di avvio: chi gestisce case, o è fornitore, di solito entra su invito («Richiedi un invito» sul sito pubblico). Ospiti e inquilini non ne hanno bisogno: l'ospite prenota senza account, l'inquilino entra con l'e-mail del suo contratto. Vedi [[per-iniziare#come-si-entra-invito-o-registrazione]].
2. **Vedi solo ciò che serve a te.** Menu e pagine cambiano con ruolo, immobili assegnati, piano e funzioni attivate: se una voce manca non è un errore. Chi ha creato l'account è il titolare e ha tutti i permessi ([[per-iniziare#titolare-amministratore-e-gli-altri-ruoli]]).
3. **«Su attivazione».** La funzione non è accesa di partenza: la accende CasaZen, oppure serve un modulo del tuo piano ([[per-iniziare#cosa-significa-su-attivazione]]).
4. **Assistenza.** Non c'è un numero di telefono: in alto premi **Guida** e scegli «Scrivi all'assistenza». La voce compare solo se la tua installazione ha un indirizzo di assistenza ([[per-iniziare#assistenza-come-scrivere-a-casazen]]).

## Come fare

### Iniziare come gestore di affitti brevi
**Ti serve:** un invito (o la pagina «Registrati su CasaZen», se il sito te la offre), un'e-mail che controlli, una carta per il pagamento su Stripe e, della prima casa, nome, indirizzo con civico, comune, ospiti, camere, letti e bagni. Il CIN, se ce l'hai.

1. **Crea il tuo account e la tua attività.** Scegli profilo, area «Affitti brevi» e piano, conferma i documenti e paga su Stripe. *Cosa ottieni:* la tua organizzazione, di cui sei titolare. Vedi [[per-iniziare#creare-il-tuo-account-e-la-tua-attivita]].
2. **Aggiungi la prima casa.** In «Aggiungi il tuo primo immobile» scrivi nome, indirizzo, comune e prezzo per notte. *Cosa ottieni:* la casa esiste, ma non riceve ancora prenotazioni. Vedi [[immobili#aggiungere-il-primo-immobile]].
3. **Chiedi subito il CIN, se non ce l'hai.** È il codice nazionale della casa: senza, la casa non si attiva. Apri **Adempimenti › CIN** e premi «Richiedi il CIN sul portale»; il rilascio non dipende da CasaZen. Per una casa in Svizzera il CIN non serve. Vedi [[cin-identificazione-ticino#chiedere-il-cin]].
4. **Allinea i calendari.** Se affitti anche su Airbnb o Booking.com, collega il calendario di ogni portale con il link iCal e incolla il link di CasaZen sui portali. Attenzione: i calendari iCal non portano le prenotazioni da un portale all'altro, quindi da soli non evitano le doppie prenotazioni. Vedi [[canali-octorate#collegare-un-calendario-ical]] e [[canali-octorate#evitare-le-doppie-prenotazioni-tra-portali-con-i-calendari-ical]].
5. **Imposta prezzi e cancellazione.** Senza una politica di cancellazione, un ospite che annulla dal tuo sito riceve indietro solo l'imposta di soggiorno. Vedi [[prezzi-tariffe#impostare-i-prezzi-prezzo-base-weekend-e-pulizia]] e [[prezzi-tariffe#impostare-la-politica-di-cancellazione]].
6. **Attiva la casa.** In Immobili premi «Completa», correggi quello che manca e attiva. *Cosa ottieni:* con «Mostra la casa sul sito» acceso, la casa compare sul tuo sito di prenotazione. Vedi [[immobili#completare-l-attivazione-di-un-immobile]].
7. **Collega Stripe e copia il link del sito.** In **Impostazioni › Stripe Connect** porta lo stato su «Attivo»; poi pubblica informativa privacy e termini e copia il link. *Cosa ottieni:* un indirizzo dove l'ospite sceglie le date, paga e prenota. Vedi [[incassi#collegare-stripe-per-ricevere-i-pagamenti-online]] e [[sito-prenotazione#controllare-il-tuo-sito-e-copiare-il-link]].
8. **Capisci gli adempimenti.** Scegli chi invia i dati degli ospiti (Alloggiati Web, ISTAT) e manda agli ospiti il link per il check-in online. CasaZen ti mostra le scadenze, ma l'obbligo è tuo. Vedi [[alloggiati-istat#scegliere-chi-invia-i-dati-degli-ospiti]] e [[ospiti-checkin]].
9. **Ogni giorno apri il Cruscotto e «Da fare».** Scegli come essere avvisato in Profilo › Notifiche. La prima prenotazione arriva dal tuo sito, da un portale o la inserisci a mano. Vedi [[cruscotto-notifiche-assistente#leggere-il-cruscotto-ogni-giorno]], [[account-team-piano#impostare-le-preferenze-di-notifica]] e [[prenotazioni]].

**Se qualcosa non va:** se un pulsante o una voce non compare, vedi «Quattro cose da sapere prima di cominciare». Se l'ospite legge «Le prenotazioni online sono in pausa», Stripe non è ancora «Attivo». Per altro, scrivi all'assistenza di CasaZen.

### Iniziare come gestore di affitti lunghi
**Ti serve:** l'area «Affitti lungo termine» (o «Affitti brevi e lunghi») nel piano; indirizzo, dati catastali (foglio, particella, subalterno) e APE della casa; i dati di chi affitta e di chi prende la casa (tra cui codice fiscale ed e-mail).

1. **Crea il tuo account** scegliendo l'area «Affitti lungo termine». Vedi [[per-iniziare#creare-il-tuo-account-e-la-tua-attivita]].
2. **Aggiungi la casa.** Apri **Affitti lunghi › Immobili** e premi «Aggiungi immobile». Per aggiungerla bastano indirizzo e comune, ma l'APE e i dati catastali ti servono prima di creare il contratto. Vedi [[affitti-lunghi]].
3. **Crea il contratto.** Premi «Crea contratto» e segui i passi fino alla firma; se è già firmato, caricalo. Vedi [[contratti]].
4. **Registra il contratto.** CasaZen ti guida e ti ricorda le scadenze, ma la registrazione all'Agenzia delle Entrate resta a te. Vedi [[contratti]].
5. **Attiva il piano dei canoni e controlla chi ha pagato.** *Cosa ottieni:* le rate con le loro scadenze. Vedi [[canoni-scadenze]].
6. **Fai entrare l'inquilino nella sua area:** scrivi la sua e-mail nel contratto e digli l'indirizzo dell'area. Vedi [[area-inquilino]].

**Se qualcosa non va:** se manca l'area «Affitti lunghi», aggiungila al piano in Amministrazione › Fatturazione. Se non riesci a creare il contratto, controlla che la casa abbia l'APE e i dati catastali.

### Iniziare come agenzia
**Ti serve:** un invito, il nome dell'agenzia e le camere previste, una carta per l'attivazione e, per ogni proprietario, nome o ragione sociale, e-mail e quota di ogni immobile.

1. **Crea l'account come «Agenzia / Property manager»,** con nome dell'agenzia e camere previste. L'addebito è a fine mese, sulle unità attive. *Cosa ottieni:* sei titolare e amministratore. Vedi [[per-iniziare#creare-il-tuo-account-e-la-tua-attivita]].
2. **Invita i collaboratori** da **Amministrazione › Persone**, scegliendo ruolo, aree e immobili. Se sei un collaboratore, parti dal passo 3. Vedi [[account-team-piano#invitare-una-persona-nel-team]].
3. **Controlla di avere il livello agenzia.** In **Amministrazione** devi vedere «Proprietari» e «Chiusura mensile». Se non li vedi sono su attivazione: chiedi l'attivazione all'assistenza di CasaZen. Vedi [[agenzie-proprietari]].
4. **Aggiungi proprietari, quote e mandato** di ogni immobile. *Cosa ottieni:* i dati per i rendiconti. Vedi [[agenzie-proprietari]].
5. **Invita i proprietari al portale.** L'invito parte solo quando lo confermi tu. Vedi [[agenzie-proprietari]].
6. **A fine mese apri «Chiusura mensile»:** controlla il mese, approva e pubblica i rendiconti, registra i pagamenti ai proprietari. Pubblicare un rendiconto avvisa il proprietario e chiudere il mese non si annulla: controlla prima. Vedi [[chiusura-mensile]].

**Se qualcosa non va:** se un proprietario non riesce a entrare, controlla che l'invito sia arrivato all'e-mail giusta e rimandalo ([[agenzie-proprietari]]).

### Iniziare come proprietario di un immobile gestito da un'agenzia
**Ti serve:** l'e-mail di invito che la tua agenzia ti ha mandato.

1. **Apri l'e-mail dell'agenzia e premi il link,** usando lo stesso indirizzo a cui è arrivata. *Cosa ottieni:* l'accesso al «Portale proprietari». Vedi [[agenzie-proprietari]].
2. **Apri «Contabilità»** e leggi il rendiconto del mese. *Cosa ottieni:* i rendiconti che l'agenzia pubblica, mese per mese.
3. **Guarda «Immobili e calendario», «Documenti» e «Documenti emessi».** *Cosa ottieni:* le tue case con il calendario, i documenti condivisi e quelli emessi a tuo nome.
4. **Per stare in casa tua usa «Chiedi un soggiorno».** *Cosa ottieni:* la richiesta arriva all'agenzia. Non è ancora un soggiorno confermato: le date non sono bloccate finché non è approvata.
5. **Per qualsiasi dubbio usa «Messaggi»** o «Scrivi all'agenzia». In «Contatti» puoi far entrare un'altra persona.

**Se qualcosa non va:** se il link è scaduto o già usato, chiedi all'agenzia un nuovo invito. Se una sezione dice «Non puoi vedere questa parte del portale», scrivi all'agenzia.

### Iniziare come fornitore
**Ti serve:** un invito, il nome della tua attività, un telefono e il comune principale in cui lavori.

1. **Ottieni l'invito.** Dalla pagina «Per i fornitori» del sito pubblico di CasaZen premi «Richiedi un invito»: si apre un'e-mail già pronta, che invii tu. Oppure chiedilo al gestore per cui lavori, se usa i «Fornitori fidati». Vedi [[per-iniziare#ottenere-un-invito-a-casazen]].
2. **Apri il link dell'invito.** In «Registrazione fornitore» l'e-mail è quella dell'invito e non si cambia. Completa i dati e premi «Crea account e accetta l'invito» (o «Ho già un account: accedi»). Vedi [[area-fornitore]].
3. **Attiva il profilo in cinque passi.** Finché non lo attivi i gestori non ti vedono.
4. **Imposta gli orari di lavoro e crea il primo servizio con il prezzo.** *Cosa ottieni:* i gestori possono scegliere un orario libero e vedere quanto costi. Vedi [[area-fornitore]].
5. **Pubblica la tua vetrina** (facoltativo): una pagina pubblica da condividere. Vedi [[vetrina-fornitore]].
6. **Rispondi alla prima richiesta.** Ogni richiesta ha un tempo limite (di base due ore): accetta, rifiuta o manda un preventivo. Indirizzo e contatti del cliente li vedi solo dopo che accetti.
7. **Fatti pagare.** A lavoro finito segna «Completato». I pagamenti online dentro CasaZen sono su attivazione e prevedono una commissione; un pagamento ricevuto fuori da CasaZen lo registri con «Ho incassato fuori da CasaZen». Vedi [[area-fornitore]].

**Se qualcosa non va:** se il link dice «Invito non utilizzabile» (scaduto, già usato o annullato), chiedi un nuovo invito. Se non ricevi richieste, controlla che il profilo sia «Attivo» e che tu abbia orari e almeno un servizio con il prezzo.

### Iniziare come ospite
**Ti serve:** nome, cognome, un'e-mail vera (ci arriva il codice della prenotazione) e, se paghi online, una carta. Non serve un account.

1. **Trova la casa.** Apri il link dell'host oppure, sul sito pubblico di CasaZen, usa «Cerca una casa» (Dove, Arrivo, Partenza, Ospiti). *Cosa ottieni:* le case libere con il prezzo di tutto il soggiorno. Vedi [[pagine-pubbliche]].
2. **Controlla il totale** nella scheda «Prenota questa casa»: notti, pulizia e, dove c'è, imposta di soggiorno.
3. **Scegli come prenotare.** «Prenotazione immediata» (paghi online con «Paga ora» o «Paga alla scadenza») oppure «Su richiesta» («Paga in struttura», se l'host accetta). Vedi [[sito-prenotazione#prenotare-una-casa-dal-sito-dell-host-guida-per-l-ospite]].
4. **Completa entro 30 minuti:** dopo aver confermato i dati le date restano tue per 30 minuti, poi tornano libere. *Cosa ottieni:* «Prenotazione confermata!» e un'e-mail con il **codice prenotazione**. Con «Paga in struttura» apri l'e-mail e premi «Conferma e invia la richiesta»: senza, l'host non riceve nulla.
5. **Salva il codice.** Con il codice e l'e-mail (o le ultime 4 cifre del telefono) ritrovi la prenotazione da «Le mie prenotazioni». Vedi [[sito-prenotazione#ritrovare-la-tua-prenotazione-dal-sito-dell-host-guida-per-l-ospite]].
6. **Prima dell'arrivo fai il check-in online** dal link dell'e-mail. Vedi [[portale-ospite]].
7. **Se devi annullare,** apri «Le mie prenotazioni» o il link dell'e-mail: la pagina mostra prima quanto ti viene rimborsato. Se hai prenotato da Airbnb o Booking.com annulli lì. Vedi [[sito-prenotazione#come-funziona-la-cancellazione-dal-sito]].

**Se qualcosa non va:** se leggi «Le prenotazioni online sono in pausa», l'host non può ancora incassare online: scrivigli (il pulsante «Scrivi a …» c'è se ha indicato un'e-mail). Se non ti arriva l'e-mail di conferma, guarda tra la posta indesiderata e prova «Le mie prenotazioni».

### Iniziare come inquilino
**Ti serve:** l'indirizzo della tua area (te lo dà il proprietario o l'agenzia: è l'indirizzo di CasaZen seguito da `/portale-conduttore`) e la stessa e-mail scritta nel tuo contratto.

1. **Chiedi al proprietario di controllare la tua e-mail nel contratto:** deve essere uguale a quella del tuo account. Vedi [[area-inquilino]].
2. **Apri l'indirizzo della tua area.** CasaZen ti porta alla pagina di accesso sicura: crea l'account con quella e-mail e conferma il messaggio che ti arriva, oppure accedi se ce l'hai già. Non partire da «Registrati su CasaZen»: è la registrazione di chi gestisce case.
3. **Apri il contratto** con «Apri il contratto» e guarda «Prossima scadenza». *Cosa ottieni:* la casa, la durata e la prossima rata.
4. **Paga la rata** con la carta, dal link dell'e-mail («Paga [importo]»), oppure con bonifico e poi «Ho effettuato il bonifico». *Cosa ottieni:* la rata passa a «Pagata» solo quando il pagamento è confermato; il bonifico dichiarato resta «In verifica» finché il gestore non lo controlla.
5. **Scarica i documenti** che il proprietario condivide, da «Documenti».
6. **Segnala un guasto** da «Manutenzione › Nuova richiesta». La richiesta arriva al gestore, che decide: non scegli tu il fornitore e aprirla non vuol dire che qualcuno stia già arrivando. Per un'urgenza avvisa subito il proprietario.

**Se qualcosa non va:** se leggi «Non hai un contratto attivo da consultare», quasi sempre l'e-mail del tuo account è diversa da quella del contratto o non è verificata ([[area-inquilino]]).

### Iniziare dal telefono
**Ti serve:** lo stesso account che usi sul computer.

1. **Usa CasaZen dal browser del telefono.** Apri lo stesso indirizzo e accedi con lo stesso account: il menu diventa una barra in basso con le voci principali e «Altro». Vedi [[per-iniziare#muoverti-nel-menu]].
2. **L'app «CasaZen» non è ancora negli store** (App Store e Google Play): per ora non puoi scaricarla da lì. Vedi [[app-mobile]].
3. **Ricorda cosa resta sul sito:** creare prenotazioni, prezzi, incassi, messaggi e invii agli enti non si fanno dall'app. Per la prima configurazione è più comodo un computer.

**Se qualcosa non va:** se non trovi una voce sul telefono, controlla ruolo e funzione («Su attivazione») come sul computer.

## Domande frequenti

### Cos'è CasaZen e da dove comincio?
È il gestionale per chi affitta case; affianca Airbnb e Booking.com, non li sostituisce. Scegli il tuo percorso in «Quale percorso è il tuo?». Altri dettagli: [[per-iniziare#cos-e-casazen-e-cosa-posso-farci]].

### Devo pagare per usare CasaZen?
Gestori e agenzie scelgono un piano e ne vedono il costo prima di pagare ([[per-iniziare#devo-pagare-per-usare-casazen-quanto-costa]]). Ospiti e inquilini non scelgono nessun piano: l'ospite paga il soggiorno, l'inquilino l'affitto. Il fornitore non sceglie un piano; le commissioni sui pagamenti online sono in [[area-fornitore]].

### Sono un idraulico: come ricevo lavori?
Ti serve un invito. Poi attivi il profilo, imposti gli orari e crei un servizio con il prezzo. Vedi «Iniziare come fornitore».

### Ho una perdita d'acqua in casa: chi chiamo?
Chiama subito un tecnico. CasaZen non è un pronto intervento: una richiesta a un fornitore ha un tempo per ricevere risposta (di base due ore). Con acqua che allaga, odore di gas o scintille chiama anche i soccorsi. Dopo, se sei gestore, puoi chiedere un intervento ([[marketplace]]); se sei inquilino, segnala il guasto e avvisa il proprietario ([[area-inquilino]]).

### Ho perso il codice della prenotazione
Cerca nella posta, anche tra quella indesiderata, l'e-mail di conferma: il codice è scritto lì. Se non la trovi, scrivi all'host. Vedi [[sito-prenotazione#ho-perso-il-codice-della-prenotazione-cosa-faccio]].

### Non mi è arrivata l'e-mail di conferma della prenotazione
Guarda tra la posta indesiderata e controlla l'indirizzo. Con il codice ritrovi comunque la prenotazione da «Le mie prenotazioni». Vedi [[sito-prenotazione#l-ospite-non-ha-ricevuto-l-e-mail-di-conferma-cosa-faccio]].

### Come pago l'affitto?
Dalla tua area, in «Pagamenti»: con la carta dal link dell'e-mail oppure con bonifico e poi «Ho effettuato il bonifico». Vedi «Iniziare come inquilino» e [[area-inquilino]].

### Non vedo il mio contratto
Quasi sempre l'e-mail del tuo account è diversa da quella scritta nel contratto, oppure non è verificata. Chiedi al proprietario di controllarla ([[area-inquilino]]).

### Dove scarico l'app?
Non è ancora negli store. Per ora usa CasaZen dal browser del telefono: vedi «Iniziare dal telefono» e [[app-mobile]].

### Non vedo una voce del menu che trovo nella guida
Dipende da ruolo, immobili assegnati, piano e funzioni attivate: non è un errore. Vedi [[per-iniziare#non-vedo-un-pulsante-o-una-voce-di-menu-di-cui-parla-il-manuale-perche]].

### Non ho un invito: come entro?
Premi «Richiedi un invito» sul sito pubblico di CasaZen, oppure chiedi a un host che usa già CasaZen di invitarti ([[per-iniziare#ottenere-un-invito-a-casazen]]). Ospiti e inquilini non ne hanno bisogno.

### Le prenotazioni online sono in pausa: cosa significa?
Se sei un ospite: l'host non può ancora incassare online dal suo sito e non si può prenotare, nemmeno con «Paga in struttura»; scrivigli per chiedere le date. Se sei l'host: porta Stripe su «Attivo» ([[incassi#collegare-stripe-per-ricevere-i-pagamenti-online]]). Vedi [[sito-prenotazione#perche-il-sito-puo-non-prendere-prenotazioni]].

### Cosa significa «Su attivazione»?
Che la funzione non è accesa di partenza: la accende CasaZen, oppure serve un modulo del tuo piano. Se ti serve, scrivi all'assistenza. Vedi [[per-iniziare#cosa-significa-su-attivazione]].

## Glossario
- **Percorso**: in questa pagina, l'elenco dei passi per un tipo di utente. Non è il percorso «Inizia con CasaZen» che trovi dentro l'app.
- **Gestore (host)**: chi gestisce case e prenotazioni su CasaZen; l'app lo chiama anche «host».
- **Inquilino (conduttore)**: chi prende la casa in affitto con un contratto; l'app e i contratti dicono «conduttore».
- **Proprietario**: chi ha affidato la sua casa a un'agenzia che usa CasaZen; entra nel «Portale proprietari».

## Vedi anche
- [[per-iniziare]]: registrazione, accesso, menu, «Cerca» e Guida.
- [[account-team-piano]]: persone, ruoli, piano e fatturazione.
- [[app-mobile]]: l'app per il telefono.
