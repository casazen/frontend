---
id: chiusura-mensile
titolo: Chiusura mensile, rendiconti, fatture, ritenute e bonifici ai proprietari
menu: Chiusura mensile e rendiconti
sezione: Agenzie e proprietari
ordine: 51
riassunto: Come un'agenzia chiude ogni mese i conti dei proprietari, dal controllo al rendiconto, dall'approvazione e dalla pubblicazione al pagamento e alla chiusura, poi fatture, autofatture, ritenute d'acconto, F24 e file dei bonifici. Chi emette cosa e cosa resta a te.
chi: [amministratore]
dove: Amministrazione › Chiusura mensile
parole_chiave: [chiusura mensile, chiudere il mese, rendiconto, pubblicare rendiconto, versione, approvazione, pubblicazione, riconciliazione, rettifica, cambio, fattura al proprietario, fattura del PM, autofattura, TD17, SDI, ritenuta d'acconto, F24, Certificazione Unica, 770, bonifici, pagare proprietario, ISO 20022, SEPA, esegui per tutti, anomalie]
copre: [/app/account/owner-close, /app/account/owner-close/versions/:versionId, /app/account/statements, /app/account/owner-invoices, /app/account/self-billing, /app/account/withholding, /app/account/wire-transfers]
stato: su-attivazione
fonte_codice: [frontend/src/features/owner-accounting/month-end-close-page.tsx, frontend/src/features/owner-accounting/statement-detail-page.tsx, frontend/src/features/owner-accounting/owner-accounting-model.ts, frontend/src/features/owner-accounting/components/owner-close-row.tsx, frontend/src/features/owner-accounting/components/close-dialog.tsx, frontend/src/features/owner-accounting/components/tax-filing-panel.tsx, frontend/src/features/owner-accounting/components/tax-exports-section.tsx, frontend/src/features/owner-accounting/components/owner-invoice-panel.tsx, frontend/src/features/owner-accounting/components/external-invoices-panel.tsx, frontend/src/features/owner-accounting/components/bulk-close-dialog.tsx, frontend/src/features/owner-invoices/owner-invoices-page.tsx, frontend/src/features/fiscal/self-billing/self-billing-page.tsx, frontend/src/pages/StatementsPage.tsx, frontend/src/components/statements/StatementDetail.tsx, frontend/src/pages/WithholdingPage.tsx, frontend/src/pages/WireTransferPage.tsx, frontend/src/components/finance/agency-finance-gate.tsx, backend/Casazen.Web/Controllers/OwnerAccountingController.cs, backend/Casazen.Web/Controllers/StatementsController.cs, backend/Casazen.Web/Controllers/OwnerPayoutsController.cs, backend/Casazen.Web/Controllers/OwnerInvoicesController.cs, backend/Casazen.Web/Controllers/SelfBillingController.cs, backend/Casazen.Web/Controllers/WithholdingController.cs, backend/Casazen.Web/Controllers/WireTransferController.cs, backend/Casazen.Core/Services/IOwnerAccountingService.cs, backend/Casazen.Core/Authorization/AgencyPermissions.cs]
---

## In breve
Ogni mese, quando il mese è finito, **chiudi i conti dei tuoi proprietari** da **Amministrazione › Chiusura mensile**. Per ogni proprietario CasaZen prepara un **rendiconto**: tu lo controlli, lo **approvi**, lo **pubblichi** (da quel momento il proprietario lo vede nel suo portale), registri il **pagamento** e infine **chiudi il mese**. Le altre schede della stessa sezione riguardano le fatture e i soldi che ne seguono: **Fatture ai proprietari**, **Autofatture (TD17)**, **Ritenute d'acconto** e **Bonifici proprietari**.

CasaZen prepara e conserva; **non esegue** i bonifici, **non versa** l'F24 e **non trasmette** niente all'Agenzia delle Entrate: lo fai tu o il tuo commercialista, e in CasaZen registri che è stato fatto (CasaZen non controlla che sia vero). Questa parte è **su attivazione** ([[per-iniziare#cosa-significa-su-attivazione]]) e serve il **piano Agency** e il ruolo di titolare o amministratore: nomi, percorso e cosa vedi senza piano sono in [[agenzie-proprietari#chi-ha-il-piano-agency-e-cosa-sblocca]].

> **Attenzione, queste azioni non si annullano dall'app:** «Pubblica» (avvisa subito il proprietario con un'e-mail; per cambiare qualcosa serve una nuova versione), «Registra il pagamento», «Chiudi il mese» (non c'è un comando per riaprirlo), «Emetti» (la fattura prende un numero e non si modifica più), la registrazione del pagamento dell'F24, «Confermato pagato» sul file dei bonifici e «Esegui per tutti», che ripete un passaggio per tutti i proprietari insieme. Controlla prima: dove puoi, prova con un solo proprietario.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Chiusura mensile | Mostra il mese di tutti i proprietari in quattro gruppi, con le anomalie | Amministrazione › Chiusura mensile | amministratore | Su attivazione | Aprire la chiusura mensile e scegliere il mese |
| Controlla il mese | Registra nel libro dei proprietari i movimenti del mese e segnala le anomalie | Chiusura mensile › «Controlla il mese» | amministratore | Su attivazione | Controllare il mese e risolvere le anomalie |
| Prepara il rendiconto | Crea una nuova versione del rendiconto di un proprietario | Riga del proprietario › «Prepara il rendiconto» | amministratore | Su attivazione | Preparare il rendiconto di un proprietario |
| Approva e pubblica | Blocca la versione e la rende visibile al proprietario | Riga del proprietario › «Approva», «Pubblica» | amministratore | Su attivazione | Approvare e pubblicare un rendiconto |
| Registra un pagamento | Registra il bonifico al proprietario e decide la ritenuta | Riga del proprietario › «Registra un pagamento» | amministratore | Su attivazione | Registrare il pagamento a un proprietario |
| Chiudi il mese | Blocca il mese di un proprietario dopo la riconciliazione | Riga del proprietario › «Chiudi il mese» | amministratore | Su attivazione | Chiudere il mese di un proprietario |
| Esegui per tutti | Fa lo stesso passaggio per tutti i proprietari del mese | Chiusura mensile › «Esegui per tutti» | amministratore | Su attivazione | Eseguire un passaggio per tutti i proprietari |
| Rettifica | Aggiunge una riga con il suo motivo, senza toccare le righe già registrate | Rendiconto › «Altre azioni» › «Registra una rettifica» | amministratore | Su attivazione | Registrare una rettifica |
| Cambio | Aggiunge un cambio tra due valute per un giorno | Anomalia «Manca un cambio» › «Aggiungi il cambio» | amministratore | Su attivazione | Aggiungere un cambio |
| Rendiconto di un proprietario | Mostra le righe, i totali, le versioni e i file | Chiusura mensile › nome del proprietario | amministratore | Su attivazione | Leggere il rendiconto di un proprietario |
| Rendiconti | Elenca i rendiconti per immobile con approvazione, pubblicazione, PDF e CSV | Chiusura mensile › Rendiconti | amministratore | Su attivazione | Usare la scheda Rendiconti |
| Fatture ai proprietari | Crea ed emette la fattura dell'agenzia al proprietario | Chiusura mensile › Fatture ai proprietari; riquadro «Fattura del PM» del rendiconto | amministratore | Su attivazione | Creare ed emettere la fattura al proprietario |
| Fatture emesse fuori da CasaZen | Collega al rendiconto una fattura emessa dal tuo sistema | Rendiconto › «Fatture emesse fuori da CasaZen» | amministratore | Su attivazione | Collegare una fattura emessa fuori da CasaZen |
| Autofatture (TD17) | Prepara, controlla ed emette l'autofattura per le commissioni dei portali esteri | Chiusura mensile › Autofatture (TD17) | amministratore | Su attivazione | Preparare ed emettere le autofatture |
| Ritenute d'acconto | Mostra le ritenute del mese, l'F24 e permette di registrare il pagamento | Chiusura mensile › Ritenute d'acconto | amministratore | Su attivazione | Versare la ritenuta con il modello F24 |
| Ritenute e invii fiscali | Genera l'F24 e i dati annuali e segue invio e ricevuta | In fondo alla Chiusura mensile | amministratore | Su attivazione | Versare la ritenuta con il modello F24 |
| Dati per il commercialista | Scarica in CSV o Excel F24, Certificazione Unica, 770 e comunicazione dei contratti | In fondo alla Chiusura mensile | amministratore | Su attivazione | Preparare i dati per il commercialista |
| Bonifici proprietari | Crea il file per la banca che paga i proprietari | Chiusura mensile › Bonifici proprietari | amministratore | Su attivazione | Creare il file dei bonifici per la banca |
| Conduttore società | Decide se un soggiorno con una società come conduttore ha la ritenuta | Finestra «Registra un pagamento» › «Conduttori società» | amministratore | Su attivazione | Decidere il regime di un soggiorno con conduttore società |

## Come funziona

### Chi emette cosa
| Cosa | Chi lo prepara o lo emette | Cosa resta a te |
|---|---|---|
| **Rendiconto** del proprietario | CasaZen lo prepara dal libro del mese. **Non è un documento fiscale**: è il riepilogo di quello che l'agenzia deve al proprietario | Controllarlo, approvarlo, pubblicarlo |
| **Fattura dell'agenzia al proprietario** («Fattura del PM»; «PM» è la tua agenzia, il property manager) | Con la funzione attiva, **CasaZen** prepara la bozza dal rendiconto e la **emette** quando premi «Emetti» (numero, PDF). Senza la funzione, CasaZen non emette: fatturi dal tuo sistema e **colleghi** la fattura al rendiconto. Come capisci quale è il tuo caso: nel rendiconto vedi «Crea la fattura» (CasaZen emette) oppure «Collega una fattura» (emetti tu, fuori da CasaZen) | Rivedere la bozza ed emetterla. L'invio allo SDI è automatico solo se CasaZen è collegata allo SDI (su attivazione: riquadro «Invio allo SDI», pulsante «Invia»); altrimenti l'invio resta a te, a mano ([[fisco-documenti]]) |
| **Autofattura TD17** (commissioni dei portali esteri senza IVA) | CasaZen prepara le bozze dal libro del mese; **la emetti tu** e CasaZen le dà il numero e crea PDF e XML | Emettere entro il giorno 15 del mese dopo (data prudente, da confermare con il commercialista) e inviarla allo SDI come le altre fatture. Quando le bozze sono pronte, in «Da fare» compare «Autofatture da controllare ed emettere» con quella scadenza |
| Ricevute e fatture dei **soggiorni** a nome del proprietario | CasaZen le emette a suo nome se il suo profilo emittente è completo (su attivazione) | Completare il profilo ([[agenzie-proprietari]]) |
| **Ritenuta d'acconto** | CasaZen la **decide** quando registri il pagamento, con la regola approvata dal commercialista, e conserva la prova | Versare l'F24 (tu o il commercialista) e registrare il giorno |
| **F24**, Certificazione Unica, 770, comunicazione dei contratti | CasaZen prepara i **dati** (PDF, CSV, Excel) e non trasmette nulla | Il commercialista li compila e li invia; tu registri invio e ricevuta |
| **Pagamento** al proprietario | CasaZen registra il pagamento e prepara il **file per la banca** | Caricare il file in banca, far eseguire i bonifici, segnare «Confermato pagato» |
| **Approvazione della regola fiscale** | La dà il commercialista, fuori da CasaZen | Registrare chi ha approvato |

CasaZen non controlla mai che un versamento, un invio o un bonifico siano andati a buon fine: scrive quello che dichiari.

### Il mese in quattro gruppi
La pagina si apre sul **mese scorso**, cioè l'ultimo mese finito. Sotto «Rendiconti del mese» i proprietari sono divisi per quello che c'è da fare:
| Gruppo | Cosa vuol dire |
|---|---|
| **Da preparare** | Non c'è ancora un rendiconto |
| **Da verificare** | Una bozza da controllare e approvare, oppure un rendiconto segnalato per anomalie da risolvere |
| **Approvati** | Pronti da pubblicare al proprietario |
| **Pubblicati** | Il proprietario li vede. Registra il pagamento e chiudi il mese |

Ogni riga mostra la versione, lo stato e il saldo («Versione 2 · Bozza · saldo € 1.250,00»), un'etichetta «Chiuso», «Da aggiornare» o il numero di anomalie, e un solo pulsante con il **prossimo passo**. Gli altri passi sono in «Altre azioni».

### Le versioni del rendiconto
Un rendiconto è una **versione** preparata dal libro dei proprietari **in un certo momento** («tagliata il…»). Ogni versione ha uno stato:
| Stato | Cosa vuol dire |
|---|---|
| **Bozza** | Preparata, da controllare. Si può approvare |
| **Segnalato** | Preparata ma con anomalie che bloccano: risolvile e preparane una nuova |
| **Approvato** | Controllata. Non si modifica. Non è ancora del proprietario |
| **Pubblicato** | Il proprietario la vede. Il file e la sua impronta non cambiano più |
| **Sostituito** | Una versione più recente ha preso il suo posto; resta consultabile con il suo file |

Se dopo la versione il libro cambia (un pagamento nuovo, una rettifica) la riga dice «Da aggiornare» e la versione **non si può più approvare né pubblicare**: premi «Rigenera come nuova versione». Una versione pubblicata non si modifica mai: per cambiare quello che vede il proprietario serve una nuova versione, che la sostituisce.

### Cosa c'è in un rendiconto
Il **saldo di chiusura** si legge così: saldo di apertura + incassi del proprietario + commissioni e costi + pagamenti e ritenute + rettifiche. Le righe possono essere: incassi di una prenotazione (al netto dei rimborsi e per la quota del proprietario), commissione del canale, commissione dell'agenzia secondo il mandato, IVA sulla fattura dell'agenzia, addebiti e spese, pagamenti al proprietario, ritenute e rettifiche. Una riga «Solo informativa» (per esempio la commissione del portale pagata dall'agenzia e non riaddebitata) **non entra in nessun totale**. L'**imposta di soggiorno** non fa parte del netto: l'agenzia la incassa per conto del comune e la versa, il dettaglio è nel PDF e nel CSV.

Aprendo una riga vedi «Come si arriva all'importo» (quota del proprietario, cambio usato e sua fonte) e puoi aprire l'origine (la prenotazione, il pagamento, l'allegato).

### Le anomalie
Un'anomalia è qualcosa che impedisce di fidarsi del rendiconto. Alcune **bloccano** la chiusura, altre sono solo avvisi («Non blocca la chiusura»). Le più comuni:
| Anomalia | Cosa fare |
|---|---|
| «Manca la commissione di un portale» | «Imposta la commissione del canale»: [[agenzie-proprietari#impostare-le-commissioni-dei-canali]] |
| «Manca un cambio» | «Aggiungi il cambio» |
| «Il rendiconto mescola più valute» | Scegli la valuta del pagamento nei dati finanziari del proprietario |
| «Mancano i dati finanziari del proprietario» o «sono incompleti» | «Apri i dati del proprietario» e completali |
| «Manca la regola fiscale», «non è ancora approvata», «non è in vigore in questo mese», «è di un'altra giurisdizione» | Nei dati finanziari scegli o crea la regola e registra l'approvazione del commercialista |
| «Un soggiorno non ha un mandato in vigore» | Registra il mandato nei dati finanziari. CasaZen non inventa la provvigione |
| «Un immobile non ha proprietari in questo periodo», «Le quote di un immobile non fanno 100%» | «Completa nell'attivazione» |
| «Ci sono movimenti non ancora registrati» | Premi «Controlla il mese» |
| «Il registro è cambiato dopo l'ultima versione» | Prepara una nuova versione |
| «Un incasso non ha l'importo» | «Apri il pagamento» e completa l'importo |
| «È arrivato un movimento dopo la chiusura» | Il mese resta chiuso: registra una rettifica in un mese aperto |
| «Il saldo del proprietario è negativo» | Si chiude solo con un motivo (vedi sotto) |
| «La fattura è stata emessa dopo l'approvazione del rendiconto» | Prepara una nuova versione: comprende l'IVA della fattura |
| «Il proprietario è presunto un imprenditore» | È un avviso: il rendiconto è giusto, ma i suoi soggiorni non hanno la ritenuta delle locazioni brevi |

### Pagamento e ritenuta
**Registrare un pagamento** in CasaZen vuol dire scrivere che hai pagato (o stai per pagare) il proprietario. È **in quel momento** che CasaZen decide se c'è una **ritenuta**, con la regola fiscale approvata e in vigore il giorno del pagamento, e ne conserva la prova. I fatti su cui decide li legge dal libro: non si scrivono a mano. La **data del pagamento** conta: da lei dipendono il mese in cui entrano il pagamento e la ritenuta (e quindi l'F24 da versare) e la regola fiscale che vale; se quel mese è già chiuso, CasaZen non registra il pagamento.

La ritenuta si applica ai soggiorni che sono una **locazione breve** e per cui l'agenzia ha **incassato o è intervenuta nel pagamento**. Non c'è ritenuta, per esempio, quando: il portale l'ha già trattenuta; l'agenzia non ha incassato; il proprietario non è una persona fisica senza partita IVA o è un'«impresa presunta»; l'immobile non è in Italia; la durata del soggiorno è fuori dai limiti; il soggiorno non è attivo (annullato, non presentato, in attesa). La finestra «Registra un pagamento» mostra, soggiorno per soggiorno, se entra nella base e perché. Se il proprietario è pagato in un'altra valuta (per esempio in franchi), la ritenuta decisa in euro si trattiene al cambio dell'agenzia.

Registrare il pagamento **non muove soldi**: il bonifico lo esegui tu in banca (con il file di «Bonifici proprietari»).

### Riconciliazione e chiusura
Il mese di un proprietario si chiude quando:
- il **mese è finito** (prima il pulsante non c'è: «Il mese si potrà chiudere quando sarà finito»);
- il rendiconto è **approvato o pubblicato** e non è «Da aggiornare»;
- non ci sono anomalie che bloccano;
- il **saldo torna con i pagamenti**: «Dovuto (saldo approvato)» meno «Pagato» fa zero. Se non ci sono pagamenti registrati, CasaZen conta i bonifici segnati come pagati per quel mese.

Se il saldo non torna, o è negativo, si può chiudere solo con un **motivo scritto**, e può farlo solo chi gestisce le finanze dei proprietari (titolare e amministratori). Il motivo resta registrato con il tuo nome e la data. In un mese chiuso **non si registra più niente**: quello che arriva dopo va in una rettifica di un mese aperto.

## Come fare

### Aprire la chiusura mensile e scegliere il mese
1. Apri **Amministrazione › Chiusura mensile**.
2. La pagina mostra il mese scorso. Usa «Mese precedente» e «Mese successivo» per cambiare, e «Torna a» (il mese consigliato) per tornare.
3. Leggi il riquadro in alto, «Chiusura di» e il mese: dice quanti rendiconti sono senza anomalie (per esempio «80% pronti: 8 su 10») e «Tutto in ordine: puoi andare avanti» oppure «N anomalie da risolvere prima di chiudere».
4. Se nel mese non c'è niente vedi «Nessun rendiconto da preparare»; se tutto è chiuso, «… è chiuso».

Se vedi «Serve il piano Agenzia» (è il piano Agency) o «Serve l'amministratore dell'organizzazione», la tua organizzazione o il tuo ruolo non permettono questa pagina ([[agenzie-proprietari#capire-se-la-tua-organizzazione-ha-il-piano-agency]]).

**Prima di chiudere il primo mese tieni pronto:** le commissioni dei portali (se le prenotazioni non le riportano), i cambi (se i proprietari sono pagati in valute diverse), il mandato e i dati finanziari di ogni proprietario validi dal primo mese da chiudere, le quote di ogni immobile al 100% e una regola fiscale approvata dal commercialista. Se manca qualcosa lo scopri comunque dalle anomalie dopo «Controlla il mese».

### Controllare il mese e risolvere le anomalie
1. Premi «Controlla il mese». CasaZen registra nel libro i movimenti del mese che mancano e dice: «Controllo fatto: N righe registrate, N stornate, N invariate».
2. Leggi «Anomalie da risolvere»: ogni anomalia dice cosa non va e propone il pulsante giusto («Imposta la commissione del canale», «Aggiungi il cambio», «Registra una rettifica», «Completa nell'attivazione», «Apri il pagamento», «Apri i dati del proprietario», «Vai al rendiconto»).
3. Risolvi e premi di nuovo «Controlla il mese».

Cosa succede dopo: i movimenti già registrati non cambiano, si aggiungono solo quelli che mancano. Ripetere il controllo non cambia niente. Nessun proprietario viene avvisato: lo fa solo la pubblicazione.

### Preparare il rendiconto di un proprietario
1. Nel gruppo «Da preparare», sulla riga del proprietario premi «Prepara il rendiconto».
2. Compare «Rendiconto di … preparato: versione N». Se ci sono anomalie che bloccano, la versione è «Segnalato» e il messaggio dice «è pronto (versione N) ma ha delle anomalie: risolvile e preparane uno nuovo».
3. Premi il nome del proprietario per aprire il rendiconto.

Per cambiare una versione già preparata usa «Rigenera come nuova versione»: la versione precedente resta consultabile come sostituita, con il suo file; la nuova parte come bozza e va approvata e pubblicata di nuovo.

### Leggere il rendiconto di un proprietario
1. Dalla riga del proprietario premi il suo nome.
2. In alto leggi «Versione N · stato» e il saldo di chiusura. Il pulsante grande è il prossimo passo; su una versione sostituita il riquadro lo dice e il pulsante porta alla versione più recente («Apri la versione più recente»).
3. In «In breve» vedi i numeri del rendiconto: incassi del proprietario, commissioni e costi, pagamenti e ritenute e saldo di chiusura (con il saldo di apertura sotto). In «Il rendiconto come lo riceve il proprietario» vedi le parti (soggiorni, commissioni dei canali, provvigione, riaddebiti e spese, rettifiche, ritenuta) e premi «PDF» o «CSV» per scaricare lo stesso file del proprietario. Il PDF di una bozza porta la filigrana di bozza.
4. In «Righe del rendiconto» premi una riga per vedere come si arriva all'importo. Mostra le prime 25: «Mostra tutte (N)» per le altre.
5. «Cosa è cambiato dalla versione precedente» mostra la differenza con la versione di prima. «Pagamenti e riconciliazione» mostra i pagamenti e il confronto con il saldo.
6. «Altre azioni» in alto ha le azioni possibili, «Registra una rettifica» e «Dati finanziari del proprietario». Se il rendiconto è pubblicato c'è anche «Scarica il file pubblicato».

### Approvare e pubblicare un rendiconto
1. Su un rendiconto in **Bozza** senza anomalie che bloccano premi «Approva». Si apre «Approva la versione N».
2. Leggi cosa succede: dopo l'approvazione il rendiconto non si modifica (per cambiare qualcosa serve una nuova versione) e non va ancora al proprietario. Premi «Approva».
3. Sul rendiconto **Approvato** premi «Pubblica». Si apre «Pubblica la versione N».
4. Leggi: il file e la sua impronta si conservano e non cambiano più; per cambiare qualcosa serve una nuova versione. Premi «Pubblica».

> **Attenzione:** appena premi «Pubblica» il proprietario riceve l'e-mail e non c'è modo di ritirare né di cambiare il rendiconto. Controlla prima cifre e righe.

Cosa succede dopo: il proprietario vede il rendiconto nel portale (in «Contabilità») e riceve un'e-mail che lo avvisa. L'e-mail dice solo quale agenzia ha pubblicato e ha il link a «Contabilità»: **nessun importo, riga, periodo o ospite**. Il PDF entra anche tra i suoi documenti. Se l'e-mail non parte, in «Da fare» ti compare «Proprietario da avvisare a mano»: avvisalo tu; il rendiconto è pubblicato comunque.

Non si annulla: un'approvazione o una pubblicazione si sostituisce con una nuova versione. Approvare e pubblicare sono due permessi distinti nel sistema; titolare e amministratori hanno entrambi.

### Registrare il pagamento a un proprietario
**Ti serve:** essere titolare o amministratore; il rendiconto approvato; i dati finanziari del proprietario completi, con una regola fiscale approvata.
> **Attenzione:** un pagamento registrato **non si annulla dalla pagina**. Registralo il giorno in cui il bonifico parte davvero (o lo carichi in banca) e scrivi quella data. Controlla importo, data e ritenuta prima di premere «Registra il pagamento». CasaZen non muove soldi: il bonifico lo fai tu in banca.
1. Sul rendiconto **Approvato** o **Pubblicato** apri «Altre azioni» e scegli «Registra un pagamento» (se è il prossimo passo è il pulsante principale).
2. Controlla «Fatti letti dal registro del proprietario»: per ogni soggiorno vedi se entra nella base della ritenuta e perché. Non si scrivono a mano; se qualcosa non torna, correggilo nel libro e riapri la finestra.
3. Scegli la «Data del pagamento» e, se vuoi, scrivi il «Riferimento del bonifico» (al massimo 100 caratteri).
4. Leggi l'anteprima: «Si paga il saldo del rendiconto: …», «La ritenuta si applica a questo pagamento» oppure «Su questo pagamento non c'è ritenuta», quanto si trattiene e il «Netto da bonificare».
5. Premi «Registra il pagamento». Compare «Pagamento registrato» con lordo, ritenuta e netto.

Se la finestra dice «Non si può ancora registrare un pagamento», leggi il motivo (profilo mancante o incompleto, regola fiscale mancante, non approvata, non in vigore o di un'altra giurisdizione) e premi «Apri i dati del proprietario».

Cosa succede dopo: il pagamento compare nei **Bonifici proprietari** se il rendiconto è pubblicato e il netto è maggiore di zero. Nella pagina non c'è un pulsante per annullare un pagamento registrato: controlla bene la data prima di confermare.

### Chiudere il mese di un proprietario
1. Aspetta la fine del mese. Prima vedi «Il mese si potrà chiudere quando sarà finito».
2. Sul rendiconto approvato o pubblicato (non «Da aggiornare») premi «Chiudi il mese». Si apre «Chiudi» e il mese.
3. Leggi la «Riconciliazione dei pagamenti»: «Dovuto (saldo approvato)», «Pagato», «Differenza». Se torna vedi «Il saldo torna con i pagamenti: il mese si può chiudere».
4. Se non torna o il saldo è negativo, scrivi il «Motivo della chiusura con differenza» (fino a 500 caratteri). Può farlo solo chi gestisce le finanze dei proprietari.
5. Scrivi **CHIUDI** nel campo di conferma e premi «Chiudi il mese».

Cosa succede dopo: il mese è «Chiuso». Non si registra più niente in quel mese: quello che arriva dopo va in una rettifica di un mese aperto. Le prove (versioni, righe, file pubblicati) si conservano per il tempo previsto dalla regola fiscale. **Un mese chiuso non si riapre: nell'app non c'è un comando per farlo.** Se hai chiuso per errore, scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»): non c'è una procedura che tu possa fare da solo.

Se vedi «Il mese non si può ancora chiudere», sotto c'è l'elenco delle anomalie che bloccano: risolvile e riprova.

### Eseguire un passaggio per tutti i proprietari
Utile con tanti immobili. Ogni proprietario fa da sé: se uno non va avanti, gli altri sì.
> **Attenzione:** «Pubblica i rendiconti» avvisa **subito ogni proprietario** con un'e-mail e «Chiudi il mese» chiude il mese di **tutti** quelli con il saldo a posto: nessuno dei due passaggi si annulla. Prima apri almeno un rendiconto e controllalo; se puoi, fai prima il passaggio su un solo proprietario dalla sua riga.
1. In «Rendiconti del mese» premi «Esegui per tutti».
2. In «Quale passaggio?» scegli: «Controlla e registra i movimenti», «Prepara i rendiconti», «Approva i rendiconti», «Pubblica i rendiconti» oppure «Chiudi il mese». Uno è «consigliato». «Chiudi il mese» è indicato «il mese non è ancora finito» finché non lo è.
3. Leggi le conseguenze (per «Pubblica i rendiconti»: i proprietari vedono subito il rendiconto e ricevono l'avviso) e premi «Esegui».
4. Segui l'avanzamento («N proprietari su M»). Puoi chiudere la finestra: finché resti sulla pagina ti avvisiamo quando finisce, e il risultato resta in «Esegui per tutti».
5. Leggi il risultato: «Fatti», «Con anomalie», «Già a posto», «Non completati», con il motivo per ognuno. Premi «Esegui un altro passaggio» per continuare.

Le versioni con anomalie non si approvano: le trovi nell'elenco con il motivo. «Chiudi il mese» per tutti salta chi ha il saldo che non torna: «Chiudilo dalla riga del proprietario, con un motivo». Ripetere un passaggio già fatto non cambia niente.

### Registrare una rettifica
Usala per sistemare il conto di un proprietario senza toccare le righe già registrate: la rettifica è una **riga in più**, con il suo motivo.
1. Apri il rendiconto del proprietario, «Altre azioni», «Registra una rettifica» (o il pulsante dell'anomalia).
2. Scrivi la «Data della rettifica»: conta nel mese di quella data e un mese chiuso non accetta righe, quindi scegli un mese aperto.
3. In «A favore di chi» scegli «A favore del proprietario (si somma al saldo)» o «A carico del proprietario (si toglie dal saldo)».
4. Scrivi «Importo», la «Valuta» (tre lettere, per esempio EUR) e il «Motivo» (cosa correggi e perché: lo leggerà chi controlla il mese). Se vuoi, aggiungi un «Allegato o riferimento» (un indirizzo https).
5. Premi «Registra la rettifica». Compare «Rettifica registrata per…».

Per far entrare la rettifica nel rendiconto prepara una **nuova versione**: la versione approvata o pubblicata resta com'è.

### Aggiungere un cambio
CasaZen non cerca i cambi da sola: scrivi quello che usa la tua agenzia, con la sua fonte.
1. Dall'anomalia «Manca un cambio» premi «Aggiungi il cambio».
2. Scrivi «Valuta di partenza» (per esempio CHF), «Valuta di arrivo» (per esempio EUR), il «Giorno del cambio», il «Cambio» (un numero maggiore di zero, fino a 8 decimali) e la «Fonte del cambio» (per esempio «Banca d'Italia, cambio del 12/10»).
3. Premi «Aggiungi il cambio» e poi «Controlla il mese».

Un'unità della prima valuta vale il cambio nella seconda, nel giorno indicato e nei 7 giorni dopo.

### Usare la scheda Rendiconti
1. Apri **Amministrazione › Chiusura mensile › Rendiconti**.
2. Se vuoi, filtra per stato (Bozza, Approvato, Pubblicato). Ogni scheda mostra l'immobile, il proprietario, il periodo, i ricavi, le commissioni e il netto pagabile.
3. Premi «Vedi dettagli». Qui puoi «Approva» una bozza e «Pubblica» un rendiconto approvato, con la conferma che ti ricorda le conseguenze: dopo l'approvazione non si modifica più, dopo la pubblicazione una correzione va nel rendiconto del mese dopo, e **da qui non parte nessun invio al proprietario**.
4. Per un rendiconto approvato o pubblicato premi «Scarica PDF» o «Scarica CSV». Per una bozza i file non ci sono.

In questa scheda non c'è un pulsante per creare rendiconti: vedi «Non ci sono ancora rendiconti generati» finché non ce ne sono. I rendiconti mensili di ogni proprietario, quelli che il proprietario legge nel portale, si preparano e si pubblicano dalla **Chiusura mensile**.

### Creare ed emettere la fattura al proprietario
Questa parte è **su attivazione**. La fattura dell'agenzia al proprietario comprende la provvigione, i riaddebiti e le spese anticipate di quel rendiconto, con la loro IVA.
1. Apri il rendiconto più recente del proprietario e vai al riquadro «Fattura del PM». Su una versione sostituita il riquadro dice «Questa versione è stata sostituita: la fattura si fa dall'ultima versione».
2. Premi «Crea la fattura». CasaZen prepara una **bozza** e scrive «Bozza pronta: totale…». Se nel frattempo il rendiconto o il mandato sono cambiati, premi «Ricalcola la bozza».
3. Controlla le righe e l'«IVA per aliquota» (premi «Rivedi la bozza»). La bozza si ricalcola dalla versione e dal mandato di adesso.
4. Premi «Emetti». La finestra «Emettere la fattura al proprietario?» mostra la serie, il totale e cosa segue: la fattura riceve **adesso** il suo numero, in ordine e senza buchi (il numero non si riusa); una volta emessa **non si modifica più**; l'IVA che aggiunge entra nel libro del proprietario una volta sola.
5. Premi «Emetti la fattura». Compare «Fattura N emessa».
6. Premi «Scarica il PDF». Se la fattura è «Compensata nel rendiconto» non devi incassare niente; se vedi «Da pagare» con un importo, è il proprietario a pagarla. Il PDF porta la QR-fattura per il pagamento, se l'agenzia ha registrato il suo IBAN.

Se emetti la fattura dopo aver approvato il rendiconto, il mese torna «Da aggiornare» e compare «La fattura è stata emessa dopo l'approvazione del rendiconto»: prepara una nuova versione. Solo titolare e amministratori possono creare ed emettere. Come funzionano i documenti emessi e l'invio allo SDI è in [[fisco-documenti]].

### Consultare le fatture ai proprietari
1. Apri **Chiusura mensile › Fatture ai proprietari**.
2. Filtra per «Proprietario» e «Mese».
3. Ogni riga mostra «Fattura n.» (o «Bozza»), il proprietario e il mese. Premi «Apri il rendiconto» per tornare al rendiconto, «Apri le righe» per le righe e i totali (imponibile, IVA per aliquota, bollo, totale) e «Scarica il PDF della fattura».

Se non ci sono fatture vedi «Non ci sono ancora fatture ai proprietari. Si creano dal rendiconto di un proprietario» e il pulsante «Apri la chiusura mensile». Se la funzione non è attiva la scheda non c'è.

### Collegare una fattura emessa fuori da CasaZen
Vale quando la fatturazione ai proprietari **non** è attiva: CasaZen non emette e tu fatturi dal tuo sistema. Il collegamento serve a ritrovare la fattura insieme al rendiconto.
1. Apri un rendiconto approvato o pubblicato. Prima dell'approvazione vedi «Potrai collegare una fattura quando il rendiconto sarà approvato».
2. In «Fatture emesse fuori da CasaZen» premi «Collega una fattura».
3. Scrivi «Sistema che l'ha emessa», «Numero della fattura», «Data della fattura», «Identificativo nel sistema», «Indirizzo del documento» (https) e l'«Impronta del file (SHA-256)». Con «Calcola l'impronta da un file» la calcola CasaZen: il file resta sul tuo computer.
4. Premi «Collega la fattura». Lo stato è «Da controllare». Dopo averla verificata premi «Segna come controllata».
5. Per toglierla premi «Scollega» e scrivi il motivo: il collegamento sparisce ma resta nella cronologia.

CasaZen conserva il collegamento, non l'importo. Il proprietario lo vede in «Fatture collegate».

### Preparare ed emettere le autofatture
Questa parte è **su attivazione**. Quando un portale estero ti fa pagare una commissione **senza IVA**, in Italia la integri con un'**autofattura TD17**, da emettere entro il giorno 15 del mese dopo. L'aliquota, il giorno e la serie sono scelte prudenti da confermare con il commercialista. L'autofattura è intestata a chi ha l'account del portale: «Agenzia» o «Proprietario».
1. Apri **Chiusura mensile › Autofatture (TD17)** e scegli il «Mese».
2. Premi «Prepara le bozze del mese». Se vedi «Il mese dei proprietari non è ancora registrato», vai alla chiusura mensile, premi «Controlla il mese» e riprova.
3. Leggi «Bozze di» e il mese: bozze nuove, aggiornate, già emesse, scartate perché non servono più. Se per qualcuno non si può fare la bozza vedi cosa manca (per esempio il profilo emittente). Le «Commissioni che non si autofatturano» dicono perché (per esempio «il titolare è un privato: il portale ha già messo l'IVA italiana»).
4. Su una bozza premi «Rivedi ed emetti» e controlla le righe (imponibile, IVA integrata) e il totale. Se compare «Una parte dell'importo è una stima», confrontala con la fattura del portale e spunta «Ho controllato la parte stimata… e la accetto».
5. Premi «Emetti» e conferma. L'autofattura riceve il numero nella serie del titolare. Poi puoi scaricare «PDF» e «XML».
6. Per una bozza sbagliata premi «Scarta la bozza»: non consuma nessun numero e potrai farne una nuova.

Cosa succede dopo: l'autofattura emessa non si modifica più. Come per ogni fattura elettronica italiana, l'invio allo SDI avviene con il collegamento di CasaZen o a mano ([[fisco-documenti]]).

### Correggere un'autofattura scartata dallo SDI
1. Apri l'autofattura «Scartata dallo SDI» e leggi «Perché lo SDI l'ha scartata».
2. Premi «Correggi e rimanda». Per il fisco quella scartata non è mai stata emessa: CasaZen ne fa una **bozza con lo stesso numero**, che non va allo SDI da sola.
3. Correggi ciò che lo SDI ha rifiutato e premi «Emetti».
4. Se la bozza non è più dovuta (per esempio il portale ha emesso una nota di credito) premi «Chiudi come non più dovuta», scegli il motivo (e una nota se vuoi) e conferma: la bozza si chiude per sempre, **non si annulla**, e il suo numero resta riservato (compare nel registro dei numeri non utilizzati che riceve il commercialista).

### Versare la ritenuta con il modello F24
1. Registra i pagamenti ai proprietari del mese ([[chiusura-mensile#registrare-il-pagamento-a-un-proprietario]]): è da lì che nascono le ritenute.
2. In fondo alla **Chiusura mensile**, nel riquadro «Ritenute e invii fiscali», leggi «F24 di» e il mese. Se ci sono ritenute vedi «Ritenute calcolate: … da versare con F24. Il file F24 non è ancora stato generato». Premi «Genera l'F24». Se non ci sono ritenute vedi «Nessuna ritenuta da versare per questo mese: senza ritenuta non c'è un F24».
3. Apri **Chiusura mensile › Ritenute d'acconto**. Scegli «Anno» e «Mese». In «Ritenute del mese» vedi per ogni proprietario base e ritenuto. In «F24 di» vedi codice tributo, importo totale, scadenza e riferimento. Premi «Scarica l'F24 (PDF)».
4. **Versa l'F24 tu o il tuo commercialista.** CasaZen non lo versa. La scadenza che CasaZen indica è il 16 del mese dopo (il 16 gennaio per dicembre): confermala con il tuo commercialista. In «Da fare» non c'è un avviso prima di quella data: segnala la scadenza nel tuo calendario (la pagina scrive «La scadenza era il …» solo quando è già passata).
5. Torna in «Ritenute d'acconto», premi «Registra pagamento», scegli il «Giorno del pagamento» e conferma «Registrare il pagamento dell'F24?». Non si annulla da qui, e CasaZen non verifica il versamento.
6. Nel riquadro «Ritenute e invii fiscali» segui il file: «Segna come verificato», «Registra l'invio» (scrivi chi l'ha trasmesso e come) e «Registra la ricevuta» (il riferimento della ricevuta dell'Agenzia delle Entrate) oppure «Segna come rifiutato» (con il motivo). Senza riferimento di invio o ricevuta CasaZen non lo considera spedito né accettato.
7. Se le ritenute cambiano (per esempio un pagamento stornato) premi «Rigenera dai dati». Se vedi «L'F24 non corrisponde alle ritenute del mese», rigeneralo prima di andare avanti.

### Preparare i dati per il commercialista
1. Apri **Chiusura mensile** e scorri fino a «Dati per il commercialista».
2. Per ogni riga premi «Scarica CSV» o «Scarica Excel»: «Dati dell'F24» del mese (sempre disponibile); su attivazione, «Certificazione Unica» dell'anno (una riga per ogni destinatario e i suoi soggiorni, più un «Prospetto PDF» di bozza per ogni proprietario, con la filigrana «bozza»), «Dati del modello 770» e «Comunicazione dei contratti di locazione breve» (da comunicare entro il 30 giugno dell'anno dopo).
3. Per la Certificazione Unica premi prima «Genera i dati annuali» (nel riquadro «Dati annuali per la Certificazione Unica»), poi segui «Segna come verificato», «Registra l'invio» e «Registra la ricevuta».

CasaZen prepara i dati e **non trasmette niente**: la compilazione e l'invio li fa il tuo commercialista, e le date di legge (per esempio il 30 giugno dell'anno dopo per la comunicazione dei contratti) le confermi con lui: CasaZen non ti manda un avviso in «Da fare» per la Certificazione Unica, il 770 o la comunicazione. «Registra l'invio» e «Registra la ricevuta» scrivono solo quello che dichiari tu. Se un file non c'è, la riga dice perché («nessuna ritenuta nel periodo», «dati annuali non ancora generati»). Per i report generali di incassi e fisco vedi [[report-commercialista]].

### Decidere il regime di un soggiorno con conduttore società
Questa parte è **su attivazione**. Se il conduttore è una società e l'immobile è di un proprietario privato, non è chiaro se vale il regime delle locazioni brevi: lo decidi tu, sentito il commercialista. Finché nessuno decide, il soggiorno resta una locazione breve.
1. Nella finestra «Registra un pagamento» cerca «Conduttori società».
2. Per il soggiorno premi «Decidi» e scegli «Resta una locazione breve» (l'agenzia trattiene la ritenuta come per gli altri soggiorni) oppure «Non è una locazione breve» (nessuna ritenuta).
3. Scrivi «Perché hai deciso così» (una nota per chi controllerà: non scrivere dati del conduttore) e premi «Registra la decisione».

Una nuova decisione prende il posto della precedente, che resta nello storico. La decisione vale per il soggiorno e per tutti i proprietari dell'immobile.

### Creare il file dei bonifici per la banca
1. Apri **Chiusura mensile › Bonifici proprietari**.
2. In «Pagamenti da inviare in banca» trovi i pagamenti ai proprietari **per valuta** («Pagamenti in EUR», «Pagamenti in CHF»), con l'importo netto dopo la ritenuta. Compaiono solo se li hai registrati nella chiusura mensile, se il rendiconto è pubblicato al proprietario e se il netto è maggiore di zero. Se non c'è niente vedi «Nessun pagamento da inviare in banca».
3. Se un proprietario non ha l'IBAN vedi «IBAN mancante»: non si può pagare finché non lo aggiungi («Apri i dati finanziari»).
4. Scegli i pagamenti uno per uno oppure «Scegli tutti» per valuta; «Togli la scelta» per annullare.
5. Scegli il «Giorno di esecuzione»: oggi o un giorno dopo.
6. Premi «Crea i file per la banca» e conferma «Creare i file per la banca?». Se hai scelto più valute si crea **un file per valuta**.

Cosa succede dopo: i pagamenti scelti entrano nel file e non si possono mettere in un altro. CasaZen crea il file, **non esegue i bonifici**. Per gli euro il file è un bonifico SEPA; per i franchi, un file svizzero (formato ISO 20022 in entrambi i casi).

### Scaricare il file e segnarlo come pagato
1. Nell'elenco «File per la banca» trova il file (stato «File creato, non ancora scaricato») e premi «Scarica il file per la banca (ISO 20022)».
2. Carica il file nella tua banca ed esegui i bonifici. Dopo il download lo stato diventa «File scaricato, non ancora segnato come pagato». Finché il file è «File creato, non ancora scaricato» vedi anche «Confermato scaricato» e «Confermato pagato» non si può ancora premere.
3. Quando la banca ha eseguito i bonifici premi «Confermato pagato» e conferma «Segnare il file come pagato?».
4. Lo stato diventa «Segnato come pagato dall'amministratore».

Non si annulla da qui. CasaZen non sa se la banca ha eseguito: lo segni tu. Il file mostra i pagamenti che contiene («Mostra i pagamenti del file»); uno annullato dopo la creazione è segnato «Annullato dopo la creazione del file».

## Flussi completi

### Flusso: dal mese finito al mese chiuso
1. Il mese finisce. L'amministratore apre **Chiusura mensile** e premi «Controlla il mese» ([[chiusura-mensile#controllare-il-mese-e-risolvere-le-anomalie]]).
2. Risolve le anomalie: commissioni dei canali, cambi, mandato, regola fiscale, quote.
3. Prepara i rendiconti (a uno a uno o con «Esegui per tutti»), li controlla e li **approva**.
4. **Pubblica**: CasaZen avvisa ogni proprietario con un'e-mail senza importi ([[agenzie-proprietari#leggere-un-rendiconto-nel-portale-per-il-proprietario]]).
5. Registra i **pagamenti** ai proprietari; CasaZen decide le ritenute.
6. Crea il file dei **bonifici**, lo carica in banca e segna «Confermato pagato».
7. **Chiude il mese** di ogni proprietario, con il saldo che torna con i pagamenti.
8. Se le ritenute ci sono: versa l'F24 e registra il pagamento ([[chiusura-mensile#versare-la-ritenuta-con-il-modello-f24]]).

### Flusso: la ritenuta, dal pagamento all'F24
1. L'agenzia registra il pagamento al proprietario: CasaZen decide la ritenuta con la regola approvata e ne conserva la prova.
2. Nella chiusura mensile premi «Genera l'F24»: CasaZen riunisce le ritenute del mese per codice tributo.
3. L'agenzia o il commercialista versa l'F24; l'agenzia registra il giorno.
4. A fine anno CasaZen prepara i dati annuali per la Certificazione Unica; il commercialista la compila e la invia; l'agenzia registra invio e ricevuta.
5. Il proprietario vede le sue ritenute e i dati della Certificazione Unica quando l'agenzia li ha verificati.

### Flusso: la fattura dell'agenzia al proprietario (su attivazione)
1. Il rendiconto è approvato. Nel riquadro «Fattura del PM» l'amministratore preme «Crea la fattura».
2. Rivede la bozza e preme «Emetti»: la fattura riceve il numero.
3. L'IVA della fattura entra nel libro del proprietario; il rendiconto la include (con una nuova versione se era già approvato).
4. Il proprietario trova la fattura in «Contabilità › Fatture del gestore» con il suo PDF.
5. La fattura è «Compensata nel rendiconto» o «Da pagare» dal proprietario.

### Flusso: l'autofattura dei portali esteri (su attivazione)
1. Il portale estero fattura la commissione senza IVA. L'agenzia ha chiuso il mese dei proprietari.
2. In **Autofatture (TD17)** premi «Prepara le bozze del mese».
3. Controlla ed **emetti** entro il giorno 15 del mese dopo.
4. L'autofattura va allo SDI; se è scartata la correggi con lo stesso numero ([[fisco-documenti]]).

## Regole e limiti
- Le pagine di questa parte servono il **piano Agency** e il ruolo di **titolare o amministratore** (con accesso a tutte le strutture), e sono su attivazione. Se il piano Agency risulta in fase di riduzione, puoi consultare ma le modifiche vengono rifiutate.
- Non si annullano dall'app: un rendiconto pubblicato (si sostituisce con una nuova versione), un pagamento registrato, un mese chiuso, una fattura emessa, il pagamento dell'F24 registrato e un file dei bonifici segnato come pagato.
- Il mese si chiude solo **dopo la sua fine**. La pagina si apre sul mese scorso.
- Una versione approvata o pubblicata **non si modifica mai**: serve una nuova versione. Un rendiconto «Da aggiornare» non si approva né si pubblica.
- Un rendiconto con anomalie che bloccano resta «Segnalato» e non si approva.
- Per chiudere un mese il saldo deve **tornare con i pagamenti**; con una differenza o un saldo negativo serve un motivo scritto, e solo titolare e amministratori possono farlo.
- In un mese chiuso non si registra niente. Una rettifica va in un mese aperto.
- La ritenuta si decide **solo** alla registrazione del pagamento, con una regola approvata, in vigore quel giorno e della stessa giurisdizione del profilo.
- L'F24 si fa solo se nel mese c'è almeno una ritenuta (la scadenza indicata nei dati è il 16 del mese dopo). Il pagamento dell'F24 lo registri tu e CasaZen non lo verifica. Un file fiscale è «inviato» solo con il riferimento di invio e «accettato» solo con la ricevuta.
- Il file dei bonifici contiene solo pagamenti confermati, di rendiconti **pubblicati**, con netto maggiore di zero e con l'IBAN del proprietario; un pagamento va in **un solo file**; un file è in **una sola valuta** (euro o franchi). La data di esecuzione è oggi o dopo.
- Le pagine dei bonifici, delle ritenute e dei rendiconti riguardano tutti i proprietari: chi ha accesso solo ad alcune strutture non le vede.
- L'autofattura TD17 si fa solo per commissioni di portali esteri senza IVA, in euro, a un titolare italiano con partita IVA (non a un privato: il portale ha già messo l'IVA italiana).
- Il numero di una fattura o di un'autofattura emessa è in ordine, senza buchi e non si riusa; una bozza scartata non consuma numeri.
- CasaZen non esegue bonifici, non versa tasse e non trasmette dichiarazioni.

## Domande frequenti

### Posso chiudere il mese prima che finisca?
No. Fino all'ultimo giorno del mese il pulsante «Chiudi il mese» non c'è e la riga dice «Il mese si potrà chiudere quando sarà finito».

### Posso modificare un rendiconto già approvato o pubblicato?
No. Prepara una **nuova versione** con «Rigenera come nuova versione»: la vecchia resta consultabile come sostituita, la nuova è una bozza e va approvata e pubblicata di nuovo.

### Il rendiconto è un documento fiscale?
No. È il riepilogo di quello che l'agenzia deve al proprietario. Le fatture sono un'altra cosa: vedi «Chi emette cosa».

### Chi emette la fattura al proprietario?
Se la funzione è attiva, la emetti da CasaZen con «Emetti». Se non lo è, CasaZen non emette: fatturi dal tuo sistema e colleghi la fattura al rendiconto.

### CasaZen paga i proprietari?
No. Registra il pagamento e prepara il file per la banca: i bonifici li esegui tu e poi premi «Confermato pagato».

### CasaZen versa la ritenuta?
No. Prepara l'F24 e i dati: lo versi tu o il tuo commercialista e registri il giorno.

### Il proprietario vede il rendiconto subito?
Solo dopo «Pubblica». Una bozza o un rendiconto approvato non sono visibili nel portale.

### Cosa succede se un pagamento arriva dopo la chiusura del mese?
Il mese resta chiuso. Compare l'avviso «È arrivato un movimento dopo la chiusura»: registra una rettifica in un mese aperto.

### Un proprietario non compare nei bonifici. Perché?
Controlla tre cose: il pagamento è registrato nella chiusura mensile; il rendiconto è pubblicato; il netto è maggiore di zero. Se il proprietario ha «IBAN mancante» compare ma non si può pagare.

### Ho registrato un pagamento sbagliato. Come lo correggo?
Nella pagina non c'è un pulsante per annullarlo e non esiste una procedura che tu possa fare da solo: scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza») dicendo quale pagamento è sbagliato e perché. Non registrare un secondo pagamento per «compensare»: il totale pagato salirebbe. Per evitarlo, controlla sempre data e importo prima di confermare.

### Posso riaprire un mese chiuso?
No: nell'app non c'è un comando per riaprirlo. Quello che arriva dopo la chiusura va in una rettifica di un mese aperto.

### Ho pubblicato un rendiconto per sbaglio. Posso ritirarlo?
No. Il proprietario è già stato avvisato (l'e-mail non contiene importi) e vede il rendiconto nel portale. Prepara una nuova versione con «Rigenera come nuova versione»: sostituisce la precedente, che resta consultabile.

### CasaZen avvisa il proprietario che il bonifico è partito?
No. Il file dei bonifici non esegue niente e CasaZen non sa se la banca ha pagato: «Confermato pagato» lo premi tu quando i bonifici sono stati eseguiti.

### Perché la scheda «Rendiconti» è vuota?
Non crea rendiconti: mostra quelli per immobile già generati. I rendiconti dei proprietari si preparano dalla chiusura mensile.

### La data dell'F24 è scaduta. Cosa succede?
La pagina dice «La scadenza era il … e il pagamento non è registrato» finché non registri il pagamento.

## Glossario
- **Rendiconto**: il riepilogo mensile di ciò che l'agenzia deve al proprietario. Non è un documento fiscale.
- **Versione**: una copia del rendiconto preparata in un certo momento; ogni cambiamento ne crea una nuova.
- **Libro del proprietario**: il registro che raccoglie, riga per riga, incassi, commissioni, spese, pagamenti e ritenute.
- **Anomalia**: un problema che segnala il mese; alcune bloccano la chiusura.
- **Riconciliazione**: il confronto tra il saldo approvato e i pagamenti.
- **Rettifica**: una riga in più, con motivo, che sistema il conto senza cancellare niente.
- **Ritenuta d'acconto** (dell'agenzia): la parte del pagamento al proprietario che l'agenzia trattiene per il fisco quando la regola lo prevede, e poi versa con l'F24. Non è la ritenuta che un portale può trattenere sulle prenotazioni.
- **Locazione breve**: l'affitto di una casa per un periodo breve, il caso in cui l'agenzia può dover trattenere la ritenuta (le condizioni esatte sono quelle della regola fiscale approvata dal commercialista).
- **F24**: il modello con cui si versa la ritenuta. CasaZen lo prepara, non lo versa.
- **Certificazione Unica (CU) e modello 770**: dichiarazioni annuali sulle ritenute. CasaZen prepara i dati; le compila e le invia il commercialista.
- **Autofattura TD17**: la fattura con cui si integra l'IVA su una commissione che un portale estero ti ha fatturato senza IVA italiana.
- **Bozza e «Emetti»**: la bozza si può scartare; con «Emetti» la fattura prende il suo numero, in ordine e senza buchi, e non si modifica più.
- **Quota**: la parte di un immobile che spetta a un proprietario (due proprietari al 50% fanno 100%).
- **Mandato**: l'accordo con cui il proprietario affida l'immobile all'agenzia (provvigione, IVA, forfait): vedi [[agenzie-proprietari]].
- **SDI**: il sistema che riceve le fatture elettroniche italiane.
- **ISO 20022**: il formato del file che la banca legge per eseguire i bonifici.

## Vedi anche
- [[agenzie-proprietari]]: il piano Agency, i dati dei proprietari, il mandato e il portale.
- [[fisco-documenti]]: fatture, ricevute, numerazione e invio allo SDI.
- [[report-commercialista]]: report e pacchetto per il commercialista.
- [[incassi]]: come arrivano i pagamenti delle prenotazioni che finiscono nei rendiconti.
