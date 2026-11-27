---
id: affitti-lunghi
titolo: Affitti lunghi: panoramica e immobili
sezione: Affitti lunghi
ordine: 60
riassunto: L'area per le case affittate con un contratto: la Panoramica ti dice cosa fare oggi, gli Immobili raccolgono case, APE e dati catastali, e da qui apri il report fiscale, le spese condominiali e gli interventi.
chi: [gestore, amministratore]
dove: Affitti lunghi › Panoramica
parole_chiave: [affitti lunghi, panoramica, immobili, APE, dati catastali, cambio modalità, passaggio affitto breve, report fiscale, spese condominiali, interventi, assistenza, manutenzione, cedolare secca]
copre: [/app/long-rent, /app/long-rent/properties, /app/long-rent/properties/new, /app/long-rent/properties/:id, /app/long-rent/properties/:id/edit, /app/long-rent/properties/:id/mode, /app/long-rent/fiscal, /app/long-rent/payments, /app/long-rent/service-requests, /app/long-rent/service-requests/:id, /app/long-rent/settings, /app/long-rent/settings/organization, /app/long-rent/settings/invitations, /app/long-rent/settings/plan, /app/long-rent/settings/billing, /app/long-rent/profile]
stato: disponibile
fonte_codice: [frontend/src/features/leases/overview/long-rent-overview-page.tsx, frontend/src/features/leases/overview/overview-model.ts, frontend/src/features/leases/overview/now-block.tsx, frontend/src/features/leases/overview/rent-numbers.tsx, frontend/src/features/leases/overview/upcoming-deadlines.tsx, frontend/src/features/onboarding/components/long-rent-guide.tsx, frontend/src/features/properties/long-rent, frontend/src/features/properties/mode/property-mode-wizard-page.tsx, frontend/src/features/leases/fiscal/long-rent-fiscal-page.tsx, frontend/src/features/leases/landlord-payments-page.tsx, frontend/src/features/condominium/condominium-management.tsx, frontend/src/features/service-requests/long-rent, frontend/src/pages/long-rent, backend/Casazen.Core/Leases/LongRentRules.cs, backend/Casazen.Core/Leases/LongRentDeadlineRules.cs]
---

## In breve
L'area **Affitti lunghi** è per chi affitta case con un contratto di locazione (canone libero 4+4, canone concordato 3+2, transitorio) e non a notti. La **Panoramica** è la pagina di partenza: ti mostra l'unico passo che non può aspettare, i contratti per stato, i canoni del mese e le prossime scadenze. Per fare un contratto ti servono prima la casa, il suo APE e i suoi dati catastali: li inserisci in **Immobili**.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Panoramica | Dice cosa fare adesso e riassume contratti, canoni del mese e scadenze | Affitti lunghi › Panoramica | gestore, amministratore (chi può leggere i contratti) | Disponibile | Capire cosa fare oggi dalla Panoramica |
| Elenco immobili | Le tue case in affitto lungo, con inquilino, canone, APE e dati catastali | Affitti lunghi › Immobili | gestore, amministratore | Disponibile | Aggiungere un immobile in affitto lungo |
| Nuovo immobile | Procedura in quattro passi: indirizzo, dati catastali, APE, riepilogo | Immobili › «Aggiungi immobile» | chi può modificare gli immobili | Disponibile | Aggiungere un immobile in affitto lungo |
| Scheda dell'immobile | Contratti collegati, dati, documenti, spese condominiali, manutenzione e interventi | Immobili › apri la riga › «Scheda completa» | gestore, amministratore | Disponibile | Completare APE e dati catastali |
| Modifica immobile | Cambia i dati della casa | Scheda dell'immobile › «Modifica» | chi può modificare gli immobili | Disponibile | Modificare un immobile |
| Cambio di modalità | Passa una casa da affitto breve a lungo, o il contrario, in un giorno scelto | Procedura «Che cosa vuoi fare con questo immobile?» | chi può modificare gli immobili | Disponibile | Passare un immobile da affitto breve ad affitto lungo |
| Report fiscale | Canoni dell'anno e imposte stimate per contratto, da portare al commercialista | Affitti lunghi › Report fiscale | gestore, amministratore (chi può leggere i contratti) | Disponibile | Leggere il report fiscale e scaricare il riepilogo |
| Spese condominiali | Registro delle spese del condominio per ogni casa, anche senza contratto | Affitti lunghi › Spese condominiali | gestore, amministratore | Disponibile | Registrare le spese condominiali |
| Interventi | Riparazioni e manutenzione affidate a un fornitore, dalla richiesta al pagamento | Immobili › scheda › «Interventi» e «Vedi tutti gli interventi» | gestore, amministratore | Disponibile | Chiedere un intervento a un fornitore |
| Impostazioni dell'area | Organizzazione, «Consiglia CasaZen», piano e fatturazione | Impostazioni (in fondo al menu) | amministratore | Disponibile | Vedi [[account-team-piano]] |

## Come funziona

### A chi serve e come ci si arriva
L'area è quella del **locatore**: la persona (o l'agenzia) che affitta una casa a un **conduttore** (l'inquilino) con un contratto. Ci entri dal menu dell'app scegliendo l'area **Affitti lunghi**. Le voci del suo menu sono:
- **Panoramica**: la pagina di partenza;
- **Immobili**: le case, e dentro ogni casa i suoi contratti;
- **Report fiscale**;
- **Spese condominiali**;
- **Impostazioni**, in fondo.

I contratti non hanno una voce di menu: si aprono dalla scheda della casa, nella scheda «Contratti». Anche **Canoni**, **Scadenze** e **Inquilini** si raggiungono da link (dalla Panoramica e dalle schede): li trovi spiegati in [[canoni-scadenze]]. Un vecchio indirizzo dell'elenco dei contratti porta da solo alla casa giusta, se conosce la casa, oppure all'elenco degli immobili.

### La Panoramica
La pagina ti saluta per nome («Buongiorno, …») e riassume la giornata.
- In alto, se puoi creare contratti, c'è il pulsante «Crea contratto». Se puoi modificare gli immobili c'è anche «Aggiungi immobile».
- **Se non hai ancora nessun contratto** vedi solo la guida «Inizia da qui», con due passi: «Aggiungi il tuo primo immobile» e «Crea il primo contratto di locazione». Sotto il titolo vedi quanti passi hai già fatto («1 di 2 passi completati»).
- **Se hai almeno un contratto** vedi quattro blocchi:
  - **Adesso**: il passo che non può aspettare (per esempio un canone in ritardo, la registrazione di un contratto, la copia firmata da caricare). Se non c'è nulla vedi «Niente di urgente». Il pulsante «Apri il contratto» ti porta al punto giusto.
  - **I tuoi contratti**: quattro contatori, «Attivi», «In preparazione», «In scadenza» e «Terminati». Il link «Apri gli immobili» porta all'elenco delle case.
  - **Canoni di [mese]**: «Incassati a [mese]» (con il confronto «su … attesi»), «In ritardo» e «Ancora da incassare». Il link «Vai ai canoni» apre la pagina dei canoni.
  - **Scadenze**: le date dei prossimi quattro mesi (registrazioni, fine contratto, disdette, canoni). Con «Vedi tutte» apri la pagina completa. Se non c'è nulla vedi «Nessuna scadenza nei prossimi 4 mesi».

Tutti i numeri li calcola CasaZen: la pagina non fa conti suoi.

### Immobili: cosa serve per poter fare un contratto
L'elenco **Immobili** mostra le case in affitto lungo. Ogni riga ha: casa, inquilino, canone, stato, APE, dati catastali, camere e bagni. I filtri rapidi sono «Tutti», «Affittati» (con un contratto registrato e in corso) e «Liberi» (senza un contratto registrato e in corso, anche se ne hai uno in preparazione). La ricerca cerca per nome, indirizzo o inquilino.

Per **creare un contratto in CasaZen** la casa deve avere:
- l'**APE** (attestato di prestazione energetica), con il suo codice e la sua classe;
- i **dati catastali**: foglio, particella, subalterno e, per essere completi, categoria catastale e rendita.

Nell'elenco vedi se mancano: «APE mancante», «APE da confermare» o «APE B» (la classe letta); «Completi» o «Da completare» per i dati catastali. Nella scheda di una casa libera il blocco «Crea il contratto» ricorda che servono l'APE e i dati catastali; se l'APE manca, la scheda avvisa «Nessun APE caricato… caricalo qui sotto». Per un **contratto già firmato** APE e dati catastali mancanti sono solo un avviso: non ti fermano.

### Come si legge la scheda di una casa
La scheda ha sei sezioni:
- **Contratti**: i contratti collegati, con il pulsante «Nuovo contratto». È qui che si trova l'elenco dei contratti della casa.
- **Dati**: indirizzo, descrizione, camere e bagni, e i dati catastali (con «Modifica»).
- **Documenti**: l'APE e gli altri documenti della casa.
- **Spese condominiali**: la situazione condominiale della casa (acconti e conguagli del contratto in corso). I canoni restano nel contratto.
- **Manutenzione**: le richieste di manutenzione del conduttore; vedi [[area-inquilino#approvare-o-rifiutare-una-richiesta-di-manutenzione]].
- **Interventi**: i lavori affidati ai fornitori per questa casa.

Una casa libera ha il blocco «Crea il contratto» (con la ricordata necessità di APE e dati catastali). Una casa con un contratto in corso o in preparazione mostra lo stato del contratto e i link «Verifica i canoni» e «Apri l'elenco degli inquilini».

### Passare da affitto breve ad affitto lungo (e ritorno)
Una casa può stare in **Affitti brevi** (prenotazioni, sito di prenotazione) oppure in **Affitti lunghi** (contratti, canoni). Il passaggio è una procedura con una data:
1. scegli la direzione: «Passa all'affitto lungo» oppure «Passa all'affitto breve»;
2. scegli il giorno («Primo giorno in affitto lungo» o «Primo giorno in affitto breve»): CasaZen ti dice da quando puoi partire e perché;
3. leggi cosa succede e confermi. Ricevi una e-mail di conferma.

Cosa blocca il passaggio, e quindi la data più vicina possibile:
- verso l'**affitto lungo**: i soggiorni già prenotati e le date occupate dai portali che finiscono dopo quel giorno, e le bozze di contratto (vanno eliminate prima). Si può partire dal giorno dopo l'ultimo soggiorno;
- verso l'**affitto breve**: i contratti che finiscono dopo quel giorno e le bozze di contratto. Si può partire dal giorno dopo la fine del contratto, e il contratto in scadenza deve avere la disdetta registrata, altrimenti si rinnova da solo e il passaggio non riesce.

Cosa succede, verso l'affitto lungo: da subito il sito e i portali non accettano più prenotazioni con partenza dal giorno scelto in poi; dal giorno scelto il sito non mostra più la casa; i soggiorni già prenotati che finiscono prima restano validi. Cosa succede, verso l'affitto breve: fino a quel giorno contratti e canoni restano come sono; per accettare prenotazioni dovrai completare l'annuncio (prezzi, ospiti e CIN). **Puoi annullare il passaggio fino al giorno prima** con «Annulla il passaggio».

### Il report fiscale
Il **Report fiscale** elenca, per un anno che scegli, i contratti in vigore con i canoni di competenza e l'imposta stimata. È pensato per darlo al commercialista, e dice chiaramente che è una **stima da validare**: non tiene conto di altri redditi, detrazioni e addizionali.
- «Canoni [anno] di competenza» conta **mesi interi** (per esempio «12 mesi × € 650,00 al mese»).
- «Incassati registrati in CasaZen» somma solo gli incassi che hai registrato (o confermato) in CasaZen; se la registrazione è iniziata più tardi vedi «registrati dal [mese]».
- «Cedolare secca stimata» c'è solo per i contratti con la cedolare secca (con l'aliquota usata). Per un contratto con regime ordinario vedi «Non stimata: dipende dal reddito complessivo»; se il regime non è registrato, «regime fiscale non registrato».
- Il pulsante «Scarica il riepilogo [anno]» scarica il file dell'anno.

### Spese condominiali
La pagina **Spese condominiali** è il tuo registro: ci scrivi ciò che devi al condominio per ogni casa, anche libera e senza canoni configurati. CasaZen **non paga** niente: paghi tu dal tuo home banking e poi segni qui il pagamento. Ti arriva un promemoria per e-mail nei cinque giorni prima della scadenza.

Per ogni casa:
- **Attiva gestione condominiale**: scegli «Carica i documenti» (preventivo, consuntivo e ripartizione rate dell'amministratore: li leggiamo e controlli i dati prima di confermarli) oppure «Imposta manualmente».
- Quattro viste: **Panoramica**, **Pagamenti** (scadenze e versamenti, con «Registra pagamento»), **Resoconti** (conto dell'anno, rate, documenti) e **Impostazioni** (casa ed esercizi).
- **Preventivo e piano rate**: inserisci la quota annuale del tuo appartamento, ordinaria e straordinaria, e la frequenza (mensile, bimestrale, trimestrale, semestrale, unica soluzione o scadenze personalizzate). Le rate già emesse mantengono i loro importi.
- **Consuntivo e conguaglio**: a fine anno inserisci il consuntivo e scegli come regolare il conguaglio («Nella prossima rata», «Con rata separata», «Rimborso del credito», «Riporto all'esercizio successivo»). Puoi anche registrare il «Saldo precedente».
- **Importa estratto conto**: carichi il file della banca (Excel o CSV), selezioni i versamenti al condominio e controlli la rata di destinazione. Nessun movimento viene registrato in automatico.
- Un archivio per scaricare i resoconti di tutti gli anni.

La quota del conduttore (acconto condominiale e conguaglio) si somma al canone nelle rate: vedi [[canoni-scadenze]].

### Interventi (richieste di assistenza)
Gli **Interventi** sono i lavori di riparazione e manutenzione che affidi a un fornitore (idraulico, elettricista, pulizie). Dalla scheda di una casa, o dalla pagina degli interventi, premi «Richiedi intervento»: scegli la casa («Per quale immobile?») e poi indichi cosa serve e scegli il fornitore. Per chiedere un intervento serve almeno una casa in affitto lungo.

La pagina elenca gli interventi con le schede «Aperti», «Chiusi» e «Tutti», e una ricerca per tipo, casa o fornitore. Aprendo un intervento vedi sempre il **prossimo passo** e a chi tocca:
- **In attesa che il fornitore risponda**: ha un tempo per rispondere; puoi premere «Sollecita».
- **Il fornitore propone un altro orario**: «Accetta l'orario» oppure «Rifiuta» (se rifiuti, la richiesta resta in attesa di un'altra risposta).
- **Il fornitore non è disponibile**: «Invia a un altro fornitore»; i dati restano compilati.
- **Intervento confermato** e poi **Il fornitore è al lavoro**.
- **Conferma l'importo finale**: se il fornitore chiede più del preventivo devi confermarlo prima di poter pagare.
- **Lavoro fatto: resta il pagamento**: «Paga [importo]» con la carta, senza uscire da CasaZen (il pagamento è elaborato da Stripe e l'intervento risulta pagato quando Stripe lo conferma), oppure «Segna come pagato» se il pagamento è fuori da CasaZen (CasaZen registra solo che l'hai fatto, non paga lui).
- **Intervento concluso e pagato**: puoi chiederlo di nuovo con «Richiedi di nuovo».

Con «Annulla intervento» scrivi il motivo (il fornitore lo legge e riceve subito un avviso). Un intervento annullato **non si riapre**: per riavere il lavoro lo richiedi di nuovo. Se il lavoro era già iniziato, accordatevi direttamente con il fornitore.

Come funzionano i fornitori e i loro prezzi lo spiega [[marketplace]].

### Impostazioni dell'area
In fondo al menu trovi **Impostazioni**, con le schede **Organizzazione**, **Consiglia CasaZen** (invita altri gestori), **Piano** e **Fatturazione**. Sono le stesse impostazioni dell'account: le spiega [[account-team-piano]]. Il **Profilo** dell'utente è spiegato in [[account-team-piano]].

## Come fare

### Capire cosa fare oggi dalla Panoramica
1. Apri **Affitti lunghi › Panoramica**.
2. Leggi il blocco **Adesso**: è l'unica cosa da fare subito. Premi «Apri il contratto» (o il pulsante indicato) per farla.
3. Guarda **Canoni di [mese]**: se vedi canoni «In ritardo», premi «Vai ai canoni» e poi segui [[canoni-scadenze#inviare-un-sollecito]].
4. Guarda **Scadenze**: premi «Vedi tutte» per l'elenco completo.

Se vedi «Niente di urgente» non devi fare niente.

### Aggiungere un immobile in affitto lungo
Serve il permesso di modificare gli immobili.
1. Apri **Affitti lunghi › Immobili** e premi «Aggiungi immobile» (oppure dalla Panoramica «Aggiungi immobile»).
2. Passo **Indirizzo**: scrivi il nome (lo vedi solo tu), il comune e l'indirizzo, e se serve la scala o l'interno. Comune e indirizzo vanno nel contratto.
3. Passo **Dati catastali**: scrivi foglio, particella e subalterno (li trovi nella visura catastale o nell'atto d'acquisto). Se non li hai sottomano, salta il passo: li aggiungi dopo.
4. Passo **APE**: carica il file dell'attestato (PDF) oppure le foto delle pagine. Se carichi foto, controlla l'ordine delle pagine e confermalo, oppure toglile: CasaZen le unisce in un solo PDF.
5. Passo **Riepilogo** («Controlla e aggiungi»): ricontrolla le risposte. Ognuna si può correggere. Poi premi «Aggiungi immobile».
6. Aspetta: «Stiamo aggiungendo l'immobile e leggendo l'APE: può volerci un minuto. Non chiudere la pagina.»

Cosa vedi dopo: la schermata «Immobile aggiunto», con i pulsanti «Crea il contratto» e «Apri l'immobile» e, se serve, l'elenco «Per creare il contratto manca ancora».

Errori comuni:
- «Esiste già un immobile con questo indirizzo e questo interno»: torna al primo passo e indica l'interno o la scala.
- L'APE caricato risulta scaduto: serve un APE in corso di validità.
- Codice e classe dell'APE non si leggono dal file: li scrivi tu nel campo che compare, come sono stampati sull'attestato (la classe va da A4, la migliore, a G).

### Completare APE e dati catastali
1. Apri **Immobili**, scegli la casa e apri la «Scheda completa».
2. Per i dati catastali apri la scheda **Dati**, premi «Modifica» accanto a «Dati catastali» e compila «Foglio», «Particella», «Subalterno», «Categoria catastale» (per esempio A/2) e «Rendita catastale (€)». Premi «Salva».
3. Per l'APE apri la scheda **Documenti** e carica l'attestato. Se CasaZen non riesce a leggere codice e classe, scrivili tu.
4. Torna a **Immobili**: nelle colonne APE e Dati catastali non devi più vedere avvisi.

Senza questi dati un contratto fatto in CasaZen si ferma prima della revisione; vedi [[contratti#creare-un-contratto-con-casazen]].

### Modificare un immobile
1. Apri **Immobili**, scegli la casa e premi «Modifica» (dalla riga o dalla scheda).
2. Cambia i dati e salva.

### Passare un immobile da affitto breve ad affitto lungo
Serve il permesso di modificare gli immobili. Prima chiudi ciò che occupa la casa: bozze di contratto e soggiorni o date dei portali che durano oltre il giorno scelto.
1. Apri la procedura di cambio di modalità della casa (per i dettagli sulla scheda dell'immobile in affitto breve vedi [[immobili]]).
2. Scegli «Passa all'affitto lungo».
3. Scegli «Primo giorno in affitto lungo». CasaZen mostra l'intervallo possibile («Puoi scegliere da … a …») e, se un giorno non va bene, perché: puoi aprire la prenotazione o il contratto che lo blocca.
4. Leggi «Cosa succede» e conferma.

Reversibile: sì, con «Annulla il passaggio», fino al giorno prima della data scelta. Dopo, la casa è nell'altra area.

### Passare un immobile da affitto lungo ad affitto breve
1. Se c'è un contratto in corso, aprilo e **registra prima la disdetta** (vedi [[contratti#registrare-una-disdetta]]): senza disdetta il contratto si rinnova da solo e il passaggio non riesce.
2. Dalla scheda del contratto in scadenza apri il menu e scegli «Passa ad affitto breve», poi «Vai al cambio di modalità». CasaZen indica il primo giorno possibile: il giorno dopo la fine del periodo in corso.
3. Scegli «Passa all'affitto breve», il giorno e conferma.

Dopo il passaggio la casa compare in Affitti brevi e, per accettare prenotazioni, devi completare l'annuncio.

### Leggere il report fiscale e scaricare il riepilogo
1. Apri **Affitti lunghi › Report fiscale**.
2. Scegli l'**Anno**.
3. Leggi in alto «Riepilogo dell'anno» e sotto la tabella con una riga per contratto: «Regime», «Competenza», «Incassati registrati», «Imposta stimata».
4. Leggi «Stima da validare con il commercialista» e «Da sapere».
5. Premi «Scarica il riepilogo [anno]» e passa il file al tuo commercialista.

Se vedi «Nessun contratto in vigore nel [anno]», premi «Vai ai contratti»: il report si compila appena un contratto firmato è in vigore.

> **Attenzione:** il report è una stima, non una dichiarazione. Gli importi veri dipendono dai tuoi altri redditi: verifica con il commercialista.

### Registrare le spese condominiali
1. Apri **Affitti lunghi › Spese condominiali** e, nel selettore «Appartamento», scegli la casa.
2. Se la casa non ha ancora una gestione, scrivi il «Nome del condominio» e il «Primo mese dell'esercizio condominiale», e premi «Attiva gestione condominiale». Scegli come iniziare: «Carica i documenti» o «Imposta manualmente».
3. Per il preventivo premi «Aggiungi il preventivo» (o apri «Preventivo e piano rate»), scrivi la «Quota ordinaria annuale (€)» (e la straordinaria, se c'è), scegli la «Frequenza delle rate al condominio» e premi «Conferma preventivo».
4. Quando paghi una rata dal tuo home banking, apri **Pagamenti** › «Registra pagamento», scegli la rata, scrivi «Importo versato (€)» e «Data del versamento» e salva. Anche un versamento parziale va bene.
5. A fine anno inserisci il consuntivo («Conferma consuntivo») e scegli come regolare il conguaglio.

Per segnare come pagata una scadenza di una casa premi «Segna come pagato» e poi «Conferma pagamento effettuato»: serve il permesso di modificare gli immobili. CasaZen non avvia nessun pagamento.

### Chiedere un intervento a un fornitore
1. Apri **Immobili** e, nella riga della casa, premi «Richiedi intervento» (oppure, in **Interventi**, «Richiedi intervento»).
2. Scegli l'immobile e premi «Continua».
3. Indica cosa serve e scegli il fornitore, seguendo i passi della procedura (la descrive [[marketplace]]).
4. Invia la richiesta: il fornitore la riceve con la casa e l'orario già pronti.

### Seguire un intervento fino al pagamento
1. Apri **Interventi** e premi «Apri» sulla riga.
2. Leggi il riquadro **Prossimo passo**: dice a chi tocca («Tocca a te» o «Tocca al fornitore») e cosa fare.
3. Se tocca a te, premi il pulsante del riquadro («Accetta l'orario», «Conferma l'importo», «Paga» o «Segna come pagato»).
4. A lavoro finito e pagato l'intervento passa tra i **Chiusi**.

## Flussi completi

### Flusso: dalla casa vuota al primo contratto
1. Aggiungi la casa con tutti i passi ([[affitti-lunghi#aggiungere-un-immobile-in-affitto-lungo]]) e controlla che APE e dati catastali siano a posto.
2. Dalla casa premi «Crea contratto» e segui [[contratti#creare-un-contratto-con-casazen]] (oppure [[contratti#caricare-un-contratto-gia-firmato]] se hai già il contratto firmato).
3. Fai firmare il contratto e carica la copia firmata ([[contratti#far-firmare-il-contratto-e-caricare-la-copia-firmata]]).
4. Registra il contratto entro la scadenza ([[contratti#registrare-il-contratto]]).
5. Attiva il piano dei canoni e segui gli incassi ([[canoni-scadenze#attivare-il-piano-dei-canoni]]).
6. Il conduttore entra nella sua area con la sua e-mail ([[area-inquilino]]).

### Flusso: fine del contratto e ritorno agli affitti brevi
1. Registri la disdetta o il recesso del conduttore ([[contratti#registrare-una-disdetta]], [[contratti#registrare-il-recesso-del-conduttore]]).
2. Concordi la riconsegna e restituisci la cauzione ([[contratti#restituire-la-cauzione]]).
3. Il contratto finisce; dalla scheda scegli «Passa ad affitto breve» e imposti il giorno.
4. Completi l'annuncio per le prenotazioni (vedi [[immobili]]).

## Regole e limiti
- Per creare un contratto in CasaZen servono APE (con codice e classe) e dati catastali della casa. Per un contratto già firmato mancano solo gli avvisi.
- Una casa in affitto breve non si può usare in un contratto lungo: deve prima passare in affitto lungo.
- Due contratti non possono coprire gli stessi giorni sulla stessa casa.
- Il passaggio di modalità non parte il giorno stesso: va scelto un giorno non prima del primo giorno possibile mostrato; si annulla fino al giorno prima.
- Il report fiscale è una stima: conta mesi interi e usa solo gli incassi registrati in CasaZen.
- Le spese condominiali registrate qui non muovono denaro.
- Un intervento annullato non si riapre; un intervento pagato online è «pagato» solo quando Stripe lo conferma.
- Chi vede cosa: la Panoramica, il report fiscale e i contratti richiedono il permesso di lettura dei contratti; le case, il permesso di lettura degli immobili; aggiungere e modificare case, il permesso di modifica degli immobili; creare e modificare contratti, il permesso di creare i contratti.

## Domande frequenti

### Perché non riesco a creare il contratto?
Quasi sempre manca qualcosa alla casa: l'APE (con codice e classe), i dati catastali, oppure la casa è ancora in affitto breve. Apri la scheda della casa: la colonna APE e quella dei dati catastali ti dicono cosa manca.

### Dove vedo l'elenco dei miei contratti?
Nella scheda **Contratti** di ogni casa (Immobili › casa › Contratti). Nella Panoramica vedi solo i contatori.

### Il report fiscale sostituisce il commercialista?
No. È una stima dei canoni dell'anno e dell'imposta, pronta da portare al commercialista, che la deve validare.

### CasaZen paga le spese del condominio per me?
No. Le spese condominiali sono un registro: paghi tu dal tuo home banking e poi lo segni.

### Posso tenere la stessa casa in affitto breve e lungo?
Non nello stesso periodo. La casa sta in una sola area alla volta: il passaggio si programma con un giorno.

## Glossario
- **Locatore**: chi affitta la casa. **Conduttore**: chi la prende in affitto (l'inquilino).
- **APE**: attestato di prestazione energetica; classe da A4 a G.
- **Dati catastali**: foglio, particella, subalterno, categoria e rendita della casa.
- **Cedolare secca**: imposta sostitutiva sul canone, al posto dell'imposta sul reddito, dell'imposta di registro e del bollo.
- **Acconto condominiale e conguaglio**: la quota di spese condominiali pagata a rate insieme al canone e la differenza che si regola a fine anno.
- **Esercizio condominiale**: l'anno di gestione del condominio, che può non coincidere con l'anno solare.

## Vedi anche
- [[contratti]]: come creare, firmare e registrare un contratto.
- [[canoni-scadenze]]: canoni, incassi, solleciti, scadenze e inquilini.
- [[area-inquilino]]: cosa vede il conduttore e le richieste di manutenzione.
- [[immobili]]: gli immobili in affitto breve e il passaggio di modalità.
- [[account-team-piano]]: impostazioni, team e piano.
- [[marketplace]]: i fornitori a cui affidi gli interventi.
