---
id: vetrina-fornitore
titolo: La vetrina del fornitore, pagina pubblica, prenotazioni e richieste su misura
sezione: Fornitori e marketplace
ordine: 72
riassunto: Come un fornitore crea, pubblica e condivide la sua pagina pubblica (stile, testi, foto, servizi), apre le prenotazioni online e risponde ai clienti; come la usa chi la visita.
chi: [fornitore, gestore]
dove: Area Fornitori › Vetrina; pagina pubblica del fornitore
parole_chiave: [vetrina, sito del fornitore, pubblica, bozza, anteprima, stile, foto dei lavori, prenotazione online, richiesta su misura, preventivo, link da condividere, pausa, AI, testi]
copre: [/app/supplier/showcase, /app/supplier/showcase/publish, /fornitori/:slug, /fornitori/:slug/servizi, /fornitori/:slug/servizi/:serviceSlug, /fornitori/:slug/chi-siamo, /fornitori/:slug/prenota, /fornitori/:slug/conferma, /fornitori/:slug/richiesta, /fornitori/:slug/preventivo]
stato: disponibile
fonte_codice: [frontend/src/features/supplier/showcase/showcase-hub-page.tsx, frontend/src/features/supplier/showcase/publish-wizard-page.tsx, frontend/src/features/supplier/showcase/showcase-work-page.tsx, frontend/src/features/supplier/showcase/panels/texts-panel.tsx, frontend/src/features/supplier/showcase/panels/ai-texts-block.tsx, frontend/src/features/supplier/showcase/panels/style-panel.tsx, frontend/src/features/supplier/showcase/panels/works-panel.tsx, frontend/src/features/supplier/showcase/panels/services-panel.tsx, frontend/src/features/supplier/showcase/panels/publish-panel.tsx, frontend/src/components/supplier-site/supplier-site-shell.tsx, frontend/src/components/supplier-site/booking/booking-wizard.tsx, frontend/src/components/supplier-site/booking/booking-confirmation.tsx, frontend/src/components/supplier-site/inquiry/inquiry-form.tsx, frontend/src/lib/supplier-site/booking-flow.ts, frontend/src/routes/index.tsx, backend/Casazen.Core/Options/ShowcaseBookingOptions.cs, backend/Casazen.Core/Options/SupplierPaymentsOptions.cs]
---

## In breve
La **vetrina** è la pagina pubblica del fornitore su CasaZen: servizi con prezzi, zone in cui lavora, foto dei lavori, domande frequenti e un indirizzo da condividere (`/fornitori/…`). La crei e la pubblichi da **Area Fornitori › Vetrina**; i clienti vedono solo ciò che pubblichi.

Dove la prenotazione online è attiva, chi visita la vetrina può **prenotare un servizio** (scegliendo un orario libero) o mandare una **richiesta su misura**. Le risposte le gestisci dalle **Richieste** (vedi [[area-fornitore]]).

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Il mio sito vetrina | Mostra lo stato (Bozza, Online, Modifiche da pubblicare, In pausa), il prossimo passo e l'indirizzo | Vetrina | fornitore | Disponibile | Creare e pubblicare la vetrina |
| Crea la tua vetrina | Guida in quattro passi: stile, presentazione, servizi, pubblicazione | Vetrina › «Crea la tua vetrina» | fornitore | Disponibile | Creare e pubblicare la vetrina |
| Editor | Stile e marchio, Testi, Foto e lavori, Servizi e sezioni, Anteprima e pubblica | Vetrina › «Modifica la vetrina» | fornitore | Disponibile | Modificare la vetrina |
| Scrivi con l'AI | Una bozza dei testi dai dati del tuo profilo | Editor › Testi | fornitore | Su attivazione | Scrivere i testi con l'AI |
| Anteprima | Guardi la bozza su computer, tablet o telefono | Editor › Anteprima | fornitore | Disponibile | Controllare l'anteprima e pubblicare |
| Pubblica / Pubblica le modifiche | Rende visibile ai clienti ciò che hai scritto | Vetrina e editor | fornitore | Disponibile | Pubblicare la vetrina |
| Annulla le modifiche | Torna alla versione pubblicata | Vetrina › «Altre impostazioni» | fornitore | Disponibile | Annullare le modifiche non pubblicate |
| Metti in pausa / Riattiva | Chiude e riapre le prenotazioni mostrando che per ora non accetti | Vetrina › «Altre impostazioni» | fornitore | Disponibile | Mettere in pausa la vetrina |
| Apri le prenotazioni | Permette ai clienti di prenotare online | Vetrina › «Altre impostazioni» | fornitore | Su attivazione | Aprire le prenotazioni |
| Condividi | Copia il link o prepara un messaggio WhatsApp o e-mail | Vetrina › «Condividi» | fornitore | Disponibile | Condividere il link della vetrina |
| Pagina pubblica | Home, Servizi, scheda di un servizio, Chi siamo | Indirizzo pubblico del fornitore | clienti | Disponibile | Visitare la vetrina |
| Prenota un servizio | Prenotazione online in cinque passi | Pagina pubblica › «Prenota ora» | clienti | Su attivazione | Prenotare un servizio dalla vetrina |
| La mia richiesta | Il cliente ritrova, segue e chiude la sua richiesta | Link ricevuto per e-mail | clienti | Su attivazione | Ritrovare la propria richiesta |
| Richiesta su misura | Il cliente scrive cosa gli serve e parla con il fornitore dentro CasaZen | Pagina pubblica › «Richiesta su misura» | clienti | Su attivazione | Mandare una richiesta su misura |
| Rispondere a una richiesta su misura | Il fornitore scrive, manda un'offerta o dice che non può | Richieste › «Rispondi» | fornitore | Su attivazione | Rispondere a una richiesta su misura |

## Come funziona

### Gli stati della vetrina
- **Bozza**: non l'hai ancora pubblicata. I clienti non la vedono.
- **Online**: i clienti la vedono. Le prenotazioni possono essere aperte oppure no.
- **Modifiche da pubblicare**: è online, ma hai cambiato qualcosa. I clienti vedono ancora la versione pubblicata.
- **In pausa**: i clienti vedono che per ora non accetti prenotazioni.

In ogni stato la pagina mostra **un solo riquadro evidenziato** con la cosa da fare ora («Crea la tua vetrina in cinque minuti», «Manca ancora qualcosa per pubblicare», «Pubblica la tua vetrina», «Hai modifiche da pubblicare», «La tua vetrina è online»…).

### Bozza e pubblicazione
Mentre scrivi, l'editor **salva da solo** («Salvato alle 14:32»). Quello che salvi è la **bozza**: nessuno la vede finché non premi «Pubblica la vetrina» (o «Pubblica le modifiche»). Se la apri da due schede e una la cambia, compare «La vetrina è stata modificata altrove»: premi «Ricarica» per vedere l'ultima versione (le modifiche non salvate della scheda vecchia vanno perse).

### Cosa serve per pubblicare
Prima di pubblicare, il riquadro **«Prima di pubblicare»** elenca i controlli, ciascuno **«Da fare»** (necessario), **«Consigliato»** o **«Fatto»**. Le voci «Da fare» vanno sistemate («Sistema le voci «Da fare» per pubblicare»); le altre no. I controlli sono:
- almeno un **servizio attivo con un prezzo**;
- almeno un **comune** dove lavori;
- gli **orari di lavoro**;
- una **frase in grande** e un **«chi siamo»** scritti da te;
- **tre foto dei tuoi lavori**;
- **tre domande frequenti** con la risposta;
- un **colore dei pulsanti** leggibile;
- il **«Verificato» di CasaZen**.

Alcune righe dei testi lasciate a metà (una domanda senza risposta, un lavoro senza foto) bloccano la pubblicazione finché non le completi o le togli. Il riquadro dice anche **cosa cambia pubblicando** (per esempio «Introduzione, Stile, Servizi mostrati») o «Tutto: è la prima pubblicazione».

### L'indirizzo pubblico
La vetrina ha un indirizzo suo (`/fornitori/…`), assegnato quando **attivi il profilo** (vedi [[area-fornitore]]): prima, l'anteprima non c'è. Il titolo della pagina è «[nome]: fornitore su CasaZen». Le pagine di prenotazione, conferma e richiesta **non sono indicizzate** dai motori di ricerca.

### Stile e marchio
Scegli uno **stile** tra quelli proposti: «Pronto intervento» (blu deciso, per idraulici e caldaisti), «Casa pulita» (verde acqua, per pulizie e lavanderia), «Verde e giardino» (verde bosco, per giardinieri) e «Impianti» (grafite e giallo, per elettricisti e tecnici). CasaZen segnala quello «Consigliato per il tuo mestiere». Poi i **caratteri dei titoli** («Classico», «Editoriale», «Moderno») e il **marchio**: «Sigla e nome» (un quadrato con le iniziali) o «Solo il nome»; in alternativa **carichi il tuo logo** (PNG, JPG o WebP fino a 200 KB). Il **colore dei pulsanti** si può lasciare quello dello stile, oppure scrivere un colore esadecimale (come `#0B5FA5`): il testo bianco deve leggersi bene, con un contrasto di almeno 4,5.

### I testi
Nel passo **«Testi»** scrivi: la frase in grande, l'introduzione, il «Chi siamo», fino a sei **punti di forza**, la **garanzia** (titolo e testo), le **certificazioni**, le **persone** del team (nome e ruolo), le **domande frequenti** e i consigli «Prima che arriviamo». **Scrivi solo ciò che è vero**: CasaZen non aggiunge né controlla certificazioni e garanzie. Se non sai cosa scrivere, «Usa il testo di partenza» riempie **solo i campi vuoti** con un testo adatto al tuo mestiere: lo cambi come vuoi e nessuno lo vede finché non pubblichi.

### Scrivere con l'AI
> **Su attivazione.** Compare solo dove l'assistente AI è attivo.

«Scrivi con l'AI» prepara una **bozza** usando solo ciò che è già vero nel tuo profilo: le categorie, le zone, i nomi dei servizi e le righe che scrivi tu («Due righe su di te», «Da quanto lavori», «In cosa sei specializzato», «Cosa ti distingue»). **Non inventa** anni di esperienza, certificazioni, garanzie, prezzi o tempi. Per una bozza migliore completa prima servizi e zone e racconta due righe su di te. Vedi la bozza, scegli quali parti usare con «Usa le parti scelte» (sostituisce il testo già scritto) e la rivedi: i testi portano la scritta «Bozza scritta dall'AI: rivedila prima di pubblicare».

### Foto e lavori
Nel passo **«Foto e lavori»** scegli la **copertina** (se non ne scegli una usa la prima foto del profilo, o uno sfondo neutro) e aggiungi i **lavori**: una foto, una didascalia, il luogo e, se vuoi, la foto «prima» per mostrare il **confronto prima e dopo**. Ogni foto ha una descrizione per chi non può vederla. I file sono immagini **PNG, JPG o WebP** (non SVG né PDF); se sono troppo pesanti o danneggiati CasaZen te lo dice. I file caricati e poi non più usati vengono tolti da soli entro due giorni.

### Servizi e sezioni
Nel passo **«Servizi e sezioni»** scegli **quali servizi mostrare e in che ordine**: si mostrano solo i servizi **attivi** (le bozze e quelli in pausa compaiono sotto «Non ancora in vetrina»). Deve restare **almeno un servizio**. Poi scegli quali **sezioni** della pagina mostrare: «Fiducia» («Verificato» e i lavori fatti, solo se veri), «I lavori», «Le zone», «Certificazioni», «Domande frequenti» e, quando le prenotazioni sono aperte, «Come funziona». Un blocco senza contenuto non si vede comunque; i servizi e i pulsanti finali si vedono sempre.

### Prenotazioni online
> **Su attivazione.** Dove la prenotazione dalla vetrina non è attiva, la pagina si vede ma non si può prenotare.

Perché i clienti possano prenotare servono **tutte** queste cose: la vetrina è **pubblicata** e **non in pausa**, le **prenotazioni sono aperte** («Apri le prenotazioni»), i **pagamenti online** sono attivi e il **conto per i pagamenti** è pronto (**Impostazioni › Pagamenti**, vedi [[area-fornitore]]). Nel riquadro «Prenotazioni» della vetrina leggi cosa manca: «La vetrina non è ancora pubblicata», «La vetrina è in pausa», «Tutto è pronto ma le prenotazioni sono chiuse», «I pagamenti online non sono ancora attivi», «Il conto per i pagamenti non è ancora pronto», con il collegamento «Vai ai pagamenti».

### Cosa succede quando un cliente prenota
1. Il cliente sceglie servizio, comune, giorno e orario libero, e lascia i suoi dati.
2. CasaZen gli manda un **link per confermare l'e-mail**: finché non lo apre, tu non ricevi nulla e l'orario resta riservato per **30 minuti** (poi torna libero).
3. L'importo viene solo **bloccato sulla carta**: lo addebitiamo **soltanto se accetti**. Se rifiuti, non rispondi in tempo o il cliente annulla prima, il blocco viene rilasciato e il cliente non paga nulla.
4. La prenotazione arriva nelle tue **Richieste** con provenienza «Dal tuo sito». Hai un tempo per rispondere (lo vedi nella richiesta): se non rispondi la richiesta si annulla da sola e il cliente è avvisato.
5. Se accetti, vedi indirizzo e contatti del cliente. Dopo il lavoro, CasaZen trattiene il pagamento fino a quando il cliente conferma che va tutto bene o finisce il tempo per segnalare un problema (vedi [[area-fornitore]]).

**Annullare non costa nulla** al cliente: può farlo dalla sua pagina «La mia richiesta» fino all'orario del lavoro.

### Richiesta su misura
Per ciò che il listino non dice (un lavoro grande, un servizio «Su preventivo», un comune fuori zona) il cliente manda una **richiesta su misura**: descrive il lavoro, indica il comune e i suoi dati, e conferma l'e-mail. Poi **parla con il fornitore dentro CasaZen** (la conversazione non mostra telefono né e-mail: il cliente è invitato a non scriverli). Il fornitore ha un tempo breve per rispondere (**un'ora**, per impostazione predefinita, contata dal momento in cui il cliente conferma l'e-mail): **il suo primo messaggio ferma il tempo**. Se nessuno risponde, la richiesta si chiude e al cliente si propongono altri professionisti della zona. Il fornitore può poi inviare un'**offerta** con prezzo e orario, che il cliente accetta o rifiuta.

### Cosa vede un visitatore della vetrina
La **home** mostra il nome, la frase in grande, i pulsanti «Prenota ora» e «Richiesta su misura» (o «Guarda i servizi» se le prenotazioni sono chiuse), il **primo orario libero**, «I prossimi giorni», i servizi, i lavori, «Come funziona», le garanzie, le domande frequenti e le zone. La pagina **Servizi** elenca i servizi; la scheda di un servizio mostra la **stima** del prezzo; **Chi siamo** racconta la storia e le persone. Ogni pagina ha in fondo «Vetrina creata con CasaZen».

## Come fare

### Creare e pubblicare la vetrina
1. Apri **Area Fornitori › Vetrina**. Se non hai ancora una vetrina compare «Crea la tua vetrina in cinque minuti».
2. Premi «Crea la tua vetrina». La procedura ha quattro passi: «Stile», «Presentazione», «Servizi» e «Riepilogo».
3. **«Scegli lo stile della vetrina»**: scegli uno stile (lo puoi cambiare quando vuoi).
4. **«Presenta la tua attività»**: scrivi la frase in grande (almeno **12 caratteri**) e due righe di introduzione. Se vedi un testo già scritto, è un testo di partenza adatto al tuo mestiere: leggilo e cambialo come vuoi. Non è pubblico finché non pubblichi.
5. **«Scegli i servizi da mostrare»**: scegline almeno uno. Si mostrano solo i servizi attivi.
6. **«Controlla e pubblica»**: leggi i controlli e premi «Pubblica la vetrina».
7. Compare «La tua vetrina è online»: puoi «Apri la vetrina» o «Condividi il link».

Se la pubblicazione non riesce («Non riesco a pubblicare la vetrina»), riprova; se mancano dei dati, il riepilogo dice quali.

### Modificare la vetrina
1. In **Vetrina** premi «Modifica la vetrina». L'editor ha cinque passi: «Stile e marchio», «Testi», «Foto e lavori», «Servizi e sezioni» e «Anteprima e pubblica».
2. Vai da un passo all'altro: l'anteprima accanto mostra subito come diventa la pagina.
3. Ogni modifica si salva da sola come bozza («Modifiche non ancora salvate…», poi «Salvato alle…»).
4. Per mostrarla ai clienti premi «Pubblica le modifiche».

### Scrivere i testi con l'AI
1. In **Testi**, apri «Scrivi con l'AI».
2. Facoltativo: scrivi due righe su di te, da quanto lavori, in cosa sei specializzato e cosa ti distingue. Premi «Più domande» o «Meno domande» per vederne di più o di meno.
3. Premi «Scrivi la bozza». Attendi «Sto scrivendo…».
4. Leggi «Ecco una bozza», scegli le parti e premi «Usa le parti scelte». Per ricominciare, «Scrivi un'altra bozza».
5. Rileggi tutto e correggi: la bozza resta tua e **non è pubblica** finché non pubblichi.

### Controllare l'anteprima e pubblicare
1. Nell'ultimo passo, «Anteprima e pubblica», guarda la pagina su «Computer», «Tablet» o «Telefono» (anche le pagine «Home», «Servizi», «Chi siamo»). L'anteprima mostra la **bozza**; **non invia** richieste.
2. Leggi «Controlli prima di pubblicare» e «Cosa cambia pubblicando».
3. Sistema le voci «Da fare». Premi «Pubblica la vetrina» (la prima volta) o «Pubblica le modifiche».
4. Compare «Vetrina pubblicata». Puoi **tornare indietro** dal messaggio che segue.

### Annullare le modifiche non pubblicate
1. In **Vetrina › Altre impostazioni** premi «Annulla le modifiche».
2. Leggi la domanda «Annullare le modifiche?»: la bozza torna uguale alla vetrina pubblicata, **le modifiche non pubblicate vanno perse**, la vetrina che i clienti vedono non cambia.
3. Conferma. Compare «Modifiche annullate».

### Mettere in pausa la vetrina
1. In **Vetrina › Altre impostazioni** premi «Metti in pausa».
2. Compare «Vetrina in pausa»: i clienti vedono che per ora non accetti prenotazioni e le prenotazioni si chiudono. Puoi tornare indietro dal messaggio.
3. Per riaprire, premi «Riattiva la vetrina». Compare «Vetrina riattivata».

### Aprire le prenotazioni
> **Su attivazione.**
1. Controlla che nel riquadro «Prenotazioni» non ci siano problemi (pubblicata, non in pausa, pagamenti e conto pronti).
2. In **Altre impostazioni** premi «Apri le prenotazioni».
3. Compare «Le prenotazioni sono aperte». I clienti vedono «Prenota ora» e gli orari liberi.

### Condividere il link della vetrina
1. In **Vetrina** premi «Condividi».
2. Scegli «Copia il link» (compare «Link copiato»), «WhatsApp» o «E-mail»: ti prepariamo il messaggio, ma **lo invii tu**, da qui non parte nulla.
3. Se il link completo non è disponibile (messaggio «L'indirizzo pubblico non è configurato su questo ambiente»), non puoi copiarlo da qui.

### Rispondere a una richiesta su misura
> **Su attivazione.**
1. Apri **Richieste**: la richiesta ha il pulsante «Rispondi».
2. Premi «Rispondi al cliente». Leggi cosa chiede e scrivi nei messaggi (non scambiare telefono, e-mail o indirizzo: si vedono dopo che il lavoro è accettato).
3. Quando sei pronto premi «Invia un'offerta»: voci, totale, giorno, inizio e durata in ore. Il cliente vede le voci e il totale e le accetta o rifiuta. **Finché non accetta, nessun orario è riservato.**
4. Se serve, «Sostituisci l'offerta» o «Ritira l'offerta» (la richiesta resta aperta e puoi mandarne un'altra).
5. Se non puoi fare il lavoro premi «Non posso farlo».

Se il tempo è scaduto, la richiesta mostra «Il tempo per rispondere è scaduto».

### Visitare la vetrina
1. Apri l'indirizzo della vetrina (o «Vedi la vetrina» dalla scheda del fornitore nel Marketplace).
2. Scorri la home, apri «Servizi» e la scheda di un servizio per la stima del prezzo, oppure «Chi siamo».
3. Per prenotare premi «Prenota ora»; per qualcosa di diverso, «Richiesta su misura».

### Prenotare un servizio dalla vetrina
> **Su attivazione.**
1. Premi «Prenota ora» (o il servizio e poi «Prenota»). La pagina si chiama «Prenota un servizio» e ha cinque passi.
2. **Servizio**: scegli il servizio, le quantità e le opzioni. Il prezzo si aggiorna mentre scegli. Se vuoi un orario di oggi o domani, attiva «È urgente?» (può avere un supplemento).
3. **Dove**: scrivi il comune e scegli dall'elenco. Se è fuori zona, il prezzo lo decide il professionista con una richiesta su misura.
4. **Quando**: scegli il giorno e l'orario tra quelli liberi (Mattina, Pomeriggio, Sera). Se non ce ne sono, puoi mandare una richiesta su misura.
5. **Pagamento**: l'importo viene **solo bloccato** sulla carta («Blocca € … e continua»): lo addebitiamo soltanto se il professionista accetta.
6. **I tuoi dati**: nome e cognome, e-mail, telefono, CAP, via e numero civico, piano e come entrare. Spunta il consenso alla privacy e premi «Invia la richiesta».
7. Apri il link che ti arriva per e-mail («Controlla la tua email»). Finché non lo apri, il professionista non riceve nulla; il link vale fino all'ora indicata: dopo, l'orario torna libero.
8. Compare «Richiesta inviata» con un **codice**: conservalo, insieme alla tua e-mail ti serve per ritrovare la richiesta.

Indirizzo e telefono arrivano al professionista **solo dopo che accetta**.

### Mandare una richiesta su misura
1. Dalla vetrina premi «Richiesta su misura».
2. Scegli il servizio più vicino («Su quale servizio?») oppure «Altro, una cosa diversa». Scegli il comune e descrivi cosa ti serve (dove, quanto è grande, quando). Non scrivere telefoni o e-mail nel testo.
3. Lascia nome, e-mail e telefono, spunta il consenso e premi «Invia la richiesta».
4. Apri il link che ti arriva per e-mail. Poi parli con il professionista nella pagina «La mia richiesta».

### Ritrovare la propria richiesta
1. Apri il link dell'e-mail o la pagina «La mia richiesta» e usa l'e-mail e il codice.
2. Leggi lo stato e, per una richiesta su misura, la conversazione.
3. Per chiudere premi «Chiudi la richiesta» e conferma «Sì, chiudi la richiesta»: non costa nulla e il professionista è avvisato. Una prenotazione si annulla senza costi fino all'orario del lavoro.

## Flussi completi

### Flusso: dalla creazione della vetrina alla prima prenotazione
1. **Fornitore**: attiva il profilo e crea servizi con prezzi e orari ([[area-fornitore]]).
2. **Fornitore**: crea e pubblica la vetrina ([[vetrina-fornitore#creare-e-pubblicare-la-vetrina]]).
3. **Fornitore**: collega il conto per i pagamenti e apre le prenotazioni ([[vetrina-fornitore#aprire-le-prenotazioni]]).
4. **Fornitore**: condivide il link con i clienti ([[vetrina-fornitore#condividere-il-link-della-vetrina]]).
5. **Cliente**: sceglie servizio, dove, quando, lascia i dati e conferma l'e-mail.
6. **CasaZen**: blocca l'importo sulla carta e manda la richiesta al fornitore.
7. **Fornitore**: accetta entro il tempo indicato; il cliente è avvisato.
8. **Fornitore**: fa il lavoro e segna «Completato»; **CasaZen** trattiene il pagamento fino alla conferma del cliente e poi lo rilascia.

### Flusso: richiesta su misura
1. **Cliente**: manda la richiesta e conferma l'e-mail.
2. **Fornitore**: risponde nella conversazione (entro un'ora per impostazione predefinita).
3. **Fornitore**: manda un'offerta con prezzo e orario.
4. **Cliente**: accetta l'offerta: il lavoro è del fornitore a quel prezzo e a quell'ora (si procede come per una prenotazione).
5. Se nessuno risponde in tempo, **CasaZen** chiude la richiesta e propone altri professionisti della zona.

## Regole e limiti
- Frase in grande: almeno **12 caratteri**.
- Colore dei pulsanti: contrasto con il bianco di almeno **4,5**.
- Logo: PNG, JPG o WebP fino a **200 KB**; foto: PNG, JPG o WebP (non SVG né PDF). Ci sono limiti al numero di lavori e di foto: l'editor li mostra («Fino a N lavori e M foto in tutto»).
- Almeno **un servizio** in vetrina; solo servizi **attivi**.
- Link di conferma e-mail: **30 minuti** (poi l'orario torna libero). Risposta del cliente a un orario proposto: **24 ore**. Risposta del fornitore a una richiesta su misura: **un'ora** (impostazione predefinita). Valori di configurazione dell'ambiente.
- Il blocco sulla carta dura al massimo **48 ore** (impostazione predefinita): oltre, il blocco si libera e la richiesta si chiude.
- **Annullamento gratuito** per il cliente fino all'orario del lavoro.
- Indirizzo e telefono del cliente si vedono solo **dopo** l'accettazione.
- Le prenotazioni dipendono dall'attivazione della prenotazione online, dai pagamenti online e dal conto Stripe pronto.
- La pagina pubblica non è indicizzata per prenotazione, conferma e richiesta.
- Certificazioni e garanzie le scrive il fornitore: CasaZen non le aggiunge né le controlla.

## Domande frequenti

### I clienti vedono la mia bozza?
No. Vedono solo ciò che hai pubblicato. L'anteprima serve a te.

### Ho cambiato un testo ma non si vede
Le modifiche vanno **pubblicate**: premi «Pubblica le modifiche».

### Perché non si può prenotare?
Controlla il riquadro «Prenotazioni» della vetrina: puoi leggere se manca la pubblicazione, se la vetrina è in pausa, se le prenotazioni sono chiuse o se manca il conto per i pagamenti.

### Posso tornare alla versione pubblicata?
Sì, con «Annulla le modifiche»: perdi le modifiche non pubblicate.

### Come tolgo la vetrina?
Mettila in pausa: i clienti vedono che per ora non accetti prenotazioni.

### L'AI inventa cose sul mio lavoro?
No: usa solo categorie, zone, nomi dei servizi e le righe che scrivi tu, e la bozza non è pubblica finché non la rivedi e pubblichi.

### Cos'è «Verificato»?
Un segno di fiducia su dati dell'attività e partita IVA, assegnato da CasaZen: compare nella sezione «Fiducia» solo se vero.

## Glossario
- **Vetrina**: la pagina pubblica del fornitore.
- **Bozza**: la versione che stai scrivendo, non ancora visibile ai clienti.
- **Richiesta su misura**: richiesta libera, per ciò che il listino non dice.
- **Blocco sulla carta**: l'importo è riservato sulla carta del cliente ma non addebitato.
- **Offerta**: voci, totale e orario che il fornitore propone dentro la conversazione.

## Vedi anche
- [[area-fornitore]]: richieste, agenda, servizi, incassi e conto per i pagamenti.
- [[marketplace]]: come un gestore ti trova e apre la tua vetrina.
