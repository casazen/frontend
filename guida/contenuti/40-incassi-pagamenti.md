---
id: incassi
titolo: Incassi e pagamenti
sezione: Incassi e fisco
ordine: 40
riassunto: Come incassi i soldi delle prenotazioni (carta, bonifico, contanti), come colleghi Stripe, come registri un incasso, rimborsi un ospite e leggi i ricavi.
chi: [gestore, amministratore]
dove: Affitti brevi › Incassi
parole_chiave: [incassi, pagamenti, Stripe, Stripe Connect, carta, bonifico, contanti, link di pagamento, rimborso, cancellazione, cauzione, saldo, acconto, ricavi, da incassare]
copre: [/app/short-rent/payments, /app/short-rent/payments/revenue, /app/short-rent/payments/create, /app/short-rent/payments/:id, /app/short-rent/settings/payments]
stato: disponibile
fonte_codice: [frontend/src/features/payments/payments-page.tsx, frontend/src/features/payments/payments-list.tsx, frontend/src/features/payments/lib/payment-list.ts, frontend/src/features/payments/payment-detail-page.tsx, frontend/src/features/payments/payment-create-page.tsx, frontend/src/features/payments/components/record-payment-form.tsx, frontend/src/features/payments/components/refund-dialog.tsx, frontend/src/features/payments/components/payment-ledger-period.tsx, frontend/src/features/payments/components/payment-ledger-table.tsx, frontend/src/features/payments/revenue-page.tsx, frontend/src/lib/revenue-analytics.ts, frontend/src/features/settings/payments-page.tsx, backend/Casazen.Web/Controllers/ConnectController.cs, backend/Casazen.Infrastructure/Services/ManualPaymentService.cs, backend/Casazen.Infrastructure/Services/BookingPaymentLinkService.cs, backend/Casazen.Infrastructure/Services/BookingCancellationService.cs, backend/Casazen.Core/Services/CancellationRefundPolicy.cs, backend/Casazen.Core/Services/DirectBookingPaymentRules.cs]
---

## In breve
In **Affitti brevi › Incassi** trovi tutti i pagamenti delle tue prenotazioni: quelli arrivati, quelli ancora da incassare e i rimborsi. Gli ospiti del tuo sito pagano con carta tramite **Stripe**, e i soldi vanno direttamente sul tuo conto Stripe: CasaZen non li trattiene. I pagamenti ricevuti fuori da CasaZen (contanti, bonifico) li registri tu con «Registra incasso».

Per far pagare online gli ospiti serve collegare **Stripe** in **Impostazioni › Stripe Connect**. Finché l'account non è «Attivo», il tuo sito di prenotazione non può prendere pagamenti.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Elenco dei pagamenti | Mostra incassi, pagamenti da incassare e rimborsi, con i numeri del mese | Incassi | gestore, amministratore | Disponibile | Controllare cosa hai incassato e cosa aspetti |
| Registro per prenotazione e periodo | Una riga per ogni incasso, con commissione, netto, giorno di accredito e documento fiscale | Incassi › «Per prenotazione e periodo» | gestore, amministratore | Disponibile | Vedere gli incassi di un periodo con commissioni e accrediti |
| Dettaglio di un pagamento | Importo, metodo, stato, rimborsi e cronologia | Incassi › apri un pagamento | gestore, amministratore | Disponibile | Trovare un pagamento |
| Registra incasso | Segna un pagamento ricevuto fuori da CasaZen (contanti o bonifico) | Incassi › menu della riga › «Registra incasso», oppure dalla prenotazione | gestore, amministratore | Disponibile | Registrare un incasso ricevuto fuori da CasaZen |
| Link di pagamento | Manda all'ospite un link per pagare il saldo con la carta | Scheda della prenotazione › «Link di pagamento» | gestore, amministratore | Disponibile | Inviare il link di pagamento a un ospite |
| Collegamento a Stripe | Collega il conto che riceve i pagamenti online degli ospiti | Impostazioni › Stripe Connect | amministratore | Disponibile | Collegare Stripe per ricevere i pagamenti online |
| Rimborso di un pagamento con carta | Restituisce all'ospite tutto o parte di un pagamento fatto con carta | Incassi › apri il pagamento › «Rimborsa» | gestore, amministratore | Disponibile | Rimborsare un pagamento fatto con carta |
| Annullamento con rimborso | Annulla la prenotazione e rimborsa l'ospite secondo la politica di cancellazione | Scheda della prenotazione › «Annulla prenotazione» | gestore, amministratore | Disponibile | Annullare una prenotazione e rimborsare chi ha pagato |
| Politica di cancellazione | Dice quanto rimborsi e fino a quando | Immobili › modifica › regole della casa | gestore, amministratore | Disponibile | Scegliere la politica di cancellazione di un immobile |
| Ricavi | Somma i pagamenti completati per periodo | Incassi › Ricavi | gestore, amministratore | Disponibile | Vedere i ricavi |

## Come funziona

### Come pagano gli ospiti
Ci sono quattro modi, a seconda di come arriva la prenotazione.

- **Dal tuo sito di prenotazione.** L'ospite paga online con la carta, con il pagamento sicuro di Stripe. Può scegliere tra tre opzioni:
  - **Paga ora**: paga subito tutto l'importo.
  - **Paga alla scadenza**: oggi non paga nulla. CasaZen salva la carta e addebita l'importo nel giorno in cui scade la cancellazione gratuita. Si può scegliere solo se quel giorno è ancora nel futuro; senza una politica di cancellazione significa soltanto per arrivi a più di 7 giorni di distanza.
  - **Paga in struttura**: l'ospite non paga online. È una **richiesta**: l'ospite conferma il suo indirizzo e-mail, poi tu la accetti o la rifiuti. Se non rispondi, la richiesta scade (per impostazione predefinita dopo 24 ore) e non vale per soggiorni molto lunghi (per impostazione predefinita, oltre 30 notti). Quando l'ospite arriva e paga, l'incasso lo registri tu.
- **Prenotazione inserita da te.** Nel passo «Pagamento» della nuova prenotazione scegli tra «Link di pagamento» (l'ospite riceve una e-mail e paga il saldo con la carta; l'incasso si registra da solo), «Bonifico» (l'ospite ti paga con un bonifico e quando arriva registri tu l'incasso) e «Paga in struttura» (registri tu l'incasso quando l'ospite paga).
- **Da un portale (Airbnb, Booking.com e simili).** Il portale incassa per te. **Non registrare l'incasso anche in CasaZen**: lo conteresti due volte nei tuoi ricavi. CasaZen non te lo permette neppure: «Registra incasso» non accetta prenotazioni arrivate da un portale. Nel registro per periodo queste righe compaiono come «Dal canale» o «Incassato dal canale».
- **Bonifico dell'ospite.** Per gli affitti brevi il bonifico lo registri a mano. Il collegamento automatico al conto bancario riguarda invece gli affitti lunghi: vedi [[canoni-scadenze]].

### Gli stati di un pagamento
| Stato | Cosa vuol dire |
|---|---|
| **Da incassare** | Il pagamento è registrato ma i soldi non sono ancora arrivati |
| **In elaborazione** | La banca o il circuito della carta lo stanno confermando |
| **Incassato** | Il pagamento è arrivato |
| **Non riuscito** | Non è andato a buon fine: i soldi non sono arrivati |
| **Rimborsato** | Hai restituito tutta la somma all'ospite |
| **Rimborsato in parte** | Hai restituito una parte: il resto è incassato |
| **Annullato** | È stato annullato prima di arrivare, di solito insieme alla prenotazione |

Il metodo è mostrato come: «Carta di credito», «Bonifico bancario», «Apple Pay», «Google Pay», «PayPal» o «In struttura» (contanti all'arrivo).

### I numeri del mese
Sopra l'elenco vedi tre numeri, solo se hai già almeno un pagamento. Ognuno è un link che apre l'elenco già filtrato.
- **Incassato in [mese]**: i pagamenti arrivati in quel mese, al netto di ciò che hai già restituito.
- **In attesa di incasso**: i pagamenti non ancora arrivati, qualunque sia la data.
- **Rimborsato in [mese]**: quanto hai restituito sui pagamenti del mese.

### Che cosa c'è nell'elenco
L'elenco si apre su **«In arrivo»**: i pagamenti dei soggiorni in arrivo o in corso, già incassati o da incassare. Gli altri filtri rapidi sono «Tutti», «Da incassare», «Incassati», «Rimborsati» e «Annullati». Ogni riga mostra: chi e per cosa (ospite, prenotazione, immobile), quando, metodo, stato e importo. Il giorno di un pagamento è quello in cui sono arrivati i soldi; se non sono ancora arrivati, quello in cui è stato registrato.

### Acconto e saldo
Non c'è una percentuale di acconto da impostare. Sul tuo sito l'ospite paga tutto l'importo (subito o alla scadenza). Se vuoi un acconto, puoi:
1. registrare con «Registra incasso» la somma ricevuta (qualsiasi importo, fino a ciò che resta da incassare);
2. mandare poi all'ospite il «Link di pagamento» per il **saldo**, cioè il totale della prenotazione meno quanto è già arrivato (rimborsi esclusi).

In «Registra incasso» vedi sempre la scritta «Resta da incassare» con la cifra del saldo.

### Commissioni e soldi che arrivano sul conto
- CasaZen **non trattiene** i tuoi incassi e non applica una sua commissione sui pagamenti delle prenotazioni: il pagamento con carta va direttamente sul tuo account Stripe.
- **Stripe** applica le sue commissioni di incasso con carta. Le vedi, quando sono note, nella colonna «Commissione» del registro per periodo (scritta come una detrazione) e il «Netto» è quello che resta. Se la cifra non è ancora disponibile vedi «Non disponibile», mai uno zero finto.
- Quando i soldi arrivano **sul tuo conto bancario** lo decide Stripe, in base alle impostazioni del tuo account (di solito alcuni giorni dopo il pagamento). Saldo e bonifici li vedi su Stripe con «Gestisci su Stripe». In CasaZen la colonna «Accredito» del registro per periodo indica il giorno in cui la somma risulta accreditata su Stripe.
- Per i pagamenti che incassa il portale (Airbnb, Booking.com…), gli accrediti e le commissioni dipendono dal portale: li vedi in [[report-commercialista#vedere-cosa-e-entrato-cosa-resta-da-incassare-e-cosa-e-arrivato]] quando il tuo channel manager li comunica.

### Stripe: collegamento, verifica, prova e reale
Per ricevere pagamenti online la tua organizzazione ha un **account Stripe** collegato a CasaZen (un account «Express»: lo apri da CasaZen, non devi creare nulla prima).
- **Non collegato**: nessun account. Il sito di prenotazione mostra «Sito prenotazioni non ancora attivo».
- **In verifica**: l'account esiste ma Stripe non ha ancora tutto quello che gli serve (di solito dati dell'attività o della persona, documento di identità e conto bancario su cui ricevere i soldi). Le domande le decide Stripe. Finché la verifica non è finita, gli ospiti non possono pagare.
- **Attivo**: l'account può accettare pagamenti. Vedi il messaggio «Il tuo account può accettare pagamenti. I fondi vengono accreditati direttamente sul tuo conto Stripe — CasaZen non trattiene i tuoi incassi».

Il paese dell'account Stripe viene scelto da CasaZen in base ai dati della tua organizzazione (il paese dei documenti fiscali o della fatturazione). Se l'account è già stato aperto e non hai ancora inviato nessun dato a Stripe, CasaZen può sostituirlo con uno del paese giusto.

Se lavori su un **ambiente di prova** di CasaZen (non sul sito reale), Stripe è in modalità di prova: i pagamenti sono finti, non muovono soldi veri e si fanno con le carte di prova di Stripe (per esempio 4242 4242 4242 4242). Sull'ambiente reale i pagamenti e i bonifici sono veri.

Se Stripe non risponde, CasaZen non scollega mai il tuo account: ti dice che Stripe è momentaneamente non raggiungibile e ti propone «Riprova».

### Rimborsi
- **Pagamento con carta (Stripe)**: lo rimborsi da CasaZen. Il rimborso torna sul metodo usato dall'ospite. CasaZen non scrive mai «rimborsato» prima che lo faccia Stripe: all'inizio il rimborso può essere «In attesa di Stripe» e si aggiorna da solo. Nei messaggi all'ospite CasaZen dice che l'accredito di solito arriva entro 5-10 giorni.
- **Contanti o bonifico**: non passano da Stripe, quindi CasaZen non può restituirli. Il rimborso lo fai tu, fuori da CasaZen.
- Un rimborso inviato a Stripe **non si può ritirare** da CasaZen.

### Politiche di cancellazione e importi
Ogni immobile ha una **politica di cancellazione** scelta tra le cinque di CasaZen. Ognuna è descritta da tre numeri: rimborso totale fino a un certo numero di giorni (o ore) prima dell'arrivo; poi una percentuale fino a un secondo termine; dopo, nessun rimborso. Le ore si contano fino all'inizio del giorno di check-in (ora italiana).

- **Se l'ospite annulla da solo** (con il link ricevuto o da «Le mie prenotazioni»): riceve la percentuale della politica applicata al prezzo del soggiorno (alloggio e pulizie) **più tutta l'imposta di soggiorno**, mai più di quello che può essere rimborsato. Se l'immobile non ha una politica, gli viene restituita solo l'imposta di soggiorno.
- **Se annulli tu** la prenotazione, CasaZen calcola il **rimborso minimo**: se all'ospite è stata mostrata la cancellazione gratuita fino a un certo giorno, il rimborso deve essere totale; altrimenti vale la percentuale della politica. Puoi sempre rimborsare di più, fino a quanto è stato pagato con la carta. Se nessuna regola si applica, scegli tu l'importo.
- **Personalizzare il rimborso**: nel modulo dell'immobile puoi cambiare le ore del rimborso totale, le ore e la percentuale del rimborso parziale, oppure segnare il soggiorno come «Non rimborsabile». Vale per i soggiorni sotto le 28 notti; dalle 28 notti in su resta la politica di CasaZen senza modifiche.
- Il sito di prenotazione scrive «Cancellazione gratuita fino al…» solo se la politica prevede davvero un rimborso totale fino a quel giorno.

### Cauzione (deposito cauzionale)
Nella scheda dell'immobile c'è il campo «Deposito cauzionale». È solo un **dato informativo** sulla casa: CasaZen non lo addebita all'ospite, non lo blocca sulla carta e non lo restituisce. Se vuoi una cauzione, la gestisci tu fuori da CasaZen (per esempio in contanti all'arrivo, con una ricevuta tua) e non la registri come incasso della prenotazione.

### Sollecitare chi non ha pagato
CasaZen non manda solleciti automatici agli ospiti per saldi non pagati. Per sapere chi deve ancora pagare:
- apri **Incassi** e usa il filtro «Da incassare»;
- oppure guarda la tabella «Da incassare» del report [[report-commercialista#vedere-cosa-e-entrato-cosa-resta-da-incassare-e-cosa-e-arrivato]], dove i soggiorni finiti con qualcosa da incassare sono segnati «Scaduto»;
- per riscuotere online, manda (o rimanda) il «Link di pagamento» dalla prenotazione.

## Come fare

### Controllare cosa hai incassato e cosa aspetti
1. Apri **Affitti brevi › Incassi**. In alto vedi i tre numeri del mese.
2. Premi un numero (per esempio «In attesa di incasso») per vedere i pagamenti che lo formano.
3. Usa i filtri rapidi («In arrivo», «Tutti», «Da incassare», «Incassati», «Rimborsati», «Annullati»), la ricerca «Cerca ospite, immobile o codice» o i filtri «Immobile», «Metodo» e «Data tra». Le viste «Questo mese» e «Mese scorso» impostano già le date.
4. Per tornare all'elenco completo premi «Azzera i filtri».

Se non c'è ancora nessun pagamento vedi «Qui vedrai i soldi che entrano». Se «In arrivo» è vuoto, premi «Vedi tutti i pagamenti».

> **Suggerimento:** l'elenco si apre su «In arrivo», che non mostra i soggiorni già finiti. Se cerchi un pagamento vecchio, apri «Tutti».

### Trovare un pagamento
1. Apri **Incassi** e scrivi nella ricerca il nome dell'ospite, l'immobile o il codice della prenotazione.
2. Premi la riga, oppure il menu della riga e «Apri i dettagli».
3. Nella pagina del pagamento (titolo «Pagamento #» con le prime lettere del codice) trovi l'importo, il metodo, la data, l'eventuale nota, l'importo rimborsato e il netto, e la «Cronologia». Per i pagamenti con carta c'è anche «Informazioni Stripe».
4. Per aprire la prenotazione premi «Vedi la prenotazione».

### Vedere gli incassi di un periodo con commissioni e accrediti
1. Apri **Incassi** e, sopra l'elenco, scegli «Per prenotazione e periodo».
2. Imposta «Dal» e «Al». All'apertura c'è il mese in corso. Servono entrambi i giorni, con il primo non dopo l'ultimo.
3. Leggi la tabella: «Incasso» (da dove vengono i soldi e il giorno), «Prenotazione», «Lordo», «Commissione», «Netto», «Accredito», «Stato» e «Documento».
4. Per aprire la prenotazione premi il suo codice. Se il documento fiscale è disponibile e hai il permesso, il suo nome è un link a [[fisco-documenti]].

La tabella non fa totali, perché gli importi di un periodo possono essere in valute diverse. Sotto la tabella vedi quante righe ci sono nel periodo e le pagine.

### Registrare un incasso ricevuto fuori da CasaZen
Serve il permesso di modificare i pagamenti.
1. Parti da una di queste due strade: in **Incassi**, per una riga «Da incassare» che aspetta te, apri il menu della riga e scegli «Registra incasso»; oppure apri la prenotazione e premi «Registra incasso». Si apre la pagina **Registra un incasso** (nella prenotazione, un riquadro con gli stessi campi).
2. Se la prenotazione non è già scelta, in «Prenotazione» scegli quella giusta. Vedi «Resta da incassare: € …». Se l'importo è vuoto, CasaZen propone proprio il saldo.
3. Controlla o scrivi l'«Importo» (per esempio 100,00).
4. Scegli la «Data dell'incasso». Non può essere nel futuro.
5. Scegli il «Metodo di pagamento»: «Bonifico bancario» o «Contanti».
6. Se vuoi, scrivi una «Nota» (per esempio «saldo in contanti all'arrivo»).
7. Premi «Registra incasso».

Cosa succede dopo: il pagamento risulta «Incassato» nel giorno che hai scelto e il saldo della prenotazione si aggiorna. **Non parte nessun messaggio** all'ospite e nessuna richiesta di pagamento. Se la prenotazione aveva una riga «Da incassare» in attesa di te (per esempio «paga in struttura»), l'incasso la chiude invece di crearne una seconda.

Se l'ospite aveva un link di pagamento ancora aperto, CasaZen lo annulla su Stripe così non può pagare due volte. Se in quel momento sta già pagando, l'incasso viene rifiutato: aspetta che il pagamento si concluda.

Errori comuni:
- L'importo è più alto di ciò che resta da incassare: CasaZen rifiuta l'incasso e ti dice quanto resta. Scrivi un importo uguale o più basso.
- Non trovi la prenotazione nell'elenco: la lista offre solo le prime 100 prenotazioni e solo quelle su cui si può registrare un incasso (non annullate e non arrivate da un portale).
- Hai premuto due volte il pulsante: non succede niente di male, l'incasso viene registrato una sola volta.

> **Attenzione:** nella pagina del pagamento non c'è un pulsante per modificare o togliere un incasso registrato. Controlla bene importo e data prima di premere «Registra incasso»; se hai sbagliato, scrivi all'assistenza.

### Inviare il link di pagamento a un ospite
Vale per le prenotazioni inserite da te, non annullate, con un saldo da pagare e con Stripe «Attivo».
1. Apri la prenotazione (**Affitti brevi › Prenotazioni**, poi la prenotazione).
2. Nel riquadro «Link di pagamento» premi «Crea e invia il link».
3. L'ospite riceve una e-mail con il link e può pagare il saldo con la carta. Quando paga, il pagamento si registra da solo.
4. Se la e-mail non parte, premi «Copia il link» e mandalo tu.
5. Per rimandarlo premi «Invia di nuovo»: il nuovo link sostituisce quello di prima, che smette di funzionare.

Se non puoi creare il link, CasaZen ti ricorda cosa serve: un conto Stripe pronto a incassare, un saldo da pagare e una prenotazione inserita da te e non annullata. Se un pagamento è già in corso, aspetta il suo esito.

### Collegare Stripe per ricevere i pagamenti online
Serve essere amministratore dell'organizzazione (chi gestisce la fatturazione).
1. Apri **Impostazioni › Stripe Connect** (la pagina si chiama «Incassi online»).
2. Nel riquadro «Sito prenotazioni non ancora attivo» premi «Collega Stripe».
3. Si apre Stripe: segui le sue domande fino alla fine.
4. Stripe ti riporta in CasaZen. Lo stato si aggiorna da solo: «Non collegato» diventa «In verifica» e, a verifica conclusa, «Attivo».

Cosa succede dopo: con lo stato «Attivo» il sito di prenotazione può prendere pagamenti. Il collegamento si può rifare e non è distruttivo: un errore di Stripe non scollega l'account.

Se non sei amministratore, il pulsante non funziona: chiedi a chi amministra l'organizzazione.

### Finire la verifica di Stripe
1. Apri **Impostazioni › Stripe Connect**. Se Stripe chiede ancora dei dati, vedi «Verifica incompleta».
2. Premi «Completa la verifica».
3. Rispondi alle domande di Stripe (anche documenti aggiuntivi) e torna in CasaZen.
4. Controlla che lo stato sia «Attivo». Se resta «In verifica», Stripe sta ancora controllando: riapri la pagina più tardi.

### Vedere saldo e bonifici su Stripe
1. Con lo stato «Attivo», apri **Impostazioni › Stripe Connect**.
2. Premi «Gestisci su Stripe». Si apre il pannello di Stripe con un accesso a uso singolo.
3. Lì vedi saldo, bonifici ricevuti e dati bancari.

Se vedi «Il tuo account Stripe non è ancora pronto», collega Stripe o completa la verifica, poi riprova.

### Rimborsare un pagamento fatto con carta
Serve il permesso di modificare i pagamenti. Il pulsante compare solo sui pagamenti con carta «Incassato» o «Rimborsato in parte».
1. Apri **Incassi** e il pagamento da rimborsare.
2. Premi «Rimborsa». Vedi «Importo pagato», «Già rimborsato (confermato da Stripe)», «Rimborsi in attesa di Stripe» e «Importo rimborsabile».
3. In «Importo da rimborsare» scrivi la cifra, oppure lascia vuoto per rimborsare tutto l'importo rimborsabile.
4. Se vuoi, scrivi il «Motivo»: lo vedi solo tu.
5. Premi «Rimborsa su Stripe».
6. Leggi l'esito: confermato da Stripe, inviato ma non ancora confermato (si aggiorna da solo), oppure non eseguito. In quest'ultimo caso all'ospite non è stato restituito nulla e puoi riprovare.

Nel riquadro «Rimborsi» della pagina del pagamento vedi ogni tentativo con il suo stato («In attesa di Stripe», «Confermato», «Non riuscito»…) e l'origine («Dalla pagina del pagamento», «Annullamento della prenotazione», «Dalla dashboard Stripe»).

Se vedi «Questo pagamento non è passato da Stripe: il rimborso va fatto fuori da CasaZen», il pagamento era in contanti o bonifico.

### Annullare una prenotazione e rimborsare chi ha pagato
1. Apri la prenotazione e premi «Annulla prenotazione».
2. CasaZen calcola pagamenti e rimborsi e ti mostra: «Pagato con Stripe», «Già rimborsato», «Rimborsi in attesa di Stripe», «Rimborsabile ora». Se una parte è stata pagata in contanti o bonifico, vedi un avviso: il rimborso di quella parte va gestito a parte.
3. Leggi la regola che si applica (cancellazione gratuita mostrata all'ospite, condizioni della politica o nessuna regola).
4. In «Rimborso all'ospite» scegli «Rimborso totale» oppure «Rimborso parziale» e scrivi l'importo (tra il minimo e il massimo indicati; con 0 l'ospite non riceve nulla, se la regola lo consente).
5. Se vuoi, scrivi il «Motivo» (lo vedi solo tu).
6. Premi «Annulla prenotazione».

Cosa succede dopo: le date tornano libere, il pagamento non completato dall'ospite viene annullato su Stripe (l'ospite non potrà più pagarlo), parte il rimborso su Stripe e l'ospite riceve una e-mail di annullamento, **senza il motivo**. L'annullamento **non è reversibile**.

Una prenotazione arrivata da un portale non si annulla da qui: si annulla sul portale.

### Scegliere la politica di cancellazione di un immobile
1. Apri **Affitti brevi › Immobili** e crea o modifica l'immobile.
2. Nel passo delle regole della casa («Quali regole valgono in casa?») cerca «Politica di cancellazione» e scegli una delle politiche. Sotto ognuna leggi quanto rimborsi e quando.
3. Salva.

Se non scegli nessuna politica il passo ti avvisa che il rimborso totale vale fino a 7 giorni prima dell'arrivo e che dopo decidi tu. Per avere regole chiare e un rimborso automatico per gli ospiti che annullano da soli, scegli sempre una politica. Per i dettagli dell'immobile vedi [[immobili]].

### Personalizzare il rimborso di un immobile
1. Apri **Immobili**, scegli l'immobile e premi la modifica.
2. Nella sezione «Regole del soggiorno» scegli la «Policy di cancellazione» e premi «Personalizza rimborso».
3. Cambia «Ore per rimborso 100%», «Ore per rimborso parziale» e «Percentuale rimborso parziale», oppure imposta il «Tipo di rimborso» su «Non rimborsabile».
4. Salva.

I soggiorni di 28 notti o più restano sulla politica di CasaZen, senza queste modifiche.

### Vedere i ricavi
1. Apri **Incassi › Ricavi** (pagina «Analisi ricavi»).
2. Scegli l'«Immobile» (all'apertura c'è il primo della lista), la «Data inizio» e la «Data fine». Il periodo parte dal primo del mese e arriva a oggi.
3. Leggi i numeri in alto («Ricavi totali», «Prenotazioni totali», «Valore medio prenotazione», «Periodi»), i due grafici e la tabella «Dettaglio analitico».
4. Per ricominciare premi «Reimposta filtri».

Questa pagina somma i **pagamenti «Completato»** del periodo, con l'importo pieno e con la data in cui sono stati creati, per mese. Non toglie i rimborsi e non conta i pagamenti «Rimborsato in parte». Per i ricavi per competenza (notti dei soggiorni) e per gli incassi al netto dei rimborsi usa [[report-commercialista]].

### Sapere chi deve ancora pagare
1. Apri **Incassi** e premi il filtro «Da incassare».
2. Se vuoi, aggiungi il filtro «Immobile» o «Metodo».
3. Per un saldo da riscuotere online, apri la prenotazione e usa «Crea e invia il link» (o «Invia di nuovo»).

## Flussi completi

### Flusso: prenotazione dal sito, pagamento online, accredito
1. L'ospite sceglie le date sul tuo sito e paga con la carta ([[sito-prenotazione]]). Perché funzioni, Stripe deve essere «Attivo».
2. Stripe incassa sul tuo account. CasaZen registra il pagamento («Incassato») e la prenotazione risulta pagata. Tu non fai niente.
3. A fine soggiorno CasaZen prepara il documento fiscale ([[fisco-documenti#come-funziona]]).
4. I soldi arrivano sul tuo conto secondo i tempi di Stripe. Controlli saldo e bonifici con «Gestisci su Stripe».
5. Se l'ospite annulla, il rimborso è calcolato dalla politica dell'immobile e parte da solo su Stripe.

### Flusso: prenotazione inserita da te, acconto e saldo
1. Crei la prenotazione ([[prenotazioni]]) e al passo «Pagamento» scegli «Bonifico» o «Link di pagamento».
2. Quando ricevi un acconto in contanti o con bonifico, premi «Registra incasso» e scrivi la somma. «Resta da incassare» scende.
3. Per il saldo mandi il «Link di pagamento»: l'ospite paga con la carta e l'incasso si registra da solo.
4. Se il saldo arriva in contanti all'arrivo, lo registri con «Registra incasso». Quando il totale è arrivato, la prenotazione non ha più nulla da incassare.

### Flusso: ospite che chiede di pagare in struttura
1. L'ospite sceglie «Paga in struttura» sul tuo sito e conferma il suo indirizzo e-mail.
2. Tu ricevi la richiesta e la accetti o la rifiuti entro il termine (per impostazione predefinita 24 ore). Se non rispondi, scade.
3. Quando l'ospite paga all'arrivo, apri **Incassi**, trova la riga «Da incassare» e dal menu scegli «Registra incasso».

### Flusso: cancellazione e rimborso
1. L'ospite annulla da solo, oppure annulli tu dalla prenotazione.
2. CasaZen calcola quanto rimborsare (vedi «Politiche di cancellazione e importi»).
3. Il rimborso parte su Stripe. Se non viene confermato subito, resta «In attesa di Stripe» e poi si aggiorna da solo; se fallisce lo vedi come «Non riuscito» e puoi riprovare dal pagamento.
4. L'ospite riceve una e-mail. La parte pagata in contanti o con bonifico la restituisci tu.

## Regole e limiti
- **Chi può cosa**: vedere pagamenti, ricavi e report serve il permesso di lettura dei pagamenti; registrare un incasso e rimborsare serve il permesso di modifica dei pagamenti; collegare Stripe, completare la verifica e aprire «Gestisci su Stripe» è dell'amministratore dell'organizzazione. Vedi solo i pagamenti degli immobili a cui hai accesso.
- Un incasso registrato a mano: importo maggiore di zero con al massimo due decimali, data non futura, mai oltre il saldo, mai su prenotazioni annullate o arrivate da un portale. Solo contanti e bonifico.
- Il rimborso con carta non può superare l'importo rimborsabile; i rimborsi in attesa di Stripe sono già tolti dal rimborsabile.
- Il «Link di pagamento» esiste solo per prenotazioni inserite da te; un nuovo link sostituisce il precedente.
- «Paga alla scadenza» richiede che il giorno dell'addebito sia dopo oggi.
- I soggiorni di 28 notti o più non accettano le modifiche alla politica.
- La cauzione non è gestita da CasaZen.
- Le prenotazioni dei portali non si incassano né si annullano da CasaZen.
- Per l'imposta di soggiorno e i suoi pagamenti vedi [[imposta-soggiorno-documenti]].

## Domande frequenti

### CasaZen trattiene una commissione sui miei incassi?
No sulle prenotazioni: il pagamento con carta va sul tuo account Stripe e CasaZen non lo trattiene. Stripe applica le sue commissioni di incasso; le vedi nel registro per periodo, nella colonna «Commissione».

### Quando arrivano i soldi sul mio conto?
Dipende da Stripe e dalle impostazioni del tuo account. In CasaZen la colonna «Accredito» ti dice quando la somma è accreditata su Stripe; saldo e bonifici li controlli con «Gestisci su Stripe».

### Perché il mio sito non accetta pagamenti?
Quasi sempre perché Stripe non è «Attivo». Apri **Impostazioni › Stripe Connect**: se vedi «Non collegato» premi «Collega Stripe», se vedi «In verifica» premi «Completa la verifica».

### Perché non vedo il pulsante «Rimborsa»?
Compare solo sui pagamenti con carta, già incassati o rimborsati in parte, e solo se puoi modificare i pagamenti. Per contanti e bonifico non esiste: il rimborso lo fai tu.

### L'ospite ha pagato su Airbnb o Booking.com: devo registrare l'incasso?
No. Il portale incassa per te e CasaZen non ti lascia registrare un incasso su quelle prenotazioni.

### Ho registrato un incasso sbagliato: come lo correggo?
Nella pagina del pagamento non c'è un pulsante per modificarlo. Scrivi all'assistenza con il codice della prenotazione e l'importo.

### CasaZen gestisce la cauzione?
No. Il «Deposito cauzionale» è solo un dato della scheda dell'immobile: non viene addebitato né bloccato sulla carta.

### Cosa succede se non scelgo una politica di cancellazione?
Se l'ospite annulla da solo, gli viene restituita solo l'imposta di soggiorno. Se annulli tu, scegli l'importo del rimborso. Conviene scegliere sempre una politica.

### Quanto dura un rimborso?
Dopo l'invio, Stripe lo conferma e la banca dell'ospite lo accredita. CasaZen dice agli ospiti che di solito arriva entro 5-10 giorni.

## Glossario
- **Saldo**: quanto resta da incassare su una prenotazione (totale meno incassato, rimborsi esclusi).
- **Stripe**: il servizio di pagamento con carta che CasaZen usa per incassare per te.
- **Account Express**: l'account Stripe che apri da CasaZen per ricevere i pagamenti.
- **Accredito**: il giorno in cui una somma pagata con carta risulta accreditata su Stripe.
- **Politica di cancellazione**: la regola che dice quanto rimborsi e fino a quando.
- **Rimborso minimo**: la cifra sotto cui non puoi scendere se annulli tu, perché all'ospite era stata promessa.
- **Link di pagamento**: un link per pagare il saldo con la carta, mandato per e-mail all'ospite.

## Vedi anche
- [[fisco-documenti]]: i documenti fiscali che CasaZen prepara per ogni soggiorno.
- [[report-commercialista]]: i report su incassi, costi dei canali e il pacchetto per il commercialista.
- [[prenotazioni]]: come creare e annullare una prenotazione.
- [[immobili]]: dove si scelgono le regole della casa e la politica di cancellazione.
- [[sito-prenotazione]]: come il tuo sito prende le prenotazioni e i pagamenti.
- [[imposta-soggiorno-documenti]]: l'imposta di soggiorno e i suoi versamenti.
- [[canoni-scadenze]]: gli incassi degli affitti lunghi, compreso il bonifico collegato al conto.
