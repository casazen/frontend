---
id: prezzi-tariffe
titolo: Prezzi e tariffe
sezione: Affitti brevi
ordine: 12
riassunto: Come si forma il prezzo di un soggiorno e dove lo imposti: prezzo base, weekend, pulizia, soggiorno minimo, sconti per soggiorni lunghi, suggerimenti stagionali, prezzo calcolato con l'AI, modifiche su più giorni e immobili e politica di cancellazione.
chi: [gestore, amministratore]
dove: Affitti brevi › Immobili › scheda › Panoramica › Prezzi; Affitti brevi › Calendario › Cambia più giorni
parole_chiave: [prezzo, tariffa, prezzo base, weekend, pulizia, soggiorno minimo, sconto, stagione, festività, suggerimenti stagionali, AI, cancellazione, rimborso, cambia più giorni, restrizioni]
copre: [/app/short-rent/properties/:id/pricing, /app/short-rent/bookings/calendar/bulk]
stato: disponibile
fonte_codice: [frontend/src/features/pricing/pricing-dashboard-page.tsx, frontend/src/features/pricing/components/pricing-suggestions-section.tsx, frontend/src/features/pricing/components/pricing-rules-section.tsx, frontend/src/features/bookings/calendar-bulk-page.tsx, frontend/src/features/bookings/lib/bulk-change-model.ts, frontend/src/features/bookings/lib/day-rules-model.ts, frontend/src/features/properties/wizard/steps/prices-step.tsx, frontend/src/features/properties/wizard/steps/ai-price-card.tsx, frontend/src/features/properties/wizard/steps/rules-step.tsx, frontend/src/features/properties/wizard/property-wizard-model.ts, frontend/src/i18n/locales/it.json, frontend/src/i18n/locales/price-estimate.it.json, backend/Casazen.Core/Services/StayPricing.cs, backend/Casazen.Core/Pricing/SeasonalPricing.cs]
---

## In breve
Il prezzo di una notte parte dal **prezzo base** della casa. Su quello CasaZen applica, in ordine, un eventuale prezzo scelto da te per quella data, il supplemento weekend e, sull'intero soggiorno, uno sconto per soggiorni lunghi. La pulizia si aggiunge una volta a soggiorno.
Il prezzo base e le regole fisse si impostano nella procedura della casa. Per le singole date, per i periodi e per più case insieme c'è «Cambia più giorni». I **suggerimenti stagionali** e il **calcolo con l'AI** ti propongono dei prezzi: non cambiano nulla finché non li confermi.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Prezzo base, weekend, pulizia, soggiorno minimo | I prezzi e le regole fissi della casa | Procedura «Aggiungi immobile» › passo «Prezzi» | gestore, amministratore (permesso di modifica) | Disponibile | Impostare il prezzo base e le regole di prezzo |
| Sconti per soggiorni lunghi | Fino a 5 fasce di sconto in base alle notti | Passo «Prezzi» › «Sconti per soggiorni lunghi» | gestore, amministratore (permesso di modifica) | Disponibile | Impostare gli sconti per soggiorni lunghi |
| Calcolo del prezzo con l'AI | Propone prezzo, weekend, pulizia e soggiorno minimo | Passo «Prezzi» › «Vuoi che calcoli io il prezzo con l'AI?» | gestore, amministratore (permesso di modifica) | Su attivazione | Calcolare il prezzo con l'AI |
| Suggerimenti stagionali | Prezzo suggerito per ogni notte dei prossimi 90 giorni, secondo stagioni e festività | Scheda immobile › Panoramica › «Prezzi» › «Gestisci i suggerimenti» | gestore, amministratore | Disponibile | Attivare e usare i suggerimenti stagionali |
| Cambia più giorni | Cambia prezzo e restrizioni di più giorni e più immobili in una volta | Calendario › «Cambia più giorni» | gestore, amministratore (permesso di modifica degli immobili) | Disponibile | Cambiare prezzo e regole di più giorni e immobili |
| Politica di cancellazione | Dice quanto rimborsi se l'ospite cancella | Passo «Regole» › «Se l'ospite cancella»; modulo «Modifica immobile» | gestore, amministratore (permesso di modifica) | Disponibile | Impostare la politica di cancellazione |
| Supplemento per ospite in più | Indica quanto chiedi a notte per ogni ospite oltre la capienza | Passo «Regole» | gestore, amministratore (permesso di modifica) | Disponibile | Vedi «Come funziona» |
| Prezzo di un singolo giorno | Prezzo e restrizioni di una data dal calendario | Calendario › clic su un giorno | gestore, amministratore | Disponibile | Vedi [[prenotazioni]] |

## Come funziona

**Come CasaZen calcola il prezzo di un soggiorno.** Lo stesso calcolo vale per il preventivo che vede l'ospite, per la prenotazione e per quello che vedi tu:
1. **Notte per notte.** Per ogni notte vale, nell'ordine: il prezzo che hai impostato per quella data (anche quello di un suggerimento che hai confermato); altrimenti il prezzo base con il supplemento weekend, se la notte comincia di venerdì o di sabato; altrimenti il prezzo base. Un prezzo scelto per una data vince su tutto: il supplemento weekend non si aggiunge.
2. **Sconto per soggiorni lunghi.** Se il soggiorno raggiunge una fascia, la percentuale di quella fascia (la più alta raggiunta) si toglie dal totale delle notti.
3. **Pulizia.** Si aggiunge una volta a soggiorno. Lo sconto non la tocca.
4. **Imposta di soggiorno.** Non è nel prezzo: si aggiunge alla prenotazione dove CasaZen conosce la tariffa del comune. Lo sconto non la tocca. La scheda del prezzo ti dice se per il tuo comune «abbiamo la tariffa» o «non è ancora disponibile» (vedi [[imposta-soggiorno-documenti]]).

*Esempio.* Prezzo base € 100,00, supplemento weekend 20%, pulizia € 50,00, sconto 10% da 7 notti. Un soggiorno di 7 notti da lunedì a lunedì ha 5 notti a € 100,00 e 2 notti weekend (venerdì e sabato) a € 120,00: € 740,00. Sconto 10%: − € 74,00. Pulizia: + € 50,00. Totale € 716,00, più l'imposta di soggiorno. Un soggiorno di 3 notti da venerdì ha 2 notti weekend e 1 normale: € 340,00 + pulizia € 50,00 = € 390,00.

**Dove stanno i prezzi.**
| Cosa | Dove lo imposti |
|---|---|
| Prezzo base, supplemento weekend, pulizia, soggiorno minimo, sconti | Procedura «Aggiungi immobile», passo «Prezzi» (si riapre da «Completa», da «Riprendi configurazione» o da «Modifica» nel «Riepilogo» dell'ultimo passo) |
| Prezzo per notte e pulizie (e deposito cauzionale) | Scheda dell'immobile › «Modifica» › «Modifica immobile» |
| Prezzo di una data o di un periodo, soggiorno minimo e massimo, arrivi e partenze chiusi, anticipo | Calendario (pannello del giorno) e «Cambia più giorni» |
| Stagioni e festività | «Suggerimenti stagionali» |
| Cosa rimborsi | Passo «Regole», «Se l'ospite cancella» |

**Soggiorno minimo.** Nella procedura va da 1 a 30 notti (1 = nessun minimo) e vale per le prenotazioni dal tuo sito: non limita le prenotazioni che inserisci tu. Per date particolari puoi impostare un minimo (da 1 a 365 notti) con «Cambia più giorni».

**Supplemento per ospite in più.** In «Regole» scrivi quanto chiedi a notte per ogni ospite oltre la capienza (da 0 a 1.000 €; vuoto = non accetti ospiti in più). Per ora gli ospiti lo leggono tra le regole: **non viene aggiunto da solo al prezzo del soggiorno**.

**Deposito cauzionale.** Nel modulo «Modifica immobile» c'è il campo «Deposito cauzionale» (da 0 a 50.000 €). È un dato della casa: CasaZen non lo somma al prezzo del soggiorno.

**Suggerimenti stagionali.** Sono prezzi proposti, calcolati dal prezzo base e dalle tue regole su stagioni e festività. Restano **proposte** finché non li confermi; quando confermi una notte, quel prezzo vale per quella data come un prezzo scelto da te. Se cambi il prezzo base dopo il calcolo, CasaZen te lo dice («I suggerimenti non sono aggiornati») e va ricalcolato.

**Calcolo con l'AI.** Parte dai dati della casa (ospiti, camere, metri quadri, dotazioni), dalla zona e, se ce ne sono almeno 3, dai prezzi delle case simili pubblicate su CasaZen nello stesso comune: mai l'indirizzo, mai i dati di altri gestori. È una stima: più sono completi i passi precedenti, più è precisa. Non cambia nulla senza il tuo sì.

**Cancellazione.** Scegli una delle politiche di CasaZen. Sotto ogni politica vedi cosa rimborsi in base ai giorni che mancano all'arrivo.

**Chi può fare cosa.** Leggere i prezzi richiede il permesso di lettura degli immobili. Cambiare prezzi, regole e cancellazione, e usare «Cambia più giorni», richiede il permesso di modifica degli immobili.

## Come fare

### Impostare il prezzo base e le regole di prezzo
Serve il permesso di modifica degli immobili.
1. Apri la procedura sul passo «Prezzi» («Quanto costa una notte?»): da **Affitti brevi › Immobili** premi «Completa» o «Riprendi configurazione». Per una casa già attiva apri l'ultimo passo e premi «Modifica» accanto a «Prezzi» nel «Riepilogo».
2. Scrivi il «Prezzo base per notte (€)»: da 1 a 100.000, solo numeri (per esempio 135 oppure 135,50). Vale per ogni notte. **Senza un prezzo l'immobile resta «Da completare»** e non si può attivare.
3. Se vuoi, scrivi il «Supplemento weekend (%)», da 0 a 100: si aggiunge al prezzo delle notti che cominciano di venerdì o di sabato. Se per una data c'è già un prezzo suo, vale quello. Vuoto = nessun supplemento.
4. Scrivi il «Costo della pulizia (€)», da 0 a 10.000: si paga una volta a soggiorno.
5. Imposta il «Soggiorno minimo», da 1 a 30 notti (1 = nessun minimo).
6. Premi «Continua».

Per cambiare solo il prezzo per notte o la pulizia di una casa già attiva puoi anche aprire la scheda, il menu «⋯» e «Modifica», poi «Aggiorna immobile».

> **Nota:** nel passo «Prezzi» leggi «Il prezzo base vale per ogni notte; nel Calendario vedi i prezzi che si applicano».

### Impostare gli sconti per soggiorni lunghi
1. Nel passo «Prezzi» vai a «Sconti per soggiorni lunghi» e premi «Aggiungi una fascia».
2. In «Fascia 1: da quante notti» scrivi un numero da 2 a 365. In «Fascia 1: sconto in %» scrivi una percentuale sopra 0 e fino a 100, per esempio 10.
3. Puoi aggiungere fino a 5 fasce. Due fasce non possono partire dalle stesse notti.
4. Per togliere una fascia premi «Togli». Se togli tutte le fasce, gli sconti spariscono.

Lo sconto si toglie dal soggiorno; pulizia e imposta di soggiorno non cambiano. Se un soggiorno raggiunge più fasce, vale quella con più notti. Lo sconto non cambia il prezzo di una singola notte nel calendario: vale sul soggiorno intero.

### Calcolare il prezzo con l'AI
Su attivazione: dipende da come è configurata la tua organizzazione.
1. Nel passo «Prezzi» leggi la domanda «Vuoi che calcoli io il prezzo con l'AI?» e premi «Calcola il prezzo». Se preferisci fare da solo premi «No, lo scrivo io» (puoi cambiare idea con «Calcolalo con l'AI»).
2. Rispondi a «Rispetto alle case simili della zona vuoi un prezzo…» con «Più basso», «In linea» o «Più alto».
3. Aspetta «Sto calcolando…». Vedi «Prezzo consigliato»: prezzo a notte, supplemento weekend, pulizia e soggiorno minimo, con «Di solito tra … e … per case come la tua in zona» e, sotto «Basato su», i dati usati. «Perché questo prezzo» spiega la stima.
4. Premi «Usa questi valori» per riempire i campi; poi controllali e premi «Continua». Se non ti convince premi «Lascio il mio» oppure «Cambia posizionamento».
5. Subito dopo l'uso puoi premere «Annulla» per tornare ai valori di prima.

> **Suggerimento:** per una stima più precisa indica prima i metri quadri (primo passo) e scegli le dotazioni (passo «Dotazioni»).
> **Nota:** se l'AI non risponde, CasaZen calcola il prezzo dalle case simili del comune («L'AI non ha risposto, quindi ho calcolato il prezzo dalle … case simili»). Se non ce ne sono abbastanza, o il calcolo è sospeso (per esempio «sospeso fino al prossimo mese»), scrivi tu il prezzo. È sempre una stima: confrontala con il Calendario e con quello che chiedono gli altri.

### Attivare e usare i suggerimenti stagionali
1. Apri la scheda dell'immobile e, in **Panoramica**, la sezione «Prezzi»: premi «Gestisci i suggerimenti». Si apre «Suggerimenti stagionali».
2. Se vedi «Manca il prezzo per notte» imposta prima il prezzo base («Modifica la struttura»).
3. Attiva «Attiva i suggerimenti stagionali». CasaZen calcola un prezzo suggerito per ogni notte dei prossimi 90 giorni partendo dal prezzo base. Non cambia i prezzi applicati.
4. Scegli «Aggiornamento dei suggerimenti»: «Ogni giorno» o «Ogni settimana».
5. In «Regole» imposta **Stagioni (mesi)**: scegli i mesi di «Alta stagione» e di «Bassa stagione» e, per ciascuna, il «Moltiplicatore» (tra 0,1 e 5; per esempio 1,3 per +30%). Accendi «Festività nazionali italiane» se vuoi il moltiplicatore sulle feste (Capodanno, Epifania, Pasqua, Pasquetta, 25 aprile, 1° maggio, 2 giugno, Ferragosto, 4 ottobre dal 2026, Ognissanti, Immacolata, Natale, Santo Stefano; nessun evento locale). Un giorno festivo prevale sulla stagione.
6. Premi «Salva regole», poi «Ricalcola ora» se non vuoi aspettare il prossimo aggiornamento («Alla prossima esecuzione notturna»).
7. Nell'elenco «Dettaglio per data» vedi per ogni notte «Suggerito», la «Regola applicata» e, se c'è, il prezzo «Applicato». Per confermare una notte premi «Applica»; se vuoi un altro prezzo, scrivilo nel campo prima di premere. Per confermarle tutte premi «Applica tutti i suggerimenti».

La regola iniziale è un esempio (estate +30%, inverno −20%, festività nazionali +50%): modificala in base alla tua casa. Per disattivare i suggerimenti spegni l'interruttore: senza suggerimenti il prezzo resta il prezzo base in ogni data.

### Cambiare prezzo e regole di più giorni e immobili
Serve il permesso di modifica degli immobili. Si apre dal **Calendario** con «Cambia più giorni».
1. **Immobili.** Scegli le case da toccare (al massimo 50 alla volta; «Scegli tutti» e «Togli la scelta» aiutano). Per ognuna leggi se è collegata al channel manager («la modifica viene inviata anche lì») o no («la modifica resta in CasaZen»).
2. **Periodo.** Scegli «Dal giorno» e «Al giorno» (al massimo 366 giorni; non solo giorni già passati) e i «Giorni della settimana» da toccare. Di solito sono tutti.
3. **Cosa cambia.** Per ciascuno di questi sette valori scegli «Lascia com'è», «Imposta» o «Togli la regola»; devi cambiarne almeno uno:
   - **Prezzo** a notte (da € 0,01 a € 100.000, al massimo due decimali);
   - **Soggiorno minimo** e **Soggiorno massimo** (da 1 a 365 notti; il massimo non può essere sotto il minimo);
   - **Arrivi** e **Partenze** (si chiudono con «Chiudi» e si riaprono con «Riapri»);
   - **Anticipo minimo** e **Anticipo massimo** (giorni di preavviso, da 0 a 730).
4. **Riepilogo.** Leggi «Controlla prima di applicare»: quanti giorni cambiano per casa, le prime modifiche «prima e dopo», le notti già occupate («la regola non cambia le prenotazioni») e i giorni già passati (non si toccano). «Non viene inviato nulla finché non premi «Applica le modifiche»».
5. Premi «Applica le modifiche». La modifica è tutta o niente: se qualcosa va storto leggi «Nulla è stato salvato: riprova.».
6. Vedi «Modifica salvata in CasaZen». Nel calendario i nuovi prezzi e le nuove restrizioni sono sui giorni.
7. Se la casa è collegata al channel manager, l'invio continua da solo: sopra il calendario vedi le «Ultime modifiche» con lo stato («In attesa di invio», «In invio», «Accettata dal tuo channel manager», «Confermata», «Non inviata»). Se una riga è «Non inviata» premi «Riprova ora».

Puoi uscire in ogni momento con «Salva ed esci»: la scelta resta salvata come bozza.

> **Attenzione:** cambiare un valore non modifica le prenotazioni già fatte. «Togli la regola» riporta il valore a quello consueto della casa.

### Impostare la politica di cancellazione
1. Apri il passo «Regole» della procedura (o il modulo «Modifica immobile»).
2. In «Se l'ospite cancella» scegli una delle politiche di CasaZen. Sotto ognuna leggi quanto rimborsi, contando i giorni prima dell'arrivo, per esempio «Rimborso totale fino a 7 giorni prima dell'arrivo; poi il 50% fino a 2 giorni prima; dopo, nessun rimborso».
3. Premi «Continua» (o «Aggiorna immobile»).

Se non scegli una politica, il rimborso totale vale fino a 7 giorni prima dell'arrivo; dopo, decidi tu caso per caso. Nel modulo «Modifica immobile» puoi anche usare «Personalizza rimborso» (ore per il rimborso totale e parziale, percentuale, «Non rimborsabile»); i soggiorni di 28 notti o più restano sulla politica di catalogo, senza questi cambi.

> **Nota:** se i pagamenti online sono attivi, gli ospiti possono anche chiedere di pagare in struttura: tu accetti o rifiuti ogni richiesta e, senza risposta, la richiesta scade.

## Flussi completi

### Flusso: dalla casa nuova al primo prezzo
1. Aggiungi l'immobile ([[immobili#aggiungere-un-immobile-con-la-procedura-guidata]]).
2. Al passo «Prezzi» scrivi il prezzo base o fatti proporre quello dell'AI ([[prezzi-tariffe#calcolare-il-prezzo-con-l-ai]]).
3. Imposti il soggiorno minimo e, se vuoi, gli sconti ([[prezzi-tariffe#impostare-gli-sconti-per-soggiorni-lunghi]]).
4. Scegli la politica di cancellazione.
5. Attivi la casa ([[immobili#attivare-un-immobile]]): da quel momento gli ospiti vedono i prezzi nel calendario del tuo sito ([[sito-prenotazione]]).

### Flusso: alta stagione su più case
1. Attivi i suggerimenti stagionali per ogni casa e controlli le notti proposte.
2. Per le date che ti convincono premi «Applica»; per le altre scrivi un altro prezzo.
3. Per un periodo uguale su più case (per esempio Ferragosto) usi «Cambia più giorni».
4. Se le case sono collegate al channel manager, controlli le «Ultime modifiche» finché non sono «Accettate» ([[canali-octorate]]).

## Regole e limiti
- Prezzo base: da € 1,00 a € 100.000,00 per notte. Supplemento weekend: da 0 a 100%. Pulizia: da € 0,00 a € 10.000,00. Soggiorno minimo nella procedura: da 1 a 30 notti.
- Sconti per soggiorni lunghi: al massimo 5 fasce, da 2 a 365 notti, percentuale sopra 0 e fino a 100.
- Il supplemento weekend si applica alle notti che cominciano di venerdì o di sabato e si calcola notte per notte, arrotondato al centesimo.
- Un prezzo scelto per una data prevale sul prezzo base e sul supplemento weekend.
- Lo sconto per soggiorni lunghi non si applica a pulizia e imposta di soggiorno e non cambia il prezzo di una singola notte nel calendario.
- «Cambia più giorni»: fino a 50 case e 366 giorni per volta; prezzo da € 0,01 a € 100.000; minimo e massimo da 1 a 365 notti; anticipo da 0 a 730 giorni. Non tocca i giorni passati né le prenotazioni già fatte.
- Moltiplicatore dei suggerimenti stagionali: da 0,1 a 5. I suggerimenti coprono i prossimi 90 giorni e si aggiornano ogni giorno o ogni settimana.
- Il calcolo con l'AI usa i prezzi delle case simili solo se ne esistono almeno 3 nello stesso comune. Non usa mai l'indirizzo né i dati di altri gestori.
- Il supplemento per ospite in più e il deposito cauzionale sono dati della casa: CasaZen non li somma da solo al prezzo del soggiorno.

## Domande frequenti

### Perché l'ospite vede un prezzo diverso dal mio prezzo base?
Perché il calendario applica, notte per notte, un eventuale prezzo scelto per la data, il supplemento weekend e, sul soggiorno, lo sconto per soggiorni lunghi. Il prezzo di ogni notte libera lo vedi nel calendario.

### I suggerimenti stagionali cambiano i miei prezzi da soli?
No. Sono proposte: valgono solo le notti che confermi con «Applica».

### Posso avere un prezzo diverso per una data speciale?
Sì, dal calendario (pannello del giorno) o con «Cambia più giorni» scegliendo «Imposta» su «Prezzo».

### Il prezzo include l'imposta di soggiorno?
No. L'imposta si aggiunge alla prenotazione dove CasaZen conosce la tariffa del comune.

### Se cambio il prezzo base, cambiano anche i prezzi già confermati?
No: le notti confermate (o scelte da te) tengono il loro prezzo. CasaZen ti avvisa che i suggerimenti non sono più aggiornati e vanno ricalcolati.

### Posso mettere un soggiorno minimo diverso in estate?
Sì: in «Cambia più giorni» imposta «Soggiorno minimo» sul periodo e sui giorni della settimana che vuoi.

### Perché il calcolo con l'AI non parte?
Può non essere attivo per la tua organizzazione, essere sospeso per il mese, o non avere una risposta affidabile: in tutti i casi scrivi tu il prezzo (leggi il messaggio mostrato).

## Glossario
- **Prezzo base**: prezzo di una notte quando non c'è nessun'altra regola.
- **Supplemento weekend**: percentuale in più sulle notti che cominciano di venerdì o di sabato.
- **Fascia di sconto**: sconto per soggiorni lunghi a partire da un certo numero di notti.
- **Suggerimento stagionale**: prezzo proposto per una notte secondo stagioni e festività.
- **Moltiplicatore**: numero per cui si moltiplica il prezzo base (1,3 = +30%).
- **Restrizioni**: soggiorno minimo e massimo, arrivi e partenze chiusi, anticipo minimo e massimo.

## Vedi anche
- [[immobili]]: procedura «Aggiungi immobile», scheda e attivazione.
- [[canali-octorate]]: come prezzi e restrizioni arrivano al channel manager.
- [[prenotazioni]]: calendario e prezzo di un singolo giorno.
- [[imposta-soggiorno-documenti]]: imposta di soggiorno.
- [[sito-prenotazione]]: come gli ospiti vedono prezzi e disponibilità.
