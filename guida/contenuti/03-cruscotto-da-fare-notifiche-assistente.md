---
id: cruscotto-notifiche-assistente
titolo: Cruscotto, Da fare, notifiche e assistente
menu: Cruscotto e notifiche
sezione: Per iniziare
ordine: 3
riassunto: Cosa vedi ogni giorno nel Cruscotto, come lavorare con «Da fare», «Da approvare» e «Verifiche», come funzionano campanella e avvisi, cosa sa fare davvero «Chiedi a CasaZen» e cosa si attiva nelle impostazioni AI.
chi: [gestore, amministratore]
dove: Affitti brevi › Cruscotto (schede Da fare, Da approvare, Verifiche) · campanella e «Chiedi a CasaZen» in alto · Impostazioni › AI
parole_chiave: [cruscotto, oggi, arrivi, partenze, da fare, attività, approvazione, verifiche, notifiche, campanella, avvisi, assistente, chiedi a CasaZen, AI, routine]
copre: [/app/short-rent, /app/short-rent/activities, /app/short-rent/approval-queue, /app/short-rent/verifications, /app/short-rent/settings/ai, /app/short-rent/settings/assistant]
stato: disponibile
fonte_codice: [frontend/src/features/dashboard/dashboard-page.tsx, frontend/src/features/dashboard/lib/home-model.ts, frontend/src/features/todo/todo-list.tsx, frontend/src/features/todo/lib/todo-model.ts, frontend/src/pages/ApprovalQueuePage.tsx, frontend/src/features/approvals/lib/approval-model.ts, frontend/src/pages/VerificationQueuePage.tsx, frontend/src/features/notifications/notification-bell.tsx, frontend/src/features/notifications/use-notifications-realtime.ts, frontend/src/components/shared/alert-popup.tsx, frontend/src/features/assistant/ask/navigation.ts, frontend/src/features/assistant/ask/ask-panel.tsx, frontend/src/features/assistant/assistant-settings-page.tsx, frontend/src/features/settings/ai-settings-page.tsx, backend/Casazen.Web/Controllers/AskNavigationController.cs]
---

## In breve
Il **Cruscotto** è la pagina da cui parti ogni mattina: cosa succede oggi, cosa devi fare e i numeri essenziali. Le schede **Da fare**, **Da approvare** e **Verifiche** raccolgono ciò che aspetta una tua decisione. La **campanella** e gli avvisi ti dicono quando succede qualcosa, senza ricaricare la pagina. **Chiedi a CasaZen** è una scorciatoia per aprire pagine, trovare prenotazioni e raggiungere il punto giusto del manuale: non fa operazioni al posto tuo.

> **Suggerimento:** **in pratica, ogni giorno** fai tre cose, in quest'ordine. 1) Apri il **Cruscotto** e guarda «Oggi» (arrivi, partenze, pulizie) e «Da fare». 2) Guarda la **campanella**: ti dice cosa è successo e porta alla pagina giusta. 3) Se usi l'assistente o le campagne, apri **Da approvare**: ciò che prepara CasaZen non parte senza il tuo sì. Il pulsante **Guida** serve finché non hai finito la configurazione. «Home» e «Cruscotto» sono la stessa pagina: la pagina iniziale di Affitti brevi. Il primo giorno è normale che sia quasi vuoto: si riempie quando hai una casa attiva. Dal telefono la campanella e il Cruscotto si usano dal browser; le notifiche sul telefono arrivano con l'app «CasaZen», che non è ancora negli store ([[app-mobile]]).

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Cruscotto | Mostra oggi, cose da fare e numeri | Affitti brevi › Cruscotto | gestore, amministratore | Disponibile | Leggere il Cruscotto ogni giorno |
| Oggi | Arrivi, partenze, pulizie e interventi del giorno | Cruscotto › «Oggi» | gestore, amministratore | Disponibile | Leggere il Cruscotto ogni giorno |
| I numeri essenziali | Ricavi, occupazione, prenotazioni in arrivo | Cruscotto › «I numeri essenziali» | gestore, amministratore | Disponibile | Cambiare periodo e immobile |
| Da fare | Elenco delle attività, dalla più urgente | Cruscotto › scheda «Da fare» | gestore, amministratore | Disponibile | Lavorare con «Da fare» |
| Da approvare | Bozze e azioni che aspettano la tua approvazione | Cruscotto › scheda «Da approvare» | amministratore, gestore | Disponibile | Approvare, modificare o rifiutare un elemento |
| Verifiche | Identità degli ospiti che aspetta una persona | Cruscotto › scheda «Verifiche» | amministratore, gestore | Disponibile | Registrare la decisione su una verifica |
| Campanella | Elenco delle notifiche, con numero da leggere | In alto, icona «Notifiche» | tutti | Disponibile | Leggere le notifiche |
| Avvisi in primo piano | Un avviso alla volta per le scadenze | Sopra la pagina, in basso a destra | gestore, amministratore | Disponibile | Rispondere a un avviso |
| «Chiedi a CasaZen» | Apre pagine, trova prenotazioni, indica i punti del manuale, prepara bozze | In alto, accanto a «Cerca» | gestore, amministratore | Disponibile | Chiedere a CasaZen |
| Impostazioni AI | Porta alle routine, all'assistente e alla verifica dei volti | Impostazioni › AI | gestore, amministratore | Disponibile | Controllare le impostazioni AI |
| Assistente per i messaggi | Prepara bozze di risposta agli ospiti | Impostazioni › AI › Assistente | gestore, amministratore | Su attivazione | Regolare l'assistente dei messaggi |

## Come funziona

### Il Cruscotto
Il titolo è «Buongiorno, [il tuo nome]». Sotto, una riga riassume la giornata: per esempio «2 arrivi, 1 partenza, 1 richiesta da approvare», oppure «giornata tranquilla, niente di urgente».

In alto trovi i pulsanti, a seconda dei tuoi permessi:
- «Crea prenotazione» (serve poter modificare le prenotazioni);
- «Aggiungi immobile» (serve poter modificare gli immobili);
- «Richiedi un intervento» (serve poter richiedere interventi);
- «I numeri essenziali», per passare alla vista dei numeri.

**Filtri.** Se hai più di un immobile compare «Filtri della Home»: scegli un **Immobile** (di base «Tutti gli immobili assegnati») e usa «Azzera filtri» per tornare indietro. Vedi solo gli immobili che ti sono assegnati.

**Se non hai ancora immobili** vedi «Aggiungi il tuo primo immobile» (oppure «Completa il tuo primo immobile» con «Riprendi da dove eri» se l'avevi iniziato). Appena l'immobile è attivo compaiono giornata, cose da fare e numeri.

**«Oggi»** è la lista della giornata. Puoi filtrarla per tipo: «Tutti», «Arrivi», «Pulizie», «Partenze», «Interventi». Per ogni arrivo vedi il numero di ospiti e lo stato del check-in online:
- «Link di check-in non ancora inviato»;
- «Link inviato: in attesa dell'ospite»;
- «Check-in online in corso»;
- «Modulo inviato · dati ospiti incompleti»;
- «Dati del check-in completi»;
- «Link di check-in scaduto».

I pulsanti sulla riga sono «Vedi check-in» (apre i documenti della prenotazione) e «Registra partenza». Se chi legge non può modificare le prenotazioni, può solo consultare lo stato. La data degli arrivi segue l'ora di Roma. Se la lista è lunga vedi «Altro N oggi» e «Vedi le prenotazioni». Se non c'è niente: «Giornata libera» con «Apri il calendario». Se la Home mostra solo una parte delle attività lo dice: «La Home mostra solo una parte delle attività di oggi».

**«Da fare» nel Cruscotto** mostra le prime quattro cose; «Vedi tutte (N)» le apre tutte e «Mostra meno» le richiude. Ogni riga ha un pulsante: «Completa», «Rispondi», «Accetta», «Conferma», «Paga», «Controlla», «Registra partenza», «Completa i dati» e così via. Hanno una scadenza: «Scaduto», «Entro oggi alle 18:00», «Entro domani alle 09:00» o «Quando puoi». Per le richieste di prenotazione puoi **accettare** o **rifiutare**; rifiutando, l'ospite riceve un'email e le date tornano disponibili. Se hai attivato «Mostra prima le attività nel cruscotto» (menu del profilo › «Personalizza area di lavoro»), «Da fare» viene prima di «Oggi».

**«I numeri essenziali»** è un pannello che si apre dal titolo. Scegli il **periodo**: «Questo mese» (di base), «Ultimi 30 giorni», «Ultimi 3 mesi», «Quest'anno». Trovi ricavi, occupazione, prenotazioni in arrivo, prossimi arrivi e il numero di richieste da approvare, con il confronto sul periodo precedente. I **ricavi** sono per competenza: contano le notti dei soggiorni confermati, nel periodo in cui si fanno. Il grafico è per settimana o per mese e può mostrare la parte «Prevista». Chi non gestisce gli incassi vede «I ricavi li vede chi gestisce gli incassi»: occupazione, arrivi e cose da fare restano visibili. Il riquadro «Stato canali OTA» compare solo se hai attivato l'integrazione con i portali.

### Da fare
La scheda **Da fare** elenca tutte le attività «dalla più urgente alla meno urgente». Serve poter leggere gli immobili. Ogni voce ha: il **titolo**, il **perché** (una riga che spiega la regola), la **scadenza** («Entro [data] alle [ora]», «Scaduta: …»), l'**urgenza** («Urgente», «Importante», «Quando puoi») e a cosa si riferisce (un immobile, una prenotazione, il tuo account).

Le attività che puoi incontrare, per gruppi:
- **Ospiti e soggiorni**: check-in da completare, link di check-in da consegnare, check-out da completare, richiesta speciale dell'ospite, messaggio a cui rispondere, identità dell'ospite da verificare.
- **Adempimenti**: Alloggiati Web e ISTAT in scadenza, ricevuta da recuperare, imposta di soggiorno da inserire o in scadenza, credenziali da rinnovare, rimborso della tassa di soggiorno.
- **Calendari e canali**: date già occupate, prenotazione cambiata anche sul gestionale dei canali, annuncio modificato sul canale, collegamento da sistemare, immobile importato da controllare.
- **Pulizie e interventi**: pulizia da richiedere, pulizia da rivedere dopo un cambio di date.
- **Soldi e documenti**: documento fiscale da sistemare, autofatture da controllare, rendiconto del proprietario.
- **Messaggi automatici e AI**: messaggio da approvare, messaggio programmato da sistemare, promemoria manuale di una routine.
- **Altre**: procedura da riprendere, privacy dell'ospite (copia o cancellazione dei dati).

Cosa puoi fare su una voce:
- **«Fallo ora»** apre la pagina giusta per risolverla.
- **«Segna come fatto»** la toglie dall'elenco. CasaZen ti chiede conferma: «Segnare questa attività come fatta?». Se la cosa non è davvero risolta, **CasaZen potrebbe riproporla**.
- Puoi **filtrare** per tipo, per immobile o per «Riguardano l'account», e «Mostra tutte» azzera i filtri.
- Una parte delle voci appare come «I tuoi prossimi passi» (Adesso, Programmato) quando derivano da un percorso guidato.

Il numero rosso su «Da fare» e sul pulsante **Guida** conta le attività urgenti. Se l'elenco è troppo lungo, CasaZen mostra «Le prime N cose da fare» e invita a risolvere dall'alto.

### Da approvare
La **coda di approvazione** raccoglie quello che CasaZen o le tue regole hanno preparato e che **non parte senza il tuo sì**. Serve il permesso di decidere sulle approvazioni (di base titolare, amministratori e property manager) o di gestire il marketing. I tipi:
- **Bozza di messaggio**: una risposta a un ospite, spesso scritta dall'assistente.
- **Risposta a una recensione**.
- **Campagna** (email di marketing).
- **Testo AI**.
- **Routine**.

Ogni elemento mostra il contenuto, se è «Generato da AI», una **affidabilità** (alta o bassa, «controllala bene»), quando **scade** e, per le bozze, la «Situazione» (per esempio Wi-Fi, Come arrivare, Reclamo). Puoi:
- **Approvare** («Approva», «Approva e invia» o «Approva e pubblica»);
- **Modificare** il testo prima (resta visibile l'originale; «Ripristina l'originale»); un messaggio non può essere vuoto né più lungo di 2000 caratteri; una campagna ha bisogno di oggetto (una sola riga) e testo;
- **Rifiutare**, scrivendo il **motivo**: viene registrato.

Cosa succede dopo:
- **Messaggio**: parte verso l'ospite («Messaggio inviato all'ospite»). Se il canale lo gestisce il channel manager: «Messaggio preso in carico dal tuo channel manager: sarà lui a inviarlo all'ospite». Se non siamo sicuri della consegna lo diciamo: controlla la conversazione prima di scriverlo di nuovo.
- **Risposta a una recensione**: viene pubblicata ed è **pubblica e non si può più ritirare**.
- **Campagna**: viene approvata e, se ha una data di invio, programmata; altrimenti la programmi dalle campagne.
- Un elemento già approvato non viene inviato due volte («Era già approvato»).
- Se qualcosa non va, l'elemento **resta in attesa**: puoi riprovare, oppure modificare il testo e approvarlo di nuovo.

Gli elementi appena decisi restano nella lista «Decisi adesso». Un elemento può scadere: stato «Scaduto». Puoi filtrare per «Tipo».

### Verifiche
La scheda **Verifiche** («Coda di verifica») mostra gli **ospiti la cui identità aspetta la verifica di una persona**. Serve il permesso di decidere sulle verifiche (di base titolare, amministratori e property manager). Compare un elemento quando l'ospite chiede una persona, quando il controllo automatico non è sicuro, o quando le impostazioni dell'organizzazione prevedono sempre una persona. Se non usi questa verifica, la coda è vuota («Nessuna verifica in attesa»).

Per ogni caso vedi l'ospite, il soggiorno, «Perché è qui» e «Cosa ha rilevato il controllo automatico» (documento, ripresa dal vivo, qualità della foto, confronto del volto…), con i tentativi. In alto, i numeri degli ultimi 30 giorni. Un badge «Soglie provvisorie» ti dice di considerare provvisorio l'esito automatico.

Azioni:
- **«Videochiamata»**: incolla il link di una riunione (deve cominciare con `https://`); lo mandiamo all'ospite per email e **non resta nella scheda della prenotazione**.
- **«Registra la decisione»**: «Approva la verifica» (l'ospite riceve per email il codice di accesso della struttura, se ne ha uno) oppure «Non verificato» (serve un motivo; il check-in si chiude, l'ospite non può riprovare e non viene inviato nessun codice).
- **«Richiedi una nuova foto»**: l'ospite riceve un nuovo link.
- **«Rifiuta il check-in»**.

Le decisioni restano nel registro delle verifiche. Vedi anche [[ospiti-checkin]] e [[cin-identificazione-ticino]].

### Notifiche
- **Campanella.** È l'icona «Notifiche» in alto a destra: il numero ti dice quante non hai ancora letto. Aprila: le notifiche sono divise per giorno, quelle nuove hanno il segno «Da leggere». Toccandone una si apre la pagina collegata e la notifica risulta letta. «Segna tutte come lette» le azzera; «Mostra altre» carica le più vecchie. Se non c'è niente: «Nessuna notifica. Quando un ospite scrive o c'è qualcosa da fare, lo trovi qui.»
- **Aggiornamenti in tempo reale.** La campanella e le pagine collegate (per esempio **Da fare**) si aggiornano da sole, senza ricaricare. Se la connessione in tempo reale si interrompe, il numero continua ad aggiornarsi a intervalli.
- **Messaggio a comparsa.** Quando arriva una notifica e la campanella è chiusa, compare per circa 8 secondi un messaggio in un angolo con il testo e «Apri».
- **Avvisi in primo piano.** Per ciò che non può aspettare (per esempio Alloggiati Web o ISTAT in scadenza, check-in o check-out da chiudere, sincronizzazione di un canale non riuscita) compare un avviso **alla volta** sopra la pagina, in basso a destra (su telefono sopra la barra in basso). Ha tre scelte: **«Fallo ora»** (apre la prenotazione o l'immobile), **«Ricordamelo più tardi»** (scegli «Tra 15 minuti», «Tra 1 ora», «Tra 4 ore» o «Domani alle 9:00»; le scelte oltre la scadenza non sono disponibili) e **«Ignora»**. Gli avvisi aspettano mentre hai aperta una procedura guidata e compaiono quando la chiudi.

Che cosa ti notifica CasaZen, in sintesi:
- **Ospiti e prenotazioni**: nuova prenotazione, messaggio di un ospite, check-in completato, dati ospite mancanti, richiesta o modifica dal portale ospiti, recensione ricevuta.
- **Adempimenti**: Alloggiati Web in scadenza, scaduto o non riuscito; notifica all'autorità in Svizzera e in Ticino da fare o scaduta; imposta di soggiorno pagata online.
- **Servizi e fornitori**: richiesta presa in carico, iniziata, completata, rifiutata, preventivo, orario proposto, pagamento ricevuto.
- **Documenti fiscali, dominio e supporto**: documento emesso, fattura scartata dallo SDI, dominio verificato, richiesta «Fallo per me» presa in carico o chiusa.
- **Identità**: verifica che aspetta una persona.

**Le preferenze** (quali eventi ti avvisano e per quali canali, e le ore di silenzio) le imposti da **Profilo › Notifiche**: vedi [[account-team-piano#impostare-le-preferenze-di-notifica]]. Le notifiche non compaiono nell'ambiente dimostrativo.

### Chiedi a CasaZen
**Chiedi a CasaZen** è il pulsante con le scintille accanto a «Cerca» (su schermi stretti resta solo l'icona). Apre una finestra con il campo «Cerca una pagina o fai una domanda».

**Cosa sa fare davvero:**
- **Aprire una pagina per nome**: scrivi «apri i messaggi» o solo il nome. Trova solo le pagine che **puoi aprire** (permessi, piano e funzioni attive).
- **Trovare una prenotazione**: scrivi «prenotazione Rossi» o il codice. Se ce n'è una sola, la apre; altrimenti ne mostra fino a sei e «Cerca nell'elenco prenotazioni».
- **Dirti le attività aperte**: «cose da fare» risponde «Ci sono N attività aperte» (o «Tutto in regola. Nessuna attività aperta.»), propone le prime cinque con il pulsante per aprirle e il collegamento a **Da fare**.
- **Portarti alla pagina giusta**: «alloggiati» apre **Report Alloggiati**; «fatture di ottobre» apre **Documenti fiscali** già filtrati sul mese (e sulle fatture); «impostazioni» apre le impostazioni dell'organizzazione; «crea una routine per le pulizie» apre **Routine AI** (nei modelli o in creazione, secondo le parole usate).
- **Indicarti il manuale**: se chiedi come fare una cosa («come metto in pausa una casa?») compare «Nel manuale» con i punti che ne parlano; si aprono in una nuova scheda. Se nessuna pagina corrisponde ma il manuale ha la risposta, vedi solo quella.
- **Trovare i check-in incompleti di oggi**: la domanda suggerita «Quali arrivi di oggi hanno il check-in incompleto?» (pulsante «Trova i check-in incompleti») elenca gli arrivi del giorno (ora di Roma), per «Tutti gli immobili assegnati» o per l'immobile selezionato, con lo stato del link («Link da inviare», «Link inviato · dati in attesa», «Link scaduto», «Compilazione in corso», «Modulo inviato · dati ospiti incompleti»). Scegli una prenotazione con «Apri prenotazione» per verificarla.
- **Preparare le istruzioni di arrivo**: dal dettaglio di una prenotazione, «Prepara le istruzioni di arrivo» ti fa scegliere un «Modello della tua organizzazione», premi «Prepara bozza» e ottieni una «Bozza modificabile» che **copi** con «Copia la bozza» e incolli nei messaggi della prenotazione.
- **Preparare un invito**: «voglio invitare Marta come manager» (anche con l'email, e con «come amministratore», «come collaboratore» o «come commercialista») apre il modulo «Invita un utente» già compilato con nome, email, ruolo e area. Se indichi un'altra organizzazione ti dice qual è quella attiva. L'invio lo confermi tu e serve poter gestire le persone.

**Cosa non fa:**
- **Non invia messaggi, non salva modifiche, non registra pagamenti, non cambia dati.** Apre pagine e prepara testi che poi decidi tu.
- **Non è una chat libera**: se non capisce, dice «Scegli la domanda suggerita per verificare oggi, oppure cerca una pagina per nome» e non inventa risposte.
- Non ti mostra ciò a cui non hai accesso: ti dice «Questa funzione non è disponibile per il tuo profilo».

**Riservatezza.**
- Legge solo con i **tuoi permessi** e solo gli immobili che ti sono assegnati.
- Quasi tutte le richieste le capisce CasaZen stesso, nel tuo browser. Se non riesce, il **testo che hai scritto (al massimo 200 caratteri)** può essere mandato al servizio di intelligenza artificiale di CasaZen **solo per capire dove portarti**. Il servizio restituisce soltanto il tipo di richiesta (per esempio «pagina» o «prenotazione») e una parola chiave. Non riceve i dati della tua attività. Per questo non scrivere nel campo dati sensibili (documenti, carte, password).
- Se il servizio AI non è disponibile, CasaZen cerca soltanto tra i nomi delle pagine.
- Nell'ambiente dimostrativo i dati sono di esempio («Dati dimostrativi»).

### Impostazioni AI
**Impostazioni › AI** raccoglie ciò che usa l'intelligenza artificiale. Serve poter modificare gli immobili. Trovi:
- **Routine AI** («Apri le routine», «Sfoglia i modelli»): «Organizza il lavoro sugli arrivi e le partenze. Scegli cosa avvia una routine, controlla le azioni e provala prima di attivarla». Esempio: «Al check-out › Richiedi la pulizia dell'immobile». Se il tuo piano non include il modulo, vedi «Il modulo non è attivo per la tua organizzazione» e, per l'amministratore, «Gestisci piano e moduli». Vedi [[routine-ai-crm]].
- **Assistente** («Rivedi le regole per le risposte agli ospiti», «Apri le impostazioni»): compare solo se l'assistente per i messaggi è attivo per te (su attivazione).
- **Confronto del volto con il documento** (se il tuo piano include l'identificazione degli ospiti): se è **accesa**, l'ospite scatta un selfie e un programma lo confronta con la foto del documento; se è **spenta**, a verificare è sempre una persona. Imposti la «Soglia di accettazione» (da quel valore in su il volto è accettato da solo, sotto decide l'operatore) e i «Tentativi dell'ospite» (da 1 a 5; dopo questi tentativi passa a un operatore). Finché non salvi valgono i valori predefiniti; salvando, diventano quelli della tua organizzazione.
- Le impostazioni del fornitore AI e dei modelli sono della piattaforma e le gestisce il personale CasaZen: non le vedi.

> **Nota:** un testo scritto dall'AI è sempre una **bozza da rivedere**: dove lo vedi trovi l'etichetta «Contenuto generato con AI».

### Assistente per i messaggi (su attivazione)
Se è attivo, prepara **solo bozze** di risposta ai messaggi degli ospiti. **Nessun messaggio parte senza la tua approvazione** e gli ospiti non vengono avvisati che la bozza l'ha scritta l'assistente. Le bozze arrivano in **Da approvare** come «Bozza di messaggio» (con «Generato da AI» e l'affidabilità); le trovi anche nella conversazione, con «Approva e invia», «Modifica» e «Rifiuta».

In **Impostazioni › AI › Assistente** hai tre sezioni:
- **Regole**: «Assistente acceso», «Tono», «Lingue», «Orari» (le ore in cui prepara le bozze), «Firma» (al massimo 300 caratteri), «Argomenti su cui l'assistente può rispondere» e «Argomenti vietati». Se un argomento è vietato o non consentito l'assistente non scrive e crea un'attività in **Da fare**. Le regole le cambia solo l'amministratore dell'organizzazione. Nella stessa scheda trovi **Le tue risposte**: informazioni, domande frequenti e regole che scrivi tu («Aggiungi una risposta», da 1 a 1000 caratteri, in una lingua o in qualsiasi lingua). L'assistente le usa per scrivere le bozze; quelle «Spente» restano ma non vengono usate. «Informazioni che mancano» elenca gli argomenti su cui non c'è nulla. L'assistente **non legge mai i codici di accesso dell'immobile** (serrature, cassetta delle chiavi).
- **Immobili**: le stesse scelte per un singolo immobile (o «segue di nuovo l'organizzazione»).
- **Situazioni**: per ogni situazione (Wi-Fi, Come arrivare, Parcheggio, Animali, Reclamo, Cancellazione o rimborso…) scegli «Prepara una bozza» oppure «Decide una persona» (l'assistente non scrive e ti crea un'attività in Da fare).

Per modificare immobili e situazioni serve poter modificare gli immobili; senza il permesso puoi solo leggere.

Una bozza può non arrivare perché: l'assistente è spento, il messaggio è troppo vecchio, hai già risposto, l'ospite ha scritto di nuovo, l'annuncio non è confermato o il collegamento con i canali non è attivo. La conversazione ti dice il motivo («Apri le impostazioni dell'assistente» o «Apri le attività da fare»).

## Come fare

### Leggere il Cruscotto ogni giorno
1. Apri **Affitti brevi › Cruscotto** (su telefono è la prima voce della barra in basso).
2. Leggi la riga sotto il titolo: ti dice cosa c'è oggi.
3. In «Oggi» controlla arrivi e partenze. Per un arrivo con check-in incompleto premi «Vedi check-in».
4. In «Da fare» premi il pulsante della prima riga, oppure «Vedi tutte».
5. Se serve, apri «I numeri essenziali».

### Cambiare periodo e immobile
1. Per l'immobile usa «Filtri della Home › Immobile» (compare se ne hai più di uno).
2. Per il periodo apri «I numeri essenziali» e scegli in «Periodo dei numeri».
3. «Azzera filtri» riporta tutto come prima.

### Lavorare con «Da fare»
1. Apri **Cruscotto › Da fare**.
2. Leggi la prima voce e premi «Fallo ora»: si apre la procedura giusta.
3. Se l'hai già risolta fuori da CasaZen, premi «Segna come fatto» e conferma.
4. Per cercare una cosa precisa usa i filtri «Filtra per tipo» e «Filtra per immobile».

Se non c'è niente, vedi «Non c'è niente da fare». Se le attività non si caricano, premi «Riprova» (se compare) o ricarica la pagina.

### Approvare, modificare o rifiutare un elemento
1. Apri **Cruscotto › Da approvare**.
2. Leggi il contenuto, l'affidabilità e la scadenza.
3. Per cambiare il testo premi «Modifica», correggi e premi «Salva e approva» (o «Salva»).
4. Per approvare premi «Approva» (o «Approva e invia» / «Approva e pubblica»).
5. Per rifiutare premi «Rifiuta», scrivi il motivo e conferma («Rifiuta elemento»).
6. Controlla il messaggio di esito: dice se il testo è partito, è in carico al channel manager o se serve riprovare.

> **Attenzione:** una risposta a una recensione, una volta pubblicata, non si può ritirare. Rileggila prima.

### Registrare la decisione su una verifica
1. Apri **Cruscotto › Verifiche** e scegli il caso.
2. Leggi «Perché è qui» e i controlli automatici.
3. Se vuoi parlare con l'ospite premi «Videochiamata», incolla il link (`https://…`) e premi «Invia all'ospite».
4. Dopo il contatto premi «Registra la decisione»: «Approva la verifica» oppure «Non verificato» (con il motivo).

Alternativa: «Richiedi una nuova foto» o «Rifiuta il check-in» (chiude il check-in, l'ospite non può riprovare).

### Leggere le notifiche
1. Premi la campanella «Notifiche» in alto.
2. Tocca una notifica per aprire la pagina collegata: risulta letta.
3. Premi «Segna tutte come lette» per azzerarle.

### Rispondere a un avviso
1. Quando compare un avviso, premi «Fallo ora» per aprire la pagina collegata.
2. Se non puoi adesso premi «Ricordamelo più tardi» e scegli quando.
3. Premi «Ignora» solo se l'avviso non ti serve.

### Chiedere a CasaZen
1. Premi «Chiedi a CasaZen» in alto, accanto a «Cerca».
2. Scrivi una pagina («impostazioni») o una prenotazione («prenotazione Rossi») e premi «Cerca».
3. Scegli il risultato.

**Trovare i check-in incompleti di oggi**
1. Apri «Chiedi a CasaZen» e premi «Trova i check-in incompleti» (o scrivi la domanda).
2. Leggi l'elenco: per ogni arrivo vedi lo stato del link.
3. Premi «Apri prenotazione» per completare. Se la fonte è parziale ti avvisa e puoi aprire gli arrivi di oggi.

**Preparare le istruzioni di arrivo**
1. Apri la prenotazione e premi «Prepara le istruzioni di arrivo».
2. Scegli il «Modello della tua organizzazione» e premi «Prepara bozza».
3. Modifica il testo e premi «Copia la bozza».
4. Apri «Apri i messaggi della prenotazione» e incolla.

Se non vedi modelli: «L'organizzazione non ha modelli attivi. Puoi scrivere il messaggio nella prenotazione». Se manca la conversazione: «Per questa prenotazione non è disponibile una conversazione per i modelli».

### Controllare le impostazioni AI
1. Apri **Impostazioni › AI**.
2. Per le routine premi «Apri le routine» o «Sfoglia i modelli», scegli, controlla le azioni e provale prima di attivarle.
3. Per l'assistente dei messaggi premi «Apri le impostazioni» (se è attivo).
4. Per il confronto del volto accendilo o spegnilo e regola soglia e tentativi, poi salva.

### Regolare l'assistente dei messaggi
1. Apri **Impostazioni › AI › Assistente › Regole**.
2. Accendi «Assistente acceso», scegli «Tono», «Lingue», «Orari» e «Firma».
3. Scegli gli argomenti consentiti e quelli vietati.
4. Premi «Salva le regole». Poi, in **Situazioni**, decidi per ognuna se prepara una bozza o decide una persona.

## Flussi completi

### Flusso: dal messaggio di un ospite alla risposta approvata
1. **L'ospite** scrive su un canale o sul sito.
2. **CasaZen** ti avvisa (campanella e, se l'hai chiesto, email o telefono: [[account-team-piano#impostare-le-preferenze-di-notifica]]).
3. **L'assistente** (se attivo) prepara una bozza o crea un'attività in **Da fare**.
4. **Tu** apri **Da approvare**, controlli, modifichi se serve e premi «Approva e invia».
5. **CasaZen** manda il messaggio e lo segna come inviato, oppure lo passa al channel manager.
6. La conversazione resta in [[messaggi-recensioni]].

### Flusso: una scadenza di legge
1. **CasaZen** crea una voce in **Da fare** (per esempio «Alloggiati Web da inviare») e un avviso in primo piano.
2. **Tu** premi «Fallo ora»: si apre la procedura ([[alloggiati-istat]]).
3. **Tu** completi e confermi.
4. **CasaZen** chiude la voce quando l'adempimento risulta fatto; se l'hai chiusa tu con «Segna come fatto» senza risolvere, potrebbe riproporla.

### Flusso: verifica dell'identità di un ospite
1. **L'ospite** completa il check-in e carica documento e selfie.
2. **CasaZen** fa il controllo automatico (se acceso) e, se non è sicuro o l'ospite lo chiede, mette il caso in **Verifiche** e ti avvisa.
3. **Tu** apri il caso, parli con l'ospite se serve e registri la decisione.
4. **CasaZen** manda all'ospite il codice di accesso (se c'è) o chiude il check-in.

## Regole e limiti
- Cruscotto e «Da fare» mostrano solo gli immobili che ti sono assegnati.
- «Da fare» si apre con il permesso di leggere gli immobili; «Da approvare» con quello di decidere le approvazioni o gestire il marketing; «Verifiche» con quello di decidere sulle verifiche.
- Un messaggio da approvare non può essere vuoto né superare 2000 caratteri. Il motivo di un rifiuto è obbligatorio e viene registrato.
- Una risposta a una recensione pubblicata non si può ritirare.
- «Segna come fatto» non risolve il problema: CasaZen può riproporre l'attività.
- Il link di videochiamata deve cominciare con `https://`, non contenere spazi né password e non superare 500 caratteri.
- Gli avvisi in primo piano compaiono uno alla volta e non durante una procedura guidata. Le scelte di rinvio oltre la scadenza non sono disponibili.
- Le scadenze di legge nelle notifiche non si possono spegnere del tutto.
- «Chiedi a CasaZen» non esegue operazioni e il testo che scrivi (al massimo 200 caratteri) può essere analizzato dal servizio AI solo quando le regole interne non lo capiscono.
- L'assistente dei messaggi prepara **solo bozze** e la firma è lunga al massimo 300 caratteri.

## Domande frequenti

### Non vedo le schede «Da approvare» o «Verifiche».
Compaiono solo se il tuo ruolo permette di decidere su quelle cose. Chiedi a un amministratore ([[account-team-piano]]).

### Ho premuto «Ignora» su un avviso. L'ho perso?
No: la voce resta in **Da fare** finché la cosa non è risolta.

### La campanella non si aggiorna.
Di solito si aggiorna da sola. Se la connessione in tempo reale si interrompe, il numero si aggiorna comunque a intervalli; ricarica la pagina se serve.

### «Chiedi a CasaZen» può modificare una prenotazione?
No. Apre pagine, trova prenotazioni e prepara testi; le modifiche le fai tu.

### Gli ospiti sanno che la bozza l'ha scritta l'assistente?
No: l'avviso resta dentro CasaZen. Per questo rileggi sempre il testo prima di approvarlo.

### Perché «Da fare» mostra solo le prime attività?
Se l'elenco è molto lungo mostra le più urgenti: risolvile e le altre compaiono.

## Glossario
- **Cruscotto**: la pagina iniziale di Affitti brevi.
- **Da fare**: elenco delle attività che aspettano te.
- **Da approvare**: coda delle azioni che partono solo dopo il tuo sì.
- **Verifica**: controllo dell'identità di un ospite fatto da una persona.
- **Avviso in primo piano**: avviso a comparsa per le scadenze.
- **Bozza**: testo proposto che non parte finché non lo approvi.

## Vedi anche
- [[per-iniziare]]: menu, «Cerca» e Guida.
- [[account-team-piano]]: preferenze di notifica, persone e ruoli.
- [[prenotazioni]]: dettaglio, calendario e check-in.
- [[messaggi-recensioni]]: conversazioni con gli ospiti e recensioni.
- [[routine-ai-crm]]: routine AI e campagne.
- [[alloggiati-istat]]: scadenze di legge.
