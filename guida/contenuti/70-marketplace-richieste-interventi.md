---
id: marketplace
titolo: Marketplace dei servizi, interventi e fornitori fidati
menu: Marketplace e interventi
sezione: Fornitori e marketplace
ordine: 70
riassunto: Come trovi un fornitore nella tua zona (pulizie, idraulico, elettricista…), come gli chiedi un intervento, lo segui, lo paghi e lo annulli, e come inviti i tuoi fornitori di fiducia.
chi: [gestore, amministratore]
dove: Affitti brevi › Marketplace; Affitti brevi › Immobili › Interventi; Affitti brevi › Immobili › Fornitori fidati
parole_chiave: [marketplace, fornitori, intervento, richiedere un intervento, pulizie, idraulico, elettricista, manutenzione, perdita d'acqua, guasto urgente, emergenza, pronto intervento, preventivo, sollecito, fornitore non risponde, pagamento fornitore, fornitori fidati, riserva, partner, verificato, link di pagamento, annullare un intervento]
copre: [/app/short-rent/marketplace, /app/short-rent/marketplace/categories, /app/short-rent/marketplace/categories/:category, /app/short-rent/marketplace/search, /app/short-rent/marketplace/mine, /app/short-rent/marketplace/suppliers/:orgId, /app/short-rent/interventions, /app/short-rent/interventions/request, /app/short-rent/interventions/:id, /app/short-rent/trusted-suppliers, /service/pay/:paymentId]
stato: disponibile
fonte_codice: [frontend/src/features/marketplace/marketplace-page.tsx, frontend/src/features/marketplace/category-page.tsx, frontend/src/features/marketplace/search-page.tsx, frontend/src/features/marketplace/mine-page.tsx, frontend/src/features/marketplace/supplier-page.tsx, frontend/src/features/marketplace/marketplace-supplier-drawer.tsx, frontend/src/features/marketplace/components/supplier-card.tsx, frontend/src/features/marketplace/components/supplier-sections.tsx, frontend/src/features/service-requests/interventions/interventions-page.tsx, frontend/src/features/service-requests/interventions/intervention-page.tsx, frontend/src/features/service-requests/interventions/intervention-now.tsx, frontend/src/features/service-requests/interventions/intervention-model.ts, frontend/src/features/service-requests/interventions/use-intervention-actions.tsx, frontend/src/features/service-requests/interventions/request/request-page.tsx, frontend/src/features/service-requests/interventions/request/request-model.ts, frontend/src/features/service-requests/interventions/request/request-pick-steps.tsx, frontend/src/features/service-requests/interventions/request/request-steps.tsx, frontend/src/features/service-requests/interventions/request/request-assist-card.tsx, frontend/src/pages/TrustedSuppliersPage.tsx, frontend/src/features/public-service-payment/service-payment-page.tsx, frontend/src/features/host-tracking/host-tracking.tsx, frontend/src/features/service-requests/long-rent/long-rent-requests-page.tsx, backend/Casazen.Core/Suppliers/HostServiceRequestActions.cs, backend/Casazen.Core/Options/ServiceRequestOptions.cs, backend/Casazen.Core/Options/SupplierPaymentsOptions.cs, backend/Casazen.Web/Controllers/TrustedSuppliersController.cs]
---

## In breve
Nel **Marketplace** trovi i fornitori CasaZen che lavorano nei comuni dei tuoi immobili: pulizie, idraulico, elettricista, manutenzione e altri lavori. Quando ti serve un lavoro apri **Interventi** e premi «Richiedi un intervento»: scegli la casa, il servizio, il fornitore e l'orario, e la richiesta parte solo quando premi «Invia la richiesta».

Da quel momento segui tutto dalla pagina dell'intervento: il fornitore accetta, rifiuta o propone un altro orario; a lavoro finito paghi con la carta dentro CasaZen (quando è attivo) oppure segni tu che hai pagato. Annullare è sempre gratuito.

> **Attenzione:** CasaZen non è un servizio di pronto intervento. Se c'è un pericolo (acqua che allaga, odore di gas, scintille) chiama subito un tecnico o i soccorsi: leggi l'avviso in «Richiedere un intervento».

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Servizi per la casa | Mostra le categorie di lavoro (Pulizie, Idraulico, Elettricista…) con quanti fornitori ci sono nella tua zona | Marketplace › Scopri › «Servizi per la casa» | gestore, amministratore | Disponibile | Trovare un fornitore nel Marketplace |
| Cerca | Cerca per nome del fornitore, servizio o categoria | Marketplace › casella «Cerca nel Marketplace» | gestore, amministratore | Disponibile | Cercare un fornitore per nome o servizio |
| Filtri e ordine | Ordina i fornitori e mostra solo quelli «Verificato» | Marketplace › pagina di una categoria o «Cerca» | gestore, amministratore | Disponibile | Trovare un fornitore nel Marketplace |
| Scheda del fornitore | Foto, servizi con prezzi, zone, contatti e vetrina del fornitore | Marketplace › tocca un fornitore | gestore, amministratore | Disponibile | Aprire la scheda di un fornitore |
| Attivi | Mostra le integrazioni attive e i fornitori CasaZen a cui hai già chiesto un lavoro | Marketplace › «Attivi» | gestore, amministratore | Disponibile | Ritrovare i fornitori già usati |
| Richiedi un intervento | Guida in sei passi che manda la richiesta a un fornitore | Immobili › Interventi › «Richiedi un intervento» | gestore, amministratore (serve il permesso di richiedere interventi) | Disponibile | Richiedere un intervento |
| Descrivi a parole | L'AI propone servizio, urgenza e chi chiamare da poche righe di testo | Richiedi un intervento › passo «Chi» | gestore, amministratore | Su attivazione | Descrivere il lavoro a parole |
| Invio anche alle riserve | La richiesta va anche ad altri fornitori, che subentrano se il primo non risponde | Richiedi un intervento › «Riepilogo» | gestore, amministratore | Su attivazione | Inviare le richieste anche ai fornitori di riserva |
| Elenco Interventi | Tutte le richieste fatte, con stato, prezzo e azione da fare | Immobili › Interventi | gestore, amministratore | Disponibile | Seguire un intervento |
| Pagina dell'intervento | «Prossimo passo», dettagli, foto del lavoro, fornitore e cronologia | Interventi › apri una riga | gestore, amministratore | Disponibile | Seguire un intervento |
| Sollecita | Ricorda al fornitore di rispondere | Pagina dell'intervento › «Sollecita» | gestore, amministratore | Disponibile | Sollecitare un fornitore |
| Nuovo orario proposto | Accetti o rifiuti l'orario che il fornitore propone al posto del tuo | Pagina dell'intervento › «Accetta l'orario» | gestore, amministratore | Disponibile | Rispondere a un nuovo orario proposto |
| Conferma dell'importo | Confermi un importo finale molto sopra il preventivo prima di pagare | Pagina dell'intervento › «Conferma l'importo» | gestore, amministratore | Disponibile | Confermare l'importo finale |
| Paga con la carta | Paghi il fornitore dentro CasaZen, con Stripe | Pagina dell'intervento › «Paga» | gestore, amministratore | Su attivazione | Pagare un intervento con la carta |
| Segna come pagato | Registri che hai già pagato il fornitore fuori da CasaZen | Pagina dell'intervento › «Segna come pagato» | gestore, amministratore (anche collaboratori che possono richiedere interventi) | Disponibile | Segnare un intervento come pagato |
| Annulla intervento | Chiude la richiesta e avvisa il fornitore | Pagina dell'intervento › menu «⋯» | gestore, amministratore (serve poter modificare gli immobili) | Disponibile | Annullare un intervento |
| Richiedi di nuovo | Riparte dalla stessa richiesta dopo un rifiuto, un annullamento o un lavoro concluso | Pagina dell'intervento | gestore, amministratore | Disponibile | Richiedere di nuovo un intervento |
| Fornitori fidati | Elenco dei fornitori che inviti tu, con le case a cui sono assegnati | Immobili › Fornitori fidati | amministratore | Su attivazione | Invitare un fornitore di fiducia |
| Pagina «Pagamento di un servizio» | Il link che arriva per e-mail per pagare un lavoro finito | Link ricevuto per e-mail | chi riceve il link | Su attivazione | Pagare dal link ricevuto per e-mail |
| Partner esterni | Aziende esterne a cui ti affidi fuori da CasaZen | Marketplace › «Partner» e passo «Chi» | gestore, amministratore | Disponibile | Richiedere un intervento |
| Richieste di assistenza degli affitti lunghi | Stessa gestione, legata all'immobile e non al soggiorno | Affitti lunghi › Interventi | gestore, amministratore | Disponibile | Vedi [[affitti-lunghi]] |

## Come funziona

### Che cosa c'è nel Marketplace
Il **Marketplace** (**Affitti brevi › Marketplace**) ha due schede: «Scopri» e «Attivi». In «Scopri» trovi cinque gruppi, che puoi raggiungere dai pulsanti in alto:
- «Canali di vendita», «Strumenti collegati» e «Funzioni del channel manager»: servono a collegare i portali e il tuo channel manager. Sono spiegati in [[canali-octorate]].
- **«Servizi per la casa»**: i fornitori CasaZen della tua zona per pulizie, manutenzione e altri lavori. È la parte di cui parla questa pagina.
- **«Partner»**: servizi di aziende esterne. Non sono fornitori CasaZen: il lavoro si organizza con loro, sul loro sito. Controlla sempre che servano la tua zona.

### Come si trovano i fornitori: la zona
I fornitori si cercano **per comune**. Il Marketplace mostra quelli che lavorano nei comuni dei tuoi immobili. Se a un immobile manca il comune, CasaZen lo dice («Aggiungi il comune per vedere i fornitori della tua zona»): lo scegli dall'elenco ufficiale nella scheda dell'immobile (vedi [[immobili]]). Se nel tuo territorio non c'è ancora nessun fornitore per una categoria, vedi «Ancora nessun fornitore» e, più sotto, i partner esterni.

### Che cosa vedi di un fornitore
Su ogni scheda trovi il nome, le categorie, il prezzo «da…» (oppure «Su preventivo») e, solo quando è misurato, «Risponde in genere entro…». I segni di fiducia sono:
- **«Consigliato»**: lo ha solo il fornitore messo meglio nell'ordine (affidabilità e disponibilità), e solo se è davvero davanti agli altri.
- **«Verificato»**: il profilo del fornitore è attivo e ha una partita IVA indicata. Compare da solo e non misura la qualità del lavoro ([[area-fornitore#cos-e-verificato-e-come-lo-ottengo]]).

Aprendo il fornitore vedi anche la presentazione («Chi è»), i servizi con prezzo e durata, le categorie e le zone («Dove e cosa fa») e i contatti (telefono ed e-mail). Se il fornitore ha pubblicato una vetrina, c'è il pulsante «Vedi la vetrina» (vedi [[vetrina-fornitore]]). **Non vedi nessun importo di commissione**: il prezzo è quello del servizio.

### Il ruolo di «Interventi»
Il Marketplace serve a **conoscere** i fornitori; la richiesta si fa da **Interventi** (**Affitti brevi › Immobili › Interventi**). Lì trovi tutte le richieste che hai fatto, a che punto sono e cosa devi fare tu. Puoi anche partire da altri punti: la scheda di una prenotazione («Richiedi le pulizie» o «Altro intervento»), il Cruscotto («Richiedi un intervento») o la schermata finale del check-out («Richiedi le pulizie»).

### La richiesta è per la casa
Una richiesta riguarda **l'immobile**. Un soggiorno si può collegare alla fine, se vuoi (per esempio le pulizie del giorno in cui gli ospiti partono). Senza soggiorno la richiesta riguarda solo la casa.

### Cosa vede il fornitore
Nel riepilogo, prima di inviare, CasaZen ti dice cosa vedrà il fornitore:
- **Prima che accetti**: che tipo di intervento è e quanto è urgente, il giorno e l'orario, il comune e il CAP dell'immobile (non l'indirizzo), il nome della tua organizzazione e il prezzo previsto.
- **Quando accetta**: anche il nome e l'indirizzo dell'immobile, le tue note e i tuoi contatti (e-mail e telefono).
- **Mai** i dati dei tuoi ospiti: se colleghi un soggiorno, il fornitore ne conosce solo le date.

### Gli stati di un intervento
| Stato | Cosa vuol dire |
|---|---|
| **Richiesto** | La richiesta è partita e aspetta la risposta del fornitore |
| **Preso in carico** | Il fornitore ha accettato: giorno e ora sono confermati |
| **In corso** | Il fornitore ha iniziato il lavoro |
| **Completato** | Il lavoro è finito: restano l'importo e il pagamento |
| **Pagato** | Il lavoro è concluso e pagato |
| **Rifiutato** | Il fornitore ha detto di no (puoi leggere il motivo se lo ha scritto) |
| **Annullato** | La richiesta è stata chiusa da te, dal fornitore o da CasaZen |

Nell'elenco i filtri rapidi sono: «Tutti», «In attesa» (aspettano la risposta del fornitore), «In corso» (presi in carico o già iniziati), «Da pagare» (lavori finiti: restano l'importo e il pagamento) e «Conclusi» (pagati, rifiutati o annullati).

### Il «Prossimo passo»
In cima alla pagina di un intervento c'è un solo riquadro evidenziato, «Prossimo passo», che dice **di chi è il turno** («Tocca a te» o «Tocca al fornitore») e ti dà un solo pulsante. Cambia così:
- **In attesa che il fornitore risponda**: puoi premere «Sollecita». Vedi fino a quando ha tempo per rispondere («Ha tempo per rispondere fino a…»).
- **Il fornitore propone un altro orario**: «Accetta l'orario» oppure «Rifiuta». Se rifiuti, la richiesta resta in attesa di un'altra risposta.
- **Intervento confermato** o **Il fornitore è al lavoro**: non devi fare nulla; se c'è un numero di telefono puoi usare «Chiama il fornitore».
- **Conferma l'importo finale**: il fornitore ha chiesto molto più del preventivo (vedi sotto).
- **Lavoro fatto: resta il pagamento**: «Paga» (con la carta, dentro CasaZen) oppure «Segna come pagato».
- **Il fornitore non è disponibile** (rifiuto): «Invia a un altro fornitore», con i dati già compilati.
- **Intervento annullato** (da te, dal fornitore o da CasaZen «in automatico»): «Richiedi di nuovo».
- **Intervento concluso e pagato**: «Richiedi di nuovo» con un tocco.

### Tempi di risposta e solleciti
> **Attenzione:** una richiesta in CasaZen non è una telefonata. Il fornitore ha di norma **due ore** per rispondere e l'urgenza «Emergenza» non accorcia questo tempo: è solo un'indicazione per lui. Per un guasto che non può aspettare chiama tu un tecnico.

Il fornitore ha un tempo limitato per rispondere, che vedi sempre nella pagina dell'intervento («Ha tempo per rispondere fino a…»). Per impostazione predefinita sono **due ore**; se la richiesta va anche ai fornitori di riserva (su attivazione), il fornitore che hai scelto ha **un'ora**. Poi:
- **Dove l'annullamento automatico è attivo** ([[per-iniziare#cosa-significa-su-attivazione]]: lo accende CasaZen), passato il tempo CasaZen annulla la richiesta da sola (il controllo gira ogni 10 minuti circa) e avvisa te e il fornitore: leggi «L'ha annullato CasaZen in automatico» e il motivo «Il fornitore non ha risposto in tempo». La rilanci con «Richiedi di nuovo».
- **Dove non è attivo**, la richiesta resta «Richiesto» anche dopo l'ora indicata: non si annulla da sola. Puoi sollecitare, aspettare o annullarla tu.

Con **«Sollecita»** il fornitore riceve un promemoria. Puoi sollecitarlo **una volta ogni 6 ore** (impostazione predefinita): prima, il pulsante mostra «Puoi sollecitare tra N ore» o «tra N minuti».
### Fornitori di riserva
> **Su attivazione.** Dove è attiva, ogni richiesta può partire anche verso altri fornitori della zona, dichiarati come **riserve** (fino a tre).

Funziona in due finestre di tempo:
1. Il fornitore che hai scelto ha **un'ora** per accettare. Se accetta, le riserve vengono avvisate e la richiesta si chiude per loro.
2. Se non accetta in tempo (o rifiuta), parte una seconda finestra di un'ora: **il primo fornitore contattato che accetta ha il lavoro**. Se nessuno accetta, le richieste decadono e puoi chiedere di nuovo.

Nella pagina dell'intervento compare il blocco **«Fornitori contattati»**: per ciascuno vedi se è «scelto da te» o «riserva» e a che punto è («In attesa», «Ha rifiutato», «Non ha risposto in tempo», «Ha il lavoro»…). Se annulli, anche le riserve sono avvisate. Nel passo «Riepilogo» trovi la casella «Invia anche a delle riserve» (già spuntata); l'impostazione generale è in **Impostazioni › Organizzazione**, «Invia le richieste anche a fornitori di riserva».

### Importo finale e conferma
Il fornitore può indicare un preventivo e poi, a lavoro finito, l'importo finale. Se l'importo finale supera il preventivo di **più del 20 %** (impostazione predefinita), devi **confermarlo** tu prima di poter pagare: il riquadro dice «Conferma l'importo finale» e il pulsante riporta la cifra (per esempio «Conferma € 120,00»).

### Come si paga un intervento
Inviare la richiesta non addebita nulla: si paga a lavoro finito (stato «Completato»). Il modo di pagamento si decide quando il fornitore accetta, e lo leggi nella pagina dell'intervento, alla voce «Pagamento»:
- **«Online, in CasaZen»** (su attivazione): paghi con la carta dentro CasaZen, con **Stripe**. L'intervento risulta pagato quando Stripe lo conferma a CasaZen; la pagina si aggiorna da sola. Gli importi molto piccoli (sotto 0,50 €) non si pagano online.
- **«Fuori da CasaZen: lo segni tu»**: paghi il fornitore come vi siete accordati (contanti, bonifico…) e poi premi «Segna come pagato». CasaZen non effettua il pagamento: registra solo che lo hai fatto.

**Commissioni.** Come gestore **non vedi nessun importo di commissione** né sulle schede né nel pagamento: paghi l'importo del lavoro (solo nella pagina «Fornitori fidati» un'etichetta dice a chi va la commissione, senza cifre). La commissione di CasaZen, quando c'è, la vede il fornitore nei suoi incassi (vedi [[area-fornitore]]).

### Fornitori fidati
I **fornitori fidati** sono i professionisti con cui lavori già: li inviti tu e, accettato l'invito, compaiono tra le proposte quando richiedi un intervento, accanto a quelli del Marketplace. Puoi assegnarli a tutte le tue case o solo ad alcune. Sotto il nome di ogni fornitore leggi da dove arriva: «Fornitore di fiducia · Commissione all'host» (lo hai invitato tu) oppure «Fornitore marketplace · Commissione a CasaZen».

> **Su attivazione.** Questa voce compare solo se l'organizzazione è sul piano Agenzia e solo a chi amministra l'organizzazione ([[per-iniziare#cosa-significa-su-attivazione]]). Se non la vedi, chiedi l'attivazione all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza» ([[per-iniziare#assistenza-come-scrivere-a-casazen]]).

### Link di pagamento per e-mail
Quando un lavoro finito si paga dentro CasaZen, il cliente può ricevere per e-mail un **link di pagamento** (pagina «Pagamento di un servizio»). Il link vale **30 giorni** («Il link vale fino al…») ed è legato a quel solo pagamento: se ne ricevi uno più recente, usa quello. Nella pagina vedi professionista, servizio, immobile, voci e totale, e premi «Paga». Dopo il pagamento compare «Pagamento ricevuto. Grazie!»; se il link non è valido o il pagamento è già stato saldato, la pagina lo dice.

### Tracciamento delle prenotazioni (Google Tag Manager)
Il «tracciamento» del tuo sito di prenotazione non riguarda i fornitori. Se hai un tuo dominio puoi inserire un identificativo **Google Tag Manager** (nella forma «GTM-ABC123») in **Impostazioni › Incorpora nel tuo sito**. Le pagine sul tuo dominio lo caricano **solo se l'ospite ha accettato le statistiche** nel banner dei cookie. Il dettaglio è in [[dominio-incorpora]].

### Affitti lunghi
Per gli affitti lunghi esiste la stessa gestione degli interventi (**Affitti lunghi › Interventi**, con «Richiedi intervento»): la richiesta è legata all'immobile e non a un soggiorno, e il riquadro «Prossimo passo» funziona allo stesso modo. Vedi [[affitti-lunghi]].

## Come fare

### Trovare un fornitore nel Marketplace
**Ti serve:** almeno un immobile con il **comune** scelto dall'elenco ufficiale ([[immobili]]): senza comune CasaZen non sa quale zona cercare.
1. Apri **Affitti brevi › Marketplace**: si apre la scheda «Scopri».
2. Premi «Servizi per la casa» tra i pulsanti in alto, oppure scorri fino al gruppo.
3. Premi la categoria che ti serve (per esempio «Pulizie»). Sotto il nome leggi quanti fornitori ci sono («3 fornitori») oppure «Ancora nessun fornitore».
4. Nell'elenco usa «Ordina per» (**Consigliati**, **Nome**, **Prezzo**, **Risposta più rapida**) e, se vuoi, «Solo verificati».
5. Premi un fornitore per vedere la sua scheda.

Se non vedi nessun fornitore, controlla che i tuoi immobili abbiano il comune: senza comune CasaZen non sa quale zona cercare.
> **Suggerimento:** se tutti i fornitori sono nascosti da «Solo verificati», premi «Azzera i filtri».

### Cercare un fornitore per nome o servizio
1. In **Marketplace** scrivi nella casella «Cerca nel Marketplace» (esempio: «Fornitore, servizio o categoria») e premi Invio.
2. Si apre la pagina «Cerca»: la ricerca trova per nome del fornitore, per servizio e per categoria, anche senza maiuscole o accenti.
3. Per tornare a tutti i fornitori premi «Azzera la ricerca».

### Aprire la scheda di un fornitore
1. Premi un fornitore nell'elenco: si apre un riquadro a lato.
2. Leggi «Servizi», «Dove e cosa fa» e «Contatti».
3. Premi «Apri la pagina» per la pagina intera (il suo indirizzo si può condividere) oppure «Vedi la vetrina» per la pagina pubblica del fornitore.

### Ritrovare i fornitori già usati
1. Apri **Marketplace** e premi la scheda «Attivi».
2. Nella sezione «Fornitori CasaZen» vedi i fornitori a cui hai già chiesto un lavoro, con «Ultimo lavoro» e le richieste aperte.
3. Premi «Vedi il fornitore» per aprirne la scheda.

### Richiedere un intervento
> **Attenzione:** CasaZen non è un servizio di pronto intervento. Se c'è un pericolo (acqua che allaga, odore di gas, scintille, fumo) chiama subito un tecnico di fiducia, i vigili del fuoco (115) o il numero unico di emergenza (112): non aspettare una richiesta in CasaZen. Una richiesta non è una telefonata: il fornitore ha di norma due ore per rispondere e «Emergenza» è solo un'indicazione per lui, non accorcia l'attesa. Dove l'annullamento automatico non è attivo, una richiesta senza risposta resta aperta ([[marketplace#tempi-di-risposta-e-solleciti]]).

**Ti serve:** il permesso di richiedere interventi, almeno un immobile con il **comune** scelto, e sapere che lavoro serve, per quando e con che urgenza. Non scrivere dati degli ospiti nelle note. Inviare la richiesta non addebita nulla: si paga a lavoro finito.

Gestisci affitti lunghi? La stessa richiesta si fa da **Affitti lunghi › Interventi**: vedi [[affitti-lunghi#chiedere-un-intervento-a-un-fornitore-per-una-casa-in-affitto-lungo]].

La richiesta parte **solo** quando premi «Invia la richiesta» all'ultimo passo. Fino ad allora puoi tornare indietro e cambiare tutto; se esci, CasaZen conserva una bozza delle prime risposte.
1. Apri **Affitti brevi › Immobili › Interventi** e premi «Richiedi un intervento». Il pulsante non compare se non puoi richiedere interventi.
2. Passo **«Immobile»** («Per quale immobile?»): scegli la casa. Se ne hai una sola è già scelta. Senza immobili compare «Prima serve un immobile» con «Aggiungi un immobile».
3. Passo **«Chi»** («Chi vuoi coinvolgere?»): lascia «Un fornitore per questo immobile» (è il consigliato) oppure scegli «Un servizio esterno» per i partner. Se l'immobile non ha il comune, o nella zona non c'è nessun fornitore, CasaZen lo spiega e ti propone i partner esterni.
4. Passo **«Servizio»** («Di che servizio hai bisogno?»): scegli il tipo di lavoro. Ogni tessera dice quanti fornitori ci sono.
5. Passo **«Proposte»** («Chi se ne occupa?»): scegli il fornitore. Sono in ordine di affidabilità e disponibilità, il primo è il più consigliato. Vedi prezzo, tempo di risposta e alcuni servizi, e i segni «Consigliato» e «Verificato». Se hai invitato fornitori di fiducia, sono qui con l'etichetta «Fornitore di fiducia».
6. Passo **«Dettagli»** («Quando e come?»):
   - scegli il **servizio** del fornitore, oppure «Altro lavoro» se non è nell'elenco;
   - scegli il **giorno** (non può essere già passato);
   - scegli uno degli **orari liberi** (sono mostrati in base all'agenda del fornitore). Se quel giorno non ce ne sono, CasaZen suggerisce i giorni vicini. Per «Altro lavoro» scrivi tu l'ora di inizio e scegli la durata (da 5 minuti a 24 ore);
   - indica l'**urgenza**: «Normale» (si può programmare), «Alta» (serve in tempi brevi) o «Emergenza» (serve subito);
   - scrivi le **note** (facoltative, fino a 1000 caratteri): cosa deve fare il fornitore. Non scrivere dati degli ospiti;
   - se vuoi, collega un **soggiorno** («Collega a un soggiorno»; la scelta predefinita è «Nessun soggiorno: solo la casa»).
7. Passo **«Riepilogo»** («Controlla e invia»): controlla le risposte (ognuna ha «Modifica»), il prezzo («Stima…», «Su preventivo» o «Da concordare con il fornitore») e il riquadro «Cosa vede il fornitore».
8. Premi **«Invia la richiesta»**.
9. Compare «Richiesta inviata a [fornitore]»: il fornitore decide («accetta, rifiuta oppure ti propone un altro orario»), tu sei avvisato appena risponde, e puoi annullare quando vuoi senza costi. Premi «Vedi la richiesta» per aprirla oppure «Fai un'altra richiesta».

Errori comuni:
- «Questo orario è appena stato preso: scegline un altro»: il fornitore ha ricevuto un'altra richiesta; torna al passo «Dettagli» e scegli un altro orario.
- «Questo fornitore al momento non è disponibile» o «non lavora nel comune dell'immobile»: torna a «Proposte» e scegli un altro fornitore.
- «Non siamo riusciti a inviare la richiesta. Riprova tra poco: le tue risposte sono ancora qui».
- «CasaZen non ha ricevuto la conferma. Controlla gli interventi prima di inviare di nuovo la richiesta»: apri **Interventi** per vedere se la richiesta c'è già, così non la mandi due volte.

> **Nota:** se scegli «Un servizio esterno», il percorso finisce con «Ho scelto un partner»: **CasaZen non invia nulla**. Il lavoro si organizza sul sito del partner e non lo trovi in Interventi.

### Descrivere il lavoro a parole
> **Su attivazione:** il riquadro compare solo dove CasaZen ha l'assistente AI attivo.

1. Nel passo **«Chi»**, sotto le scelte, trovi «Preferisci raccontarcelo?». Premi «Descrivi a parole».
2. Scrivi di cosa hai bisogno (almeno 8 caratteri, al massimo 600). Per esempio: «Il rubinetto della cucina perde, serve qualcuno domani mattina». Più dettagli dai (dove, da quando, per quando), più preciso è il consiglio. **Non scrivere nomi, telefoni o documenti degli ospiti.**
3. Premi «Suggerisci con l'AI». Compare «Ti consiglio»: il servizio, l'urgenza, una nota per il fornitore e chi coinvolgere.
4. Premi «Vedi i fornitori» (o «Vedi i partner») per usare il consiglio: il percorso continua da lì e **puoi cambiare tutto**. Con «Cambia le parole» riscrivi, con «Scelgo io» chiudi l'assistente.

L'AI non decide e non invia nulla: propone, e la richiesta parte solo quando premi «Invia la richiesta». Se non riesce a darti un consiglio (per esempio «Il consiglio dell'AI non è disponibile al momento»), scegli tu il servizio.

### Richiedere le pulizie dopo un check-out
1. Apri la scheda della prenotazione e, nella parte del soggiorno, premi «Richiedi le pulizie» (per un altro lavoro, «Altro intervento»). Oppure usa «Richiedi le pulizie» alla fine del check-out.
2. Il percorso si apre già con la casa, il soggiorno e il servizio «Pulizie» scelti, e il giorno di partenza degli ospiti.
3. Nel passo «Dettagli» CasaZen consiglia la **fascia giusta**: da quando gli ospiti partono (per impostazione predefinita alle 10:00, oppure l'orario di check-out dell'immobile) fino a quando arrivano i prossimi (per impostazione predefinita dalle 15:00, oppure l'orario di check-in dell'immobile). Con «Mostra tutti gli orari» vedi anche gli altri.
4. Prosegui fino a «Invia la richiesta».

### Seguire un intervento
1. Apri **Affitti brevi › Immobili › Interventi**.
2. Scegli un filtro rapido («In attesa», «In corso», «Da pagare», «Conclusi»), oppure cerca per tipo, immobile o fornitore. Puoi filtrare per «Tipo», «Immobile», «Fornitore» e «Giorno del lavoro».
3. Premi una riga: si apre un riquadro con «Apri la scheda» per la pagina completa. Nell'elenco vedi anche il soggiorno collegato, quando e a che prezzo («Da definire» se non è ancora noto).
4. Nella pagina leggi in ordine: lo stato, il percorso già fatto, il riquadro «Prossimo passo», i «Dettagli», le «Foto del lavoro» (se il fornitore le ha caricate), il «Fornitore» con telefono ed e-mail, e la «Cronologia».
5. Dal menu «⋯» puoi aprire l'immobile («Apri l'immobile»), il soggiorno («Apri il soggiorno»), chiamare il fornitore o annullare.

Ti avvisiamo noi quando il fornitore risponde o cambia qualcosa: non serve ricaricare la pagina.

### Sollecitare un fornitore
1. Apri la pagina dell'intervento in stato «Richiesto».
2. Nel «Prossimo passo» premi «Sollecita». Compare «Sollecito inviato al fornitore».
3. Se hai già sollecitato da poco, il pulsante dice «Puoi sollecitare tra…»: aspetta e riprova. Vedi anche «Ultimo sollecito».

Serve poter modificare gli immobili. Il sollecito non si può ritirare.

### Rispondere a un nuovo orario proposto
1. Apri l'intervento: il riquadro dice «[Fornitore] propone un altro orario» e mostra anche l'orario che avevi chiesto e l'eventuale messaggio.
2. Premi «Accetta l'orario»: l'intervento è confermato.
3. Oppure premi «Rifiuta»: la richiesta resta in attesa di un'altra risposta.

### Confermare l'importo finale
1. Apri l'intervento in stato «Completato»: compare «Conferma l'importo finale».
2. Leggi la cifra chiesta e il preventivo, poi premi «Conferma» seguito dall'importo.
3. Da qui puoi pagare.

### Pagare un intervento con la carta
> **Su attivazione:** il pagamento con la carta compare solo per i fornitori che possono ricevere pagamenti online da CasaZen.

**Ti serve:** un lavoro in stato «Completato», il permesso di modificare gli immobili, una carta e un fornitore che riceve pagamenti online da CasaZen.
1. Apri l'intervento: il riquadro dice «Lavoro fatto: resta il pagamento».
2. Premi «Paga» (con la cifra, per esempio «Paga € 80,00»).
3. Nella finestra «Paga l'intervento» inserisci i dati della carta e conferma.
4. Compare «Pagamento inviato: aspettiamo la conferma di Stripe». La pagina si aggiorna da sola e l'intervento passa a «Pagato» quando Stripe conferma.
5. Se la carta viene rifiutata, compare «Il pagamento non è andato a buon fine. Controlla la carta o prova con un'altra»: premi di nuovo «Paga».

Serve poter modificare gli immobili. Un pagamento andato a buon fine non si ritira da qui.

### Segnare un intervento come pagato
**Ti serve:** un lavoro in stato «Completato», il permesso di richiedere interventi e di aver già pagato il fornitore fuori da CasaZen. L'operazione non si annulla.
1. Paga il fornitore come vi siete accordati (contanti, bonifico…).
2. Apri l'intervento e premi «Segna come pagato».
3. Nella finestra leggi: «CasaZen non effettua il pagamento: questo segna solo che l'hai già fatto» e «L'operazione non si può annullare e il fornitore riceverà una notifica».
4. Premi «Sì, ho pagato». Compare «Segnato come pagato».

Può farlo anche un collaboratore che può richiedere interventi.

### Annullare un intervento
1. Apri l'intervento e, dal menu «⋯», premi «Annulla intervento».
2. Scrivi **perché** annulli: il fornitore legge il motivo (al massimo 500 caratteri).
3. Premi «Annulla intervento». Compare «Intervento annullato».

Cosa succede: annullare è **sempre gratuito**; il fornitore riceve subito un avviso con il tuo motivo e l'intervento **non si può riaprire** (per riaverlo lo richiedi di nuovo). Se il lavoro risulta già iniziato, la finestra ti avvisa: se il fornitore ha già lavorato, mettetevi d'accordo direttamente. Serve poter modificare gli immobili.

### Richiedere di nuovo un intervento
1. Apri un intervento rifiutato, annullato o concluso.
2. Premi «Invia a un altro fornitore» (dopo un rifiuto) oppure «Richiedi di nuovo».
3. Si apre la richiesta guidata già compilata con la stessa casa e lo stesso tipo di lavoro. Dopo un rifiuto il fornitore che ha detto no non viene riproposto; negli altri casi sì.

### Invitare un fornitore di fiducia
> **Su attivazione** e solo per l'amministratore ([[per-iniziare#cosa-significa-su-attivazione]]).

**Ti serve:** il piano Agenzia, l'e-mail del fornitore (la stessa con cui si registrerà) e, se vuoi, le case a cui assegnarlo.

1. Apri **Affitti brevi › Immobili › Fornitori fidati** e premi «Invita fornitore».
2. Scrivi l'«Email fornitore»: dev'essere quella con cui il fornitore si registrerà.
3. Scegli le «Proprietà assegnate». Se non ne scegli nessuna, il fornitore lavora su tutte le tue proprietà.
4. Premi «Invia invito». Compare «Richiesta registrata. Dopo la verifica il fornitore riceverà il link per accettare».
5. Il rapporto inizia **quando il titolare del profilo accetta**: da quel momento il fornitore compare nell'elenco e tra le proposte delle tue richieste.

Il messaggio dice «Dopo la verifica il fornitore riceverà il link»: di norma l'e-mail con il link parte subito. Se dopo qualche minuto il fornitore non l'ha ricevuta, controlla che l'indirizzo sia giusto e la cartella dello spam. Il fornitore apre il link, crea l'account (o accede) con **quella e-mail** e accetta: i suoi passi sono in [[area-fornitore#registrarsi-con-un-invito]]. Per scegliere un fornitore dal Marketplace usa invece «Cerca fornitori nel marketplace CasaZen».

### Rimuovere un fornitore di fiducia
1. In **Fornitori fidati** premi «Rimuovi» sulla scheda del fornitore.
2. Conferma «Vuoi davvero rimuovere questo fornitore di fiducia?» con «Rimuovi». Compare «Fornitore rimosso».

I lavori già richiesti non cambiano; il fornitore non compare più tra le tue proposte.

### Inviare le richieste anche ai fornitori di riserva
> **Su attivazione.**

1. Per tutte le richieste: apri **Impostazioni › Organizzazione** e attiva «Invia le richieste anche a fornitori di riserva».
2. Per una sola richiesta: nel passo «Riepilogo» lascia spuntata, oppure togli la spunta, a «Invia anche a delle riserve».
3. Dopo l'invio, nella pagina dell'intervento controlli «Fornitori contattati».

### Pagare dal link ricevuto per e-mail
1. Apri il link «Pagamento di un servizio» che ti è arrivato per e-mail.
2. Controlla professionista, servizio, immobile, voci e totale.
3. Premi «Paga [importo]» e inserisci i dati della carta.
4. Vedi «Stiamo confermando il pagamento» e poi «Pagamento ricevuto. Grazie!».

Se leggi «Questo link di pagamento non è valido o è stato sostituito da uno più recente», usa l'e-mail più recente. Se leggi «Questo pagamento non è più disponibile», potrebbe essere già stato saldato in altro modo o ritirato.

## Flussi completi

### Flusso: dalla richiesta al pagamento di un intervento
1. **Tu**: dopo un check-out apri la prenotazione e premi «Richiedi le pulizie» (vedi [[prenotazioni]]), oppure vai in **Interventi** e premi «Richiedi un intervento».
2. **Tu**: scegli immobile, servizio, fornitore, giorno e orario libero, urgenza e note, poi «Invia la richiesta» ([[marketplace#richiedere-un-intervento]]).
3. **CasaZen**: manda la richiesta al fornitore (e, dove è attivo, alle riserve) e ti avvisa appena risponde.
4. **Fornitore**: accetta, rifiuta o propone un altro orario (vedi [[area-fornitore]]). Se propone un altro orario, **tu** premi «Accetta l'orario» o «Rifiuta» ([[marketplace#rispondere-a-un-nuovo-orario-proposto]]).
5. **Fornitore**: fa il lavoro, lo segna «Completato» e indica l'importo. Se è molto sopra il preventivo, **tu** premi «Conferma l'importo».
6. **Tu**: premi «Paga» (carta, dentro CasaZen) oppure paghi fuori e premi «Segna come pagato» ([[marketplace#pagare-un-intervento-con-la-carta]]).
7. L'intervento passa a «Pagato». Per riaverlo, «Richiedi di nuovo».

### Flusso: il fornitore non risponde
1. La richiesta è in «Richiesto» e il «Prossimo passo» dice «In attesa che [fornitore] risponda».
2. **Tu**: dopo un po' premi «Sollecita» (una volta ogni 6 ore).
3. Con le riserve attive: dopo un'ora il lavoro passa al primo fornitore di riserva che accetta e il blocco «Fornitori contattati» te lo dice.
4. Senza riserve, o se nessuno accetta: dove l'annullamento automatico è attivo, CasaZen annulla la richiesta e ti avvisa; altrimenti resta «Richiesto» e decidi tu se aspettare, sollecitare o annullarla.
5. **Tu**: premi «Richiedi di nuovo» e scegli un altro fornitore.

## Regole e limiti
- **Tempo di risposta**: due ore per impostazione predefinita; un'ora per il fornitore scelto più un'ora di gara tra le riserve, quando sono attive. L'annullamento automatico per mancata risposta c'è solo dove è attivo; altrimenti la richiesta resta aperta. Le durate possono essere diverse sul tuo ambiente: vale sempre quella scritta nella pagina dell'intervento.
- **Sollecito**: una volta ogni 6 ore (impostazione predefinita).
- **Importo finale**: oltre il 20 % sopra il preventivo serve la tua conferma prima di pagare (impostazione predefinita).
- **Riserve**: fino a tre, scelte tra i fornitori liberi della zona e della categoria.
- **Note**: al massimo 1000 caratteri. **Descrizione per l'AI**: da 8 a 600 caratteri.
- **Durata** di un lavoro scelto da te: da 5 minuti a 24 ore. Il giorno e l'ora non possono essere nel passato.
- **Annullare** è sempre gratuito; l'intervento annullato non si riapre.
- **Permessi**: chiedere un intervento e segnare un pagamento richiedono il permesso di richiedere interventi; sollecitare, rispondere a un orario, confermare l'importo, pagare con la carta e annullare richiedono il permesso di modificare gli immobili. Senza permesso il pulsante non compare e il «Prossimo passo» ti porta all'elenco.
- **Fornitori fidati**: solo l'amministratore dell'organizzazione e solo dove la voce è attivata.
- **Dati degli ospiti**: il fornitore non li vede mai.
- **Partner esterni**: CasaZen non li gestisce né li segue in «Interventi».
- **Pagamento online**: dipende dal fornitore; l'importo minimo è 0,50 €; il link di pagamento vale 30 giorni.

## Domande frequenti

### Perché non vedo nessun fornitore?
Quasi sempre manca il comune dell'immobile: aggiungilo dalla scheda dell'immobile (**Immobili › Modifica**) scegliendolo dall'elenco ufficiale. Altrimenti, nella tua zona non c'è ancora un fornitore per quella categoria: vedi i partner esterni nel gruppo «Partner».

### Posso chiedere un intervento senza un soggiorno?
Sì. La richiesta riguarda la casa; il soggiorno si collega solo se vuoi, nel passo «Dettagli».

### Il fornitore vede i dati dei miei ospiti?
No. Vede il comune e il CAP prima di accettare e l'indirizzo dopo; se colleghi un soggiorno vede solo le date.

### Posso pagare in contanti o con bonifico?
Sì. Paghi come vi siete accordati e poi premi «Segna come pagato». CasaZen non esegue quel pagamento e non lo può annullare per te.

### CasaZen mi addebita una commissione?
Nelle schede e nel pagamento dell'intervento non vedi nessun importo di commissione: paghi l'importo del lavoro. Se hai dubbi sulla fattura del fornitore, chiedila a lui.

### Posso annullare quando il lavoro è già iniziato?
Sì, annullare è gratuito, ma se il fornitore ha già lavorato dovete accordarvi direttamente.

### Ho una perdita d'acqua o un guasto urgente: cosa faccio?
Chiama subito un tecnico di fiducia e, se c'è un pericolo (acqua che allaga, odore di gas, scintille, fumo), i vigili del fuoco (115) o il numero unico di emergenza (112). CasaZen non è un servizio di pronto intervento: una richiesta non è una telefonata, il fornitore ha di norma due ore per rispondere e «Emergenza» non accorcia l'attesa. Puoi mandare la richiesta anche subito, ma non aspettare la risposta per metterti in sicurezza.

### Il fornitore non risponde alla mia richiesta: cosa faccio?
Guarda l'orario scritto nella pagina dell'intervento («Ha tempo per rispondere fino a…») e premi «Sollecita» (una volta ogni 6 ore). Se non puoi aspettare, annulla la richiesta (è gratuito) e scegline un altro fornitore con «Richiedi di nuovo». Dove l'annullamento automatico è attivo CasaZen la annulla da sola passato il tempo e ti avvisa; dove non è attivo la richiesta resta aperta finché non la chiudi tu.

### Posso usare il mio idraulico di sempre?
Sì, se la tua organizzazione ha «Fornitori fidati»: invitalo con la sua e-mail. Quando accetta lo trovi tra le proposte.

## Glossario
- **Intervento**: una richiesta di lavoro che mandi a un fornitore e segui fino al pagamento.
- **Fornitore CasaZen**: professionista iscritto a CasaZen, che lavora nei comuni che ha scelto.
- **Fornitore di fiducia**: fornitore che hai invitato tu.
- **Riserva**: fornitore che riceve la richiesta insieme al primo e subentra se questo non risponde.
- **Partner**: azienda esterna a CasaZen; il lavoro si organizza sul suo sito.
- **Preventivo**: prezzo che il fornitore propone prima del lavoro.
- **Prossimo passo**: il riquadro che dice cosa fare adesso e a chi tocca.
- **Consigliato**: segno sul fornitore messo meglio nell'ordine per affidabilità e disponibilità, solo se è davvero davanti agli altri.
- **Verificato**: segno su un fornitore con profilo attivo e partita IVA indicata.
- **Marketplace**: la voce di menu dove trovi i fornitori CasaZen della tua zona e, in altri gruppi, i collegamenti ai canali di vendita e agli strumenti.
- **Pronto intervento**: servizio di emergenza (tecnici o soccorsi) che risponde subito; CasaZen non lo è.

## Vedi anche
- [[area-fornitore]]: come i fornitori ricevono, accettano e si fanno pagare.
- [[vetrina-fornitore]]: la pagina pubblica di un fornitore.
- [[immobili]]: il comune e gli orari di check-in e check-out dell'immobile.
- [[prenotazioni]]: le pulizie dal soggiorno.
- [[canali-octorate]]: gli altri gruppi del Marketplace (canali, strumenti, funzioni).
- [[affitti-lunghi]]: gli interventi negli affitti lunghi.
- [[dominio-incorpora]]: Google Tag Manager sul tuo dominio.
