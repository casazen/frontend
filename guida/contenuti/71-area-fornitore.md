---
id: area-fornitore
titolo: Area Fornitori, richieste, agenda, servizi e incassi
sezione: Fornitori e marketplace
ordine: 71
riassunto: Come un fornitore (pulizie, idraulico, elettricista…) attiva il profilo, riceve e accetta le richieste dei gestori, tiene l'agenda, scrive servizi e prezzi, conosce i suoi clienti e si fa pagare.
chi: [fornitore]
dove: Area Fornitori (Dashboard, Richieste, Disponibilità, Servizi e prezzi, Clienti, Impostazioni, Profilo)
parole_chiave: [fornitore, attivazione, richieste, preventivo, accettare, rifiutare, riserva, agenda, disponibilità, orari, iCal, calendario, servizi e prezzi, clienti, incassi, commissione, Stripe, profilo, termini di servizio]
copre: [/app/supplier/dashboard, /app/supplier/inbox, /app/supplier/inbox/:id, /app/supplier/availability, /app/supplier/calendar, /app/supplier/services, /app/supplier/services/new, /app/supplier/services/:id, /app/supplier/clients, /app/supplier/settings, /app/supplier/earnings, /app/supplier/profile, /app/supplier/help/ical, /app/supplier/activation, /register, /register/claim]
stato: disponibile
fonte_codice: [frontend/src/features/supplier/supplier-dashboard-page.tsx, frontend/src/features/supplier/supplier-inbox-page.tsx, frontend/src/features/supplier/supplier-request-detail-page.tsx, frontend/src/features/supplier/requests/request-parts.tsx, frontend/src/features/supplier/requests/use-request-actions.tsx, frontend/src/features/supplier/supplier-availability-page.tsx, frontend/src/features/supplier/supplier-calendar-sync-page.tsx, frontend/src/features/supplier/ical-help-page.tsx, frontend/src/features/supplier/services/supplier-services-page.tsx, frontend/src/features/supplier/services/supplier-service-wizard-page.tsx, frontend/src/features/supplier/services/supplier-service-detail-page.tsx, frontend/src/features/supplier/clients/supplier-clients-page.tsx, frontend/src/features/supplier/earnings/supplier-earnings-page.tsx, frontend/src/features/supplier/settings/supplier-settings-page.tsx, frontend/src/features/supplier/settings/auto-accept-section.tsx, frontend/src/features/supplier/supplier-profile-page.tsx, frontend/src/features/supplier/supplier-activation-page.tsx, frontend/src/pages/supplier-register-page.tsx, frontend/src/pages/supplier-claim-page.tsx, backend/Casazen.Core/Options/ServiceRequestOptions.cs, backend/Casazen.Core/Options/SupplierPaymentsOptions.cs, backend/Casazen.Core/Entities/Enums/SupplierStatus.cs]
---

## In breve
L'**area Fornitori** è lo spazio di chi offre servizi alle case dei gestori: pulizie, idraulico, elettricista, manutenzione e altro. Qui attivi il tuo profilo, scegli quando lavori, scrivi i tuoi servizi con i prezzi e rispondi alle richieste che arrivano dai gestori (e, dove è attivo, dai clienti della tua vetrina).

Il giro tipico è: ti registri dall'invito, **attivi il profilo** (cinque passi), imposti **orari** e **servizi**, e da quel momento i gestori della tua zona ti trovano. Ogni richiesta ha un tempo per la risposta: tu accetti, rifiuti o mandi un preventivo. A lavoro finito segni «Completato» e, dove i pagamenti online sono attivi, ti fai pagare dentro CasaZen.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Registrazione su invito | Crea il tuo profilo fornitore dal link ricevuto per e-mail | Link dell'invito | fornitore | Disponibile | Registrarsi con un invito |
| Collega il tuo profilo | Collega il profilo già registrato al tuo account | Pagina «Collega il tuo profilo fornitore» | fornitore | Disponibile | Registrarsi con un invito |
| Attivazione del profilo | Cinque passi per comparire ai gestori | Attivazione | fornitore | Disponibile | Attivare il profilo |
| Dashboard | Le cose da fare, la giornata e i tuoi numeri | Dashboard | fornitore | Disponibile | Leggere la Dashboard |
| Richieste | Elenco di tutte le richieste con il tempo per rispondere | Richieste | fornitore | Disponibile | Rispondere a una richiesta |
| Accettare, rifiutare, completare | Le azioni su una richiesta | Richieste › apri una richiesta | fornitore | Disponibile | Rispondere a una richiesta |
| Preventivo | Mandi le voci e il totale; il cliente approva o rifiuta | Richiesta › «Invia un preventivo» | fornitore | Disponibile | Inviare un preventivo |
| Accettare come riserva | Dici che prenderesti il lavoro se il primo fornitore non risponde | Richiesta › «Accetta come riserva» | fornitore | Su attivazione | Accettare come riserva |
| Accettazione automatica | Le richieste dei clienti abituali si accettano da sole | Impostazioni › Risposte | fornitore | Disponibile | Accettare in automatico i clienti abituali |
| Agenda e disponibilità | Lavori, impegni, ferie e giorni chiusi, a giorno, settimana o mese | Disponibilità | fornitore | Disponibile | Impostare gli orari di lavoro |
| Calendario iCal | Collega il tuo calendario: i tuoi impegni chiudono le ore | Disponibilità › Calendario | fornitore | Disponibile | Collegare il calendario iCal |
| Guida iCal | Come trovare il link iCal su Airbnb, Booking.com, Google, Apple, Outlook | Guida iCal | fornitore | Disponibile | Collegare il calendario iCal |
| Servizi e prezzi | Il tuo listino: nome, prezzo, durata, giorni e foto | Servizi e prezzi | fornitore | Disponibile | Creare un servizio |
| Clienti | Chi ti ha chiesto un lavoro, con lo storico | Clienti | fornitore | Disponibile | Consultare i clienti |
| Incassi | Lordo, commissione e netto di ogni lavoro pagato online | Impostazioni › Incassi | fornitore | Su attivazione | Controllare gli incassi |
| Conto per i pagamenti | Colleghi il conto Stripe su cui ricevere i pagamenti | Impostazioni › Pagamenti | fornitore | Su attivazione | Collegare il conto per i pagamenti |
| Ricordare un pagamento | Mandi al cliente un nuovo link di pagamento | Richiesta › «Ricorda il pagamento» | fornitore | Su attivazione | Farsi pagare un lavoro |
| Incasso fuori da CasaZen | Registri un pagamento ricevuto in altro modo | Richiesta › «Ho incassato fuori da CasaZen» | fornitore | Disponibile | Farsi pagare un lavoro |
| Profilo | Dati dell'attività, presentazione, zona, orari e foto | Profilo | fornitore | Disponibile | Aggiornare il profilo |
| Vetrina | La tua pagina pubblica | Vetrina | fornitore | Disponibile | Vedi [[vetrina-fornitore]] |

## Come funziona

### Attivo, in attesa, sospeso
Il tuo profilo ha tre stati:
- **In attesa**: il profilo esiste ma non hai finito l'attivazione. I gestori **non** ti vedono.
- **Attivo**: hai completato l'attivazione e accettato i Termini di Servizio. Compari nella ricerca dei gestori («Visibile ai host nella ricerca»).
- **Sospeso**: uno staff di CasaZen ha sospeso l'account. Non ricevi nuove richieste e non puoi accettare, completare o rifiutare quelle esistenti. Per riattivarlo scrivi al supporto CasaZen.

Se CasaZen aggiorna i **Termini di Servizio**, compare un avviso «Accetta la nuova versione dei Termini di Servizio»: finché non accetti non puoi accettare, completare o rifiutare incarichi.

### Come arrivano le richieste
Le richieste arrivano da due strade:
- da un **gestore** CasaZen, che ti sceglie tra i fornitori della sua zona. Nell'elenco vedi «Host di CasaZen» come provenienza;
- da un **cliente della tua vetrina** («Dal tuo sito»), dove è attiva la prenotazione online (vedi [[vetrina-fornitore]]).

**Prima di accettare** vedi: tipo di lavoro, urgenza, giorno e orario, il comune («Indirizzo dopo che accetti») e il prezzo. **Dopo che accetti** vedi l'indirizzo completo e i contatti del cliente (nome, telefono, e-mail). Se la richiesta è chiusa, i dati del cliente non sono più disponibili.

### Il tempo per rispondere
Ogni richiesta ha un tempo limite, scritto nella richiesta («Rispondi entro le 14:30»). Per impostazione predefinita un gestore aspetta **due ore**; se ha chiesto anche ad altri fornitori di riserva, il fornitore scelto ha **un'ora**. Se nessuno risponde in tempo la richiesta può essere annullata da CasaZen («Nessuno ha risposto in tempo»). La risposta più rapida migliora il tuo «Tempo di risposta» (lo vedi in Dashboard e i gestori lo vedono sulla tua scheda come «Risponde in genere entro…»).

### Gli stati di una richiesta, dal tuo punto di vista
| Stato | Cosa fai tu |
|---|---|
| **Richiesto** («Da rispondere») | Accetti, rifiuti o mandi un preventivo |
| **In attesa del cliente** | Hai proposto un altro orario o inviato un preventivo: aspetti la risposta |
| **Preso in carico** («Programmate») | Fai il lavoro all'orario indicato |
| **In corso** | Stai lavorando: quando finisci, segni «Completato» |
| **Completato** («Da incassare») | Aspetti il pagamento |
| **Pagato** | Fine: non devi fare altro |
| **Rifiutato** / **Annullato** («Archivio») | Chiusa: se avevi un orario in agenda, torna libero |

In ogni richiesta il riquadro **«Adesso»** ti dice cosa fare e a chi tocca («Tocca a te»/«Il cliente»).

### Il preventivo
Per i servizi «Su preventivo» (o quando vuoi proporre un altro prezzo o un altro orario) puoi mandare un **preventivo**: delle voci con importo (da € 0,01 a € 100.000, totale massimo € 100.000), una nota e, se vuoi, un altro orario. Il cliente vede le voci e il totale e li **approva o rifiuta**; solo se li approva il lavoro è accettato a quel prezzo. L'orario proposto **non è riservato** finché il cliente non accetta. Finché il cliente non risponde puoi **modificare** o **ritirare** il preventivo (il cliente, se ritiri, non riceve nessun messaggio e la richiesta torna «da rispondere»). Se il cliente non risponde, il preventivo scade («Il cliente non ha risposto al preventivo in tempo»).

**Importo finale**: se a lavoro finito chiedi **più del 20 %** sopra il totale del preventivo (impostazione predefinita), il cliente deve prima confermare l'importo e poi può pagare.

### Fornitore di riserva
> **Su attivazione.** Dove le riserve sono attive, un gestore può mandare la stessa richiesta a te e ad altri, indicando chi è il fornitore scelto.

Se sei una **riserva** lo vedi nella richiesta («Sei una riserva per questa richiesta»). Il fornitore scelto ha tempo fino a una certa ora. Tu puoi dire subito che prenderesti il lavoro con **«Accetta come riserva»**: la prima riserva che accetta chiude la gara (le altre non possono più accettare) e **il suo orario viene riservato in agenda**. Se il fornitore scelto accetta, il tuo orario torna libero e **non c'è nessuna penalità**. Se non accetta in tempo il lavoro passa a te e ti avvisiamo: solo allora vedi indirizzo e contatti. Se il tuo orario non è più libero quando il lavoro passa a te, la richiesta si chiude per te.

### Accettazione automatica dei clienti abituali
In **Impostazioni › Risposte** puoi attivare «Accetta in automatico i clienti abituali». Funziona così:
- vale per i gestori con cui hai già preso **almeno 3 lavori** (quelli annullati non contano): la prima richiesta accettata in automatico è la quarta;
- vale per i servizi **con un prezzo** e solo se l'orario scelto è **libero nella tua agenda**; non vale per i servizi su preventivo né per i clienti privati della vetrina;
- ti avvisiamo ogni volta che una richiesta viene accettata da sola;
- puoi **annullare il lavoro** dalla richiesta, indicando un motivo, fino a quando non lo avvii.

### L'agenda e il calendario
La pagina **Disponibilità** («Agenda e disponibilità») mostra i tuoi lavori e i tuoi impegni a **giorno, settimana o mese** (su telefono parte dal giorno). I clienti possono prenotare solo quando sei libero. Gli orari di lavoro sono **fasce** (fino a tre al giorno, in ora di Roma: per una pausa pranzo ne servono due). **Senza orari non risultano slot**: i gestori non trovano nessun orario libero. Puoi **chiudere un giorno** («Chiudi questo giorno») e riaprirlo («Riapri questo giorno»).

CasaZen controlla i lavori dei prossimi 30 giorni e ti segnala quelli con un orario da sistemare: cade in un'ora che hai bloccato, nelle ferie o in un giorno di riposo, è fuori dai tuoi orari, si sovrappone a un altro lavoro o a un impegno del tuo calendario, la pausa tra due lavori è troppo corta, supera il massimo di lavori al giorno. Ogni caso ha il suo suggerimento («Sposta il lavoro a un altro orario»…) e il «Primo orario libero».

### Il calendario iCal
Se colleghi il tuo calendario (Google, Apple, Outlook, Airbnb, Booking.com), i tuoi impegni chiudono automaticamente quelle ore. CasaZen **aggiorna il calendario ogni 15 minuti**: una modifica fatta sul calendario esterno si vede entro 15 minuti. Gli eventi segnati **«Disponibile»** nel tuo calendario aspettano una tua risposta: finché non decidi, quei giorni risultano **occupati**.

### Come ti paga CasaZen
Il modo di pagamento di una richiesta è uno solo e lo vedi nella richiesta, alla voce «Come si paga»:
- **«Online, con CasaZen»** (su attivazione): il cliente paga con la carta dentro CasaZen. CasaZen **trattiene** il pagamento: quando segni il lavoro come completato, il cliente ha un po' di tempo per dire che va tutto bene o per segnalare un problema; poi il pagamento viene **rilasciato** a te, al netto della commissione. Per impostazione predefinita il rilascio avviene un'ora dopo, se il cliente non dice nulla. Se un trasferimento non riesce, CasaZen riprova.
- **«Fuori da CasaZen»**: il cliente ti paga come vi siete accordati e **segna** lui la richiesta come pagata, oppure la segni tu con «Ho incassato fuori da CasaZen».

Gli stati del pagamento online che leggi nella richiesta: «Richiesto al cliente», «Importo bloccato sulla carta del cliente», «Pagato dal cliente: CasaZen trattiene i fondi…», «Pagamento rilasciato», «In elaborazione», «Rimborsato» o «Rimborsato in parte», «In contestazione», «Il trasferimento non è ancora riuscito: CasaZen riprova», «In verifica da CasaZen».

### La commissione
Dove i pagamenti online sono attivi, in **Incassi** leggi la regola che vale per te, in una di queste forme: «Sui pagamenti online CasaZen trattiene il N %», «Fino al [giorno] CasaZen non trattiene commissione sui pagamenti online» (periodo gratuito) oppure «Sui pagamenti online CasaZen non trattiene commissione». Ogni lavoro mostra **Lordo**, **Commissione** e **Netto**. Nella richiesta leggi «Netto € … dopo la commissione». Sugli incassi registrati fuori da CasaZen la commissione non c'è («CasaZen non trattiene nessuna commissione su questo incasso»).

### Segnalazioni dei clienti
> **Su attivazione**, solo per i pagamenti fatti online.

Se il cliente, il gestore o CasaZen segnalano un problema (lavoro non fatto, incompleto, non come descritto, qualità non attesa, altro motivo) vedi una **segnalazione** nella richiesta. Il pagamento resta **trattenuto da CasaZen**. Hai **48 ore** per rispondere, **una volta sola**, in testo semplice, scrivendo i fatti (cosa hai fatto, quando, cosa è successo). Se non rispondi la segnalazione passa comunque al team CasaZen, che decide; puoi rispondere anche dopo, finché CasaZen non ha deciso. Esiti: «Risolta a tuo favore» (il pagamento non viene rimborsato), «Risolta a favore del cliente» (con rimborso totale o parziale) o «Ritirata dal cliente». Un esito a favore del cliente può pesare sulla tua posizione di fornitore. Se nessuno segna il lavoro come completato e l'orario previsto è passato, CasaZen può aprire la segnalazione da solo.

### Dove sono i dati del cliente
Telefono ed e-mail del cliente li vedi solo **dopo che accetti** («Il contatto compare dopo che hai preso un lavoro di questo cliente»). I tuoi dati: gli host vedono il tuo telefono solo quando prendi in carico un incarico.

## Come fare

### Registrarsi con un invito
1. Apri il link dell'**invito** che ti è arrivato per e-mail. La pagina mostra «Invito per [tua e-mail]», il comune e fino a quando vale («Valido fino al…», ora italiana).
2. Premi «Crea account e accetta l'invito». Se hai già un account con la stessa e-mail, premi «Ho già un account: accedi».
3. L'e-mail dell'account deve essere **quella dell'invito**: se sei entrato con un'altra, la pagina te lo dice («Accedi con l'email invitata»).
4. Finita la registrazione si apre l'**attivazione del profilo**.

Se il link non funziona (invito scaduto, già usato o annullato) la pagina lo dice: serve un nuovo invito. Senza invito, la registrazione libera è disponibile solo dove CasaZen l'ha aperta; altrimenti leggi «Al momento i fornitori entrano in CasaZen solo su invito».

> **Se hai già registrato il profilo con la stessa e-mail** e crei l'account dopo, la pagina «Collega il tuo profilo fornitore» lo collega: usa «Crea account» o «Ho già un account: accedi» con **la stessa e-mail**. Se l'e-mail non è verificata, apri il link che ti abbiamo inviato e poi premi «Riprova».

### Attivare il profilo
1. Apri **Attivazione** (si apre da solo dopo la registrazione). Vedi «Passo 1 di 5». I progressi si salvano: puoi interrompere e riprendere.
2. **«Dati dell'attività»** («Chi sei?»): ragione sociale, telefono (con il prefisso se non italiano) e, se vuoi, la partita IVA.
3. **«Servizi e comuni»**: scegli almeno una **categoria di servizio** e almeno un **comune** in cui lavori, cercandolo nell'elenco ufficiale.
4. **«Vetrina e foto»**: aggiungi le prime foto (puoi farlo anche dopo).
5. **«Presentazione»**: scrivi chi sei e cosa fai. Lo leggono i gestori quando ti scelgono.
6. **«Termini e attivazione»**: leggi i Termini di Servizio, spunta «Accetto i Termini di Servizio di CasaZen…» e premi «Attiva profilo».
7. Compare «Profilo fornitore attivato: da ora gli host possono trovarti».

Se manca qualcosa, nel riepilogo «Prima di attivare» leggi cosa: la ragione sociale, un telefono valido, almeno una categoria, almeno un comune, la descrizione, i Termini; con «Vai al passo…» ci torni.

### Leggere la Dashboard
1. Apri **Dashboard**: in alto il saluto, poi il riquadro «Per cominciare» finché non hai fatto i primi passi (orari, primo servizio, profilo, vetrina, prima richiesta), con «Configura il tuo profilo» e «Passo X di 5».
2. **«Oggi e prossimi giorni»**: i lavori e le richieste da rispondere. Dalla riga puoi «Accetta» o accettare come riserva.
3. **«Da fare»**: richieste da rispondere, pagamenti in ritardo («Vedi i lavori da incassare»), eventi del calendario da confermare. Se non c'è niente: «Tutto in ordine».
4. **«I tuoi numeri»**: «Lavori completati», «Incassi netti», «Accettate» e «Tempo di risposta», per «Questo mese», «Ultimi 30 giorni» o «Ultimi 3 mesi», con il confronto con il periodo prima.

### Rispondere a una richiesta
1. Apri **Richieste**. L'elenco si apre su «Da rispondere». Le altre schede sono «In attesa del cliente», «Programmate», «Da incassare», «Archivio» e «Tutte».
2. Il pulsante in alto «Rispondi alla più urgente» apre la prima. Puoi anche cercare («Cerca servizio, comune o cliente») e filtrare per servizio, comune, provenienza e giorno del lavoro.
3. Apri la richiesta. Leggi «Il lavoro» (servizio, urgenza, note, immobile, soggiorno) e quando.
4. Scegli:
   - **«Accetta»**: il lavoro è tuo; ora vedi indirizzo e contatti. Se il servizio è su preventivo, «Accetta senza preventivo» lo prende senza voci;
   - **«Rifiuta»**: scrivi il motivo (massimo 500 caratteri): il cliente lo legge e può scegliere un altro fornitore;
   - **«Invia un preventivo»** (vedi sotto).
5. Dopo il lavoro premi **«Segna come completato»**: il cliente vede che hai finito e inizia il pagamento.
6. Per annullare un lavoro già accettato usa **«Annulla il lavoro»** e scrivi il motivo: il cliente è avvisato e il tuo orario torna libero.

Per accettare **più richieste insieme**, nella scheda «Da rispondere» spunta le righe e premi «Accetta le selezionate»: le accetti **così come sono**, con il giorno e l'ora indicati. Le richieste che non si possono accettare (per esempio perché si sovrappongono a un lavoro già accettato) restano «da rispondere» e CasaZen te lo dice, con il motivo. Le richieste come riserva e quelle che vanno risposte con un'offerta non entrano nella scelta multipla.

Dopo un **rifiuto** la richiesta è chiusa («Hai rifiutato la richiesta»); dopo un'**accettazione** puoi solo annullare il lavoro.

### Inviare un preventivo
1. Apri la richiesta e premi «Invia un preventivo».
2. Aggiungi le **voci** («Aggiungi una voce»): una descrizione (per esempio «manodopera») e l'importo (per esempio «80» o «80,50»). Puoi togliere una voce.
3. Scrivi, se vuoi, una **nota per il cliente** (per esempio «il prezzo comprende i materiali»).
4. In «Quando» scegli «Tieni l'orario della richiesta» oppure «Proponi un altro orario» (giorno e ora): l'orario non è riservato finché il cliente non accetta.
5. Premi «Invia il preventivo». Compare «Preventivo inviato al cliente».
6. Per cambiarlo premi «Modifica il preventivo»; per toglierlo «Ritira il preventivo».

### Accettare come riserva
1. Apri la richiesta: dice «Sei una riserva per questa richiesta».
2. Premi «Accetta come riserva». Compare «Fatto: se il fornitore scelto non accetta in tempo, il lavoro può passare a te».
3. Se il fornitore scelto non accetta entro l'ora indicata, il lavoro è tuo e te lo diciamo.

### Accettare in automatico i clienti abituali
1. Apri **Impostazioni › Risposte**.
2. Attiva «Accetta in automatico i clienti abituali».
3. Leggi «Come funziona» (le regole sono sopra). Compare «Salvato.».

### Impostare gli orari di lavoro
1. Apri **Disponibilità**. Se non hai ancora orari compare «Orari di lavoro non impostati» con «Imposta orari».
2. Premi «Imposta orari» (o «Modifica gli orari»). Per ogni giorno scegli l'«Inizio» e la «Fine». Con «Aggiungi una fascia» aggiungi una seconda fascia (per la pausa pranzo); il massimo è tre al giorno. Per un giorno di riposo lascia vuoto («Riposo»).
3. In ogni fascia l'inizio deve venire prima della fine e due fasce non si possono sovrapporre.
4. Premi «Salva orari». Compare «Orari di lavoro aggiornati».

### Chiudere o riaprire un giorno
1. Apri **Disponibilità** e scegli la vista «Giorno» (o tocca il giorno nel mese).
2. Premi «Chiudi questo giorno»: il giorno risulta «Chiuso da te» e i clienti non lo vedono.
3. Per tornare disponibile premi «Riapri questo giorno».

### Collegare il calendario iCal
1. Apri **Disponibilità › Calendario** («Sincronizzazione Calendario»). Nella sezione «Apple / Outlook / Airbnb» premi «Incolla link iCal».
2. Nella finestra «Collega feed iCal» incolla il link in «URL feed iCal». Non sai dove trovarlo? Premi «Scopri come fare» (o apri **Guida iCal**): ci sono i passi per Airbnb, Booking.com, VRBO, Google Calendar, Apple Calendar e Outlook.
3. Premi «Salva e sincronizza». Compare «Sincronizzazione avviata: il calendario si aggiorna tra pochi istanti», poi «Feed iCal connesso».
4. Per aggiornare subito premi «Sincronizza ora»; di norma si aggiorna da solo ogni 15 minuti. Con «Modifica» cambi il link. Se la sincronizzazione fallisce vedi «Errore durante la sincronizzazione» con il motivo.
5. Gli eventi segnati «Disponibile» ricompaiono come «Da confermare»: per ognuno scegli «Sono disponibile» (i giorni tornano prenotabili) oppure «Segna occupato». La scelta vale per tutte le date di un evento ricorrente.
6. Per scollegarlo premi «Scollega» e conferma «Scollegare il calendario?»: i giorni e le ore che il calendario aveva chiuso si riaprono ai clienti; i tuoi blocchi e i giorni chiusi a mano restano.

Il link iCal è un dato riservato: trattalo come una password.

### Creare un servizio
1. Apri **Servizi e prezzi** e premi «Aggiungi un servizio» (se non ne hai: «Crea il tuo primo servizio»). Ti guidiamo in quattro passi e la bozza si salva a ogni passo.
2. **«Cosa offri?»**: nome (massimo 60 caratteri, per esempio «Pulizia cambio ospiti»), categoria, una riga che lo spiega (massimo 200 caratteri) e descrizione (massimo 2000). Puoi aggiungere «Cosa è incluso» e «Cosa non è incluso» (una voce per riga).
3. **«Quanto costa?»**: scegli «Prezzo fisso» (una cifra per lavoro), «A ore» (tariffa oraria) o «Su preventivo» (il prezzo lo dici dopo aver visto il lavoro). L'importo va da € 0,01 a € 100.000. Con «I miei prezzi includono l'IVA» lo mostri ai clienti. Con «Aggiungi un supplemento» aggiungi voci (per esempio per ogni bagno in più), fino a 10.
4. **«Quanto dura e quando lo offri?»**: la durata di solito (serve a mostrare solo gli orari in cui ci sei), il preavviso minimo e i giorni in cui lo offri. Ogni prenotazione arriva come richiesta e la confermi tu.
5. **«Come lo vedranno i clienti?»**: aggiungi le foto (JPEG, PNG o WebP; la prima è la copertina) e guarda l'anteprima.
6. Premi «Pubblica il servizio», oppure spegni «Pubblica subito» e usa «Salva come bozza».

Un servizio **bozza** lo vedi solo tu; uno **pubblicato** è in elenco; uno **in pausa** non è visibile finché non lo riattivi. La zona in cui lavori è la stessa per tutti i servizi: la cambi una volta sola («Cambia la zona»).

### Modificare un servizio
1. In **Servizi e prezzi** filtra per «Tutti», «Pubblicati», «Bozze» o «In pausa» e premi il servizio.
2. Cambia i campi e premi «Salva le modifiche». Con «Visibile ai clienti» pubblichi o metti in pausa. «Come lo vedono i clienti» mostra l'anteprima.
3. Dal menu della riga trovi anche «Duplica», «Metti in pausa»/«Riattiva» e «Elimina».
4. «Elimina» chiede conferma: il servizio non si può ripristinare e i clienti non lo vedono più; **le richieste già ricevute restano dove sono**.

### Consultare i clienti
1. Apri **Clienti**. I filtri sono «Tutti», «Host», «Privati», «Nuovi» (non hai ancora preso nessun loro lavoro) e «Abituali» (almeno 3 lavori presi).
2. Cerca per nome. Apri un cliente per vedere il contatto (solo dopo che hai preso un suo lavoro), i «Lavori presi», gli «Ultimi lavori», il «Prossimo» lavoro e, dove sono attivi i pagamenti online, «Pagato».
3. «Le sue richieste» apre le richieste di quel cliente; «I suoi incassi» i suoi pagamenti.

### Collegare il conto per i pagamenti
> **Su attivazione:** finché i pagamenti online non sono attivi leggi «I pagamenti online non sono ancora attivi».

1. Apri **Impostazioni › Pagamenti**. Leggi lo stato: «Collega il conto per ricevere i pagamenti online».
2. Premi «Collega il conto»: ti porta su **Stripe**, dove inserisci i dati della tua attività e il conto su cui ricevere i soldi. CasaZen non vede né conserva i tuoi dati bancari.
3. Tornando, lo stato può essere «Stripe sta verificando i tuoi dati» (premi «Controlla di nuovo») o «Manca ancora qualcosa» (premi «Riprendi la configurazione»; se il link è scaduto ne ottieni uno nuovo).
4. Quando è attivo vedi «Puoi ricevere pagamenti online» e il pulsante «Apri la dashboard di Stripe».
5. La scheda «Dati per la fattura» mostra ragione sociale e partita IVA: per cambiarli usa «Modifica nel profilo».

### Controllare gli incassi
> **Su attivazione.**

1. Apri **Impostazioni › Incassi**. Sopra l'elenco: «Pagati questo mese», «Da incassare» e «Commissione di CasaZen questo mese».
2. Filtra per periodo («Questo mese», «Mese scorso», «Quest'anno», «Tutto il periodo») e per stato («Tutti», «Da incassare», «In ritardo», «Pagati»).
3. Ogni riga mostra Lavoro, Lordo, Commissione, Netto e Stato («Pagato», «Da incassare», «In ritardo di N giorni», «Rimborsato»…).
4. Premi «Scarica il riepilogo» per il file del periodo.

### Farsi pagare un lavoro
1. Dopo il lavoro premi «Segna come completato»: il cliente vede che hai finito.
2. **Pagamento online**: aspetti; ti avvisiamo quando il cliente paga. Se è in ritardo la richiesta è segnata («In ritardo») e puoi premere **«Ricorda il pagamento»**: il cliente riceve un'e-mail con un nuovo link. Puoi mandarne **uno al giorno**.
3. **Pagamento fuori da CasaZen**: se il cliente ti ha pagato in altro modo, premi «Ho incassato fuori da CasaZen», scrivi il motivo (per esempio «bonifico» o «contanti») e conferma «Registra l'incasso».
4. Per un lavoro che doveva essere pagato online, il motivo è **obbligatorio** («spiega perché il cliente non ha pagato in CasaZen»).

L'incasso registrato fuori **non si può annullare**: il cliente riceve un avviso e il lavoro risulta pagato; CasaZen non trattiene commissione.

### Rispondere a una segnalazione
> **Su attivazione.**
1. Apri la richiesta con la segnalazione: leggi «Cosa ha scritto…» e il motivo.
2. Scrivi la tua risposta in «La tua risposta» (solo fatti, testo semplice) entro il tempo indicato.
3. Premi «Invia la risposta». Compare «Risposta inviata». Puoi rispondere **una sola volta**.

### Aggiornare il profilo
1. Apri **Profilo**. In alto trovi lo stato («Il tuo profilo è attivo» o «Imposta i tuoi orari di lavoro»).
2. Cambia «Dati dell'attività» (ragione sociale, telefono, partita IVA), la «Presentazione», «Servizi e zona», gli orari e le «Foto del tuo lavoro» (JPEG, PNG o WebP fino a 5 MB: si salvano appena le carichi o le sposti).
3. Premi «Salva i dati». Compare «Dati salvati».

L'e-mail dell'account non si cambia da qui: per cambiarla scrivi al supporto.

## Flussi completi

### Flusso: dall'invito alla prima richiesta
1. **Il gestore o CasaZen** ti manda l'invito per e-mail (per un fornitore di fiducia vedi [[marketplace#invitare-un-fornitore-di-fiducia]]).
2. **Tu**: apri il link, crei l'account con la stessa e-mail ([[area-fornitore#registrarsi-con-un-invito]]).
3. **Tu**: completi l'attivazione in cinque passi e premi «Attiva profilo» ([[area-fornitore#attivare-il-profilo]]).
4. **Tu**: imposti gli orari ([[area-fornitore#impostare-gli-orari-di-lavoro]]) e crei il primo servizio ([[area-fornitore#creare-un-servizio]]). Senza questi due passi i gestori non trovano un orario libero.
5. **Tu** (facoltativo): pubblichi la vetrina ([[vetrina-fornitore]]).
6. **Un gestore** ti trova nel Marketplace e ti manda una richiesta ([[marketplace#richiedere-un-intervento]]).
7. **Tu**: la trovi in **Richieste › Da rispondere** e rispondi entro l'orario indicato.

### Flusso: dalla richiesta al pagamento
1. **Il gestore** invia la richiesta: ti arriva un avviso.
2. **Tu**: accetti (o mandi un preventivo, o rifiuti con il motivo).
3. **CasaZen**: ti mostra indirizzo e contatti, e mette il lavoro in agenda.
4. **Tu**: fai il lavoro e premi «Segna come completato».
5. **Il gestore**: conferma l'importo se è oltre il 20 % del preventivo, poi paga con la carta dentro CasaZen oppure segna di aver pagato.
6. **CasaZen**: con il pagamento online trattiene la somma e la rilascia a te al netto della commissione; la vedi in Incassi.
7. La richiesta passa a «Pagato».

### Flusso: richiesta su preventivo
1. Arriva una richiesta per un servizio «Su preventivo».
2. **Tu**: premi «Invia un preventivo» con le voci e, se serve, un altro orario.
3. **Il cliente**: approva o rifiuta. Se approva, il lavoro è accettato a quel prezzo e a quell'ora.
4. **Tu**: fai il lavoro e segni «Completato»; se l'importo finale è oltre il 20 % del preventivo, il cliente deve confermarlo prima di pagare.

## Regole e limiti
- Un profilo **non attivo** non compare ai gestori; uno **sospeso** non riceve né gestisce richieste.
- Il tempo per rispondere è **due ore** per impostazione predefinita; **un'ora** per il fornitore scelto quando ci sono riserve (poi un'altra ora di gara tra le riserve).
- Il motivo del rifiuto o dell'annullamento è visibile al cliente: massimo 500 caratteri.
- Una **riserva** non ha penalità se il primo fornitore accetta.
- **Accettazione automatica**: dal quarto lavoro con lo stesso gestore, solo per servizi con prezzo e orario libero.
- **Preventivo**: importi da € 0,01 a € 100.000 (totale massimo € 100.000); il cliente deve approvarlo.
- **Importo finale** oltre il 20 % del preventivo: conferma del cliente.
- **Servizio**: nome fino a 60 caratteri, riga fino a 200, descrizione fino a 2000; supplementi fino a 10; il numero massimo di servizi è limitato (se lo raggiungi, elimina un servizio).
- **Orari**: fino a tre fasce al giorno, ora di Roma.
- **iCal**: aggiornamento ogni 15 minuti.
- **Promemoria di pagamento**: uno al giorno per richiesta.
- **Segnalazione**: 48 ore per rispondere, una sola risposta.
- **Pagamenti online**: dove sono attivi; sotto € 0,50 non si pagano online.
- I dati del cliente (indirizzo, telefono, e-mail) si vedono **dopo** l'accettazione.

## Domande frequenti

### Perché i gestori non mi trovano?
Controlla che il profilo sia **Attivo**, di aver scelto almeno un **comune** e una **categoria**, di avere **orari di lavoro** e almeno un servizio **pubblicato**. Senza orari non ci sono slot liberi.

### Posso rifiutare una richiesta?
Sì, con «Rifiuta» e il motivo. Il cliente lo legge e può scegliere un altro fornitore.

### Cosa succede se non rispondo in tempo?
La richiesta può passare a una riserva (dove attive) o essere annullata da CasaZen («Nessuno ha risposto in tempo»). L'ordine in cui i gestori ti vedono tiene conto di affidabilità e disponibilità: rispondere in tempo ti aiuta.

### Perché non vedo l'indirizzo del cliente?
Lo vedi solo dopo che accetti la richiesta.

### Quanto trattiene CasaZen?
In **Incassi** leggi la regola che vale per te (percentuale, periodo gratuito o nessuna commissione). Sui lavori pagati fuori da CasaZen non trattiene nulla.

### Posso cambiare l'e-mail del mio account?
Non da qui: scrivi al supporto CasaZen.

### Cos'è «Verificato»?
Un segno che i gestori vedono sulla tua scheda quando i dati dell'attività e la partita IVA sono verificati.

### Come tolgo un servizio dalla vetrina?
Mettilo in pausa in **Servizi e prezzi** («Metti in pausa»): i clienti non lo vedono finché non lo riattivi.

## Glossario
- **Richiesta**: una richiesta di lavoro che ricevi da un gestore o da un cliente della vetrina.
- **Preventivo**: voci e totale che proponi prima del lavoro.
- **Riserva**: fornitore che riceve la richiesta insieme al primo e subentra se questo non risponde.
- **Fascia oraria**: un periodo di lavoro in un giorno (inizio e fine).
- **Slot**: un orario libero che il cliente può scegliere.
- **Netto**: quanto ti spetta, dopo la commissione.
- **Trattenuto**: pagamento già pagato dal cliente, tenuto da CasaZen fino al rilascio.
- **Segnalazione**: la comunicazione di un problema su un lavoro pagato online.

## Vedi anche
- [[vetrina-fornitore]]: la tua pagina pubblica e le prenotazioni online.
- [[marketplace]]: come ti trova il gestore e cosa vede.
