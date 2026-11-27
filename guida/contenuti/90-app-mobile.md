---
id: app-mobile
titolo: App mobile CasaZen
sezione: App mobile
ordine: 90
riassunto: L'app CasaZen per iPhone e Android: cosa fanno dal telefono il gestore, l'ospite, il fornitore e l'inquilino, come si accede, come funzionano notifiche e uso senza connessione e cosa si fa solo sul sito.
chi: [gestore, fornitore, ospite, inquilino]
dove: App CasaZen sul telefono
parole_chiave: [app, app mobile, telefono, iPhone, Android, installare, accesso, login, notifiche push, offline, senza connessione, fotocamera, permessi, calendario, check-in, check-out rapido, adempimenti, Alloggiati Web, richieste fornitore, area fornitore, area inquilino, cerca e prenota, scadenze, manutenzione, cambiare area]
copre: [mobile:index, mobile:login, mobile:(tabs)/calendar, mobile:(tabs)/compliance, mobile:(tabs)/properties, mobile:(tabs)/profile, mobile:bookings/:id, mobile:bookings/:id/service-request, mobile:bookings/:id/checkout, mobile:(guest)/search, mobile:(guest)/trips, mobile:(guest)/settings, mobile:stay/:orgSlug/:property, mobile:book/:orgSlug/:property, mobile:trips/:id, mobile:(supplier)/today, mobile:(supplier)/requests, mobile:(supplier)/agenda, mobile:(supplier)/account, mobile:supplier/requests/:id, mobile:(tenant)/home, mobile:(tenant)/dues, mobile:(tenant)/documents, mobile:(tenant)/maintenance, mobile:(tenant)/me, mobile:tenant/dues/:id, mobile:tenant/maintenance/new, mobile:tenant/maintenance/:id, mobile:+native-intent (non-utente)]
stato: in-arrivo
fonte_codice: [mobile/README.md, mobile/docs/technical/guide.md, mobile/app.json, mobile/app.config.ts, mobile/package.json, mobile/app/_layout.tsx, mobile/app/index.tsx, mobile/app/login.tsx, mobile/app/(tabs)/_layout.tsx, mobile/app/(tabs)/compliance.tsx, mobile/app/(tabs)/properties.tsx, mobile/app/(guest)/_layout.tsx, mobile/app/(guest)/search.tsx, mobile/app/(supplier)/_layout.tsx, mobile/app/(tenant)/_layout.tsx, mobile/app/(tenant)/home.tsx, mobile/app/bookings, mobile/app/supplier/requests, mobile/app/tenant, mobile/src/i18n/locales/it.ts, mobile/src/i18n/index.ts, mobile/src/auth/area.ts, mobile/src/auth/host-access.ts, mobile/src/profile/AccountPanel.tsx, mobile/src/notifications/PushHandler.tsx, mobile/src/notifications/PushSettingsCard.tsx, mobile/src/notifications/notification-routes.ts, mobile/src/bookings/stay-actions.ts, mobile/src/bookings/booking-compliance.ts, mobile/src/bookings/checkout-summary.ts, mobile/src/calendar/HostCalendar.tsx, mobile/src/compliance/compliance-summary.ts, mobile/src/properties/share-link.ts, mobile/src/supplier/supplier-request.ts, mobile/src/supplier/photos.ts, mobile/src/service-requests/supplier-choice.ts, backend/Casazen.Core/Services/PushRoutes.cs, backend/Casazen.Core/Services/IPushNotificationService.cs, backend/Casazen.Infrastructure/Push/InAppNotificationPushDecorator.cs, backend/Casazen.Web/Controllers/ServiceRequestsController.cs, backend/docs/runbooks/mobile-release.md, frontend/src/i18n/locales/it.json]
---

## In breve
CasaZen ha **un'unica app per il telefono**, chiamata «CasaZen». Dentro ci sono quattro aree, una per ogni persona: il **gestore** (l'app lo chiama «host»), l'**ospite**, il **fornitore** e l'**inquilino** (l'app lo chiama «conduttore»). Dopo l'accesso con il tuo account CasaZen vedi solo la tua area.

Dal telefono fai le cose di ogni giorno. Il gestore controlla calendario, arrivi, check-in degli ospiti e adempimenti. L'ospite cerca e prenota una casa. Il fornitore risponde alle richieste e segue i lavori. L'inquilino vede scadenze e documenti e chiede una manutenzione. Le operazioni più grandi (creare prenotazioni, prezzi, incassi, messaggi, invii agli enti) restano **solo sul sito**: l'app non lo sostituisce.

**Stato: in arrivo.** L'app non è ancora negli store (App Store e Google Play). Questa pagina descrive le funzioni che ci sono nella versione attuale dell'app.

**Per partire subito:** apri l'app. Sei un gestore, un fornitore o un inquilino? Premi «Sei un host o un fornitore? Accedi». Sei un ospite? Usa «Cerca» e, quando vuoi prenotare, accedi.

## Funzionalità
La colonna «Disponibilità» dice se la funzione c'è già nell'app. L'app stessa non è ancora negli store (vedi «Lingua, requisiti e installazione»).

| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Accesso con il tuo account | Entri con lo stesso account del sito e l'app ti porta nella tua area | Schermata «CasaZen» (gestori, fornitori, inquilini) o «Accedi per prenotare» (ospiti) | gestore, fornitore, inquilino, ospite | Disponibile | Accedere come gestore, fornitore o inquilino; Accedere o registrarsi come ospite |
| Cambio di area | Passi da un'area all'altra se il tuo account ne ha più di una | Profilo (gestore) o Account (altri) | gestore, fornitore, inquilino, ospite | Disponibile | Cambiare area |
| Notifiche push | Ti avvisano sul telefono di prenotazioni, ospiti, richieste e scadenze | Profilo o Account › riquadro «Notifiche» | gestore, fornitore, inquilino | Disponibile | Attivare le notifiche sul telefono |
| Calendario di un immobile | Elenco mensile di prenotazioni e date bloccate, una casa alla volta | «Calendario» | gestore | Disponibile | Vedere il calendario di un immobile |
| Dettaglio prenotazione | Stato del check-in ospiti, di Alloggiati Web e delle richieste ai fornitori | «Calendario» › tocca una prenotazione | gestore | Disponibile | Aprire una prenotazione e capire cosa manca |
| Registra arrivo | Segna che l'ospite è arrivato | Prenotazione › «Registra arrivo» | gestore | Disponibile | Registrare un arrivo |
| Link di check-in | Manda per e-mail o condividi il link con cui l'ospite compila i suoi dati | Prenotazione › «Invia link via email», «Condividi link di check-in» | gestore | Disponibile | Mandare il link di check-in a un ospite |
| Richiedi fornitore | Chiedi un intervento (pulizie, manutenzione…) legato a un soggiorno | Prenotazione › «Richiedi fornitore» | gestore | Disponibile | Chiedere un intervento a un fornitore |
| Segna pagato | Registra che hai pagato un fornitore per un lavoro completato | Prenotazione › «Richieste fornitore» › «Segna pagato» | gestore | Disponibile | Segnare come pagata una richiesta a un fornitore |
| Check-out rapido | Chiude il soggiorno in pochi tocchi | Prenotazione › «Check-out rapido» | gestore | Disponibile | Fare il check-out rapido |
| Adempimenti | Mostra cosa richiede attenzione: case da attivare, check-in incompleti, check-out in scadenza, Alloggiati | «Adempimenti» | gestore | Disponibile | Controllare gli adempimenti dal telefono |
| Link di prenotazione di una casa | Condividi il link della pagina di prenotazione della casa | «Proprietà» › «Condividi link» | gestore | Disponibile | Condividere il link di prenotazione di una casa |
| Cerca una casa | Cerca case per luogo, date e ospiti, senza account | «Cerca» | ospite | Disponibile | Cercare una casa |
| Prenota un soggiorno | Scegli date e ospiti, accedi e paghi con la carta | Pagina della casa › «Prenota» | ospite | Disponibile | Prenotare un soggiorno |
| Le mie prenotazioni | Ritrovi le prenotazioni fatte con la tua e-mail | «Prenotazioni» | ospite | Disponibile | Ritrovare le tue prenotazioni |
| Elimina il mio account | Cancella l'account ospite | «Account» › «Elimina il mio account» | ospite | Disponibile | Eliminare il tuo account ospite |
| Oggi e Richieste | Vedi cosa rispondere e i lavori del giorno; accetti o rifiuti | «Oggi», «Richieste» | fornitore | Disponibile | Rispondere a una nuova richiesta |
| Altro orario o preventivo | Proponi un altro orario o mandi un preventivo | Richiesta › «Altro orario o preventivo» | fornitore | Disponibile | Proporre un altro orario o inviare un preventivo |
| Lavoro: inizio, foto, fine | Segui il lavoro, aggiungi foto, chiudi con il totale | Richiesta accettata | fornitore | Disponibile | Seguire un lavoro fino alla fine |
| Pagamento del lavoro | Chiedi il pagamento o registri un incasso fuori da CasaZen | Richiesta completata | fornitore | Disponibile | Farsi pagare un lavoro finito |
| Richiesta come fornitore di riserva | Se l'host ha scelto prima un altro fornitore, il lavoro diventa tuo solo se l'altro non risponde in tempo | «Richieste» › apri la richiesta | fornitore | Su attivazione | Rispondere a una nuova richiesta |
| Agenda | Imposti orari di lavoro e giorni di assenza | «Agenda» | fornitore | Disponibile | Impostare orari di lavoro e giorni di assenza |
| Casa, scadenze, bonifico | Vedi il contratto, la prossima scadenza e i dati per il bonifico | «Casa», «Scadenze» | inquilino | Disponibile | Vedere il contratto e la prossima scadenza |
| Dichiarazione di bonifico | Avvisi il gestore che hai pagato con un bonifico | Scadenza › «Ho effettuato il bonifico» | inquilino | Disponibile | Dichiarare un bonifico |
| Documenti condivisi | Apri preventivi, consuntivi, conguagli e resoconti | «Documenti» | inquilino | Disponibile | Aprire i documenti condivisi |
| Richiesta di manutenzione | Scrivi al gestore del contratto, con foto | «Manutenzione» › «Nuova richiesta» | inquilino | Disponibile | Chiedere un intervento di manutenzione |
| Uso senza connessione | Vedi i dati già caricati quando non c'è internet | Tutta l'app | gestore, fornitore, inquilino, ospite | Disponibile | Vedi «Usare l'app senza connessione» |
| Uscita dall'account | Esci e cancelli i dati dal telefono | Profilo o Account › «Esci» | gestore, fornitore, inquilino, ospite | Disponibile | Uscire dall'account |

## Come funziona

### Un'app, quattro aree
Hai un solo account CasaZen e una sola app. L'area che si apre dipende dal tuo account.

| Area | Per chi | Schede in basso | Quando si apre |
|---|---|---|---|
| Gestore (l'app dice «area host») | Chi gestisce case e prenotazioni | «Calendario», «Adempimenti», «Proprietà», «Profilo» | Per chi ha un account da gestore. Un account nuovo vede prima «Completa l'attivazione sul sito». |
| Fornitore | Chi ha un account collegato a un'attività di fornitore | «Oggi», «Richieste», «Agenda», «Account» | Se l'account è collegato a un fornitore e non ha anche una gestione di case. |
| Inquilino (l'app dice «area conduttore») | Chi ha un accesso a un contratto di affitto ancora valido | «Casa», «Scadenze», «Documenti», «Manutenzione», «Account» | Se l'account ha quell'accesso e non è anche gestore o fornitore. |
| Ospite | Chiunque | «Cerca», «Prenotazioni», «Account» | Solo se la scegli tu. La ricerca non richiede un account. |

- Se non hai fatto l'accesso, l'app si apre su «Cerca».
- Se il tuo account ha più aree, passi dall'una all'altra dalla pagina dell'account (vedi «Cambiare area»). L'app ricorda la tua scelta anche se la riapri; «Esci» la dimentica.
- Chi entra con «Accedi per prenotare» è trattato da ospite: non gli viene chiesto di attivare un account da gestore.

### Cosa si fa dal telefono e cosa solo sul sito
Tutto quello che non è nell'elenco «Nell'app» si fa sul sito.

| Persona | Nell'app | Solo sul sito |
|---|---|---|
| Gestore | Calendario di una casa, dettaglio prenotazione, arrivo, link di check-in, richieste ai fornitori, check-out rapido, adempimenti, link di prenotazione | Creare o cambiare prenotazioni, prezzi e tariffe, creare e attivare le case, chiudere le date, messaggi e recensioni, incassi e rimborsi, documenti fiscali, invio e correzione dei dati per Alloggiati Web, ISTAT e imposta di soggiorno, report, team e piano |
| Ospite | Cercare, vedere il prezzo, prenotare (il pagamento è in una pagina sicura dentro l'app), vedere le prenotazioni | Annullare una prenotazione, scrivere all'host, check-in online, recensioni, preferiti, mappa |
| Fornitore | Richieste, orari e assenze, lavoro, foto, pagamento | Blocchi e aperture di singole ore, regole dell'agenda (pausa tra lavori, lavori al giorno, preavviso, orizzonte), richieste urgenti, calendario iCal, catalogo dei servizi, vetrina, richieste su misura |
| Inquilino | Contratto, scadenze, bonifico, documenti, manutenzione | Il resto si gestisce con il gestore del contratto o sul sito |

L'app ti manda sul sito in alcuni punti, per esempio con «Apri Alloggiati sul sito», «Completa sul sito», «Apri sul sito» o «Gestisci sul sito». Il sito si apre nel browser del telefono: se non hai fatto l'accesso lì, ti viene chiesto.

### Notifiche push
Sono gli avvisi che arrivano sul telefono anche con l'app chiusa. Servono un telefono vero (non un emulatore), l'accesso fatto e il permesso del telefono.

**Quando si attivano.** Dopo l'accesso, la prima volta, l'app ti spiega a cosa servono le notifiche: «CasaZen ti avvisa quando mancano i dati di un ospite, quando un fornitore aggiorna una richiesta e quando è ora del check-out». Poi chiede il permesso al telefono. Se in quel momento scegli «Non ora», puoi attivarle più tardi dal riquadro «Notifiche» del Profilo (gestore) o dell'Account (fornitore, inquilino). Gli ospiti non ricevono notifiche dall'app.

**Cosa succede se le tocchi.** L'app apre la schermata giusta: la prenotazione, il check-out rapido, l'elenco «Proprietà», la richiesta del fornitore, la scadenza o la richiesta di manutenzione dell'inquilino. Se non avevi fatto l'accesso, la schermata si apre appena accedi. Se l'avviso riguarda qualcosa che l'app non ha (per esempio una conversazione con un ospite), si apre la prenotazione collegata oppure la schermata di sempre. Con l'app aperta l'avviso compare in alto e la prenotazione che stai guardando si aggiorna da sola.

**Quali avvisi puoi ricevere.** Dipende dalle funzioni attive sul tuo account.
- *Gestore:* nuova prenotazione; l'ospite ha completato il check-in online; mancano dati di un ospite; scadenza vicina, superata o invio non riuscito per Alloggiati Web; promemoria di check-out; il fornitore ha accettato, rifiutato, iniziato, completato o annullato una richiesta, ha proposto un altro orario o ha mandato un preventivo; il link di check-in non è arrivato all'ospite; un documento fiscale emesso o rifiutato; l'ospite ha pagato l'imposta di soggiorno; una recensione ricevuta; un messaggio programmato con un problema; un messaggio di un ospite o una risposta da approvare. In certi casi CasaZen fa un passaggio al posto tuo (per esempio registra arrivo o partenza) e ti avvisa.
- *Fornitore:* nuova richiesta; richiesta accettata in automatico; promemoria dell'host; l'host accetta o rifiuta il tuo orario o il tuo preventivo; il preventivo scade; promemoria il giorno prima del lavoro (alle 18:00, senza indirizzo); pagamento ricevuto; richiesta annullata o pagata.
- *Inquilino:* avvisi che si riferiscono a una scadenza (con il link di pagamento) o a una richiesta di manutenzione.

**Cosa scegli tu.** Sul sito, nella pagina «Notifiche» del tuo profilo, scegli per ogni evento se riceverlo come «Notifica sul telefono», in «Campanella» o per «Email». Con «Ore di silenzio» (ora italiana) le notifiche sul telefono e le e-mail aspettano che il silenzio finisca; le scadenze di legge ti avvisano comunque. Vedi [[cruscotto-notifiche-assistente]].

> **Nota:** il telefono si registra con l'account con cui accedi. Quando fai «Esci», quel telefono smette di ricevere gli avvisi del tuo account.

### Usare l'app senza connessione
L'app ha bisogno di internet per funzionare. Senza connessione:
- vedi i dati già caricati, sotto una barra che dice «Sei offline · dati aggiornati al» e l'ora, oppure «Sei offline · nessun dato salvato su questo telefono»; il pulsante «Riprova» controlla di nuovo la rete;
- le azioni falliscono subito con «Connessione assente. Riprova quando sei online.» L'app **non mette niente in coda per dopo**: quello che hai provato a fare non è stato fatto;
- quando la connessione torna, le schermate aperte si aggiornano da sole.

Se riapri l'app da zero senza rete, trovi ancora l'elenco delle tue case (nome, città, stato e se sono attive). **Calendario, prenotazioni, richieste dei fornitori e dati degli ospiti non vengono salvati sul telefono**: spariscono quando chiudi l'app. I pochi dati salvati vengono cancellati dopo 7 giorni e quando fai «Esci».

**Bozze.** Per ora nessuna schermata dell'app salva bozze: se esci da un modulo a metà, quello che hai scritto non viene tenuto.

### Sessione, sicurezza e dati sul telefono
- L'accesso si rinnova da solo. Se non è più possibile, vedi «La sessione è scaduta: accedi di nuovo.» e dopo l'accesso torni alla schermata in cui eri.
- Le chiavi di accesso sono conservate nell'archivio protetto del telefono, mai in chiaro. Nessun dato di carta passa dall'app: il pagamento dell'ospite avviene in una pagina di pagamento sicura.
- «Esci» scollega questo telefono dalle notifiche, chiude l'accesso e cancella i dati scaricati. Funziona anche senza rete.
- Se un amministratore disattiva il tuo account vedi «Account disattivato».

### Permessi richiesti dal telefono
| Permesso | Quando lo chiede | A cosa serve | Se lo neghi |
|---|---|---|---|
| Notifiche | Dopo l'accesso, la prima volta, con una spiegazione | Avvisi su ospiti, fornitori e check-out | L'app funziona, ma non ti avvisa. Per attivarle: «Attiva notifiche» o «Apri impostazioni» nel riquadro «Notifiche» |
| Fotocamera | Solo quando premi «Scatta una foto» (fornitore) | Fotografare un lavoro | Vedi «Serve il permesso per la fotocamera» e «Apri impostazioni»; puoi sempre scegliere dalla galleria |
| Foto | Quando scegli foto da allegare a un lavoro, a una richiesta di manutenzione o a una ricevuta | Allegare foto | L'app vede solo le foto che scegli tu, con il selettore del telefono |

L'app non chiede la posizione, i contatti né il microfono. Quando premi «Chiama», «Scrivi una e-mail», «Apri la mappa» o «Apri sul sito», apre le app del telefono (chiamate, posta, mappe, browser).

### Lingua, requisiti e installazione
- **Lingua:** italiano; inglese se il telefono è in inglese. Con ogni altra lingua del telefono l'app resta in italiano.
- **Requisiti:** iPhone con iOS 16.4 o successivo (va anche su iPad) oppure telefono Android 7.0 o successivo; connessione a internet. L'app si usa in verticale. Per le notifiche serve un telefono vero.
- **Nome:** l'app si chiama «CasaZen» sia su iPhone sia su Android.
- **Dove si scarica:** l'app **non è ancora negli store**. Se ti è stata data una versione di prova, installala seguendo le istruzioni di chi te l'ha data.
- **Account:** è lo stesso del sito. Gli ospiti possono crearlo dall'app.

### Se qualcosa non va
| Cosa vedi | Cosa significa | Cosa fare |
|---|---|---|
| «Configurazione dell'app incompleta» con un «Codice» | La versione installata non ha le impostazioni per collegarsi a CasaZen | Installa la versione più recente. Se resta, scrivi all'assistenza con il codice |
| Un errore sulla schermata di accesso (per esempio «Accesso non completato: Auth0 non ha rilasciato il token.») | L'accesso nel browser non è finito | Riprova con «Continua con Auth0» o «Accedi o registrati». Se chiudi il browser a metà resti sulla schermata di accesso |
| «La sessione è scaduta: accedi di nuovo.» | L'accesso non si può più rinnovare | Accedi di nuovo |
| «Completa l'attivazione sul sito» | L'account da gestore non è ancora attivo, oppure i documenti legali sono cambiati e vanno accettati | Premi «Apri il sito», completa i passi, torna e premi «Ho completato, riprova» |
| «Account disattivato» | Un amministratore ha disattivato il tuo account | Premi «Esci» e scrivi all'assistenza o a chi ti ha dato l'accesso |
| «Questo account non è un fornitore» o «Questo account non ha un contratto attivo» | L'area si apre solo con il collegamento giusto | Accedi con l'account giusto o chiedi l'accesso |
| «Connessione assente. Riprova quando sei online.» o la barra «Sei offline» | Il telefono non ha internet | Ricollegati e premi «Riprova» |
| «Impossibile caricare…» con «Riprova» | Il caricamento non è riuscito | Premi «Riprova». Se resta, esci e rientra |
| «Non hai accesso a questi dati con il tuo account.» | Il tuo ruolo non può vedere o fare quella cosa | Chiedi a chi amministra l'organizzazione |
| «Elemento non trovato: potrebbe essere stato eliminato.» | La cosa è stata cancellata o spostata | Torna indietro e aggiorna la schermata (tira giù) |
| «Troppe richieste in poco tempo.» | Hai fatto molte operazioni di seguito | Aspetta qualche istante e riprova |

## Come fare

### Accedere come gestore, fornitore o inquilino
Per chi: gestore, fornitore, inquilino.
1. Apri l'app «CasaZen». Se non hai ancora fatto l'accesso si apre «Cerca».
2. In alto premi «Sei un host o un fornitore? Accedi». Vedi la schermata «CasaZen» con «Gestisci prenotazioni e lavori dal telefono».
3. Premi «Continua con Auth0». Si apre nel browser del telefono la pagina di accesso di CasaZen.
4. Accedi con il tuo account CasaZen, lo stesso del sito.
5. Alla fine l'app si riapre da sola nella tua area: «Calendario» per il gestore, «Oggi» per il fornitore, «Casa» per l'inquilino.

Se chiudi il browser prima di finire, resti sulla schermata di accesso e puoi riprovare. Se vedi un errore con un codice, riprova e, se continua, scrivi all'assistenza con quel codice.

> **Nota:** «Auth0» è il nome del servizio di accesso: la pagina che si apre è quella del tuo account CasaZen. L'inquilino entra dalla stessa porta: l'app lo porta nella sua area se riconosce un accesso al contratto.

**Primo accesso come gestore.** Se l'account non è ancora attivato vedi «Completa l'attivazione sul sito»: premi «Apri il sito», scegli il tipo di attività e accetta Termini di servizio, Informativa privacy e DPA. Torna nell'app e premi «Ho completato, riprova». Lo stesso avviene quando i documenti legali vengono aggiornati («Abbiamo aggiornato i documenti legali: accettali sul sito per continuare a usare l'app»).

### Accedere o registrarsi come ospite
Per chi: ospite.
1. Apri l'app e usa «Cerca»: per cercare non serve un account.
2. Quando premi «Prenota» sulla pagina di una casa, o apri «Prenotazioni» o «Account» senza aver fatto l'accesso, l'app ti propone «Accedi o registrati». Premilo.
3. Nel browser crea il tuo account oppure accedi.
4. Dopo l'accesso torni alla casa che stavi guardando.
5. Per vedere le tue prenotazioni l'e-mail dell'account deve essere verificata: apri il messaggio che ti arriva, poi in «Prenotazioni» premi «Ho verificato».

### Cambiare area
Per chi: chi ha più di un'area sullo stesso account.
1. Apri la pagina dell'account: «Profilo» (gestore) oppure «Account» (fornitore, inquilino, ospite).
2. Premi il pulsante dell'area che vuoi: «Passa all'area fornitore», «Passa all'area host», «Passa all'area conduttore» (l'area dell'inquilino) oppure «Cerca e prenota come ospite».
3. L'app si apre sulla pagina iniziale dell'altra area. La scelta resta anche se riapri l'app.

I pulsanti compaiono solo se il tuo account ha davvero quell'area. «Cerca e prenota come ospite» c'è sempre. Per tornare alla tua area di lavoro usa lo stesso pulsante nella pagina dell'account.

### Attivare le notifiche sul telefono
Per chi: gestore, fornitore, inquilino.
1. Al primo accesso, quando l'app chiede «Vuoi attivare le notifiche?», premi «Attiva» e consenti nel messaggio del telefono.
2. Se avevi scelto «Non ora» o avevi rifiutato, apri «Profilo» (gestore) o «Account» (fornitore, inquilino) e guarda il riquadro «Notifiche».
3. Premi il pulsante che c'è: «Attiva notifiche», «Apri impostazioni» (se il telefono le blocca: attivale per CasaZen nelle impostazioni) oppure «Riprova».
4. Quando leggi «Attive: questo telefono riceve le notifiche del tuo account.» è fatto.

> **Suggerimento:** sul sito, nella pagina «Notifiche» del profilo, scegli per quali eventi vuoi la «Notifica sul telefono» e le «Ore di silenzio».

### Risolvere i problemi con le notifiche
1. Apri «Profilo» o «Account» e leggi il messaggio nel riquadro «Notifiche».
2. «Non ancora attivate su questo telefono»: premi «Attiva notifiche».
3. «Le notifiche di CasaZen sono disattivate nelle impostazioni del telefono»: premi «Apri impostazioni» e consentile.
4. «Registrazione delle notifiche non riuscita»: premi «Riprova». L'app ci riprova anche alla prossima apertura. Se vedi un «Codice», dillo all'assistenza.
5. «Le notifiche push funzionano solo su un telefono vero»: sull'emulatore non funzionano.
6. Controlla sul sito, nella pagina «Notifiche», che per quell'evento sia attiva la «Notifica sul telefono» e che le «Ore di silenzio» non coprano l'orario.
7. Se hai fatto «Esci» su questo telefono, accedi di nuovo: dopo l'uscita non riceve più avvisi.

### Vedere il calendario di un immobile
Per chi: gestore.
1. Apri la scheda «Calendario» (si apre da sola dopo l'accesso).
2. Se hai più case, scegli quella che vuoi toccando il suo nome nella fascia in alto. Con una sola casa vedi il suo nome.
3. Usa ‹ e › per cambiare mese. Il pulsante «Oggi» (compare quando sei su un altro mese) riporta al mese corrente.
4. Leggi l'elenco del mese. Ogni scheda di prenotazione mostra nome dell'ospite, date e stato («In attesa», «Confermata», «Check-in effettuato», «Check-out effettuato», «Annullata»). Toccala per aprire la prenotazione.
5. Tira giù per aggiornare.

Cosa vedi oltre alle prenotazioni:
- **«Date bloccate»:** giorni occupati importati dal calendario collegato di un altro canale (per esempio Airbnb o Booking.com). Non hanno una scheda in CasaZen e non si aprono: la prenotazione si gestisce sul canale.
- **«Date chiuse da te»:** giorni che hai chiuso tu. Si cambiano dal calendario sul sito.
- **«Calendari collegati»:** per ogni canale, quando è stato sincronizzato l'ultima volta e come è andata.

Se vedi «Nessuna prenotazione e nessuna data bloccata in questo mese.» il mese è libero. Se vedi «Nessuna proprietà. Aggiungila dal sito.» non hai ancora case: creale sul sito.

### Aprire una prenotazione e capire cosa manca
Per chi: gestore.
1. Tocca la prenotazione nel «Calendario» (oppure da «Adempimenti» o da una notifica).
2. In alto vedi nome dell'ospite, date e stato. Sotto, l'elenco «Avvisi» dice cosa devi fare (per esempio «Dati degli ospiti incompleti» o «Scadenza Alloggiati superata»).
3. In «Check-in ospite» vedi se il link è stato mandato («Link non inviato», «Link inviato», «In compilazione», «Check-in completato», «Alloggiati inviato», «Link scaduto»), come è andata l'e-mail («Email in coda», «Email inviata», «Email non inviata», «Link da copiare»), fino a quando vale il link e «Ospiti completi: X su Y».
4. In «Alloggiati Web» vedi lo stato («Da inviare», «Da inviare manualmente», «Inviato (ricevuta)», «Inviato manualmente», «Invio non riuscito», «Rifiutato»), la scadenza e, se è passata, «Scadenza superata».
5. In «Richieste fornitore» vedi le richieste legate al soggiorno, con categoria, fornitore e stato.
6. In fondo trovi i pulsanti: quelli che servono ora (vedi i passi qui sotto).
7. Tira giù per aggiornare tutto.

> **Nota:** «Check-in ospite» e «Alloggiati Web» compaiono solo per prenotazioni «Confermata», «Check-in effettuato» o «Check-out effettuato». Per correggere i dati degli ospiti e per inviare ad Alloggiati Web usa il sito: «Apri Alloggiati sul sito» apre la scheda giusta della prenotazione. Vedi [[alloggiati-istat]].

### Registrare un arrivo
Per chi: gestore.
1. Apri la prenotazione.
2. Premi «Registra arrivo». Il pulsante c'è solo per una prenotazione «Confermata», dal giorno di arrivo fino al giorno di partenza (secondo l'ora italiana).
3. Alla domanda «Confermi che l'ospite è arrivato nella struttura?» premi «Conferma».
4. Vedi «Arrivo registrato» e la prenotazione passa a «Check-in effettuato». Se mancano dati degli ospiti, l'app lo dice e con «Completa sul sito» apre la scheda Alloggiati.

Nell'app non c'è un pulsante per annullare la registrazione dell'arrivo.

### Mandare il link di check-in a un ospite
Per chi: gestore.
1. Apri la prenotazione e vai a «Check-in ospite».
2. Scegli come mandarlo:
   - «Invia link via email»: CasaZen manda un'e-mail all'ospite. Se hai già mandato un link il pulsante si chiama «Invia sollecito».
   - «Condividi link di check-in»: si apre il menu di condivisione del telefono, per esempio per WhatsApp o SMS.
3. Se c'è già un link attivo, l'app avvisa: «Un nuovo link sostituisce quello attuale, che smette di funzionare.» Premi «Continua» se vuoi andare avanti.
4. Il nuovo link compare nel riquadro «Link di check-in», con la data di scadenza. Tienilo premuto per copiarlo.
5. Controlla lo stato: se vedi «Email non inviata» leggi il motivo (per esempio che l'ospite non ha un indirizzo e-mail) e condividi il link in un altro modo.

Cosa succede dopo: l'ospite riceve il link e compila i suoi dati (vedi [[ospiti-checkin]]); quando ha finito ti arriva un avviso. L'e-mail partita non si può richiamare e il link sostituito non torna valido. I pulsanti ci sono solo se la prenotazione è confermata o in corso e i dati degli ospiti non sono ancora completi.

### Chiedere un intervento a un fornitore
Per chi: gestore.
1. Apri la prenotazione (non annullata) e premi «Richiedi fornitore».
2. Scegli la «Categoria», per esempio «Pulizie» o «Manutenzione».
3. Scegli il «Fornitore» tra quelli attivi nel comune della casa (vedi «Opera a»). L'app non ne sceglie uno per te. Se non ce ne sono vedi «Nessun fornitore attivo per questa categoria nel comune dell'immobile.»
4. Scegli l'«Urgenza»: «Normale», «Alta» o «Emergenza».
5. Se vuoi, scrivi le «Note» per il fornitore (al massimo 1.000 caratteri).
6. Premi «Invia richiesta». Vedi «Richiesta inviata a» e il nome del fornitore.

Cosa succede dopo: il fornitore riceve un avviso e trova la richiesta in «Da rispondere». Tu la ritrovi in «Richieste fornitore» della prenotazione, con il suo stato. Dall'app non puoi annullarla né modificarla dopo l'invio. Se il fornitore propone un altro orario o un preventivo, la risposta si dà dal sito (vedi [[marketplace]]).

### Segnare come pagata una richiesta a un fornitore
Per chi: gestore, se il tuo ruolo può gestire le richieste ai fornitori.
1. Apri la prenotazione e guarda «Richieste fornitore».
2. Sulla richiesta con stato «Completato» premi «Segna pagato».
3. Alla domanda «Confermi il pagamento al fornitore?» premi «Conferma».

Cosa succede dopo: la richiesta passa a «Pagato» e il fornitore viene avvisato. L'app non fa partire nessun pagamento: registra che il lavoro è stato saldato. Se il fornitore ti ha chiesto di pagare dentro CasaZen, ricevi un link per pagare. Nell'app non c'è un modo per annullare «Segna pagato».

### Fare il check-out rapido
Per chi: gestore.
1. Apri la prenotazione e premi «Check-out rapido». Il pulsante compare dal giorno di arrivo, per una prenotazione «Check-in effettuato» o «Confermata» senza arrivo registrato. Puoi arrivarci anche da «Adempimenti» (voce di «Check-out in scadenza») o dalla notifica di check-out.
2. Se l'arrivo non era stato registrato vedi «Arrivo non registrato». Se l'ospite è arrivato, premi «Registra arrivo e procedi» e conferma.
3. Leggi «Riepilogo check-out»: ogni passo ha il suo stato («Fatto», «Da completare», «Da fare», «Obbligatorio»). Vedi anche «Alloggiati Web» e «Pulizie».
4. In «Imposta di soggiorno» puoi dire, se vuoi, come è stata riscossa: «Riscossa online», «Riscossa in struttura», «Non riscossa» o «Non dovuta».
5. In «Proprietà pronta» rispondi «Sì, è pronta» oppure «Non ancora».
6. In «Partenza» spunta «Confermo che l'ospite ha lasciato la struttura». È l'unica cosa obbligatoria.
7. Premi «Chiudi soggiorno» e conferma. Se l'ospite parte prima della data prevista l'app ti chiede una conferma in più («Check-out anticipato»).
8. Vedi «Soggiorno chiuso». Premi «Torna alla prenotazione» oppure «Check-out completo sul sito».

Cosa succede dopo: la prenotazione passa a «Check-out effettuato». Se non hai dichiarato la casa pronta, resta tra gli «Adempimenti» finché non lo fai. Con il check-out rapido l'app non crea nuove richieste di pulizie: se ne era stata preparata una sul sito, parte con la chiusura. Dall'app non puoi riaprire un soggiorno chiuso.

### Controllare gli adempimenti dal telefono
Per chi: gestore.
1. Apri la scheda «Adempimenti» («Panoramica compliance»).
2. Leggi le cinque sezioni, ognuna con il suo numero: «Immobili in attesa di attivazione», «Check-in ospiti incompleti», «Check-out in scadenza», «Errori Alloggiati» e «Alloggiati da inviare manualmente».
3. Tocca una voce. Una prenotazione apre il suo dettaglio o il check-out rapido. Una casa da attivare apre il sito (la freccia ↗ lo indica), perché l'attivazione si fa sul sito.
4. Se vedi «e altri N» ci sono altre voci oltre a quelle mostrate.
5. Tira giù per aggiornare.

«Tutte le attività di compliance sono aggiornate.» vuol dire che non c'è nulla da fare. Sono gli stessi conteggi del cruscotto sul sito (vedi [[cruscotto-notifiche-assistente]]).

### Condividere il link di prenotazione di una casa
Per chi: gestore.
1. Apri la scheda «Proprietà» (sul sito le case si chiamano «Immobili»).
2. Sulla casa premi «Condividi link»: si apre il menu di condivisione del telefono con il link alla pagina di prenotazione.
3. Se il pulsante è spento, leggi il motivo sotto la casa: il sito di prenotazione non è configurato, la casa non è pubblicata (deve essere attiva, non in pausa e con «Compliance: Attivo») oppure non si riesce a leggere il profilo (tira giù per riprovare).
4. «Apri sul sito» apre la pagina della casa sul sito, dove la puoi modificare.

L'elenco «Proprietà» è in sola lettura: per cambiare una casa usa il sito (vedi [[immobili]]).

### Cercare una casa
Per chi: ospite.
1. Apri «Cerca».
2. In «Dove» scrivi il luogo, oppure scegli un suggerimento sotto «Destinazioni» («Tutte le destinazioni» per non limitare).
3. Premi «Quando» («Aggiungi le date»), scegli il giorno di arrivo e poi quello di partenza, e premi «Conferma le date». Con le date l'app mostra le case libere in quei giorni, con il prezzo del soggiorno.
4. Premi «Chi»: indica adulti, bambini e se «Viaggi con animali?».
5. Premi «Cerca».
6. Con «Filtri» restringi per «Prezzo a notte (in euro)», «Camere», «Bagni» e «Servizi», e scegli l'ordine («Consigliate», «Prezzo più basso», «Prezzo più alto», «Valutazione», «Più grandi»). Premi «Mostra le case».
7. Tocca una casa per aprirla. Trovi foto, descrizione, servizi, «Da sapere», «Regole della casa», «Cancellazione», l'host e il riquadro «Il tuo soggiorno» con il prezzo riga per riga («Pulizia», «Imposta di soggiorno», «Totale»).

Se non trovi nulla: «Nessuna casa libera per queste date» suggerisce altre date o meno ospiti, e «Case libere in date vicine» ne propone di vicine. «Togli i filtri» e «Togli le date» riportano alla ricerca larga. Se un giorno scelto non è libero, l'app dice «Questo giorno non è libero.» oppure il soggiorno minimo richiesto.

> **Nota:** l'imposta di soggiorno può comparire come «stimata» o «non inclusa»: si calcola al pagamento, quando indichi l'età dei minori.

### Prenotare un soggiorno
Per chi: ospite.
1. Nella pagina della casa, in «Il tuo soggiorno» scegli le date e gli ospiti e controlla il totale.
2. Premi «Prenota» (con il totale). Se non hai fatto l'accesso, l'app ti chiede «Accedi per prenotare».
3. Nel passo «Prenota la tua casa» controlla «Il soggiorno», «Totale» e «Prenoti come».
4. Quando paghi, usa la **stessa e-mail dell'account**: così ritrovi la prenotazione in «Prenotazioni».
5. Premi «Continua al pagamento». Si apre dentro l'app una pagina di pagamento sicura con la carta, uguale a quella del sito. Le date restano riservate per 30 minuti.
6. Paga e chiudi la pagina. L'app chiede «Hai completato il pagamento?»: premi «Vai alle prenotazioni». La prenotazione compare entro un minuto.
7. Se il pagamento non è andato a buon fine o la pagina non si è aperta, premi «Riapri il pagamento». Con «Cambia le date» torni a scegliere altre date.

Cosa succede dopo: ricevi la conferma come sul sito. L'app non gestisce il pagamento e non vede i dati della tua carta. Se la casa non accetta prenotazioni online, l'app dice «Questa casa non accetta ancora prenotazioni online. Contatta direttamente l'host.»: usa «Chiama» con il nome dell'host.

### Ritrovare le tue prenotazioni
Per chi: ospite.
1. Apri «Prenotazioni» (accedi se richiesto).
2. Passa da «In arrivo» a «Passate». Se ce ne sono molte, premi «Mostra altre».
3. Tocca una prenotazione: vedi lo stato, il «Codice prenotazione», le date, gli ospiti, il prezzo («Alloggio», «Pulizia», «Imposta di soggiorno»), «Totale», «Pagato», «Rimborsato» e l'host. «Rivedi la casa» riapre la casa.
4. Per annullare o scrivere all'host premi «Gestisci sul sito».

Compaiono le prenotazioni dirette fatte con l'e-mail verificata del tuo account. Se non vedi una prenotazione, controlla di aver usato quella e-mail. Gli stati possibili sono: «Confermata», «In attesa di pagamento», «Pagamento in corso», «Pagamento non riuscito», «Da confermare via e-mail», «In attesa dell'host», «Scaduta», «Rifiutata», «Date non più libere», «Annullata», «In corso» e «Conclusa».

### Eliminare il tuo account ospite
Per chi: ospite.
1. Apri «Account» e premi «Elimina account» (sezione «Elimina il mio account»).
2. Alla domanda «Eliminare l'account?» premi «Elimina».

Cosa succede dopo: l'account viene cancellato e dovrai registrarti di nuovo per averne uno. **Non si può annullare.** Le prenotazioni già fatte restano nei registri degli host, come previsto dalla legge. Se il tuo account ha anche un profilo da host o da fornitore, il pulsante non c'è: scrivi al supporto.

### Rispondere a una nuova richiesta
Per chi: fornitore.
1. Apri «Oggi»: se c'è una richiesta nuova, è il blocco in evidenza con «Accetta» («Hai N richieste a cui rispondere»). Oppure apri «Richieste» › «Da rispondere». Il numero sull'icona di «Richieste» dice quante ne hai da rispondere.
2. Apri la richiesta per vedere «Quando», «Dove», «Compenso» e «Rispondi entro». Indirizzo, note e contatti dell'host compaiono **dopo** che hai accettato.
3. Per accettare premi «Accetta» e conferma («Accetti la richiesta?»). La prendi così com'è: orario e compenso sono quelli dell'host. La trovi tra le richieste «Programmate».
4. Per rifiutare premi «Rifiuta», scrivi il motivo (obbligatorio: l'host lo leggerà) e premi «Rifiuta la richiesta».
5. Se l'orario o il compenso non vanno bene, premi «Altro orario o preventivo» (vedi [[app-mobile#proporre-un-altro-orario-o-inviare-un-preventivo]]).

Casi particolari:
- «Questa richiesta su misura si gestisce sul sito.»: usa «Apri sul sito».
- «L'host ha scelto prima un altro fornitore…»: sei fornitore di riserva (su attivazione). Il lavoro diventa tuo solo se l'altro non risponde in tempo. Per ora puoi solo rifiutare.

Cosa succede dopo: l'host viene avvisato. Un rifiuto non si annulla; un lavoro accettato si può ancora annullare finché non lo inizi.

### Proporre un altro orario o inviare un preventivo
Per chi: fornitore.
1. Apri la richiesta nuova e premi «Altro orario o preventivo».
2. Scegli «Proponi un altro orario» oppure «Invia un preventivo».

Per proporre un altro orario:
1. In «Quale giorno proponi?» tocca il giorno e premi «Avanti».
2. In «A che ora?» scegli l'ora e la durata («Quanto dura il lavoro?»). Non puoi scegliere un orario già passato.
3. Se vuoi, scrivi un messaggio per l'host.
4. Premi «Invia la proposta».

Per inviare un preventivo:
1. Per ogni voce scrivi «Cosa fai» e l'importo in euro (per esempio 45,00). Con «Aggiungi una voce» puoi arrivare a 20 voci.
2. Se vuoi, scrivi una nota per il cliente.
3. Premi «Invia il preventivo».

Cosa succede dopo: la richiesta resta in attesa della risposta («In attesa» o «Preventivo inviato») e chi l'ha fatta viene avvisato. Puoi cambiare la proposta con «Cambia la proposta» oppure riprenderti il preventivo con «Ritira il preventivo»: la richiesta torna tra quelle a cui rispondere.

### Seguire un lavoro fino alla fine
Per chi: fornitore.
1. Il giorno del lavoro apri «Oggi»: trovi «Prossimo lavoro» e «Lavori di oggi». Premi «Dettagli».
2. Per contattare l'host usa «Chiama», «Scrivi una e-mail» e «Apri la mappa».
3. Quando cominci premi «Inizia il lavoro».
4. Per aggiungere foto premi «Aggiungi foto», poi «Scatta una foto» oppure «Scegli dalla galleria». Puoi aggiungerne al massimo sei.
5. Quando finisci premi «Lavoro finito». Controlla «Totale in euro» (lascialo com'è se il compenso non cambia), scrivi se vuoi una nota per l'host e premi «Conferma».
6. Se non puoi più fare il lavoro, premi «Annulla il lavoro», scrivi il motivo e conferma. Si può fare solo prima di iniziare.

Cosa succede dopo: l'host viene avvisato e la richiesta passa a «Completata», poi «Da incassare». Se il totale finale è molto più alto del preventivo, l'host deve confermarlo prima del pagamento. Se hai finito senza premere «Inizia il lavoro», il pulsante si chiama «Ho già finito».

### Farsi pagare un lavoro finito
Per chi: fornitore.
1. Apri la richiesta completata e guarda la sezione «Pagamento»: vedi lo stato («Richiesto al cliente», «In elaborazione», «Pagato», «Non riuscito», «In verifica») e «A te arrivano» con l'importo netto.
2. Se il pagamento passa da CasaZen, premi «Chiedi il pagamento» e conferma. CasaZen manda all'host il link per pagare. Puoi chiederlo una volta al giorno.
3. Se invece ti ha già pagato fuori da CasaZen, premi «Ho incassato fuori da CasaZen», scrivi come hai ricevuto il pagamento (contanti, bonifico…) e premi «Registra il pagamento». Se la richiesta si paga su CasaZen il motivo è obbligatorio.

Cosa succede dopo: l'host viene avvisato e, con «Registra il pagamento», la richiesta risulta pagata. Dall'app non puoi annullare questi passaggi. I due pulsanti compaiono solo quando CasaZen sa che l'operazione è possibile. Nella scheda «Da incassare» di «Richieste» trovi i lavori in attesa di pagamento.

### Impostare orari di lavoro e giorni di assenza
Per chi: fornitore.

Per i giorni di assenza:
1. Apri «Agenda» e premi «Aggiungi giorni di assenza».
2. Tocca il primo giorno e, se sono più giorni, anche l'ultimo.
3. Scegli il «Motivo» («Ferie», «Festività», «Malattia», «Altro») e premi «Salva».
4. Per togliere un'assenza premi «Elimina» e conferma «Elimini l'assenza?».

In quei giorni i clienti non possono prenotarti; i lavori già accettati restano. C'è un numero massimo di assenze: se lo raggiungi elimina una vecchia assenza.

Per gli orari:
1. In «Orari di lavoro» ogni giorno della settimana è una riga («Riposo» oppure le fasce).
2. Tocca un giorno e scegli «Lavoro» o «Riposo».
3. Per «Lavoro» imposta «Dalle» e «Alle». Con «Aggiungi una fascia» puoi avere fino a tre fasce nello stesso giorno, che non si possono sovrapporre.
4. Con «Applica anche a» copi gli stessi orari su altri giorni.
5. Premi «Salva».

> **Attenzione:** finché non imposti gli orari i clienti non possono prenotarti.

### Vedere il contratto e la prossima scadenza
Per chi: inquilino.
1. Apri «Casa». Vedi la casa del contratto, l'indirizzo, il tuo ruolo («Conduttore referente» o «Conduttore») e le date.
2. In «Prossima scadenza» vedi la data e come è composta: «Canone», «Acconto condominiale», «Conguaglio», «Altri oneri», con «Totale», «Pagato» e «Residuo».
3. Nel riquadro «Bonifico» trovi «Intestatario», «IBAN» e «Causale». Premi «Copia l'IBAN» o «Copia la causale»: vedi «Copiato».
4. Per il dettaglio premi «Apri la scadenza». L'elenco di tutte le scadenze è in «Scadenze».

Se vedi «Nessun contratto attivo su questo account.» il tuo accesso non è collegato a un contratto valido. Se vedi «Nessuna scadenza da pagare.» non c'è nulla da versare ora.

### Dichiarare un bonifico
Per chi: inquilino.
1. Fai il bonifico con la tua banca. Usa l'IBAN e la causale che trovi in «Casa» o nella scadenza (puoi copiarli).
2. In «Scadenze» apri la scadenza che hai pagato e premi «Ho effettuato il bonifico».
3. Compila «Importo» (sotto vedi «Residuo da versare»), «Data del bonifico» (nel formato AAAA-MM-GG, per esempio 2026-12-05), «Riferimento della banca» e, se vuoi, «Nota».
4. Se vuoi, premi «Allega una ricevuta» e scegli una foto dalla galleria.
5. Premi «Invia la dichiarazione».

Cosa succede dopo: vedi «Dichiarazione inviata». Il gestore deve ancora verificare l'incasso e **la scadenza non risulta pagata** finché non lo fa. La dichiarazione passa da «Inviata, in attesa di verifica» a «Verificata» o «Respinta». L'app non esegue il bonifico: lo fai tu con la banca.

### Aprire i documenti condivisi
Per chi: inquilino.
1. Apri «Documenti».
2. Tocca il documento («Apri» e il titolo).

Trovi i preventivi, i consuntivi, i conguagli e i resoconti che il gestore ha condiviso con te. Se non ce ne sono vedi «Nessun documento condiviso.»

### Chiedere un intervento di manutenzione
Per chi: inquilino.
1. Apri «Manutenzione» e premi «Nuova richiesta». Da «Casa» ci arrivi con «Richiedi un intervento», che apre «Manutenzione».
2. Se hai più contratti, scegli la casa.
3. Scegli la «Categoria» («Idraulico», «Elettricità», «Riscaldamento», «Serratura», «Elettrodomestico», «Altro») e l'«Urgenza» («Normale» o «Urgente»). Con «Urgente» compare «In caso di emergenza» con le istruzioni e i numeri del gestore.
4. Scrivi la «Descrizione».
5. Se vuoi, premi «Allega una foto» (fino a quattro, dalla galleria).
6. Premi «Invia al gestore».

Cosa succede dopo: la richiesta arriva al gestore del contratto («Richiesta inviata»). Tu non scegli il fornitore e non vedi i suoi prezzi. Inviare la richiesta non significa che qualcuno la prenda in carico subito: per un'urgenza vera usa i contatti di emergenza. Nella richiesta vedi lo stato («Inviata al gestore», «Servono informazioni», «Presa in carico», «In corso», «Respinta», «Chiusa», «Riaperta») e i messaggi del gestore in «Comunicazioni».

### Uscire dall'account
Per chi: tutti.
1. Apri «Profilo» (gestore) oppure «Account».
2. Premi «Esci». Alla domanda «Vuoi uscire?» premi «Esci».

Cosa succede dopo: questo telefono smette di ricevere le notifiche del tuo account, i dati scaricati vengono cancellati e l'app apre la pagina di uscita nel browser: al prossimo accesso ti verranno chieste di nuovo le credenziali. Funziona anche senza rete.

## Flussi completi

### Flusso: dalla prenotazione di un ospite al check-out
1. L'ospite prenota dal tuo sito ([[sito-prenotazione]]) o dall'app ([[app-mobile#prenotare-un-soggiorno]]) e paga con la carta.
2. Il gestore riceve, se attiva, la notifica «nuova prenotazione». La prenotazione compare nel «Calendario» ([[app-mobile#vedere-il-calendario-di-un-immobile]]).
3. Prima dell'arrivo il gestore manda il link di check-in ([[app-mobile#mandare-il-link-di-check-in-a-un-ospite]]). L'ospite compila i suoi dati e il gestore riceve l'avviso. Il resto del check-in è spiegato in [[ospiti-checkin]].
4. «Adempimenti» e il dettaglio della prenotazione dicono cosa manca. L'invio ad Alloggiati Web si fa sul sito ([[alloggiati-istat]]).
5. Il giorno dell'arrivo il gestore registra l'arrivo ([[app-mobile#registrare-un-arrivo]]).
6. Durante il soggiorno il gestore può chiedere un intervento a un fornitore ([[app-mobile#chiedere-un-intervento-a-un-fornitore]]).
7. Alla partenza il gestore fa il check-out rapido ([[app-mobile#fare-il-check-out-rapido]]).

### Flusso: un intervento dal gestore al fornitore
1. Il gestore apre la prenotazione e preme «Richiedi fornitore».
2. Il fornitore riceve un avviso, apre «Oggi» o «Richieste» e risponde ([[app-mobile#rispondere-a-una-nuova-richiesta]]), oppure propone un altro orario o un preventivo ([[app-mobile#proporre-un-altro-orario-o-inviare-un-preventivo]]). L'host risponde alla proposta dal sito.
3. Il giorno del lavoro il fornitore preme «Inizia il lavoro», aggiunge foto e, a fine lavoro, «Lavoro finito» con il totale ([[app-mobile#seguire-un-lavoro-fino-alla-fine]]).
4. Il gestore riceve l'avviso. Nella prenotazione la richiesta è «Completato». Con «Segna pagato» registra il saldo ([[app-mobile#segnare-come-pagata-una-richiesta-a-un-fornitore]]).
5. Il fornitore può chiedere il pagamento oppure registrare un incasso avvenuto fuori da CasaZen ([[app-mobile#farsi-pagare-un-lavoro-finito]]).

### Flusso: dalla scadenza alla verifica del bonifico
1. L'inquilino apre «Casa» e vede la prossima scadenza con IBAN e causale.
2. Fa il bonifico con la sua banca.
3. Preme «Ho effettuato il bonifico» e invia la dichiarazione ([[app-mobile#dichiarare-un-bonifico]]).
4. Il gestore verifica l'incasso sul sito ([[canoni-scadenze]]). La dichiarazione diventa «Verificata» o «Respinta». La scadenza risulta pagata solo quando il gestore registra l'incasso.

### Flusso: dalla ricerca alla prenotazione
1. L'ospite apre «Cerca», sceglie luogo, date e ospiti ([[app-mobile#cercare-una-casa]]).
2. Apre una casa, controlla il prezzo e preme «Prenota». Accede o si registra ([[app-mobile#accedere-o-registrarsi-come-ospite]]).
3. Preme «Continua al pagamento», paga con la carta e torna in «Prenotazioni» ([[app-mobile#prenotare-un-soggiorno]]).
4. Dopo la prenotazione, per annullare, scrivere all'host o fare il check-in online usa la pagina della prenotazione sul sito ([[portale-ospite]]).

## Regole e limiti
- **Stessi dati, stesse regole del sito.** L'app e il sito usano lo stesso account e gli stessi dati. Le azioni seguono il ruolo e i permessi del tuo account: se non puoi farne una, l'app mostra l'errore.
- **Serve internet.** Nessuna azione viene messa in coda per dopo. Calendario, prenotazioni, richieste e dati degli ospiti non restano sul telefono quando chiudi l'app. Nessuna schermata salva bozze.
- **Registra arrivo:** solo per una prenotazione «Confermata», dal giorno di arrivo al giorno di partenza (ora italiana).
- **Check-out rapido:** si apre dal giorno di arrivo. L'unica cosa obbligatoria è confermare la partenza. Un check-out anticipato chiede una conferma in più.
- **Link di check-in:** un nuovo link sostituisce il precedente. Disponibile per prenotazioni confermate o in corso, finché i dati degli ospiti non sono completi.
- **Richiesta fornitore:** non per prenotazioni annullate; il fornitore si sceglie tra quelli attivi nel comune della casa; le note arrivano a 1.000 caratteri. Non si annulla né si modifica dall'app.
- **Calendario:** una casa e un mese alla volta. Le «Date bloccate» e le «Date chiuse da te» si vedono ma non si modificano dall'app.
- **«Proprietà»:** sola lettura. Il link di prenotazione esiste solo per case attive, non in pausa e con l'attivazione completata.
- **Ospite:** cercare non richiede account; prenotare e «Prenotazioni» sì. Si vedono le prenotazioni dirette fatte con l'e-mail verificata dell'account. Le date restano riservate per 30 minuti durante il pagamento. L'app non annulla prenotazioni e non scrive all'host.
- **Eliminare l'account** è possibile solo per chi è soltanto ospite, e non si annulla.
- **Fornitore:** al massimo sei foto per lavoro; un preventivo ha da 1 a 20 voci; «Chiedi il pagamento» si può fare una volta al giorno; «Annulla il lavoro» solo prima di iniziare; ogni giorno ha al massimo tre fasce orarie; indirizzo, note e contatti dell'host si vedono solo dopo l'accettazione.
- **Inquilino:** fino a quattro foto per una richiesta di manutenzione e una per la ricevuta, solo dalla galleria. La dichiarazione di bonifico non segna la scadenza come pagata. L'area si apre solo con un accesso al contratto valido.
- **Notifiche:** servono un telefono vero, l'accesso fatto e il permesso. I messaggi con gli ospiti e le approvazioni non hanno una schermata nell'app. Gli ospiti non ricevono notifiche dall'app.
- **Dati sul telefono:** solo l'elenco delle case, lo stato dei calendari collegati, le categorie dei servizi e l'esito dell'attivazione, per al massimo 7 giorni; cancellati con «Esci».
- **Orientamento e lingua:** solo in verticale; italiano, o inglese se il telefono è in inglese.

## Domande frequenti

### L'app sostituisce il sito?
No. L'app serve per le cose di ogni giorno. Creare prenotazioni, prezzi, incassi, messaggi con gli ospiti, documenti fiscali e invii agli enti si fanno sul sito.

### Dove scarico l'app?
Non è ancora negli store. Se ti è stata data una versione di prova, segui le istruzioni di chi te l'ha data. L'app si chiama «CasaZen».

### Con quale account accedo?
Con lo stesso del sito. Gli ospiti possono crearne uno dall'app con «Accedi o registrati».

### Perché l'app mi chiede di attivare l'account sul sito?
Perché un account da gestore si attiva sul sito: scegli il tipo di attività e accetta Termini di servizio, Informativa privacy e DPA. Poi torna nell'app e premi «Ho completato, riprova».

### Posso creare una prenotazione dall'app?
No, solo sul sito. Dall'app il gestore vede le prenotazioni nel «Calendario».

### Posso rispondere ai messaggi degli ospiti dall'app?
No. L'app non ha una schermata dei messaggi. Se ricevi un avviso su un messaggio, si apre la prenotazione collegata. Per rispondere usa il sito.

### Posso usare l'app senza connessione?
Solo per guardare i dati già caricati. Le azioni richiedono internet e non vengono messe in coda.

### Perché non vedo il calendario di una casa?
Se non hai case vedi «Nessuna proprietà. Aggiungila dal sito.» Se hai più case scegli quella giusta in alto. Se vedi «Impossibile caricare il calendario.», premi «Riprova».

### Perché non vedo le mie prenotazioni da ospite?
Compaiono le prenotazioni dirette fatte con l'e-mail verificata del tuo account. Apri il messaggio di verifica e premi «Ho verificato». Poi controlla di aver usato quella e-mail nel modulo di pagamento.

### Le notifiche non arrivano. Cosa faccio?
Segui «Risolvere i problemi con le notifiche». Controlla il riquadro «Notifiche» nell'app, le impostazioni del telefono e la pagina «Notifiche» sul sito.

### Posso annullare una prenotazione dall'app?
Come ospite no: «Gestisci sul sito» apre la pagina della prenotazione dove annullare. Come gestore neppure: l'annullamento si fa sul sito.

### Posso avere più aree con lo stesso account?
Sì, se il tuo account le ha: per esempio gestore e fornitore. Passi dall'una all'altra dalla pagina dell'account ([[app-mobile#cambiare-area]]).

### Che permessi chiede l'app?
Notifiche, fotocamera (solo per fotografare un lavoro) e foto (solo quelle che scegli). Non chiede posizione, contatti né microfono.

### In che lingua è l'app?
In italiano; in inglese se il telefono è impostato in inglese.

## Glossario
- **Area:** la parte dell'app per un ruolo: gestore («host»), fornitore, inquilino («conduttore») e ospite.
- **Auth0:** il servizio di accesso che CasaZen usa; il suo nome compare sui pulsanti di accesso.
- **Notifica push:** un avviso che arriva sul telefono anche con l'app chiusa.
- **Adempimenti (compliance):** le cose da sistemare per essere in regola, per esempio i dati degli ospiti e Alloggiati Web. Nell'app la scheda si chiama «Adempimenti» e la pagina «Panoramica compliance».
- **Check-in ospite:** i dati che l'ospite compila con il link ricevuto.
- **Check-out rapido:** la procedura per chiudere un soggiorno dal telefono.
- **Preventivo:** il prezzo del lavoro, a voci, che il fornitore propone prima di accettare.
- **Dichiarazione di bonifico:** l'avviso con cui l'inquilino dice al gestore di aver pagato; non segna da sola la scadenza come pagata.
- **Date bloccate:** giorni occupati importati da un calendario collegato di un altro canale.

## Vedi anche
- [[prenotazioni]]: prenotazioni e calendario sul sito.
- [[ospiti-checkin]]: il check-in degli ospiti e i dati per Alloggiati Web.
- [[area-fornitore]]: l'area fornitore sul sito.
- [[area-inquilino]]: l'area inquilino sul sito.
- [[portale-ospite]]: la pagina web dell'ospite dopo la prenotazione.
- [[cruscotto-notifiche-assistente]]: le notifiche e il cruscotto sul sito.
- [[alloggiati-istat]]: Alloggiati Web e ISTAT.
- [[immobili]]: le case e le loro regole.
- [[marketplace]]: come il gestore sceglie e gestisce i fornitori.
- [[sito-prenotazione]]: il sito di prenotazione.
- [[canoni-scadenze]]: canoni e scadenze degli affitti lunghi.
