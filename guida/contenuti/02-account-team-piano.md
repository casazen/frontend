---
id: account-team-piano
titolo: Account, persone, ruoli e piano
sezione: Account e piano
ordine: 2
riassunto: Come gestire la tua organizzazione: dati e impostazioni, persone e inviti, ruoli e permessi, immobili dell'account, piano, limiti, fatturazione dell'abbonamento, «Consiglia CasaZen», profilo e notifiche.
chi: [amministratore, gestore, commercialista]
dove: Amministrazione › Home, Persone, Immobili, Fatturazione, Impostazioni · Impostazioni (Affitti brevi e lunghi) · Profilo
parole_chiave: [organizzazione, persone, invito, ruoli, permessi, posti, piano, fatturazione, abbonamento, Stripe, consiglia, referral, profilo, notifiche, immobili, responsabile]
copre: [/app/short-rent/settings, /app/short-rent/settings/organization, /app/short-rent/settings/invitations, /app/short-rent/settings/plan, /app/short-rent/settings/billing, /app/short-rent/profile, /app/short-rent/profile/notifications, /app/long-rent/settings, /app/long-rent/settings/organization, /app/long-rent/settings/invitations, /app/long-rent/settings/plan, /app/long-rent/settings/billing, /app/long-rent/profile, /app/account, /app/account/people, /app/account/people/invite, /app/account/people/roles, /app/account/people/:key/preview, /app/account/properties, /app/account/billing, /app/account/settings, /app/account/profile, /app/admin (non-utente), /app/admin/users (non-utente), /app/admin/suppliers (non-utente), /app/admin/suppliers/invite (non-utente), /app/admin/activities (non-utente), /app/admin/seo (non-utente), /app/admin/marketing (non-utente), /app/admin/cin (non-utente), /app/admin/compliance/tax-rates (non-utente), /app/admin/compliance/ltr-reference-data (non-utente), /app/admin/compliance/istat-regions (non-utente), /app/admin/jobs (non-utente), /app/admin/ai (non-utente), /app/admin/demo (non-utente), /app/admin/property-preparation (non-utente), /app/admin/profile (non-utente), /app/admin/invite-qr (non-utente), /app/admin/ai/playground (non-utente)]
stato: disponibile
fonte_codice: [frontend/src/features/account/account-home-page.tsx, frontend/src/features/account/account-settings-page.tsx, frontend/src/features/account/billing/account-billing-page.tsx, frontend/src/features/account/properties/account-properties-page.tsx, frontend/src/features/team/people-page.tsx, frontend/src/features/team/invite/invite-page.tsx, frontend/src/features/team/roles-page.tsx, frontend/src/features/team/person-preview-page.tsx, frontend/src/features/billing/plans-page.tsx, frontend/src/features/billing/billing-settings-page.tsx, frontend/src/features/settings/organization/organization-settings-page.tsx, frontend/src/features/invites/host-invites-page.tsx, frontend/src/features/profile/profile-page.tsx, frontend/src/features/profile/notification-preferences-page.tsx, backend/Casazen.Core/Services/PlanCatalog.cs, backend/Casazen.Core/OrgTeam/OrgCapabilityCatalog.cs, backend/Casazen.Core/OrgTeam/OrgInvitationRules.cs]
---

## In breve
Qui gestisci chi lavora con te, cosa può fare, quanto paghi e come ti avvisa CasaZen. Chi amministra l'organizzazione (titolare e amministratori) lavora nell'area **Amministrazione**. Gli stessi dati, piano e fatturazione compaiono anche in **Impostazioni** di Affitti brevi e Affitti lunghi, ma sono sempre riservati all'amministratore. Il **Profilo** (le tue notifiche, il tipo di operatore) è di ognuno.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Home dell'account | Mostra cosa richiede attenzione, persone, immobili e attività recenti | Amministrazione › Home | amministratore | Disponibile | Leggere la Home dell'account |
| Organizzazione | Nome, indirizzo pubblico, contatti, lingua | Impostazioni › Organizzazione (anche Amministrazione › Impostazioni) | amministratore | Disponibile | Modificare i dati dell'organizzazione |
| Persone | Elenco di chi lavora con te e degli inviti | Amministrazione › Persone | amministratore | Disponibile | Invitare una persona nel team |
| Ruoli e permessi | Spiega cosa può fare ogni ruolo | Amministrazione › Persone › Ruoli | amministratore | Disponibile | Capire cosa può fare un ruolo |
| «Cosa vede» una persona | Anteprima di menu e permessi, anche con un altro ruolo | Persone › nome della persona | amministratore | Disponibile | Vedere cosa vede una persona |
| Aree e immobili assegnati | Limita dove lavora ogni persona | Persone › «Aree e immobili» | amministratore | Disponibile | Cambiare aree e immobili di una persona |
| Disattivare e riattivare | Toglie e ridà l'accesso senza cancellare nulla | Persone › «Disattiva» / «Riattiva» | amministratore | Disponibile | Disattivare e riattivare una persona |
| Immobili dell'account | Vista unica degli immobili in affitto breve e lungo, con responsabile e stato | Amministrazione › Immobili | amministratore | Disponibile | Assegnare il responsabile di un immobile |
| Piano e limiti | Piano scelto, immobili e posti usati, confronto piani | Amministrazione › Fatturazione | amministratore | Disponibile | Cambiare piano |
| Moduli e aree attive | Funzioni extra e aree di gestione del piano | Amministrazione › Fatturazione | amministratore | Disponibile | Piano, limiti e moduli |
| Fatturazione dell'abbonamento | Metodo di pagamento, dati e fatture dell'abbonamento | Amministrazione › Fatturazione | amministratore | Disponibile | Aggiornare pagamento e dati di fatturazione |
| «Consiglia CasaZen» | Invita altri host con un link | Impostazioni › Consiglia CasaZen | gestore, amministratore | Disponibile | Consigliare CasaZen a un altro host |
| Profilo | Dati del tuo account e tipo di operatore | Menu profilo › Profilo | tutti | Disponibile | Cambiare il tipo di operatore |
| Preferenze di notifica | Scegli canali e ore di silenzio | Profilo › Notifiche | tutti | Disponibile | Impostare le preferenze di notifica |
| Privacy e dati | Scarica i dati dell'organizzazione | Amministrazione › Impostazioni | amministratore | Disponibile | Scaricare i dati dell'organizzazione |

## Come funziona

### Dove trovi le cose
- **Amministrazione** è l'area di chi gestisce l'account: voci «Home», «Persone», «Immobili», «Fatturazione» e «Impostazioni» (le ultime due sono fisse in fondo al menu). La vedono titolare e amministratori; a un altro ruolo compaiono solo le voci che può aprire.
- **Impostazioni** di Affitti lunghi (in fondo al menu) ha le schede «Organizzazione», «Consiglia CasaZen», «Piano» e «Fatturazione». Quelle di Affitti brevi ne hanno di più: «Organizzazione», «Consiglia CasaZen», «Aspetto sito», «Dominio pubblico», «Incorpora nel tuo sito» (su attivazione), «Documenti sito», «Stripe Connect», «Piano», «Fatturazione», «Portale ospiti» (su attivazione) e «AI»; quelle del sito e dei pagamenti sono spiegate in [[sito-prenotazione]] e [[incassi]]. Se hai anche l'area Amministrazione, «Piano» e «Fatturazione» ti portano direttamente alla pagina «Fatturazione e piano» di Amministrazione.
- **Posti e titolare.** Anche tu, titolare, occupi un posto del piano (con Starter i posti sono 2: tu e un'altra persona). Ogni persona attiva e ogni invito in attesa ne occupa uno. Di base puoi mandare al massimo 10 e-mail di invito ogni 24 ore (anche i «Reinvia» contano) e reinviare lo stesso invito una volta all'ora.
- **Profilo**: apri il menu in alto a destra (le tue iniziali) e scegli «Profilo».
- Chi non è amministratore che apre una pagina riservata legge «Riservato all'amministratore dell'organizzazione» e a chi rivolgersi. Non vede errori né dati.

### Home dell'account
La Home di Amministrazione risponde a «cosa richiede la mia attenzione?».
- **Adesso**: la cosa più urgente, con un pulsante. Se non c'è niente: «Niente di urgente».
- **Da controllare**: l'elenco delle altre cose. Può contenere: un problema con il pagamento del piano («Aggiorna il pagamento»), inviti non ancora accettati (con i giorni di attesa del più vecchio), immobili che non possono ancora ricevere prenotazioni («Completa l'attivazione per poter ricevere prenotazioni») e immobili senza le credenziali di Alloggiati Web.
- **Numeri**: «Persone attive» (con «su N posti» o «Posti illimitati») e «Immobili» (quanti in affitto breve e quanti in affitto lungo).
- **Attività recente**: cosa ha fatto il team di importante (per esempio inviti, ruoli cambiati, immobili attivati).

### Persone
La pagina «Persone» elenca chi lavora con te e chi hai invitato. Ogni riga ha **Persona**, **Ruolo**, **Aree e immobili** e **Stato**. Stati: attiva, invitata (invito non ancora accettato) e disattivata. In alto puoi cercare («Cerca per nome o email»), filtrare per area e ruolo e scegliere «Tutte», «Attive», «Invitate» o «Disattivate».

Aprendo una persona vedi chi è (email, data di ingresso, chi l'ha invitata, scadenza del link), il ruolo e gli immobili. Le azioni dipendono dal caso:

| Azione | Quando c'è |
|---|---|
| «Cambia ruolo» | Persona attiva, non titolare, non te stesso |
| «Aree e immobili» | Persona attiva con ruolo diverso da Amministratore |
| «Disattiva» / «Riattiva» | Persona attiva / persona disattivata |
| «Reinvia», «Copia il link», «Annulla l'invito» | Inviti in attesa |

Blocchi: **il titolare non si può cambiare né disattivare**; **non puoi cambiare te stesso**; **solo il titolare può modificare un amministratore** e nominarne uno.

### Ruoli e permessi
Ci sono **cinque ruoli**, uguali per tutte le organizzazioni:
- **Titolare**: è il proprietario dell'account, può fare tutto e non si può togliere.
- **Amministratore**: tutto: persone, permessi, piano, fatture e impostazioni.
- **Property manager**: immobili, prenotazioni, contratti, incassi e fornitori. Niente piano e fatture.
- **Collaboratore**: lavoro di ogni giorno sugli immobili assegnati: arrivi, ospiti, interventi. Vede i prezzi ma non li cambia e non vede gli incassi.
- **Contabile**: sola lettura su prenotazioni, incassi, contratti, canoni e fatture. Non modifica niente.

La pagina «Ruoli e permessi» mostra la tabella «Chi può fare cosa», con questi argomenti: Prenotazioni e calendario; Prezzi e regole; Ospiti e documenti; Incassi e pagamenti ai fornitori; Contratti e inquilini; Canoni e solleciti; Interventi dei fornitori; Persone e permessi; Piano e fatture; Fornitori di fiducia; Impostazioni dell'azienda; Sicurezza e registro attività. Per ognuno, ogni ruolo ha uno di tre livelli: **Sì** (lo vede e lo può cambiare), **Sola lettura** (lo vede ma non lo cambia), **No** (non lo vede).

Le **aree** e gli **immobili** assegnati a ogni persona restringono ancora di più cosa vede:
- puoi scegliere le **aree** (Affitti brevi, Affitti lunghi) per ogni ruolo tranne l'Amministratore, che vede tutte le aree attive;
- puoi limitare gli **immobili** («Solo alcuni») **solo al Collaboratore**. Gli altri ruoli vedono tutti gli immobili delle aree scelte.

Non ci sono ancora ruoli personalizzati, permessi diversi per ogni immobile e passaggio della titolarità: oggi si lavora con questi cinque ruoli.

### Posti
Il piano ha un numero di **posti** (le persone). Occupano un posto le persone attive e gli inviti in attesa, **anche il Contabile**. Chi è disattivato non occupa posti. Un invito occupa il posto finché non viene accettato o scade; se lo annulli, il posto si libera.

### Piano, limiti e moduli
I piani sono **Starter**, **Pro**, **Scale** e **Agency**.

| Piano | Immobili inclusi | Persone (posti) |
|---|---|---|
| Starter | fino a 3 | 2 |
| Pro | fino a 50 | 10 |
| Scale | illimitati | illimitate |
| Agency | illimitati | illimitate, si paga per camera |

Sono i limiti di base; la pagina «Fatturazione e piano» mostra sempre quelli reali della tua organizzazione («Immobili: X di Y», «Persone: X di Y»).

- Se superi i limiti dell'immobile, **non perdi nulla**: gli immobili restano tutti, ma non puoi aggiungerne finché non rientri.
- **Moduli.** Le funzioni a pagamento sono moduli: «Canali e distribuzione», «Prenotazioni dirette», «Adempimenti automatici», «Identificazione ospiti», «AI Agents», «Assistente AI per i messaggi», «Interventi e fornitori», «Documenti fiscali», «Prezzi e ricavi», «CRM e Marketing». Alcuni sono già inclusi nel piano, altri si aggiungono dal piano Pro in poi. Se una pagina richiede un modulo che non hai, vedi «Aggiungi questo modulo al tuo piano» con «Gestisci piano e moduli» (per chi è amministratore) o la richiesta di rivolgersi all'amministratore.
- **Aree di gestione.** Aggiungere gli affitti brevi o le locazioni di lungo periodo alla tua attività è una scelta riservata al gestore del piano («Gestisci le aree attive»).
- **Agency.** Si paga per camera, a fine mese, sulle unità vendibili attive almeno un giorno nel mese; c'è un minimo mensile e, da una certa soglia di unità, un preventivo.
- **Prezzi.** Sono quelli che vedi nella pagina, con IVA esclusa o inclusa come indicato. Un piano non ancora acquistabile mostra «Prezzo in definizione» e non si può scegliere.
- **Accesso aperto.** Se vedi questo avviso, per ora non viene addebitato nulla e tutte le funzioni sono sbloccate. Il piano che scegli vale quando riprenderà la fatturazione; CasaZen ti avvisa prima.

### Fatturazione dell'abbonamento
La pagina «Fatturazione e piano» ha:
- **Il tuo piano**: nome, utilizzo e «Prossimo addebito». Pulsanti «Cambia piano» o «Scegli un piano» e «Vedi i piani».
- **Confronta i piani**: tabella con prezzo («al mese + IVA») e immobili inclusi. Con un abbonamento attivo il cambio si conferma sul portale di Stripe.
- **Metodo di pagamento**: la carta si gestisce su Stripe; in CasaZen non la vediamo né la salviamo. Il pulsante è «Apri il portale di pagamento sicuro». Dal portale cambi piano, aggiorni la carta e scarichi le fatture dell'abbonamento.
- **Dati di fatturazione**: Fatturazione elettronica, Codice fiscale, PEC e Codice SDI. Se mancano vedi «Da completare». Nel passaggio di pagamento puoi anche indicare Paese e Partita IVA: la Partita IVA viene verificata prima di essere usata in fattura.
- **Stato dei moduli** («Attivo» o «Disattivo»), per chi ha scelto i moduli.
- **Cosa significano gli stati dell'abbonamento**:
  - **Attivo**: il rinnovo è automatico.
  - **In prova**: alla scadenza il pagamento parte in automatico.
  - **Pagamento in ritardo**: l'ultimo pagamento non è riuscito; il piano resta attivo solo per un breve periodo di tolleranza. Aggiorna il metodo di pagamento.
  - **Pagamento da completare**: il primo pagamento non è stato completato, il piano a pagamento non è attivo.
  - **Non pagato**: l'abbonamento è sospeso; paga la fattura aperta dal portale per riattivarlo.
  - **Scaduto**: l'abbonamento è terminato; scegli un piano per abbonarti di nuovo.
  - **Nessun abbonamento**: usi il piano senza abbonamento a pagamento.

### «Consiglia CasaZen»
In **Impostazioni › Consiglia CasaZen** (voce in fondo al menu) puoi invitare un altro host. L'invito non gli assegna ruoli: si registra come tutti gli altri. Scrivi l'email del tuo amico, un messaggio facoltativo e, se vuoi, la lingua dell'email (Predefinita, Italiano o Inglese). Hai un numero massimo di inviti al giorno: sopra l'elenco vedi «Inviti di oggi: X di Y» e, quando li finisci, da quando potrai inviarne altri. L'elenco «I tuoi inviti» mostra lo stato: In attesa, Usato, Scaduto o Revocato.

### Profilo e preferenze di notifica
Il **Profilo** mostra il tuo nome, l'email, il tuo ruolo, il tuo tipo di operatore («Modifica tipo») e il collegamento «Gestisci le notifiche». Il ruolo che vedi nel Profilo descrive il tuo tipo di utente; il ruolo nel team (Titolare, Amministratore…) lo vedi in Persone.

Le **Notifiche** sono una tabella: per ogni evento scegli i canali. Le scelte valgono solo per te e si salvano da sole.
- **Eventi:** Nuova prenotazione, Prenotazione annullata, Nuovo messaggio di un ospite, Messaggio urgente, Risposta da approvare, Scadenza di legge, Errore di sincronizzazione, Problema con un messaggio programmato.
- **Canali:** Campanella, Email, Notifica sul telefono, Notifica nel browser. Un canale che ancora non può consegnare è segnato «Non ancora disponibile».
- **Predefinito:** finché non scegli, vale la scelta predefinita (con il bollino «Predefinito»). I valori predefiniti sono questi: «Nuova prenotazione», «Nuovo messaggio di un ospite», «Messaggio urgente» e «Risposta da approvare» avvisano con «Notifica sul telefono» e «Campanella»; «Scadenza di legge» con «Notifica sul telefono», «Campanella» e «Email»; «Prenotazione annullata», «Errore di sincronizzazione» e «Problema con un messaggio programmato» solo con la «Campanella». «Notifica nel browser» è segnata «Non ancora disponibile». La riga «Nuova prenotazione» non decide l'e-mail di avviso di una nuova prenotazione: vedi «Come ricevo un'e-mail quando arriva una prenotazione?».
- **Scadenze di legge:** non si possono spegnere del tutto. Lascia attivo almeno un canale.
- **Ore di silenzio:** imposti «Dalle» e «Alle» (orario italiano). In quelle ore le notifiche sul telefono e le email aspettano la fine del silenzio; la campanella si aggiorna sempre; le scadenze di legge ti avvisano comunque. Inizio e fine uguali significano nessun silenzio.

### Immobili dell'account
La pagina **Amministrazione › Immobili** mostra tutti gli immobili, in affitto breve e lungo. Colonne: Immobile, Modalità, Responsabile, Accesso e Stato. Filtri: «Tutti», «Affitto breve», «Affitto lungo», «Da completare» (quelli che non possono ancora ricevere prenotazioni) e filtri per responsabile e stato.
- **Stato**: se manca qualcosa vedi «Manca: …» (per esempio CIN, foto, prezzo, calendario, sicurezza, documenti, dati di base o conferma dell'attivazione).
- **Responsabile**: è la persona avvisata, insieme agli amministratori, quando succede qualcosa sull'immobile (prenotazioni, interventi, scadenze). Senza responsabile viene avvisato chi ha creato l'immobile. Compare solo chi può già accedere a quell'immobile.
- **Passa ad affitto breve/lungo**: cambia la modalità dell'immobile; l'anteprima ti dice cosa va sistemato prima.
- **Elimina l'immobile**: per confermare scrivi ELIMINA. Non si può ripristinare da qui. Non compare più negli elenchi, nel calendario e sul sito; libera un posto nel piano; documenti e dati fiscali restano archiviati per obbligo di conservazione. Non puoi eliminarlo se ha prenotazioni in corso o future o un contratto attivo: prima vanno spostate, annullate o concluse.

### Impostazioni dell'account (Amministrazione)
**Amministrazione › Impostazioni** raccoglie i dati che valgono in tutte le aree. In alto «Vai a una sezione» ti porta a:
- **Organizzazione**: gli stessi campi di «Impostazioni › Organizzazione» (vedi «Modificare i dati dell'organizzazione»);
- **Incassi online**: compare se puoi aprire la pagina dei pagamenti e serve a collegare il tuo account Stripe per ricevere i pagamenti degli ospiti. I fondi vanno direttamente sul tuo conto Stripe: CasaZen non trattiene i tuoi incassi. Per i dettagli vedi [[incassi]];
- **Dati di fatturazione**: rimando a «Fatturazione e piano» per Partita IVA, codice destinatario (SDI) e PEC;
- **Privacy e dati**: il file con i dati dell'organizzazione (solo per l'amministratore).

Se nome e indirizzo del sito sono ancora provvisori vedi «Scegli il nome e l'indirizzo del tuo sito» con «Compila i dati»; se manca il collegamento dei pagamenti compare un avviso analogo.

### Pagine di Amministrazione che non sono per gli utenti
L'area «Console staff» (Cruscotto, Utenti, Fornitori, Inviti, Attività, SEO e Contenuti, Marketing, Conformità, Tassa di Soggiorno, Dati normativi, Regioni ISTAT, Processi, Configurazione AI, Ambiente demo, Preparazione strutture, QR di invito) è riservata al personale di CasaZen. Non serve a chi usa il prodotto e qui non è spiegata.

## Come fare

### Leggere la Home dell'account
1. Apri **Amministrazione › Home**.
2. Leggi «Adesso» e premi il pulsante per risolvere la cosa più urgente.
3. Scorri «Da controllare» per il resto e guarda i numeri di persone e immobili.

### Modificare i dati dell'organizzazione
Serve essere amministratore dell'organizzazione.
1. Apri **Impostazioni › Organizzazione** (in Affitti brevi o Affitti lunghi) oppure **Amministrazione › Impostazioni**.
2. Cambia i campi: «Nome organizzazione», «Indirizzo pubblico» (da 3 a 63 caratteri tra lettere, numeri e trattini), «Email di contatto», «Telefono», «Ragione sociale», «Sede legale».
3. Spunta «Mostra l'email di contatto agli ospiti» solo se vuoi che compaia sul tuo sito di prenotazione (di base non è pubblicata).
4. Scegli la «Lingua dell'account»: è la lingua delle email che mandi al team, come gli inviti. I tuoi ospiti scelgono la loro.
5. Premi «Salva impostazioni».

CasaZen controlla se l'indirizzo è libero. Se lo cambi, il vecchio indirizzo continua a portare al tuo sito e resta riservato a te, ma aggiorna comunque i link che hai condiviso (annunci, QR code, social). Ragione sociale e sede legale compaiono nel piè di pagina del sito di prenotazione. Logo, colori e tema del sito si cambiano in «Aspetto sito».

In questa pagina trovi anche **Richieste ai fornitori**: l'opzione «Invia le richieste anche a fornitori di riserva». Quando chiedi un intervento, la richiesta va al fornitore che scegli e anche ad altri fornitori della zona dichiarati come riserve. Il fornitore scelto ha un'ora per accettare: se non lo fa, il lavoro passa alla prima riserva che accetta. Per ogni richiesta puoi scegliere diversamente.

### Invitare una persona nel team
**Ti serve:** essere titolare o amministratore (il permesso di gestire le persone), un posto libero nel piano e l'indirizzo e-mail esatto che la persona userà per entrare. Se vuoi limitare un Collaboratore ad alcune case («Solo alcuni»), aggiungi prima le case.
1. Apri **Amministrazione › Persone** e premi «Invita». Se in alto non vedi «Amministrazione», cambia area (vedi [[per-iniziare#andare-in-amministrazione-o-cambiare-area-di-lavoro]]).
2. **Chi**: scrivi «Nome e cognome» ed «Email», e scegli la lingua dell'email (Italiano o Inglese). Scrivi l'indirizzo con cui la persona entrerà: **l'invito funziona solo con quell'indirizzo** (con un altro la persona non può accettarlo). La password la sceglie la persona invitata: tu non la vedi mai.
3. **Ruolo**: scegli il ruolo («Che ruolo avrà?»). «Confronta i ruoli in una tabella» apre il confronto. Come scegliere: **Collaboratore** per chi lavora ogni giorno su alcune case (arrivi, ospiti, interventi) senza toccare prezzi e incassi; **Property manager** per chi ti aiuta a gestire case, prenotazioni, contratti, incassi e fornitori; **Contabile** per il tuo commercialista (sola lettura); **Amministratore** solo per chi deve gestire anche persone, piano e fatture (lo nomina soltanto il titolare).
4. **Aree e immobili**: scegli le aree («Affitti brevi», «Affitti lunghi»). Per il Collaboratore scegli anche «Tutti gli immobili» o «Solo alcuni» e spunta gli immobili.
5. **Riepilogo**: controlla persona, ruolo, aree e immobili e premi «Invia l'invito».
6. Vedi «Invito inviato a [nome]». Da lì puoi «Copia il link», «Vedi gli inviti» o «Invita un altro utente».

Cosa succede dopo: la persona riceve un'email con il link per accettare; il link vale **7 giorni** e dopo **3 giorni** CasaZen manda un promemoria. Scegliendo la password e accettando, la persona riaccetta Termini, Privacy e DPA. L'invito occupa un posto del piano finché non viene accettato o scade. Se l'email non parte, la schermata dice «L'email non è partita»: copia il link e mandalo tu.

Errori frequenti:
- «Questa persona fa già parte del team» e «C'è già un invito in attesa per questa email: reinvialo dall'elenco delle persone».
- «Hai usato tutti i posti del piano»: disattiva chi non lavora più con te o passa a un piano con più posti. Se mandi l'invito comunque, il sistema lo rifiuta.
- «Il tuo account non può assegnare alcun ruolo»: chiedi a un amministratore.

Si può annullare finché non è accettato (vedi «Reinviare, copiare o annullare un invito»).

### Capire cosa può fare un ruolo
1. Apri **Amministrazione › Persone** e premi «Ruoli e permessi».
2. Leggi i cinque ruoli e quante persone ne hanno uno.
3. Guarda la tabella «Chi può fare cosa»: Sì, Sola lettura o No per ogni argomento.

### Vedere cosa vede una persona
1. Apri **Persone** e scegli il nome (o apri «Cosa vede»).
2. Vedi aree, menu e immobili di quella persona, e «Cosa può fare».
3. Per un'ipotesi premi «E se fosse…» e scegli un altro ruolo: vedi «Stai provando…». **Non cambia niente** finché non salvi il ruolo dalla modifica. Per cambiarlo davvero premi «Rendi [nome] [ruolo]».

### Cambiare il ruolo di una persona
1. Apri **Persone**, scegli la persona e premi «Cambia ruolo».
2. Leggi «Cosa potrà fare in più» e «Cosa non potrà più fare».
3. Premi «Salva il ruolo».

Il nuovo ruolo vale **entro un minuto**. Aree e immobili restano quelli di ora.

### Cambiare aree e immobili di una persona
1. Apri **Persone**, scegli la persona e premi «Aree e immobili».
2. Scegli le aree. Per il Collaboratore scegli anche gli immobili.
3. Premi «Salva aree e immobili».

Se salvano le aree ma non gli immobili, CasaZen te lo dice: riprova.

### Disattivare e riattivare una persona
1. Apri **Persone**, scegli la persona e premi «Disattiva».
2. Per confermare scrivi DISATTIVA e premi «Disattiva l'accesso».
3. La persona non può più entrare dalla richiesta successiva. Prenotazioni, messaggi e interventi che ha creato restano. Si libera un posto.

Per riattivare premi «Riattiva»: torna con la password di prima e gli stessi permessi, se il piano ha un posto libero.

### Reinviare, copiare o annullare un invito
1. Apri **Persone** e filtra per «Invitate».
2. «Reinvia» manda una nuova email con un nuovo link (valido altri 7 giorni): il link precedente smette di funzionare.
3. «Copia il link» ti dà il link da mandare tu. Il link di prima non funziona più.
4. «Annulla l'invito» chiude l'invito: il link smette di funzionare e il posto si libera. Hai qualche secondo per ripensarci.

### Assegnare il responsabile di un immobile
1. Apri **Amministrazione › Immobili**.
2. Sulla riga dell'immobile scegli «Assegna il responsabile» (puoi selezionare più immobili e assegnarlo a tutti).
3. Scegli la persona e premi «Assegna». Se non trovi la persona, premi «Gestisci gli accessi».

### Aggiungere o eliminare un immobile dall'Amministrazione
1. Per aggiungere premi «Aggiungi un immobile» e scegli «Affitto breve» (serve il CIN) o «Affitto lungo» (contratti, canoni e scadenze). Si apre il modulo della sezione scelta ([[immobili]]).
2. Per eliminare apri il menu dell'immobile e scegli «Elimina l'immobile». Leggi cosa succede, scrivi ELIMINA e conferma.

### Cambiare piano
Serve essere amministratore dell'organizzazione.
1. Apri **Amministrazione › Fatturazione** e premi «Cambia piano» (o «Scegli un piano»).
2. Confronta i piani e scegli.
3. Se non hai un abbonamento, indichi paese e Partita IVA e completi il pagamento su Stripe. Se ne hai uno, il cambio si conferma sul portale di Stripe.
4. Tornato su CasaZen vedi «Pagamento confermato: il piano [nome] è attivo». Se la conferma tarda, premi «Aggiorna lo stato».

### Aggiornare pagamento e dati di fatturazione
1. In **Amministrazione › Fatturazione** premi «Apri il portale di pagamento sicuro» per carta, fatture e disdetta.
2. Nei «Dati di fatturazione» completa Codice fiscale, PEC e Codice SDI per le fatture elettroniche.
3. Se vedi «C'è un problema con il pagamento del piano», premi «Aggiorna il pagamento».

### Consigliare CasaZen a un altro host
1. Apri **Impostazioni › Consiglia CasaZen**.
2. Scrivi «Email del tuo amico» e, se vuoi, il messaggio e la lingua.
3. Premi «Invia invito». Vedi «Invito inviato a [email], valido fino al [data]».
4. Dall'elenco puoi «Reinvia» (nuovo link, il vecchio smette di funzionare) o «Revoca» (il link non funziona più e puoi creare un nuovo invito per la stessa email).

### Impostare le preferenze di notifica
1. Apri **Profilo › Notifiche** (oppure «Gestisci le notifiche» dal Profilo).
2. Per ogni evento accendi o spegni i canali: la scelta si salva da sola («Preferenze salvate»).
3. In «Ore di silenzio» scegli «Dalle» e «Alle» e premi «Salva gli orari».

### Scaricare i dati dell'organizzazione
1. Apri **Amministrazione › Impostazioni › Privacy e dati**.
2. Premi «Scarica i dati dell'organizzazione».
3. Si scarica un file con i dati fiscali dell'organizzazione, le persone del team e, se puoi leggerlo, il registro delle attività. Contiene dati personali: conservalo con cura.

Per chiudere l'account o far cancellare i dati devi scrivere all'assistenza: non si fa da qui.

### Cambiare il tipo di operatore
1. Apri **Profilo** e premi «Modifica tipo».
2. Scegli «Affitti brevi», «Locazioni di lungo periodo» o «Entrambi» e premi «Salva modifiche» (se servono, prima rivedi i documenti).
3. Il piano non cambia da qui: dopo il salvataggio si apre la pagina del piano.

## Flussi completi

### Flusso: dalla scelta del piano al primo collaboratore
1. **Tu (titolare)** crei l'account e scegli il piano ([[per-iniziare#creare-il-tuo-account-e-la-tua-attivita]]).
2. **CasaZen** crea l'organizzazione e ti porta in Affitti brevi.
3. **Tu** apri **Amministrazione › Persone › Invita**, scegli ruolo, aree e immobili e invii.
4. **CasaZen** manda l'email; dopo 3 giorni un promemoria.
5. **La persona** accetta (vedi [[per-iniziare#entrare-in-un-team-con-un-invito]]).
6. **Tu** controlli «Cosa vede» e, se serve, correggi aree e immobili.

### Flusso: quando finiscono i posti
1. **CasaZen** ti avvisa in «Invita» con «Hai usato tutti i posti del piano».
2. **Tu** disattivi chi non lavora più con te (libera un posto) oppure passi a un piano con più posti.
3. **Tu** invii di nuovo l'invito.

### Flusso: pagamento in ritardo
1. **Stripe** non riesce a incassare: lo stato diventa «Pagamento in ritardo».
2. **CasaZen** mostra il problema nella Home dell'account e in Fatturazione.
3. **Tu** premi «Aggiorna il pagamento» e sistemi la carta sul portale.
4. Se il pagamento non rientra, l'abbonamento diventa «Non pagato» (sospeso) e poi «Scaduto».

## Regole e limiti
- Piano e fatturazione sono dell'**amministratore dell'organizzazione**. Organizzazione e persone dipendono dal permesso di gestire persone/impostazioni.
- **Inviti**: validità 7 giorni, promemoria dopo 3 giorni; occupano un posto fino all'accettazione o alla scadenza. Solo il titolare nomina un amministratore.
- **Posti**: persone attive più inviti in attesa; il Contabile conta; i disattivati no. Limiti di base: Starter 2, Pro 10, Scale e Agency illimitati.
- **Immobili inclusi**: Starter fino a 3, Pro fino a 50, Scale e Agency illimitati.
- **Il titolare** non si cambia né si disattiva; nessuno cambia il proprio ruolo da Persone.
- **Cambio di ruolo**: vale entro un minuto. **Disattivazione**: vale dalla richiesta successiva.
- **Consiglia CasaZen**: numero massimo di inviti al giorno (lo vedi nella pagina).
- **Eliminazione di un immobile**: non si può con prenotazioni in corso o future o con un contratto attivo; non si ripristina; documenti e dati fiscali restano archiviati.
- **Scadenze di legge** nelle notifiche: non si possono spegnere del tutto e passano anche nelle ore di silenzio.
- La carta di credito è gestita solo da Stripe.
- La lingua dell'interfaccia è Italiano o English.

## Domande frequenti

### Perché non vedo «Persone» o «Fatturazione»?
Perché il tuo ruolo non le include. Solo titolare e amministratori gestiscono persone, piano e fatture. Chiedi a chi amministra l'account.

### Ho disattivato una persona: perde i suoi dati?
No. Quello che ha creato (prenotazioni, messaggi, interventi) resta. Puoi riattivarla con gli stessi permessi, se c'è un posto libero.

### Posso dare a una persona solo alcuni immobili?
Sì, ma solo se ha il ruolo Collaboratore. Gli altri ruoli vedono tutti gli immobili delle aree scelte.

### Come cambio il titolare dell'account?
Non è previsto: il passaggio della titolarità non fa ancora parte di CasaZen.

### Dove scarico le fatture dell'abbonamento?
Dal portale di fatturazione di Stripe: «Apri il portale di pagamento sicuro» in **Amministrazione › Fatturazione**.

### Ho più immobili di quelli del piano. Cosa succede?
Restano tutti, ma non puoi aggiungerne altri finché non rientri nel limite o cambi piano.

### Come chiudo l'account?
Scrivi all'assistenza dalla pagina Privacy e dati.

### Come ricevo un'e-mail quando arriva una prenotazione?
Non devi accendere niente: quando un ospite prenota dal tuo sito e paga online («Paga ora») oppure sceglie «Paga alla scadenza», CasaZen ti manda subito un'e-mail di avviso. Va all'«Email di contatto» dell'organizzazione e, se sono persone diverse, anche al responsabile dell'immobile e agli amministratori. Per cambiare l'indirizzo cambia l'«Email di contatto» ([[account-team-piano#modificare-i-dati-dell-organizzazione]]). L'avviso non dipende dall'interruttore «Email» della riga «Nuova prenotazione» in **Profilo › Notifiche** e non aspetta le ore di silenzio. Con «Paga in struttura» non parte alla conferma, perché la richiesta l'hai accettata tu. Se la prenotazione arriva da Airbnb o Booking.com tramite un channel manager (Octorate), CasaZen non manda nessuna e-mail: la trovi in **Prenotazioni**.

## Glossario
- **Titolare**: chi ha creato l'organizzazione.
- **Posto**: un posto del piano per una persona (attiva o invitata).
- **Modulo**: funzione extra del piano (per esempio CRM e Marketing).
- **Responsabile**: la persona avvisata, con gli amministratori, per un immobile.
- **Portale di fatturazione**: pagina sicura di Stripe dove gestisci carta e fatture.
- **Ore di silenzio**: fascia oraria in cui telefono ed email aspettano.

## Vedi anche
- [[per-iniziare]]: registrazione, aree e menu.
- [[cruscotto-notifiche-assistente]]: campanella, Da fare e assistente.
- [[immobili]]: aggiungere e attivare gli immobili.
- [[agenzie-proprietari]]: proprietari, rendiconti e chiusura mensile.
