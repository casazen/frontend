---
id: sito-prenotazione
titolo: Sito di prenotazione
sezione: Sito e portali
ordine: 80
riassunto: Il sito pubblico dove i tuoi ospiti vedono le case, scelgono le date, pagano con la carta e prenotano senza commissioni. Come lo controlli, lo personalizzi (aspetto e documenti) e cosa vede e riceve l'ospite.
chi: [gestore, amministratore, ospite]
dove: Affitti brevi › Sito di prenotazione · Impostazioni › Aspetto sito · Impostazioni › Documenti sito
parole_chiave: [sito di prenotazione, prenotazione diretta, vetrina, link, QR, aspetto sito, tema, caratteri, colore, logo, copertina, documenti, privacy, termini, checkout, paga ora, paga alla scadenza, paga in struttura, Le mie prenotazioni, cancellazione]
copre: [/app/short-rent/vetrina, /app/short-rent/settings/site-appearance, /app/short-rent/settings/site-documents, /book/:orgSlug, /book/:orgSlug/search, /book/:orgSlug/property/:propertySlugOrId, /book/:orgSlug/property/:propertySlugOrId/checkout, /book/:orgSlug/booking/:bookingId, /book/:orgSlug/requests/:bookingId/confirm, /book/:orgSlug/my-bookings, /book/:orgSlug/bookings/:bookingId/cancel, /book/:orgSlug/privacy, /book/:orgSlug/termini, /book/:orgSlug/terms, /book/:orgSlug/:propertySlugOrId (non-utente)]
stato: disponibile
fonte_codice: [frontend/src/features/settings/vetrina-page.tsx, frontend/src/features/settings/components/vetrina-property-row.tsx, frontend/src/features/settings/components/booking-link-dialog.tsx, frontend/src/features/onboarding/components/site-publication-banner.tsx, frontend/src/features/settings/site-appearance/site-appearance-page.tsx, frontend/src/features/settings/site-appearance/branding-rules.ts, frontend/src/features/settings/site-documents/site-documents-page.tsx, frontend/src/features/settings/site-documents/site-documents-rules.ts, frontend/src/features/public-site/home/org-home-page.tsx, frontend/src/features/public-site/search/site-search-page.tsx, frontend/src/features/public-booking/public-property-page.tsx, frontend/src/features/public-booking/checkout/checkout-flow.tsx, frontend/src/features/public-booking/confirmation/confirmation-screen.tsx, frontend/src/features/public-booking/guest-bookings-page.tsx, frontend/src/features/public-booking/guest-cancel-link-page.tsx, frontend/src/features/public-booking/onsite-request-confirm-page.tsx, frontend/src/features/public-booking/org-document-page.tsx, frontend/src/features/site-maps, frontend/src/routes/index.tsx, backend/Casazen.Core/Services/IPublicAvailabilityService.cs, backend/Casazen.Core/Entities/Property.cs, backend/Casazen.Web/Controllers/PublicBookingsController.cs, backend/Casazen.Web/Controllers/OrgBrandingController.cs, backend/Casazen.Web/Controllers/OrgSiteDocumentsController.cs, backend/docs/runbooks/direct-booking.md]
---

## In breve
Il **sito di prenotazione** è la pagina pubblica dove i tuoi ospiti vedono le tue case, scelgono le date, pagano con la carta e prenotano direttamente da te, senza passare da un portale. Lo apri da **Affitti brevi › Sito di prenotazione**: vedi l'anteprima, l'elenco delle case pubblicate e i link da copiare e condividere.

Tu scegli come appare (logo, copertina, tema, caratteri, colore), quali documenti legali pubblicare e dove mettere il link. L'ospite non crea nessun account: bastano nome, e-mail e un pagamento sicuro con Stripe. Per far pagare online serve prima collegare Stripe: vedi [[incassi#collegare-stripe-per-ricevere-i-pagamenti-online]].

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Anteprima e link del sito | Mostra il sito com'è per gli ospiti e permette di copiare il link del sito e delle singole case | Sito di prenotazione | gestore, amministratore | Disponibile | Controllare il tuo sito e copiare il link |
| Stato di pubblicazione di una casa | Dice per ogni casa se è «Pubblicata» o «Non pubblicata» | Sito di prenotazione › elenco «Proprietà» | gestore, amministratore | Disponibile | Capire se una casa è sul sito |
| Avviso «Gli ospiti non possono ancora prenotare dal tuo sito» | Spiega perché il sito non può ancora prendere prenotazioni e porta alla pagina che risolve | Sito di prenotazione (in alto) | gestore, amministratore | Disponibile | Capire perché il sito non prende prenotazioni |
| Link per il sito della tua agenzia | Crea il link di una casa con date, ospiti, lingua e nome della campagna, e il suo codice QR | Sito di prenotazione › icona del link accanto a una casa | gestore, amministratore | Disponibile | Creare un link con date e QR per il sito della tua agenzia |
| Aspetto sito | Logo, immagine di copertina, tema, caratteri, colore principale e slogan | Impostazioni › Aspetto sito | amministratore | Disponibile | Personalizzare l'aspetto del sito |
| Documenti del sito | Informativa privacy e termini di prenotazione che l'ospite legge e accetta prima di prenotare | Impostazioni › Documenti sito | amministratore | Disponibile | Pubblicare l'informativa privacy e i termini del sito |
| Prenotazione dal sito | L'ospite cerca, sceglie le date, paga o invia una richiesta | Sito pubblico | ospite | Disponibile | Come prenota un ospite dal tuo sito |
| Richiesta «Paga in struttura» | L'ospite chiede di prenotare e di pagare all'arrivo; tu accetti o rifiuti | Sito pubblico › passo «Pagamento»; tu: Prenotazioni | ospite, gestore | Disponibile | Rispondere a una richiesta: [[prenotazioni#rispondere-a-una-richiesta-di-prenotazione]] |
| Le mie prenotazioni | L'ospite ritrova la prenotazione con il codice e gestisce il soggiorno | Sito pubblico › «Le mie prenotazioni» | ospite | Disponibile | Come l'ospite ritrova la sua prenotazione |
| Cancellazione dal sito | L'ospite annulla da solo e vede subito quanto gli viene rimborsato | Link dell'e-mail o «Le mie prenotazioni» | ospite | Disponibile | Come funziona la cancellazione dal sito |

## Come funziona

### Dove si trova il sito e come si chiama
L'indirizzo base del sito ha la forma `…/book/il-nome-del-tuo-sito`. Il nome del sito e quello che compare nel piè di pagina (ragione sociale, indirizzo, contatti) si cambiano in **Impostazioni › Organizzazione**: vedi [[account-team-piano#modificare-i-dati-dell-organizzazione]]. Se vuoi un indirizzo tuo (per esempio `prenota.latuaagenzia.it`), vedi [[dominio-incorpora]]. Le pagine di prenotazione e di check-in sono in **italiano e inglese**: l'ospite cambia lingua dal menu del sito, oppure il link porta già la lingua scelta (vedi il link per il sito della tua agenzia).

### Chi decide cosa
| Cosa | Dove lo decidi |
|---|---|
| Nome del sito, indirizzo, contatti, dati dell'operatore nel piè di pagina | Impostazioni › Organizzazione |
| Logo, copertina, tema, caratteri, colore, slogan | Impostazioni › Aspetto sito |
| Informativa privacy e termini di prenotazione | Impostazioni › Documenti sito |
| Quali case compaiono | Immobili: casa attiva, non in pausa e con «Mostra la casa sul sito» acceso ([[immobili]]) |
| Foto (la prima è la copertina), descrizione, servizi, regole della casa, politica di cancellazione | Scheda dell'immobile ([[immobili]]) |
| Prezzi, notti minime, date libere | Prezzi e calendario ([[prezzi-tariffe]], [[prenotazioni]]) |
| Pagamento con carta | Impostazioni › Stripe Connect ([[incassi]]) |
| Indirizzo e dominio proprio | Impostazioni › Dominio pubblico ([[dominio-incorpora]]) |

Solo l'**amministratore** dell'organizzazione modifica «Aspetto sito» e «Documenti sito» e vede l'indirizzo vero del sito (anche con un dominio proprio). Gli altri ricevono un avviso che dice di rivolgersi all'amministratore, e dalla pagina «Sito di prenotazione» copiano soltanto l'indirizzo di CasaZen.

### Quando una casa compare sul sito
Una casa è **pubblicata** solo se sono vere tutte queste cose insieme:
- è in **affitto breve** (le case in affitto lungo non compaiono mai);
- è **attiva**, cioè ha finito l'attivazione (vedi [[immobili#attivare-un-immobile]]);
- **non è in pausa**;
- l'interruttore **«Mostra la casa sul sito»** è acceso. Lo trovi all'ultimo passo della procedura guidata per aggiungere un immobile; se l'hai lasciato spento, alla fine della procedura trovi il pulsante «Mostralo sul sito».

Se una sola condizione manca, la casa sparisce dal sito, dalla ricerca e dai widget, e il suo indirizzo risponde «Questa casa non è disponibile».

### Perché il sito può non prendere prenotazioni
In alto, nella pagina «Sito di prenotazione», può comparire l'avviso **«Gli ospiti non possono ancora prenotare dal tuo sito»**. Sotto leggi il motivo (per esempio Stripe non ancora attivo oppure nessuna casa pubblicata) e un pulsante porta alla pagina che lo risolve. L'avviso sparisce da solo quando tutto è a posto.

Se l'ospite apre il sito mentre Stripe non è attivo, vede «Le prenotazioni online sono in pausa» e la possibilità di scrivere all'host per chiedere le date.

### Cosa vede l'ospite, pagina per pagina
1. **Pagina iniziale del sito.** Copertina, nome, slogan e una barra di ricerca con **Dove**, **Arrivo**, **Partenza** e **Ospiti**. Sotto: le categorie («Mare», «Centro storico», «Con piscina»…), **«Le nostre case»**, «Perché prenotare direttamente» con un esempio di conto, le recensioni verificate, la mappa delle zone e le domande frequenti. Nel piè di pagina compaiono i contatti, i dati dell'operatore, i documenti del sito e «Powered by CasaZen».
2. **Ricerca.** Con le date scelte ogni scheda mostra il **totale del soggiorno** (notti, pulizia e, dove il Comune la prevede, imposta di soggiorno); senza date mostra il prezzo della notte più bassa dei prossimi 30 giorni. L'ospite ordina («Consigliate», «Prezzo più basso»…), filtra (prezzo, camere, bagni, superficie, servizi, regole della casa), apre la mappa e salva i preferiti sul proprio telefono. Se non c'è nulla di libero propone date vicine.
3. **Pagina della casa.** Foto, panoramica, descrizione, servizi, planimetria, zona sulla mappa, calendario con i prezzi per notte, regole, politica di cancellazione con le date esatte, recensioni, chi ospita (con «Scrivi a…» e «Chiama»). La scheda «Prenota questa casa» mostra le notti, la pulizia, l'imposta di soggiorno e il totale: **nessun costo nascosto**. Se le date non vanno bene dice perché (notti minime o massime, arrivi chiusi, troppi ospiti, animali non ammessi) e propone una correzione.
4. **Prenotazione in tre passi:**
   - **Il soggiorno**: date, ospiti e il modo di prenotare: **«Prenotazione immediata»** (si paga online) oppure **«Su richiesta»** (paga in struttura, se l'host accetta). Può aggiungere le richieste speciali.
   - **I tuoi dati**: nome, cognome, e-mail, telefono (facoltativo, ma serve per le offerte su WhatsApp), paese di residenza, orario di arrivo previsto e gli eventuali extra. I documenti dei viaggiatori non si chiedono qui: arrivano dopo, con il check-in online.
   - **Pagamento**: sceglie **«Paga ora»**, **«Paga alla scadenza»** o la richiesta **«Paga in struttura»**, spunta il consenso a termini e privacy e conferma.
5. **Conferma.** Appare «Prenotazione confermata!» con un biglietto: codice prenotazione, arrivo, partenza e totale. L'ospite può aggiungerla al calendario (Google Calendar, Outlook.com o file `.ics`), aprire «Gestisci la prenotazione» o scrivere all'host. Riceve anche una e-mail con il codice e il link per il check-in online.
6. **Le mie prenotazioni.** Vedi più sotto.

### Le tre opzioni di pagamento
| Opzione | Cosa succede | Cosa fai tu |
|---|---|---|
| **Paga ora** | Addebito subito dell'intero importo con la carta. La prenotazione è confermata appena il pagamento va a buon fine | Niente: la prenotazione compare già confermata |
| **Paga alla scadenza** | Oggi non si addebita nulla: CasaZen salva la carta e addebita nel giorno in cui scade la cancellazione gratuita | Niente. Disponibile solo se quel giorno è ancora nel futuro: vedi [[incassi#come-pagano-gli-ospiti]] |
| **Paga in struttura** | È una **richiesta**: l'ospite conferma il suo indirizzo e-mail, poi tu accetti o rifiuti. Se accetti, paga all'arrivo | Rispondi entro il termine (per impostazione predefinita 24 ore): [[prenotazioni#rispondere-a-una-richiesta-di-prenotazione]]. Se non rispondi la richiesta scade e le date tornano libere |

Dopo aver confermato i dati, le **date restano riservate all'ospite per 30 minuti**: se non completa il pagamento, tornano libere. Se l'ospite apre di nuovo la stessa prenotazione, il sito gli propone di riprenderla invece di crearne un'altra.

Importi, commissioni di Stripe, rimborsi e stati dei pagamenti sono spiegati in [[incassi]]: CasaZen non trattiene i tuoi incassi.

### Cosa succede dopo una prenotazione dal sito
- La prenotazione compare in **Prenotazioni** con origine **«Sito diretto»** (se l'ospite è arrivato da un link creato per il sito della tua agenzia, **«Sito dell'agenzia»**). Le date risultano subito occupate sul sito e nel calendario che esporti ai canali.
- L'ospite riceve l'e-mail di conferma con il codice. Se vuoi, puoi poi mandargli il portale con il suo soggiorno: [[portale-ospite]].
- A fine soggiorno l'ospite può scrivere una **recensione verificata**, pubblicata subito sul sito: puoi rispondere ma non toglierla. Vedi [[messaggi-recensioni#le-recensioni]].

### Come funziona la cancellazione dal sito
- Nell'e-mail di conferma c'è un link per **annullare**; si può anche annullare da «Le mie prenotazioni». La pagina mostra prima **quanto verrà rimborsato**, con le date entro cui il rimborso cambia, poi chiede conferma («Annulla la prenotazione» › «Sì, annulla»).
- L'annullamento libera subito le date e **non si può riattivare**. Il rimborso arriva sul metodo usato dall'ospite, di solito entro 5-10 giorni. Se il rimborso non va a buon fine l'ospite è invitato a contattarti.
- Il rimborso segue la **politica di cancellazione** della casa e include sempre l'imposta di soggiorno già pagata: tutte le regole e gli importi sono in [[incassi#politiche-di-cancellazione-e-importi]].
- Da qui non si annulla più quando il soggiorno è già iniziato oppure mentre un pagamento è ancora in corso: l'ospite viene invitato a scriverti.
- Chi ha prenotato da un portale (Airbnb, Booking.com…) annulla sul portale, non qui.

### Le mie prenotazioni (l'area dell'ospite sul sito)
L'ospite apre **«Le mie prenotazioni»** dal menu del sito, scrive il **codice prenotazione** (10 caratteri, per esempio ABCDE-12345, lo trova nell'e-mail) e sceglie come verificarsi: con **l'e-mail** usata per prenotare oppure con le **ultime 4 cifre del telefono**. Vede stato, importi (soggiorno, pulizie, imposta, pagato, rimborsato), come si paga, i tuoi contatti, e può:
- chiedere che gli rimandi il **link per il check-in online** (il link nuovo sostituisce i precedenti);
- **annullare** la prenotazione, se la politica lo permette;
- **scriverti** un messaggio (tu rispondi da **Messaggi**: [[messaggi-recensioni]]) e scegliere se ricevere offerte.

Dopo troppi tentativi sbagliati il sito chiede di aspettare qualche minuto. La sessione è a tempo: su un telefono condiviso l'ospite usa «Esci».

### Mappe
Le mappe del sito sono schematiche e mostrano **posizioni indicative**: l'indirizzo esatto arriva con la conferma della prenotazione.

## Come fare

### Controllare il tuo sito e copiare il link
1. Apri **Affitti brevi › Sito di prenotazione**. La pagina in alto si intitola «Direct Booking».
2. A sinistra, sotto **«Proprietà»**, vedi le tue case. Premi il nome di una casa per vederne l'anteprima a destra; ripremilo per tornare al sito intero. Con i pulsanti «Anteprima desktop» e «Anteprima mobile» scegli come vederla, con «Apri a schermo intero» la apri a pagina intera.
3. Per copiare il link di **una casa** premi l'icona «Copia URL struttura» sulla riga. Per aprire la sua pagina pubblica premi «Apri pagina struttura».
4. Per il link dell'**intero sito** apri la voce **«URL organizzazione»** in basso a sinistra e premi «Copia URL».
5. Incolla il link nei tuoi messaggi, sui social o sul tuo sito.

> **Nota:** se sei amministratore il link copiato usa il tuo indirizzo vero (per esempio il tuo dominio). Se non lo sei, la pagina avvisa «Questo è l'indirizzo di CasaZen: quello del tuo sito lo vede solo chi amministra l'account»: il link funziona, ma è quello di CasaZen. Se vedi «Completa la configurazione dell'organizzazione per attivare il sito pubblico», prima completa i dati in **Impostazioni › Organizzazione**.

### Capire se una casa è sul sito
1. Apri **Affitti brevi › Sito di prenotazione** e guarda il segno accanto al nome della casa.
2. **«Pubblicata»** vuol dire che la casa è attiva e non è in pausa. **«Non pubblicata»** vuol dire che manca l'attivazione oppure che è in pausa: vedi [[immobili#attivare-un-immobile]] e [[immobili#mettere-in-pausa-e-riattivare-un-immobile]].
3. Se la casa risulta «Pubblicata» ma sul sito non c'è, controlla che l'interruttore «Mostra la casa sul sito» sia acceso (vedi sopra).

### Capire perché il sito non prende prenotazioni
1. Apri **Affitti brevi › Sito di prenotazione**. Se vedi l'avviso «Gli ospiti non possono ancora prenotare dal tuo sito», leggi il motivo sotto il titolo.
2. Premi il pulsante dell'avviso: ti porta alla pagina giusta (di solito **Stripe Connect** o l'attivazione di una casa).
3. Torna sulla pagina: quando tutto è a posto l'avviso non c'è più.

Per Stripe: [[incassi#finire-la-verifica-di-stripe]].

### Creare un link con date e QR per il sito della tua agenzia
Serve se hai già un sito tuo e vuoi che il pulsante «Prenota» di una casa porti l'ospite alla prenotazione, con le date già scelte.
1. Apri **Affitti brevi › Sito di prenotazione**.
2. Sulla riga della casa premi l'icona del link («Link per il sito dell'agenzia: nome della casa»). Si apre una finestra.
3. Se vuoi, scegli **Arrivo** e **Partenza**: vanno nel link solo insieme, l'arrivo non può essere nel passato e la partenza deve essere dopo l'arrivo.
4. Scegli gli **Ospiti** (fino alla capienza della casa) e la **Lingua della pagina**.
5. Se vuoi sapere da dove arrivano le prenotazioni, scrivi un **Nome della campagna** (per esempio «estate-2026»). Non scrivere nomi di persone, e-mail o numeri di telefono: il sito rifiuta il nome.
6. Premi **«Copia link»**. Per un cartello stampato premi **«Stampa il QR»**: il foglio dice «Inquadra il codice per prenotare».
7. Se la finestra dice «Questa casa non è ancora pubblicata sul sito», il link funzionerà solo quando lo sarà.

Cosa succede dopo: chi prenota da quel link ha come origine **«Sito dell'agenzia»**. Il link non viene salvato: si ricostruisce ogni volta che apri la finestra.

### Personalizzare l'aspetto del sito
Serve essere **amministratore**.
1. Apri **Impostazioni › Aspetto sito**. A destra vedi l'anteprima dell'inizio del sito, che si aggiorna mentre scegli.
2. In **«Immagini»** premi «Carica» per il **Logo** e per l'**Immagine di copertina**. Formati PNG, JPEG o WebP. Il logo: massimo 2 MB, da 64×32 a 4000×4000 pixel (meglio PNG con sfondo trasparente). La copertina: massimo 10 MB, almeno 1200×400 pixel. Le immagini vengono **pubblicate subito**, senza premere «Salva». Con «Sostituisci» o «Rimuovi» le cambi. Senza logo il sito mostra il nome; senza copertina usa la prima foto di una casa.
3. In **«Stile»** scegli il **Tema**: «Terra» (calda, terracotta su crema), «Mare» (fresca, blu petrolio su bianco) o «Città» (essenziale, inchiostro su pietra).
4. Scegli i **Caratteri**: «Editoriale» (titoli con le grazie), «Moderno» (senza grazie) o «Classico» (eleganza da rivista). Con «Usa i caratteri del tema» torni a quelli del tema.
5. Se vuoi un **Colore principale** diverso da quello del tema, scegli un colore o scrivi il codice (per esempio `#1a6b8f`). Sotto, il riquadro «Leggibilità» ti dice se il testo dei pulsanti sarà bianco o scuro e, se il colore è troppo chiaro, che link e contorni useranno una variante più scura. «Usa il colore del tema» cancella la scelta.
6. Scrivi uno **Slogan** (massimo 160 caratteri), per esempio «Case vacanza a due passi dal mare».
7. Premi **«Salva stile»**. Compare «Aspetto del sito salvato».
8. Per vedere il risultato vero premi «Apri il sito» sopra l'anteprima.

> **Nota:** nome e indirizzo del sito non si cambiano qui: il link «Vai a Organizzazione» sotto l'anteprima ti porta nel posto giusto.

### Pubblicare l'informativa privacy e i termini del sito
Serve essere **amministratore**. Sono i **tuoi** documenti, non quelli di CasaZen: il titolare del trattamento dei dati degli ospiti sei tu. CasaZen non li scrive e non ne controlla il contenuto, quindi falli scrivere da te o dal tuo consulente.
1. Apri **Impostazioni › Documenti sito**. Vedi due documenti: **«Informativa privacy»** e **«Termini di prenotazione»**, ognuno con il suo stato («Non ancora pubblicato», «Pubblicato: versione 2 dal…», «Ritirato il…»).
2. Sotto **«Come vuoi fornirlo»** scegli **«Scrivo il testo qui»** oppure **«Ho già un documento online»**.
3. Se scrivi il testo, usa il campo **Testo** (massimo 50.000 caratteri). Separa i paragrafi con una riga vuota; usa `#` per un titolo, `##` per un sottotitolo, `-` per un elenco, `**grassetto**`, `*corsivo*` e `[testo](https://indirizzo)` per un link. Il codice HTML non è ammesso.
4. Se hai già il documento online, scrivi l'**Indirizzo del documento**: deve iniziare con `https://`. L'ospite vedrà un pulsante che lo apre in una nuova scheda.
5. Premi **«Pubblica»** (la prima volta) o **«Pubblica nuova versione»**. Compare «Documento pubblicato (versione N)».
6. Controlla il risultato con **«Apri la pagina pubblica»**.

Cosa succede dopo: ogni pubblicazione crea una **nuova versione**; le vecchie restano nello **storico** («Versioni»), e con **«Usa come base»** ne riparti. Per togliere il documento premi **«Ritira il documento»** e conferma con «Sì, ritira»: l'ospite vedrà un avviso che dice che il documento non è stato ancora pubblicato; le versioni restano nello storico.

> **Attenzione:** finché un documento non è pubblicato, l'ospite lo trova segnato come non ancora pubblicato. L'ospite deve comunque spuntare il consenso a termini e privacy per prenotare.

### Come prenota un ospite dal tuo sito
Per spiegarlo a un ospite o provarlo tu stesso:
1. L'ospite apre il link del sito o di una casa e sceglie **Arrivo**, **Partenza** e **Ospiti**.
2. Apre la casa e controlla il totale nella scheda «Prenota questa casa». Se le date non vanno, il sito dice perché e propone alternative.
3. Preme **«Prenota»**. Si apre il primo passo: conferma date e ospiti e sceglie **«Prenotazione immediata»** oppure **«Su richiesta»**. Preme «Continua: i tuoi dati».
4. Scrive nome, cognome, e-mail e telefono, e se vuole l'orario di arrivo. Preme «Continua: pagamento».
5. Sceglie come pagare, spunta il consenso a **termini e privacy** e preme **«Prenota e paga …»** (oppure «Prenota: addebito il …», oppure «Invia la richiesta a …»).
6. Con «Paga ora» inserisce i dati della carta nel modulo sicuro di Stripe: i dati della carta non passano da CasaZen né da te.
7. Alla fine vede «Prenotazione confermata!» e riceve l'e-mail.

Per una richiesta «Paga in struttura» l'ospite deve prima **aprire l'e-mail** che riceve e premere **«Conferma e invia la richiesta»**: solo allora la richiesta arriva a te. Se non lo fa nel tempo concesso, la richiesta si annulla da sola.

### Come l'ospite ritrova la sua prenotazione
1. Apre il tuo sito e sceglie **«Le mie prenotazioni»**.
2. Scrive il **codice prenotazione** e l'e-mail usata per prenotare (oppure le ultime 4 cifre del telefono).
3. Preme **«Trova la prenotazione»**.
4. Se non la trova: controlla il codice nell'e-mail di conferma e l'indirizzo usato. Dopo troppi tentativi deve aspettare qualche minuto.

## Flussi completi

### Flusso: dal link alla prenotazione confermata
1. **Tu** colleghi Stripe e verifichi che le case siano «Pubblicata» ([[incassi#collegare-stripe-per-ricevere-i-pagamenti-online]]; questa pagina).
2. **Tu** copi il link del sito o crei il link con date e QR.
3. **L'ospite** apre il link, sceglie le date, controlla il totale e preme «Prenota».
4. **L'ospite** inserisce i suoi dati e sceglie come pagare.
5. **CasaZen** riserva le date per 30 minuti, incassa il pagamento con Stripe (oppure salva la carta, oppure manda la richiesta) e conferma la prenotazione.
6. **CasaZen** manda all'ospite la conferma con il codice e il link per il check-in; compare in **Prenotazioni** con origine «Sito diretto».
7. **L'ospite** compila il check-in online e usa il portale: [[portale-ospite]].
8. **Dopo il soggiorno** l'ospite può scrivere la recensione: [[messaggi-recensioni#flusso-dal-soggiorno-alla-recensione]].

Il flusso visto dal lato di prenotazioni e incassi è anche in [[prenotazioni#flusso-prenotazione-dal-tuo-sito-dalla-richiesta-alla-recensione]] e [[incassi#flusso-prenotazione-dal-sito-pagamento-online-accredito]].

### Flusso: richiesta «Paga in struttura»
1. L'ospite invia la richiesta e riceve un'e-mail con il link di conferma.
2. L'ospite apre il link e preme «Conferma e invia la richiesta»: ora la richiesta arriva a te.
3. Tu accetti o rifiuti da **Prenotazioni**: [[prenotazioni#rispondere-a-una-richiesta-di-prenotazione]].
4. Se accetti, l'ospite riceve la conferma e paga all'arrivo; l'incasso lo registri tu: [[incassi#flusso-ospite-che-chiede-di-pagare-in-struttura]]. Se rifiuti o non rispondi, le date tornano libere e l'ospite riceve un'e-mail.

## Regole e limiti
- **Solo l'amministratore** modifica aspetto e documenti del sito e vede l'indirizzo vero del sito.
- Una casa compare sul sito solo se è in affitto breve, attiva, non in pausa e con «Mostra la casa sul sito» acceso.
- **Immagini**: solo PNG, JPEG o WebP (niente SVG né GIF). Logo massimo 2 MB, copertina massimo 10 MB. Slogan massimo 160 caratteri.
- **Documenti del sito**: testo fino a 50.000 caratteri, senza codice HTML, con link che iniziano con `http://`, `https://` o `mailto:`; un documento esterno deve avere un indirizzo `https://` completo, senza nome utente né password.
- Le **date restano riservate 30 minuti** durante la prenotazione. Una richiesta «Paga in struttura» scade se l'ospite non conferma l'e-mail nello stesso tempo; dopo la sua conferma tu hai, per impostazione predefinita, 24 ore per rispondere, e non è possibile chiederla per soggiorni molto lunghi (per impostazione predefinita oltre 30 notti).
- Il sito accetta il pagamento online **solo con Stripe attivo**.
- **«Paga alla scadenza»** solo se il giorno di scadenza della cancellazione gratuita è ancora nel futuro.
- Il sito è in **italiano e inglese**; il check-in online e il portale ospite hanno anche tedesco, francese e spagnolo ([[portale-ospite]]).
- Le pagine in cui compare un segreto o un'operazione in corso non sono indicizzate dai motori di ricerca: ricerca del sito, «Le mie prenotazioni», conferme, cancellazioni e checkout. La pagina iniziale e le pagine delle case sì: [[pagine-pubbliche#cosa-viene-trovato-dai-motori-di-ricerca]].

## Domande frequenti

### Ho collegato Stripe ma il sito dice che non posso ancora prenotare. Perché?
Stripe deve essere **«Attivo»**, non «In verifica». Apri **Impostazioni › Stripe Connect** e completa quello che Stripe chiede: [[incassi#finire-la-verifica-di-stripe]].

### La casa è «Pubblicata» ma non la trovo sul sito.
Controlla che «Mostra la casa sul sito» sia acceso e che la casa sia in affitto breve. Se la casa è stata appena attivata, ricarica la pagina del sito.

### Posso avere il sito con un indirizzo mio?
Sì: con un sottodominio CasaZen oppure, con il piano Pro, con un dominio tuo (per esempio `prenota.latuaagenzia.it`). Vedi [[dominio-incorpora]].

### Come provo il mio sito prima di dirlo agli ospiti?
Apri il link del sito da un telefono o da una finestra privata del browser e prova a prenotare. Sull'ambiente reale ogni pagamento è vero: se fai una prova con la tua carta, poi annulla la prenotazione e rimborsala ([[incassi#annullare-una-prenotazione-e-rimborsare-chi-ha-pagato]]).

### L'ospite non ha ricevuto l'e-mail di conferma. Cosa faccio?
Controlla l'indirizzo nella scheda della prenotazione e chiedi all'ospite di guardare anche nella posta indesiderata. Dalla pagina «Le mie prenotazioni» può sempre ritrovare la prenotazione con il codice.

### Posso cambiare il tema dopo aver pubblicato il sito?
Sì, in qualsiasi momento: la modifica compare sul sito appena premi «Salva stile». Le immagini invece si pubblicano subito, senza salvare.

### CasaZen scrive l'informativa privacy del mio sito?
No. L'informativa e i termini del sito sono tuoi e li pubblichi tu in **Documenti sito**. Quelli di CasaZen sono documenti separati: [[pagine-pubbliche#i-documenti-legali-di-casazen]].

## Glossario
- **Sito di prenotazione**: la pagina pubblica della tua organizzazione dove gli ospiti prenotano direttamente.
- **Pubblicata**: una casa che gli ospiti possono vedere e prenotare sul sito.
- **Prenotazione immediata**: l'ospite paga online e la prenotazione è subito confermata.
- **Su richiesta**: l'ospite chiede di prenotare, paga all'arrivo e l'host accetta o rifiuta.
- **Codice prenotazione**: il codice di 10 caratteri (per esempio ABCDE-12345) che l'ospite trova nell'e-mail di conferma.
- **Sito dell'agenzia**: l'origine delle prenotazioni arrivate da un link creato per il sito di un'agenzia.

## Vedi anche
- [[dominio-incorpora]]: per avere un indirizzo tuo o inserire il widget nel sito che hai già.
- [[portale-ospite]]: cosa vede l'ospite dopo la prenotazione.
- [[incassi]]: Stripe, pagamenti e rimborsi.
- [[prenotazioni]]: dove ritrovi le prenotazioni del sito e rispondi alle richieste.
- [[immobili]]: attivazione, foto e regole delle case.
- [[pagine-pubbliche]]: le altre pagine pubbliche di CasaZen.
