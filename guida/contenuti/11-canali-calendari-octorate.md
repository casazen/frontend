---
id: canali-octorate
titolo: Canali, calendari e Octorate
sezione: Affitti brevi
ordine: 11
riassunto: Come evitare le doppie prenotazioni quando la stessa casa è su più portali (Airbnb, Booking.com e altri): calendari iCal (e perché CasaZen non fa da ponte tra i portali), channel manager Octorate, abbinamento degli annunci, canali e funzioni del Marketplace.
chi: [gestore, amministratore]
dove: Affitti brevi › Immobili › Canali e calendari
parole_chiave: [iCal, calendario, Airbnb, Booking.com, doppie prenotazioni, overbooking, due prenotazioni stessa notte, collegare Airbnb, collegare Booking, link calendario, sincronizzare calendari, esportare calendario, link di esportazione, date occupate, Octorate, attivare Octorate, channel manager, abbinamento, Marketplace, funzioni, OTA, canali, portali]
copre: [/app/short-rent/channels, /app/short-rent/ota, /app/short-rent/ota/create, /app/short-rent/integrations/octorate, /app/short-rent/marketplace/activate/:kind/:code, /app/short-rent/marketplace/request/:moduleCode, /app/short-rent/marketplace/partners/:code/activate]
stato: disponibile
fonte_codice: [frontend/src/features/channels/channels-page.tsx, frontend/src/features/channels/calendar-row.tsx, frontend/src/features/properties/components/ical-settings.tsx, frontend/src/features/properties/components/ical-export-section.tsx, frontend/src/features/ota/ota-page.tsx, frontend/src/features/ota/ota-setup-page.tsx, frontend/src/features/integrations/octorate/connect-wizard.tsx, frontend/src/features/marketplace/activation/activation-wizard-page.tsx, frontend/src/features/marketplace/functions/licensed-request-wizard-page.tsx, frontend/src/features/marketplace/partners/partner-wizard-page.tsx, frontend/src/i18n/locales/it.json, backend/docs/runbooks/ical.md, backend/docs/runbooks/octorate-webhooks.md, backend/Casazen.Core/Services/HostCalendarOverview.cs, backend/Casazen.Infrastructure/Services/ICalExportService.cs, backend/Casazen.Infrastructure/Services/PropertyICalSyncService.cs, backend/Casazen.Infrastructure/Octorate/BookingOctorateSyncService.cs, backend/Casazen.Infrastructure/Jobs/CalendarSyncJob.cs, backend/Casazen.Infrastructure/Jobs/OctorateBookingImportJob.cs, backend/Casazen.Infrastructure/Jobs/OctorateBookingSyncJob.cs, backend/Casazen.Core/Features/FeatureFlags.cs]
---

## In breve
Se affitti la stessa casa su più portali (per esempio Airbnb e Booking.com), le date occupate devono parlarsi, altrimenti rischi una **doppia prenotazione**: due ospiti sulla stessa notte. CasaZen ti dà due strade: i **calendari iCal** (per tutti, semplici ma con un ritardo di minuti o ore) e il channel manager **Octorate** (su attivazione, vedi [[per-iniziare#cosa-significa-su-attivazione]]; più completo). Solo dove è attivo c'è anche un collegamento diretto con i portali (pagina OTA).

**Con i soli calendari iCal CasaZen non fa da ponte tra i portali.** CasaZen legge le date occupate di ogni portale (circa ogni 15 minuti) e ti dà un suo link da incollare sui portali, ma quel link contiene solo ciò che si prenota su CasaZen: le prenotazioni del tuo sito, quelle che inserisci tu e i tuoi blocchi manuali. **Non** contiene le prenotazioni di Airbnb né quelle di Booking.com. Quindi una prenotazione di Airbnb non chiude le date su Booking.com passando da CasaZen. Per non avere due prenotazioni sulla stessa notte devi anche far leggere a ogni portale il calendario degli altri: su Airbnb quello di Booking.com e su Booking.com quello di Airbnb. I passi sono in [[canali-octorate#evitare-le-doppie-prenotazioni-tra-portali-con-i-calendari-ical]]. Anche così resta un ritardo di minuti o ore.

Con iCal le prenotazioni dei portali arrivano come **date occupate, senza nome dell'ospite e senza prezzi**: per mandargli il check-in online e preparare la comunicazione degli ospiti alla Questura trasforma il blocco in soggiorno ([[prenotazioni#creare-un-soggiorno-da-un-blocco-di-un-altro-canale]]). Con Octorate arrivano le prenotazioni complete.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Canali e calendari | Elenca i calendari collegati di tutte le case, con stato e ultimo aggiornamento | Affitti brevi › Immobili › Canali e calendari | gestore, amministratore | Disponibile | Controllare lo stato dei calendari |
| Collega un calendario iCal | Importa le date occupate di Airbnb, Booking.com o altri | Scheda immobile › Calendari iCal › «Collega un calendario» | gestore, amministratore (permesso di modifica degli immobili) | Disponibile | Collegare un calendario iCal |
| Link di esportazione di CasaZen | Link da incollare sui portali perché leggano le date occupate su CasaZen | Scheda immobile › Calendari iCal; «⋯» in Canali e calendari | gestore, amministratore | Disponibile | Incollare il link di CasaZen sui portali |
| Calendari incrociati tra portali | Fa leggere ad Airbnb le date di Booking.com e viceversa: CasaZen non lo fa al posto tuo | Sui portali (in CasaZen copi solo i link) | gestore, amministratore | Disponibile | Evitare le doppie prenotazioni tra portali con i calendari iCal |
| Sincronizza ora | Rilegge subito un calendario | Canali e calendari; scheda immobile | gestore, amministratore (permesso di modifica) | Disponibile | Sincronizzare un calendario subito |
| Scollega | Toglie un calendario e libera le sue date | Scheda immobile › Calendari iCal | gestore, amministratore (permesso di modifica) | Disponibile | Scollegare un calendario |
| Rigenera link | Crea un nuovo link di esportazione e spegne il vecchio | Scheda immobile › Calendari iCal | gestore, amministratore (permesso di modifica) | Disponibile | Rigenerare il link di esportazione |
| Collega i tuoi canali (Octorate) | Procedura guidata che collega il channel manager e abbina gli annunci agli immobili | Si apre dall'attivazione degli immobili, dal Marketplace e dalla procedura «Aggiungi immobile» | gestore, amministratore (permesso sui canali) | Su attivazione | Collegare Octorate a CasaZen |
| Abbinamento degli annunci | Dice a quale immobile CasaZen corrisponde ogni annuncio | Dentro «Collega i tuoi canali» | gestore, amministratore | Su attivazione | Abbinare gli annunci ai tuoi immobili |
| Attiva un canale o uno strumento | Collega un portale o uno strumento al tuo channel manager, immobile per immobile | Marketplace › scheda › «Attiva» | gestore, amministratore (permesso sui canali) | Su attivazione | Attivare un canale o uno strumento dal Marketplace |
| Richiedi una funzione | Prepara la richiesta di una funzione che fa parte della licenza del channel manager | Marketplace › scheda › «Richiedi» | gestore, amministratore (permesso sui canali) | Su attivazione | Richiedere una funzione del channel manager |
| Attiva un partner | Ti accompagna sul sito di un'azienda esterna e registra l'attivazione | Marketplace › scheda del partner | gestore, amministratore (permesso sui canali) | Disponibile | Attivare il servizio di un partner |
| OTA Sync | Collegamento diretto con i portali e sincronizzazione delle prenotazioni | Pagina OTA nel menu Immobili | gestore, amministratore | Su attivazione | Usare la pagina OTA |

## Come funziona

**Tre modi per allineare le date.**

| | Calendari iCal | Octorate | Pagina OTA |
|---|---|---|---|
| A cosa serve | Scambiare le date occupate | Gestire annunci, prenotazioni, calendario e prezzi su più portali da un solo punto | Collegare i portali con le loro chiavi di accesso |
| Cosa porta | Solo date occupate | Prenotazioni, date, prezzi e restrizioni | Prenotazioni dei portali |
| Quanto è veloce | CasaZen legge ogni circa 15 minuti; ogni portale legge il link di CasaZen quando vuole, di solito ogni poche ore | Date lette ogni 15 minuti; prenotazioni segnalate quando cambiano | Su richiesta |
| Disponibilità | Disponibile | Su attivazione | Su attivazione |

**Quale scelgo?** Per cominciare usa i **calendari iCal**: sono disponibili per tutti e bastano per tenere allineate le date, tenendo presenti due limiti: c'è un ritardo e arrivano solo date occupate (niente nomi, niente prezzi). Scegli **Octorate** se hai più case o più portali e vuoi lavorare da un solo punto, con prenotazioni complete e con prezzi e restrizioni che partono da CasaZen. Octorate è un servizio a parte (serve un tuo account Octorate, con le sue condizioni di abbonamento) e in CasaZen è su attivazione. La pagina OTA è una terza strada, diretta, anch'essa su attivazione: serve a chi ha le chiavi di accesso dei portali.

**Come funziona iCal.** iCal è un link a un calendario che contiene solo le date occupate. Funziona in due direzioni, separate:

| Direzione | Cosa passa | Cosa non passa |
|---|---|---|
| **Dal portale a CasaZen**: tu incolli in CasaZen il link iCal del portale | Le date occupate di quel calendario. CasaZen lo legge circa ogni 15 minuti e le mostra nel calendario come blocchi con il nome del canale; occupano le notti anche sul tuo sito | Il nome dell'ospite, i prezzi, i pagamenti, i messaggi: solo «occupato» |
| **Da CasaZen al portale**: tu incolli sul portale il link di CasaZen | Le prenotazioni arrivate dal tuo sito, i soggiorni che inserisci tu e i tuoi blocchi manuali, sempre come «Occupato». Il portale rilegge il link ogni tanto (non subito) e chiude quelle date | Le prenotazioni dei portali (anche quelle che hai trasformato in soggiorno), le date importate dai calendari dei portali, prezzi, nomi, e-mail e note. Restano fuori anche le prenotazioni annullate e le richieste «Paga in struttura» finché non le accetti |

- Per questo CasaZen **non fa da ponte** tra due portali: il link di CasaZen è uno solo per casa e CasaZen non sa quale portale lo sta leggendo, quindi non ci mette le prenotazioni dei portali. Airbnb e Booking.com si parlano solo se li colleghi tu l'uno all'altro ([[canali-octorate#evitare-le-doppie-prenotazioni-tra-portali-con-i-calendari-ical]]).
- Il link di CasaZen mostra solo «Occupato»: mai nomi, e-mail o note.
- Un calendario valido ma senza eventi libera tutte le date importate da quel calendario (le prenotazioni cancellate sul portale liberano le notti). Un file non valido non cambia nulla: le date restano come erano.
- Un evento termina il giorno della partenza: quel giorno resta libero per un nuovo arrivo. Gli eventi annullati non bloccano nulla.

**Limite reale di iCal: la finestra di ritardo.** Tra la prenotazione su un portale e il momento in cui gli altri portali la vedono passa del tempo (CasaZen circa 15 minuti, i portali anche alcune ore). Se due ospiti prenotano la stessa notte in quella finestra, nessuno può impedirlo, nemmeno con i link incrociati. CasaZen rifiuta invece una prenotazione che inserisci tu su notti già occupate. Per ridurre il rischio usa un channel manager.

**Quando un calendario è «da ricontrollare».** In Canali e calendari compare «Da ricontrollare» se l'ultimo tentativo è fallito o se non viene letto da più di 2 ore.

**Perché Octorate.** Octorate è un *channel manager*: un servizio a parte, con il suo account e le sue condizioni di abbonamento, che gestisce annunci, calendari, prenotazioni e prezzi su molti portali e fa da punto unico anche per le date. Collegandolo, CasaZen diventa il punto da cui lavori; non servono i link incrociati tra i portali collegati a Octorate. CasaZen non vede mai la tua password: la inserisci solo sul sito di Octorate e dai il consenso lì.

**Come si ottiene Octorate in CasaZen.** Questa parte è su attivazione: non si accende da un'impostazione del tuo account, la abilita CasaZen per l'installazione. Se non vedi «Collega i tuoi canali» o le schede del Marketplace per i collegamenti, scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza») e chiedi di attivare il collegamento con Octorate. L'account Octorate lo apri e lo paghi con Octorate; quanto costano i singoli collegamenti lo leggi nelle schede del Marketplace («Costo e chi fattura»).

**Cosa si sincronizza con Octorate** (verificato per ogni voce):
| Cosa | Verso | Quando |
|---|---|---|
| Prenotazioni dei portali (nuove, cambiate, cancellate) | Octorate → CasaZen | Quando Octorate le segnala; ogni 6 ore CasaZen ricontrolla ciò che è cambiato; ogni notte alle 02:00 importa le prenotazioni delle case collegate |
| Date occupate (calendario) | Octorate → CasaZen | Ogni 15 minuti, per i prossimi 365 giorni. Le notti chiuse diventano blocchi «Octorate» nel calendario: non si tolgono da CasaZen, le riapri in Octorate |
| Prezzi e restrizioni dei giorni | CasaZen → Octorate | Quando li cambi dal calendario o con «Cambia più giorni» (vedi [[prezzi-tariffe]]); lo stato dell'invio è visibile |
| Testi, foto e dotazioni dell'annuncio | CasaZen → canali | Quando premi «Pubblica» nel passo «Canali» della procedura «Aggiungi immobile» |
| Messaggi degli ospiti | portali ↔ CasaZen | Vedi [[messaggi-recensioni]] |
| Documenti fiscali | Octorate → CasaZen | Funzione separata, su attivazione: vedi [[fisco-documenti]] |

Prenotazioni e date che registri tu in CasaZen vengono comunicate a Octorate perché le date si chiudano anche sui portali.

**Octorate al posto di iCal.** Quando una casa ha un annuncio confermato su Octorate e il suo calendario è stato letto una volta, per i canali Airbnb e Booking.com il calendario arriva da Octorate e CasaZen smette di leggere in automatico il link iCal di quel canale (il link resta, e «Sincronizza ora» funziona ancora). Un calendario del tipo «Altro» non viene mai sostituito. Se scolleghi il channel manager, i link iCal tornano a essere letti.

**Abbinamento: un annuncio, un immobile.** In CasaZen un immobile è una sola unità. Per ogni annuncio di Octorate dici a quale tuo immobile corrisponde e, se l'annuncio ha più camere, quale camera. CasaZen non scrive nulla su un immobile finché non confermi.

**Il Marketplace dei collegamenti.** Il Marketplace ha tre tipi di schede per i collegamenti (i fornitori di servizi sono spiegati in [[marketplace]]):
- **Attiva**: un canale o uno strumento che CasaZen collega al tuo channel manager per te.
- **Richiedi**: una funzione che fa parte della licenza del channel manager; CasaZen non può accenderla, ti prepara il testo della richiesta.
- **Partner**: un servizio di un'azienda esterna: l'attivazione si fa sul suo sito, CasaZen ti accompagna e registra che l'hai fatta.

**Pagina OTA.** È un collegamento diretto con alcuni portali (Airbnb, Booking.com, Expedia, VRBO, TripAdvisor, Agoda) con le loro chiavi di accesso. Non è attiva per tutti: dove non lo è, la pagina Canali e calendari lo dice («Il collegamento diretto con i portali non è ancora attivo»).

**Chi può fare cosa.** Vedere Canali e calendari richiede il permesso di lettura degli immobili. Collegare, sincronizzare, scollegare, copiare o rigenerare il link richiede il permesso di modifica degli immobili: senza, vedi lo stato e nessun pulsante. Collegare Octorate e attivare canali e funzioni richiede il permesso di gestire i canali (OTA); alcuni passaggi sul pannello del channel manager li può fare solo l'amministratore dell'organizzazione.

## Come fare

### Controllare lo stato dei calendari
1. Apri **Affitti brevi › Immobili** e poi la scheda **Canali e calendari**.
2. Ogni riga è un calendario: vedi la casa, il canale (Airbnb, Booking.com, Altro), l'etichetta e «Aggiornato» seguito da quanto tempo fa. «Non ancora aggiornato» significa che non è mai stato letto.
3. Lo stato di ogni calendario è «Sincronizzato», «Sincronizzazione in corso», «Sincronizzato in parte», «Errore» oppure «Mai sincronizzato». Una riga con «Da ricontrollare» e un messaggio rosso ha un problema: leggi il messaggio (vedi [[canali-octorate#risolvere-gli-errori-dei-calendari]]).
4. Una casa senza calendari mostra «Nessun calendario collegato: le date non si aggiornano da sole» e il pulsante «Collega».
5. Se non hai nessun immobile vedi «Nessun immobile da collegare» e il pulsante «Vai agli immobili».

### Collegare un calendario iCal
Importa in CasaZen le date occupate di un portale. **Ti serve:** il permesso di modifica degli immobili, la casa già creata in CasaZen e l'accesso al tuo account Airbnb, Booking.com (o all'altro portale) per copiare il link del calendario.
1. Sul portale cerca la funzione che **esporta** il calendario dell'annuncio e copia il suo **link iCal**: un indirizzo che comincia con https. Ogni portale lo chiama in modo diverso: «Esporta calendario», «Sincronizza calendari», «Indirizzo segreto iCal». Secondo la guida dentro CasaZen, su Airbnb lo trovi nell'annuncio, in Disponibilità › Sincronizzazione calendari › «Esporta calendario»; su Booking.com, nell'Extranet, in Tariffe e disponibilità, nella sezione per sincronizzare i calendari (i nomi delle voci possono cambiare): scegli di esportare il calendario e copia l'indirizzo iCal che compare. I portali cambiano spesso nomi e posizioni: se non trovi la voce, cerca nel portale «esporta calendario» o «sincronizza calendari». Non usare il link dell'annuncio né quello di importazione.
2. In CasaZen apri **Affitti brevi › Immobili › Canali e calendari** e premi «Collega» sulla casa, oppure apri la scheda della casa e la scheda **Calendari iCal**. Se non sai dove trovare il link sul portale, sotto il campo «URL import (HTTPS)» premi «Come trovare il link iCal»: si apre la pagina «Come collegare il calendario via iCal» con i passi per Airbnb, Booking.com, VRBO, Google Calendar, Apple Calendar e Outlook (la stessa guida si apre dal «?» «Cos'è iCal» in Canali e calendari).
3. Nel modulo «Collega un calendario» scegli il «Canale»: Airbnb, Booking.com o Altro.
4. Se vuoi, scrivi un'«Etichetta (facoltativa)», fino a 60 caratteri, per esempio «Airbnb - camera 2». Serve se una casa ha più calendari.
5. Incolla il link in «URL import (HTTPS)». Deve cominciare con https ed essere raggiungibile da internet.
6. Premi «Aggiungi e sincronizza». Vedi «Calendario collegato: la prima sincronizzazione è in corso.».
7. Dopo pochi istanti lo stato diventa «Sincronizzato» e leggi quanti «periodi bloccati importati» ci sono. Le date sono occupate sul tuo sito.

Una casa può avere fino a 10 calendari, ognuno con un link diverso. Se il canale non lo scegli tu, CasaZen lo riconosce dall'indirizzo (Airbnb, Booking.com) o usa «Altro»: è solo una scritta.

> **Attenzione:** questo passo porta le date del portale **dentro CasaZen**, non le porta agli altri portali. Se la casa è su due o più portali, completa anche [[canali-octorate#incollare-il-link-di-casazen-sui-portali]] e [[canali-octorate#evitare-le-doppie-prenotazioni-tra-portali-con-i-calendari-ical]].

### Incollare il link di CasaZen sui portali
Serve perché i portali chiudano le date prese su CasaZen (prenotazioni del tuo sito, quelle che inserisci tu e i blocchi manuali). **Ti serve:** il permesso di leggere gli immobili e l'accesso ai portali.
1. Apri la scheda **Calendari iCal** della casa e guarda «Link di esportazione per le OTA».
2. Premi «Copia». Se la copia non riesce, seleziona il link e copialo a mano. In **Canali e calendari** puoi anche aprire il menu «⋯» di una riga e scegliere «Copia il link di CasaZen».
3. Sul portale cerca la funzione che **importa** o sincronizza un calendario esterno e incolla il link, dandogli un nome (per esempio CasaZen). Secondo la guida dentro CasaZen, su **Airbnb**: nell'annuncio apri Disponibilità › Sincronizzazione calendari › Importa calendario; su **Booking.com**: nell'Extranet apri Tariffe e disponibilità, nella sezione per sincronizzare i calendari, e aggiungi un calendario da importare. I nomi sui portali possono cambiare.
4. I portali rileggono il link ogni tanto: le modifiche non compaiono subito.

> **Attenzione:** chi ha il link vede le date occupate. Incollalo solo sui portali che devono leggerle («Tienilo riservato»).
> **Attenzione:** il link di CasaZen porta ai portali solo ciò che si prenota su CasaZen. Non basta per allineare tra loro Airbnb e Booking.com: serve anche il compito seguente.

### Evitare le doppie prenotazioni tra portali con i calendari iCal
Serve quando la stessa casa è su **due o più portali** (per esempio Airbnb e Booking.com) e non usi Octorate. CasaZen non passa le prenotazioni da un portale all'altro: devono leggere l'uno il calendario dell'altro. **Ti serve:** la casa già in CasaZen, l'accesso a tutti i portali dove è pubblicata e il permesso di modifica degli immobili.
1. Per ogni portale collega in CasaZen il suo calendario: [[canali-octorate#collegare-un-calendario-ical]]. Così le prenotazioni di quel portale chiudono le date sul tuo sito e nel calendario di CasaZen.
2. Per ogni portale incolla il link di CasaZen: [[canali-octorate#incollare-il-link-di-casazen-sui-portali]]. Così le prenotazioni del tuo sito e quelle che inserisci tu chiudono le date sui portali.
3. Su **ogni portale** importa anche il calendario degli altri portali. Con Airbnb e Booking.com: sul portale di Booking.com copia il link iCal di esportazione e incollalo su Airbnb (nella stessa funzione di importazione in cui hai incollato il link di CasaZen); poi fai il contrario, copiando il link di esportazione di Airbnb e incollandolo su Booking.com. Con tre portali ognuno importa gli altri due. Il link di esportazione di un portale lo copi come al passo 1 di [[canali-octorate#collegare-un-calendario-ical]].
4. Controlla ogni tanto **Canali e calendari**: se vedi «Da ricontrollare» agisci subito.
5. Quando arriva una prenotazione da un portale, nel calendario trovi un blocco: trasformalo in soggiorno per fare il check-in dell'ospite ([[prenotazioni#creare-un-soggiorno-da-un-blocco-di-un-altro-canale]]).

> **Attenzione:** senza il passo 3, una prenotazione di Airbnb non blocca mai le date su Booking.com, e viceversa: rischi due prenotazioni sulla stessa notte.
> **Nota:** anche con tutti i passi resta un ritardo di minuti o ore. Se due ospiti prenotano la stessa notte in quel ritardo, nessuno può impedirlo. Per ridurre il rischio usa un channel manager come Octorate (su attivazione).

### Sincronizzare un calendario subito
1. In **Canali e calendari** premi «Sincronizza ora» sulla riga, oppure fallo dalla scheda **Calendari iCal** della casa.
2. Il pulsante diventa «Sincronizzazione…» e lo stato «Sincronizzazione in corso». Quando finisce leggi «Sincronizzato».
3. Se premi più volte non parte più di una lettura alla volta.

### Scollegare un calendario
1. Apri la scheda **Calendari iCal** della casa e premi «Scollega» sul calendario.
2. Leggi «Scollegare il calendario?»: le date importate da quel canale tornano subito libere sul tuo sito e nel calendario. Se su quel portale hai ancora prenotazioni, potresti riceverne altre sulle stesse date. Gli altri calendari non cambiano.
3. Premi «Scollega».

È reversibile: puoi collegare di nuovo lo stesso link e le date tornano alla prima lettura.

### Rigenerare il link di esportazione
Ti serve se il link è finito a chi non dovrebbe averlo.
1. Nella scheda **Calendari iCal** premi «Rigenera link».
2. Conferma con «Rigenera». Vedi «Nuovo link creato: aggiornalo su Airbnb e Booking.com.».
3. Incolla il nuovo link su ogni portale dove avevi il vecchio.

> **Attenzione:** il vecchio link smette di funzionare subito. Fino a quando non aggiorni i portali, vedono le date occupate di CasaZen come libere.

### Collegare Octorate a CasaZen
Su attivazione. **Ti serve:** la funzione attiva (se non la vedi, scrivi all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza»), il permesso di gestire i canali, un tuo account Octorate con le credenziali per entrarci e, per alcuni passaggi sul pannello di Octorate, l'amministratore dell'organizzazione. La procedura «Collega i tuoi canali» non è in nessun menu: si apre da **Affitti brevi › Immobili › Attivazione** (scegli la casa e, in «Portali di prenotazione», premi «Collega»), dal Marketplace (dove leggi «Prima collega il tuo channel manager» con il link «Collega il channel manager») o dal passo «Canali» di «Aggiungi immobile» (pulsante «Vai al collegamento dei canali»).
1. Nella prima domanda, «Dove si trovano oggi i tuoi annunci?», scegli la risposta più vicina alla tua: «Sono già su Octorate», «Sono già sulle OTA o in un altro gestionale», «Non sono ancora stati pubblicati» oppure «Ho una situazione mista» (per ogni immobile dici in quale situazione è). Se una strada non è disponibile leggi «Questa strada non è ancora disponibile: scegli un'altra risposta».
2. Leggi «Perché collegare» e vai avanti: collegare non cambia nulla sui tuoi annunci.
3. Nel passo «Collegamento» premi «Vai al tuo channel manager». Si apre il sito di Octorate **nella stessa scheda**: accedi con le tue credenziali e autorizza CasaZen.
4. Torni in automatico. Tieni aperta la pagina («Stiamo completando il collegamento»). Vedi «Il tuo channel manager è collegato» e quanti immobili CasaZen ha trovato nel tuo account.
5. Se hai scelto «Sono già su Octorate» premi «Vedi i tuoi annunci»: nel passo «Canali trovati» ogni annuncio ha uno stato («Nuovo», «Da confermare», «Da scegliere», «Collegato», «Escluso»). Per ora li leggiamo soltanto.
6. Se hai scelto «Sono già sulle OTA» premi «Scegli i portali»: scegli i portali dove hai annunci e per ognuno dai l'accesso dal pannello di Octorate con «Collega su Octorate». Il browser apre una finestra: se la blocca, consentila. Poi rispondi «Sì, ho fatto» alla domanda «Hai completato l'accesso e visto il portale come Attivato?» (o «No, riapri»). Per Booking.com, Expedia e altri puoi anche scrivere l'ID della struttura e fare l'ultimo passo sul sito del portale. Gli stati sono «Da collegare», «In attesa del login», «Verifica in corso», «Da confermare», «Collegato», «Errore». Quando almeno un portale è collegato premi «Importa gli annunci».
7. Segui l'importazione («Annunci e camere», «Prenotazioni», «Calendario»): puoi uscire con «Salva ed esci», continua da sola. Quando gli annunci sono arrivati premi «Vai all'abbinamento».
8. Abbina gli annunci ([[canali-octorate#abbinare-gli-annunci-ai-tuoi-immobili]]).
9. Nel «Riepilogo» («Controlla e conferma») leggi cosa succederà e premi «Conferma e concludi». Il risultato dice, annuncio per annuncio: «Collegato», «Importato», «Da fare dopo», «Escluso» o «Non riuscito». Alla fine vedi «Collegamento completato».
10. Nel riepilogo trovi anche «I tuoi calendari iCal»: per ogni calendario già collegato ti dice cosa fare. Finché Octorate non ha letto il calendario una prima volta, CasaZen continua a leggere l'iCal; dopo, il calendario arriva da Octorate e puoi togliere dal portale il link iCal di CasaZen.

In ogni passo c'è «Salva ed esci»: il punto raggiunto viene conservato, anche se riprendi da un altro dispositivo. Un consenso già dato resta dato.

Se il collegamento non va a buon fine: «Collegamento non completato» (il consenso non è stato confermato) o «Il collegamento non è riuscito»; premi «Riprova il collegamento». Se leggi «Serve ricollegare il channel manager» il collegamento non è più valido e va rifatto.

### Abbinare gli annunci ai tuoi immobili
1. Nel passo «Abbinamento» ogni annuncio ha una proposta di CasaZen («Proponiamo») o dice «Non abbiamo trovato un immobile uguale in CasaZen».
2. Per ogni annuncio scegli una sola cosa in «Cosa vuoi fare con …?»: «Conferma questo immobile», «Scegli un altro immobile», «Importa come nuovo immobile», «Non è un mio immobile» oppure «Lo faccio dopo».
3. Se l'annuncio ha più camere scegli «Quale camera è questo immobile?».
4. Per le proposte chiare puoi premere «Conferma le proposte chiare» in una volta sola.
5. Un immobile corrisponde a un solo annuncio: se lo scegli due volte CasaZen te lo segnala.
6. Prosegui con «Controlla e conferma» e poi «Conferma e concludi».

Cosa succede: «Importa come nuovo immobile» crea la casa solo in CasaZen, inattiva e da controllare; sui canali non crea nulla. «Non è un mio immobile» lo esclude e non te lo propone più (puoi ripensarci). «Lo faccio dopo» lascia l'annuncio da confermare: finché non lo confermi, CasaZen non scrive su quell'immobile.

### Attivare un canale o uno strumento dal Marketplace
Su attivazione. Serve che il channel manager sia collegato e che gli immobili siano già abbinati.
1. Dal Marketplace apri la scheda del canale (per esempio un portale) e premi «Attiva». Si apre «Attiva …» con «Salva ed esci» a ogni passo.
2. **Immobili.** Scegli gli immobili da collegare. Quelli non ancora collegati al channel manager sono elencati come «Non ancora collegati», con il link «Collega gli immobili».
3. **Accesso.** CasaZen ti chiede solo ciò che serve a quel canale: nome utente e password (usati una sola volta, CasaZen non li conserva e valgono per tutti gli immobili scelti), oppure l'identificativo dell'immobile sul canale, oppure il consenso sul pannello del channel manager. Il consenso sul pannello lo dà l'amministratore dell'organizzazione; dopo premi «Controlla di nuovo». Se non serve altro leggi «Per collegare … non serve altro: puoi andare avanti».
4. **Collegamento.** CasaZen crea il collegamento nel channel manager, un immobile alla volta: «In attesa», «Collego…», «Collegato». Se un immobile non va, leggi il motivo e premi «Correggi i dati di accesso» o «Riprova».
5. **Importazione.** Il channel manager porta qui camere, prenotazioni e calendario del canale. Puoi uscire: continua da solo.
6. **Camere.** Per ogni camera del canale scegli la camera corrispondente o «Non collegare questa camera». Le camere che non si possono gestire da CasaZen restano fuori. Premi «Salva e continua».
7. **Attivazione.** Rileggi il riepilogo e premi «Attiva …».
8. Il risultato è «Attivazione completata», «Attivazione quasi completata» o «Non siamo riusciti ad attivare», con «Correggi» per le case da sistemare. CasaZen controlla il collegamento ogni 30 minuti e, se qualcosa non va, te lo segnala in «Da fare».

### Richiedere una funzione del channel manager
Su attivazione. Alcune funzioni non le accende CasaZen: fanno parte della licenza del channel manager e le chiedi tu.
1. Dal Marketplace apri la scheda della funzione e premi «Richiedi». Il primo passo, «Cos'è …», dice cosa fa, per chi è, quanto costa e cosa dice la tua licenza (per esempio le camere comprese).
2. Scegli l'immobile: la licenza è di ogni immobile.
3. Nel passo «Richiesta» CasaZen prepara il testo da mandare al channel manager. Premi «Copia il testo» e invialo tu.
4. Poi premi «Ho fatto la richiesta». La funzione risulta «Richiesta» finché non compare nella tua licenza. CasaZen controlla la licenza ogni giorno; con «Controlla ora» lo fai subito. Quando compare, la funzione diventa «Attiva».

Se la licenza mostra già la funzione attiva, non serve chiederla. Se una funzione non risulta più nella licenza, passa a «Da correggere» e puoi chiederla di nuovo con lo stesso testo.

### Attivare il servizio di un partner
Un partner è un'azienda esterna, non un fornitore CasaZen. Serve il permesso di gestire i canali.
1. Dal Marketplace apri la scheda del partner e premi «Attiva». Il primo passo, «Cosa preparare per …», elenca i dati della tua casa che il partner potrebbe chiederti (nome, indirizzo, città, CAP, camere da letto, bagni, ospiti, CIN) con il pulsante «Copia» e la lista di cosa scegliere e autorizzare sul suo sito.
2. Nel passo «L'attivazione si fa sul sito di …» premi «Vai al sito di …». Il sito si apre nella stessa scheda; CasaZen non invia nulla al partner: i dati li copi tu.
3. Fai l'attivazione sul sito del partner, poi torna in CasaZen (con «Indietro» del browser o riaprendo l'app: riprendi da dove eri).
4. Nel passo «Bentornato» rispondi a «Hai completato l'attivazione su …?» con «Sì, l'ho completata», scegliendo il giorno in cui l'hai fatta («Quando l'hai fatta?», oggi o prima). Se non hai finito scegli «Non ancora: salva ed esci».
5. Vedi «… risulta attivo»: «Dichiarato da te il …» oppure «Verificato: il collegamento lo mostra attivo».

Quello che imposti resta sul sito del partner: CasaZen non lo cambia. Se un giorno lo spegni lì, dillo in CasaZen e smetterà di mostrarlo come attivo.

### Usare la pagina OTA
Su attivazione. Serve il permesso di lettura dei canali OTA (e di scrittura per collegare).
1. Apri **Affitti brevi › Immobili › OTA**. Ogni portale è una scheda con lo stato («Connesso», «Attenzione», «Disconnesso»), «Ultimo stato sync» e «Ultima sync».
2. Per leggere subito le prenotazioni di un portale premi «Sincronizza ora». Per tutte premi «Sincronizza tutto» e poi «Avvia sync»: recupera le ultime prenotazioni, aggiorna quelle cambiate, crea le nuove ed evita i duplicati.
3. Per collegare un portale premi «Aggiungi integrazione» (oppure «Connetti» su una scheda disconnessa): nella pagina «Aggiungi integrazione OTA» scegli la «Piattaforma», la «Proprietà», inserisci le chiavi («API Key», «API Secret») e l'«ID proprietà sulla piattaforma», e premi «Crea integrazione». Per iniziare subito lascia acceso «Attiva (inizia subito la sincronizzazione)».

### Risolvere gli errori dei calendari
| Cosa vedi | Cosa significa | Cosa fare |
|---|---|---|
| «L'indirizzo del calendario non è valido: usa un link https pubblico» | Il link non comincia con https o non è pubblico | Copia di nuovo il link iCal dal portale |
| «Non è stato possibile scaricare il calendario» | Il link non risponde o non è corretto | Controlla che il link sia giusto e non scaduto; se l'hai rigenerato sul portale, incolla quello nuovo |
| «Il link non restituisce un calendario iCal valido» | Il link porta a un'altra pagina (per esempio un accesso) | Usa il link di esportazione iCal, non la pagina dell'annuncio |
| «Il calendario è troppo grande per essere importato» | File troppo grande | Chiedi al portale un calendario più corto |
| «La sincronizzazione del calendario non è riuscita: verrà ritentata automaticamente» | Errore momentaneo | Aspetta o premi «Sincronizza ora»; se dura, scollega e ricollega |
| «Questo calendario è già collegato alla proprietà» | Lo stesso link è già in elenco | Non serve aggiungerlo di nuovo |
| «Hai già collegato il numero massimo di calendari» | Limite di 10 per casa | Scollega un calendario che non usi |
| «L'etichetta del calendario può contenere al massimo 60 caratteri» | Etichetta troppo lunga o con a capo | Accorciala |
| Le date non si aggiornano | Calendario «Da ricontrollare» o link cambiato | Premi «Sincronizza ora»; controlla l'errore sulla riga |
| Una prenotazione dal portale non compare | iCal porta solo le date | Cerca il blocco nel calendario e trasformalo in soggiorno: vedi [[prenotazioni]] |
| Una prenotazione di Airbnb non chiude le date su Booking.com (o il contrario) | CasaZen non fa da ponte tra i portali | Fai leggere a ogni portale il calendario degli altri: [[canali-octorate#evitare-le-doppie-prenotazioni-tra-portali-con-i-calendari-ical]] |
| Una modifica a prezzo o restrizioni risulta «Non inviata» | Il channel manager non l'ha accettata | Premi «Riprova ora» sulla riga; finché non va, il channel manager non ha quella modifica |
| «La camera non ha una licenza attiva nel tuo channel manager» | Manca la licenza della camera | Attivala nel channel manager, poi riprova |
| «Il tuo channel manager non ha accettato l'accesso di CasaZen: ricollega l'account e riprova» | Il consenso non vale più | Rifai «Collegare Octorate a CasaZen» |
| «Il tuo channel manager ha quasi esaurito le richieste consentite» | Limite di richieste del channel manager | Non fare nulla: l'invio riprende da solo più tardi |

## Flussi completi

### Flusso: calendari allineati con iCal
1. Aggiungi l'immobile e attivalo ([[immobili#aggiungere-un-immobile-con-la-procedura-guidata]]).
2. Per ogni portale copi il link iCal di esportazione e lo incolli in CasaZen ([[canali-octorate#collegare-un-calendario-ical]]).
3. CasaZen legge i calendari circa ogni 15 minuti: le date importate occupano le notti sul tuo sito ([[sito-prenotazione]]).
4. Copi il link di CasaZen e lo incolli su ogni portale ([[canali-octorate#incollare-il-link-di-casazen-sui-portali]]).
5. Su ogni portale incolli anche il link di esportazione degli altri portali: Booking.com su Airbnb e Airbnb su Booking.com ([[canali-octorate#evitare-le-doppie-prenotazioni-tra-portali-con-i-calendari-ical]]). Senza questo passo i portali non si vedono tra loro.
6. Controlli ogni tanto «Canali e calendari»: se vedi «Da ricontrollare» agisci subito.
7. Quando arriva una prenotazione da un portale, nel calendario trovi un blocco: trasformalo in soggiorno per fare il check-in dell'ospite ([[prenotazioni]], [[ospiti-checkin]]).

### Flusso: dai calendari iCal a Octorate
1. Colleghi Octorate ([[canali-octorate#collegare-octorate-a-casazen]]) e abbini gli annunci agli immobili.
2. CasaZen legge il calendario di Octorate e, per Airbnb e Booking.com, non legge più i link iCal di quei canali.
3. Togli dal portale il link iCal di CasaZen, come ti dice il riepilogo.
4. Da qui prezzi e restrizioni cambiati in CasaZen partono anche verso Octorate ([[prezzi-tariffe#cambiare-prezzo-e-regole-di-piu-giorni-e-immobili]]).

## Regole e limiti
- Frequenza: CasaZen legge i calendari iCal circa ogni 15 minuti; un calendario si segnala «da ricontrollare» dopo 2 ore senza letture riuscite. I portali leggono il link di CasaZen con i loro tempi.
- Al massimo 10 calendari per immobile, ognuno con un link diverso. Il link deve essere https e pubblico.
- Un calendario scollegato libera subito le sue date; gli altri calendari non cambiano.
- Il link di esportazione di CasaZen contiene solo prenotazioni del tuo sito, soggiorni inseriti da te e blocchi manuali; non contiene prenotazioni dai portali né date importate. Mostra solo «Occupato».
- CasaZen non fa da ponte tra i portali: con i soli calendari iCal serve il collegamento incrociato fatto sui portali.
- Un file non valido lascia le date com'erano; un calendario valido ma vuoto le libera.
- Con Octorate: calendario letto ogni 15 minuti per 365 giorni; le notti chiuse in Octorate sono blocchi che non si tolgono da CasaZen.
- Un canale iCal «Altro» non viene mai sostituito da Octorate.
- Le funzioni di Octorate sono su attivazione e dipendono dalla tua licenza e dal tuo piano con Octorate (prezzi e condizioni li vedi nelle schede del Marketplace: «Costo e chi fattura»).
- Le credenziali dei portali le inserisci solo su Octorate o sul portale; in CasaZen l'accesso di un canale (nome utente e password) viene usato una volta e non conservato.

## Domande frequenti

### Come evito le doppie prenotazioni tra Airbnb e Booking.com?
Con i calendari iCal: collega in CasaZen il calendario di ogni portale, incolla su ogni portale il link di CasaZen e, su Airbnb, importa anche il link di esportazione di Booking.com (e su Booking.com quello di Airbnb): CasaZen non fa da ponte tra i due portali. Resta un ritardo di minuti o ore; per ridurlo usa un channel manager (Octorate, su attivazione). Passi: [[canali-octorate#evitare-le-doppie-prenotazioni-tra-portali-con-i-calendari-ical]].

### Cosa significa iCal? E cosa vuol dire channel manager?
iCal è il link a un calendario che un portale ti dà: contiene solo le date occupate, non nomi né prezzi. Un channel manager è un programma che tiene allineati prezzi, date e prenotazioni su tutti i portali; quello che CasaZen sa collegare è Octorate.

### Devo scegliere tra iCal e Octorate? Quale uso?
Per cominciare bastano i calendari iCal. Octorate serve se vuoi gestire da un solo punto prezzi, date e prenotazioni complete su più portali: è un servizio a parte, con il suo abbonamento, e in CasaZen è su attivazione. Puoi usare prima iCal e passare a Octorate dopo ([[canali-octorate#flusso-dai-calendari-ical-a-octorate]]).

### Le prenotazioni dei portali arrivano con il nome dell'ospite?
Con iCal no: arrivano solo come date occupate, senza nome, prezzi e messaggi. Per gestire l'ospite trasforma il blocco in soggiorno ([[prenotazioni#creare-un-soggiorno-da-un-blocco-di-un-altro-canale]]). Con Octorate arrivano le prenotazioni complete.

### Perché Airbnb non vede le prenotazioni di Booking.com?
Perché CasaZen non fa da ponte: il link di esportazione non contiene le date importate. Incolla su Airbnb anche il link di esportazione di Booking.com, e viceversa ([[canali-octorate#evitare-le-doppie-prenotazioni-tra-portali-con-i-calendari-ical]]).

### Quanto ci mette un portale a vedere una mia prenotazione?
Dipende dal portale: rilegge il link ogni tanto, spesso dopo alcune ore. Il tuo calendario in CasaZen si aggiorna subito.

### I prezzi che imposto in CasaZen arrivano su Airbnb e Booking.com?
Con i soli calendari iCal no: ai portali passano solo le date occupate e i prezzi li imposti ancora sui portali. Con Octorate prezzi e restrizioni dei giorni che cambi in CasaZen partono verso Octorate ([[prezzi-tariffe]]).

### Cosa succede se rigenero il link?
Il vecchio smette di funzionare subito. Aggiorna tutti i portali.

### Posso usare sia iCal sia Octorate?
Sì: finché Octorate non ha letto il calendario CasaZen continua con iCal; poi per Airbnb e Booking.com il calendario arriva da Octorate.

### Perché non vedo «Collega i tuoi canali» o il Marketplace dei canali?
Sono funzioni su attivazione: compaiono solo se CasaZen le ha attivate. Scrivi all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza», e chiedi di attivare il collegamento con Octorate. Ti servirà anche un tuo account Octorate.

### Perché «Attiva» mi chiede di collegare prima il channel manager?
Perché i canali si collegano tramite il tuo channel manager: senza collegamento non c'è nulla a cui agganciarli. Premi «Collega il channel manager».

## Glossario
- **iCal**: file di calendario che un portale pubblica con un link; porta solo le date occupate.
- **Link di esportazione**: il link che CasaZen ti dà e che incolli nei portali.
- **Blocco**: periodo occupato importato da un calendario o chiuso da te.
- **Doppia prenotazione** (overbooking): due prenotazioni sulla stessa notte, perché due portali non si sono parlati in tempo.
- **Channel manager**: servizio (qui Octorate) che gestisce annunci, prenotazioni, calendari e prezzi su più portali.
- **Abbinamento**: scelta di quale immobile di CasaZen corrisponde a un annuncio.
- **OTA**: portale di prenotazione online (Airbnb, Booking.com, Expedia…).

## Vedi anche
- [[immobili]]: aggiungere e attivare una casa; la scheda «Calendari iCal».
- [[prezzi-tariffe]]: prezzi e restrizioni che CasaZen invia al channel manager.
- [[prenotazioni]]: calendario, blocchi e soggiorni creati dalle date dei portali.
- [[messaggi-recensioni]]: messaggi e recensioni dei portali.
- [[marketplace]]: fornitori di servizi per la tua casa.
- [[fisco-documenti]]: documenti fiscali, anche quelli emessi da Octorate.
