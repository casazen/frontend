---
id: imposta-soggiorno-documenti
titolo: Imposta di soggiorno, archivio documenti e check-out
menu: Imposta di soggiorno e documenti
sezione: Adempimenti
ordine: 32
riassunto: Come CasaZen calcola l'imposta di soggiorno (e cosa non calcola), dove inserisci la tariffa se il tuo comune non c'è, come registri i versamenti al comune, dove trovi tutti i documenti, come si chiude un soggiorno con il check-out guidato e cosa succede ai dati degli ospiti nel tempo.
chi: [gestore, amministratore, commercialista]
dove: Affitti brevi › Incassi › Documenti; Report › Imposta di soggiorno; Prenotazioni › check-out
parole_chiave: [imposta di soggiorno, tassa di soggiorno, tariffa del comune, comune senza tariffa, esenzioni, versamento, registra versamento, ricevuta, report, fine anno, conto dell'agente, StayTour, documenti, archivio, ZIP, check-out, chiudi soggiorno, casa pronta, privacy, conservazione, GDPR, anonimizzare, cancellare dati ospite]
copre: [/app/short-rent/bookings/:id/checkout, /app/short-rent/reports/tourist-tax, /app/short-rent/reports/tourist-tax/year-end, /app/short-rent/documents]
stato: disponibile
fonte_codice: [frontend/src/features/reports/tourist-tax/tourist-tax-summary-page.tsx, frontend/src/features/reports/tourist-tax/tourist-tax-year-end-page.tsx, frontend/src/features/document-archive/documents-page.tsx, frontend/src/features/compliance/checkout-wizard.tsx, frontend/src/features/compliance/components/checkout-wizard-steps.tsx, frontend/src/features/checkin/wizard/steps/tax-step.tsx, frontend/src/features/checkin/wizard/steps/tax-rate-substep.tsx, frontend/src/features/properties/components/property-institutional-portals.tsx, backend/Casazen.Core/TouristTax/TouristTaxCalculator.cs, backend/Casazen.Web/Controllers/StayTouristTaxController.cs, backend/Casazen.Infrastructure/Services/ComplianceStatusService.cs, backend/docs/runbooks/tourist-tax-rates.md, backend/docs/runbooks/tourist-tax.md, backend/docs/runbooks/gdpr.md, backend/Casazen.Web/appsettings.json]
---

## In breve
CasaZen **calcola** l'imposta di soggiorno di ogni soggiorno con la tariffa del comune (o con quella che inserisci tu se il comune non c'è), tiene i totali **per comune e per periodo**, ti fa registrare i **versamenti** e conservare le ricevute. **CasaZen non paga il comune e non presenta la dichiarazione**: le fai tu o il tuo commercialista, poi le registri qui. In **Documenti** trovi tutto in un posto (fatture, ricevute, prove, contratti) e nel **check-out** chiudi il soggiorno con i controlli finali.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Calcolo dell'imposta | Calcola l'imposta del soggiorno notte per notte con la tariffa del comune | Automatico (prenotazioni, attivazione, check-out) | gestore, amministratore | Disponibile dove il comune ha una tariffa | Capire come CasaZen calcola l'imposta |
| Tariffa nell'attivazione | Mostra tariffa, notti tassate al massimo, esenzione per età, data di inizio, fonte | Passo «Imposta di soggiorno» dell'attivazione | chi può modificare gli immobili | Disponibile | Capire come CasaZen calcola l'imposta |
| Tariffa inserita da te | Se il comune non ha una tariffa in CasaZen, la inserisci tu e CasaZen ricalcola | Check-in guidato › passo «Imposta di soggiorno» › «Inserisci l'imposta del tuo comune» | chi può modificare gli immobili | Disponibile | Inserire la tariffa del tuo comune |
| Imposta dovuta e versata | Per ogni comune e periodo: dovuta, versata, saldo, stato, ricevute | Report › Imposta di soggiorno | gestore, amministratore, commercialista | Disponibile | Registrare un versamento al comune |
| «Registra versamento» | Annota quanto hai già versato al comune e allega la ricevuta (non paga nulla) | Imposta di soggiorno: dovuta e versata | chi può modificare i pagamenti | Disponibile | Registrare un versamento al comune |
| «Scarica CSV» | File del riepilogo per il periodo | Imposta di soggiorno: dovuta e versata | chi può leggere i pagamenti | Disponibile | Scaricare il riepilogo dell'imposta |
| Imposta di soggiorno: fine anno | Dichiarazione ai comuni, conto dell'agente, conteggio notti del Ticino, in CSV o Excel | Report › Imposta di soggiorno › fine anno | chi può leggere i pagamenti, con accesso a tutti gli immobili | Su attivazione | Preparare i file di fine anno |
| Pagamento online dell'imposta | L'ospite paga l'imposta durante il check-in | Check-in online dell'ospite | ospite | Su attivazione | Capire come viene incassata l'imposta |
| Documenti | Elenco unico dei documenti che puoi leggere, con ricerca e filtri | Affitti brevi › Incassi › Documenti | chi può leggere gli immobili | Disponibile | Cercare e scaricare un documento |
| «Scarica archivio» | ZIP dei documenti di un periodo | Documenti | come sopra | Disponibile | Scaricare l'archivio di un periodo |
| Check-out guidato | Chiude il soggiorno: partenza, Alloggiati, pulizie, imposta, casa pronta | Prenotazione › check-out; Adempimenti › «Registra partenza» | chi può modificare le prenotazioni | Disponibile | Chiudere un soggiorno con il check-out |
| Privacy dell'ospite | Esporta, anonimizza o cancella i dati; mostra i periodi di conservazione | Scheda dell'ospite › Privacy | gestore, amministratore | Disponibile | [[ospiti-checkin#esportare-anonimizzare-o-cancellare-i-dati-di-un-ospite]] |

## Come funziona

### Come CasaZen calcola l'imposta di soggiorno
Il calcolo è fatto da CasaZen, una sola volta e con le stesse regole ovunque (prenotazioni dirette, prenotazioni inserite da te, procedura di attivazione, calcolatore pubblico). Si basa sulle **tariffe dei comuni**, che mantiene CasaZen. Se il tuo comune non c'è, puoi inserire tu la tariffa (vedi «Dove si configura»).

Le regole:
- **Notte per notte.** Ogni notte è presa con la sua data (ora italiana) e con la tariffa in vigore quella notte. Un soggiorno a cavallo di un cambio di stagione o di tariffa è tassato notte per notte.
- **Tariffa.** Può essere un importo a persona per notte («{importo} a persona per notte») oppure una percentuale del prezzo per persona per notte, con un massimo per persona (per esempio «{percentuale}% del prezzo per persona per notte, massimo {importo}»).
- **Notti massime.** Sono tassate solo le prime notti **di ogni soggiorno** fino al massimo del comune («massimo N notti tassate»).
- **Tetti annuali: CasaZen non li applica.** Alcuni regolamenti comunali fissano un massimo di notti tassate nell'anno per la stessa persona; CasaZen conta il massimo solo per soggiorno. Se il tuo comune ha un tetto annuale, l'importo calcolato può essere **più alto del dovuto**: controlla il regolamento sul sito del comune.
- **Età.** Gli adulti contano come 18 anni e non sono mai esenti per età. I minori sotto l'età minima del comune sono **esenti**; tra l'età minima e quella massima pagano la **tariffa ridotta** pubblicata dal comune. L'età è quella al check-in, indicata dall'ospite: dove le regole dipendono dall'età il check-in la chiede per ogni minore.
- **Categoria.** Dove la tariffa dipende dalla categoria della struttura (per esempio Roma e Venezia) il calcolo automatico per l'immobile non è ancora disponibile: l'attivazione dice «la tariffa dipende dalla categoria della struttura: il calcolo automatico non è ancora disponibile».
- **Arrotondamento.** Ogni importo per ospite e per notte è arrotondato al centesimo e poi sommato: il totale è esatto al centesimo.
- **Senza tariffa.** Se per una notte non c'è una tariffa, **non c'è nessun importo**: CasaZen non mette mai zero né una stima, e la prenotazione prosegue senza imposta.
- **Esenzioni.** CasaZen conosce questi motivi di esenzione: residente nel comune, soggiorno per cure o motivi sanitari, familiare del gestore, forze dell'ordine o altro servizio pubblico in servizio, accompagnatore di una persona con disabilità, altra esenzione prevista dal comune. I minori esenti per età lo sono in automatico. Le altre esenzioni le scegli tu, ospite per ospite (check-in e check-out guidati): CasaZen non controlla che tu ne abbia diritto.

> **Nota:** la tariffa registrata in CasaZen è un aiuto, non la fonte ufficiale. Nell'attivazione vedi «Fonte ufficiale del comune» e l'avviso «Tariffa registrata in CasaZen: prima di riscuoterla verifica esenzioni e aggiornamenti sul sito del comune.»

### Dove si configura
- **La tariffa del comune.** Le tariffe ufficiali le mantiene CasaZen. Se il comune del tuo immobile non ne ha una, il passo «Imposta di soggiorno» dell'attivazione dice «Il comune di {città} non ha ancora una tariffa in CasaZen» e ti invita a verificare con il comune se l'imposta è dovuta e con quale tariffa. Quel passo è solo un avviso: puoi attivare comunque l'immobile. In Adempimenti la voce «Inserisci l'imposta di soggiorno del comune» resta finché la tariffa manca (non vale mai zero) e il suo pulsante «Inserisci l'imposta» ti porta alla scheda dell'immobile, che però non ha un campo per la tariffa. **Dove la inserisci davvero:** nel check-in guidato di una prenotazione, passo «Imposta di soggiorno», con «Inserisci l'imposta del tuo comune» (vedi «Inserire la tariffa del tuo comune»). Se per il tuo comune esiste già una tariffa ufficiale vale quella e non puoi inserirne un'altra.
- **Il comune dell'immobile** si sceglie dall'elenco ufficiale dei comuni nei dati dell'immobile. Senza comune scelto dall'elenco non si applicano le regole della tua regione, l'imposta per codice e il controllo del CIN.
- **Esenzioni e come è stata riscossa** si indicano per soggiorno (check-in e check-out guidati).

### Come viene incassata
Dipende dal soggiorno. Nel **check-out** ti viene chiesto «Come è stata riscossa l'imposta?» con quattro risposte:
- **Riscossa online, con il pagamento della prenotazione**: nelle prenotazioni dirette pagate tramite CasaZen l'imposta è compresa nel totale pagato (sul sito di prenotazione l'ospite vede «Tassa di soggiorno (inclusa nel totale)»).
- **Riscossa in struttura**: l'ospite l'ha pagata da te.
- **Non riscossa**: «Un'imposta dovuta e non riscossa va gestita secondo il regolamento del comune.»
- **Non dovuta per questo soggiorno**.

Per le prenotazioni dei portali (come Airbnb o Booking.com) CasaZen non ha un importo se il portale lo incassa o se il comune non ha tariffa: il check-out lo dice («CasaZen non ha un importo dell'imposta per questo soggiorno: verifica l'importo con il regolamento del comune») e i totali segnalano «Importo incompleto».

**Pagamento online dell'imposta durante il check-in** (su attivazione, [[per-iniziare#cosa-significa-su-attivazione]]). Se è acceso per la tua organizzazione e hai un account di pagamento collegato, l'ospite può pagare l'imposta online nel check-in: l'importo va direttamente sul tuo account, senza commissione di CasaZen. L'imposta pagata online non crea un pagamento nei tuoi incassi né cambia i ricavi. Se il soggiorno è annullato prima dell'arrivo, CasaZen rimborsa l'imposta; dopo l'arrivo decidi tu (ti arriva una cosa da fare). Puoi anche scegliere di trattenere il codice della serratura finché l'imposta non è pagata.

### Come viene rendicontata
La pagina **Imposta di soggiorno: dovuta e versata** mette insieme, per ogni comune e periodo:
- **Dovuta**: l'imposta registrata sui soggiorni con check-in nel periodo;
- **Versata**: i versamenti che hai registrato con periodo compreso nel periodo;
- **Saldo**: la differenza dei due totali. Lo stato di ogni comune è «Da versare», «Versata», «Versata in più» o «Nessun importo registrato».

Il periodo si sceglie tra i periodi proposti o con date a scelta, al massimo un anno. Contano solo gli immobili in Italia. I soggiorni senza imposta registrata non sono contati come zero: sono segnalati («N soggiorni non hanno l'imposta registrata: l'importo dovuto può essere incompleto»). Un versamento è una **tua dichiarazione**, non un movimento bancario: più versamenti per lo stesso comune e periodo sono rate. Se il tuo accesso copre solo alcuni immobili, vedi l'imposta dovuta su quelli ma non i versamenti, che appartengono a tutta l'organizzazione.

Nella scheda dell'immobile, scheda **Documenti e adempimenti**, riquadro **Imposta di soggiorno**, trovi il collegamento al rendiconto per comune («Apri il rendiconto per Comune»). Per **Como** la dichiarazione mensile si fa su StayTour (il portale del comune) con SPID o CIE, cioè con l'identità digitale o la carta d'identità elettronica («Accedi a StayTour Como»), usando il rendiconto per controllare gli importi: CasaZen non la invia. Per gli altri comuni il riquadro rimanda alla procedura prevista dal comune.

Il riepilogo **Dichiarazione mensile · Como**, nello stesso riquadro, conta per il mese scelto gli ospiti imponibili, i pernottamenti imponibili e l'imposta a carico del gestore dei soggiorni con uscita nel mese e imposta confermata. Prima di dichiarare su StayTour controlla le causali di esenzione. I soggiorni «da riconciliare» (data di uscita mancante o diversa da quella usata per il calcolo) e quelli «da completare o riconfermare» (dati mancanti o da riconfermare) restano fuori dai totali finché non li sistemi. «Imposta riscossa dal portale» dice per quanti soggiorni l'imposta l'ha già riscossa il portale di prenotazione: controlla sugli estratti degli intermediari tutte le riscossioni del mese, anche quelle dei soggiorni con uscita in altri mesi. «Archivia la conferma di StayTour» salva la conferma nell'archivio e «Consulta le conferme del mese» la ritrova.

**Scadenze.** CasaZen **non conosce la scadenza** della dichiarazione e del versamento del tuo comune e non la inventa: la trovi nel regolamento o sul sito del comune. In Adempimenti le voci «Dichiara e paga l'imposta di soggiorno di {mese}» compaiono quando il mese è finito e ci sono soggiorni con imposta. Con il semaforo la voce è «Da fare» finché non carichi né la dichiarazione né la ricevuta del pagamento, «In corso» con una sola delle due, «In regola» con tutte e due. Il pulsante ti porta all'archivio delle prove, già filtrato sul mese, per caricare la dichiarazione o il pagamento.

### Fine anno
La pagina **Imposta di soggiorno: fine anno** (su attivazione) prepara i dati da consegnare, per l'anno scelto in «Anno». Sono dati di preparazione: **CasaZen non invia niente**, i moduli li compila e li consegna chi di dovere, tu o il tuo commercialista. Contiene:
- **Italia: il {anno} in breve**: notti, imposta dovuta, versata e saldo, con «Apri il riepilogo per comune».
- **Dichiarazione ai comuni {anno}**: per ogni comune notti e ospiti, soggiorni con e senza imposta, imposta dovuta, versata e differenza, con i versamenti. Le esenzioni sono contate per motivo, mai per nome.
- **Conto dell'agente {anno}**: imposta riscossa e versata comune per comune, «Mese per mese» o «Trimestre per trimestre».
- **Conteggio delle notti in Ticino {anno}**: per ogni immobile in Ticino, soggiorni e notti con e senza imposta (secondo i documenti emessi) e importi in franchi, da consegnare all'ente turistico **entro il 5 gennaio** dell'anno dopo. I soggiorni «Senza documento» sono quelli per cui non è ancora stato emesso un documento: non sono contati come senza imposta.
- **File da consegnare**: «Scarica CSV» o «Scarica Excel».

Servono il permesso di leggere i pagamenti **e** l'accesso a tutti gli immobili dell'organizzazione: con un accesso limitato la pagina lo dice e non mostra le cifre.

### Archivio documenti
**Documenti** raccoglie in un solo elenco tutto ciò che puoi leggere. Cosa contiene, per tipo: «Fattura», «Nota di credito», «Ricevuta», «Contratto», «Documento dell'immobile», «Ricevuta Alloggiati», «Prova ISTAT», «Imposta di soggiorno», «Altro documento». Quali tipi vedi lo decide il sistema in base ai tuoi permessi: per esempio le ricevute Alloggiati richiedono il permesso di leggere i dati degli ospiti, quelle dell'imposta di soggiorno il permesso sui pagamenti. I documenti di un immobile eliminato non compaiono.

Puoi **cercare** («Cerca per titolo, immobile o codice prenotazione»), **filtrare** per tipo (ogni tipo ha il suo contatore), per «Data del documento» e per «Immobile», **scaricare** un file e scegliere quanti documenti vedere per pagina. Se un documento non ha il file compare «Nessun file». La pagina, i filtri e la dimensione dell'elenco restano nell'indirizzo: se ricarichi o torni indietro, ritrovi il punto in cui eri.

«Scarica archivio» crea un **file ZIP** dei documenti di un periodo (al massimo 24 mesi), con una cartella per ogni tipo e un indice in CSV; un documento senza file compare nell'indice con la colonna del file vuota. Se i file sono troppi o troppo grandi, ti chiede di scegliere un periodo più breve o meno tipi.

### Check-out guidato
Il check-out si apre dalla prenotazione o dalla voce «Chiudi la partenza di {nome}» in Adempimenti (pulsante «Registra partenza») e serve a chiudere il soggiorno con tutto in ordine. È disponibile **dal giorno di arrivo**, per una prenotazione confermata o con arrivo registrato; se l'arrivo non risulta compare «Arrivo non registrato» e puoi usare «Registra arrivo e procedi». Un check-out già fatto non si ripete («Check-out già completato»). Non è l'unico modo di registrare la partenza: con le impostazioni iniziali CasaZen la registra da sola all'orario di check-out, ma senza chiederti imposta, pulizie e casa pronta (vedi [[prenotazioni#due-modi-di-chiudere-un-soggiorno]]).

**Non è obbligatorio e nessun passo lo blocca**, ma è il momento in cui indichi come è stata riscossa l'imposta di soggiorno, chiedi le pulizie a un fornitore e dichiari la casa pronta per il prossimo ospite. Se lo salti, queste cose restano da fare: la voce «Chiudi la partenza di {nome}» e quella della casa da dichiarare pronta restano in **Adempimenti › Da chiudere**, e può mancare l'indicazione di come è stata riscossa l'imposta di quel soggiorno.

I passi:
1. **Soggiorno**: riepilogo di ospite, immobile, date, ospiti (minori compresi), provenienza; spunta «Confermo che l'ospite ha lasciato la struttura.»; puoi scrivere «Note per il fornitore».
2. **Alloggiati**: ti dice lo stato della comunicazione. Non blocca il check-out; se manca puoi aprire «Completa i dati degli ospiti» senza uscire.
3. **Pulizie**: «Vuoi richiedere le pulizie a un fornitore?» con «Sì, invia una richiesta a un fornitore» o «No, salta questo passaggio». Se nel comune non ci sono fornitori attivi, puoi saltare.
4. **Imposta**: «Come è stata riscossa l'imposta?» (vedi sopra).
5. **Proprietà pronta**: «La proprietà è pronta per il prossimo ospite?» con «Sì, è pronta» o «Non ancora» e una nota facoltativa.

Alla fine premi **«Chiudi soggiorno»**: il soggiorno risulta concluso. Se rispondi «Non ancora», il soggiorno si chiude lo stesso, ma la casa resta tra gli Adempimenti finché non la dichiari pronta («Dichiara la proprietà pronta»). Con il channel manager collegato il check-out è passato in automatico, ma CasaZen non mostra se è arrivato. «Salva ed esci» conserva quello che hai già risposto.

### Conservazione e privacy dei dati degli ospiti
CasaZen tiene i dati degli ospiti per obbligo di legge e li cancella dopo un periodo fisso. I periodi, come li vedi nella scheda dell'ospite (scheda **Privacy**, «Conservazione per categoria di dati»):

| Categoria | Cosa comprende | Per quanto tempo |
|---|---|---|
| Scansioni del documento | foto e copie dei documenti degli ospiti | 5 anni dall'ultimo check-out |
| Dati Alloggiati Web | nascita, cittadinanza, sesso, documento e accompagnatori | 5 anni dal check-out del soggiorno |
| Dati fiscali | anagrafica e contatti legati ai pagamenti e ai documenti fiscali | 10 anni |
| Consenso marketing | il consenso dato dall'ospite | fino alla revoca |

Se un periodo non è configurato la scheda scrive «Periodo non configurato: nessuna cancellazione automatica». Ogni notte CasaZen applica i periodi: scaduto il periodo l'ospite viene anonimizzato (nomi e dati personali sostituiti) e i file sono cancellati. Gli altri dati dei documenti per le ricevute restano 5 anni (vedi [[alloggiati-istat]]).

In più, **su attivazione**, appena un soggiorno ha la **ricevuta Alloggiati** archiviata, CasaZen cancella dall'archivio le **foto dei documenti** degli ospiti e la scansione del referente: non si annulla. I dati dei documenti dei soggiorni (numero, tipo, date) **non** si toccano: sono la registrazione di legge. Un soggiorno solo affidato al channel manager, senza ricevuta, non cancella niente.

Nella scheda **Privacy** di un ospite puoi **esportare**, **anonimizzare** o **cancellare** i dati. L'esportazione produce un file con tutti i dati (incluso il documento in chiaro, che compare solo qui). «Anonimizza» e «Cancella definitivamente» sono irreversibili; non sono possibili se l'ospite ha prenotazioni in corso o future («Questa azione renderà anonimi tutti i dati personali dell'ospite. Non sarà più possibile identificarlo.»). Restano conservati, perché servono come prova: lo stato e la ricevuta delle comunicazioni, le prenotazioni con importi e pagamenti, il registro degli eventi (senza dati personali), la storia dei consensi.

Il **consenso marketing** non lo può dare l'host: lo dà l'ospite dal check-in. Tu puoi solo **revocarlo** su richiesta documentata dell'ospite («Revoca su richiesta dell'ospite», con data e canale della richiesta).

## Come fare

### Capire come CasaZen calcola l'imposta
1. Apri la procedura di attivazione dell'immobile (vedi [[alloggiati-istat#attivare-gli-adempimenti-di-un-immobile]]).
2. Nel passo «Imposta di soggiorno» leggi la tariffa del comune: «Tariffa per persona per notte», «Notti tassate al massimo», «Esenzione per età», «In vigore dal», «Fonte ufficiale del comune».
3. Se compare «Il comune di {città} non ha ancora una tariffa in CasaZen», verifica con il comune se l'imposta è dovuta e quanto, poi inserisci la tariffa (vedi «Inserire la tariffa del tuo comune»). Puoi attivare lo stesso.

### Inserire la tariffa del tuo comune
**Ti serve:** il permesso di modificare gli immobili; l'importo e le regole del comune (dal regolamento o dal sito del comune: CasaZen non li controlla). Se il comune ha già una tariffa ufficiale in CasaZen, vale quella e non puoi inserirne un'altra.
1. Apri la prenotazione da **Prenotazioni** e avvia il check-in guidato (vedi [[ospiti-checkin]]) fino al passo **Imposta di soggiorno**.
2. Se compare «Manca l'imposta del comune», premi «Inserisci l'imposta del tuo comune» (se l'hai già inserita c'è «Modifica l'imposta del tuo comune»).
3. Compila «Importo a persona per notte (€)» (da 0,01 a 50) e «Esenti i minori di (età)» (da 0 a 18). Indica «Da dove viene l'importo» (per esempio la pagina del comune o la delibera): è obbligatorio, al massimo 500 caratteri.
4. Se serve, compila anche «Massimo di notti tassate» e la stagione («Inizio stagione» e «Fine stagione», nel formato mese-giorno, per esempio 04-01 e 10-31). Lasciali vuoti se non c'è un limite o se la tariffa vale tutto l'anno.
5. Premi «Salva e ricalcola»: CasaZen mostra l'importo ospite per ospite.

> **Nota:** la tariffa che inserisci resta tua (non la vede nessun altro) e vale per il comune dell'immobile. È sempre un importo fisso a persona per notte: non si inserisce una percentuale. Non puoi inserirla dove esiste già una tariffa ufficiale («Per questo comune esiste già un'aliquota ufficiale: vale quella e non puoi inserirne un'altra»).

### Registrare un versamento al comune
**Ti serve:** il permesso di modificare i pagamenti e l'accesso a tutti gli immobili; la ricevuta del versamento (PDF, JPEG o PNG, fino a 10 MB) se vuoi allegarla. **Questo pulsante non paga nulla:** annota in CasaZen che hai già versato tu al comune, fuori da CasaZen.
1. Apri il report **Imposta di soggiorno: dovuta e versata** (dal rendiconto della scheda dell'immobile oppure dalla sezione Report).
2. Scegli il periodo.
3. Sulla riga del comune premi «Registra versamento».
4. Compila «Importo versato (€)» (con virgola o punto, per esempio 125,50), «Data del versamento» (non nel futuro), «Periodo pagato, dal» e «al» (massimo un anno), e se vuoi «Riferimento», «Note» e «Ricevuta» (PDF, JPEG o PNG, fino a 10 MB).
5. Premi «Registra versamento». Compare «Versamento registrato.» e il saldo si aggiorna.

Per correggere un errore premi «Elimina» sul versamento: elimini anche la ricevuta e il saldo si ricalcola. Non c'è una modifica del versamento: elimina e registra di nuovo. CasaZen non verifica che il pagamento sia avvenuto.

### Scaricare il riepilogo dell'imposta
1. Apri **Imposta di soggiorno: dovuta e versata**.
2. Scegli il periodo.
3. Premi «Scarica CSV». Nel file i comuni con soggiorni senza importo hanno la nota «Importo incompleto».

### Preparare i file di fine anno
Su attivazione.
1. Apri **Imposta di soggiorno: fine anno**.
2. In «Anno» scegli l'anno.
3. Leggi le cifre di ogni sezione.
4. In «File da consegnare» premi «Scarica CSV» o «Scarica Excel» per la dichiarazione ai comuni, il conto dell'agente o il conteggio delle notti del Ticino.
5. Consegna i dati ai comuni o all'ente turistico, tu o il tuo commercialista.

### Cercare e scaricare un documento
1. Apri **Affitti brevi › Incassi › Documenti**.
2. Scrivi nel campo «Cerca tra i documenti» oppure scegli un tipo, un immobile o un intervallo di date.
3. Premi «Scarica» sulla riga. Se compare «Nessun file», il documento non ha un file.
4. Se non trovi un documento, controlla di avere il permesso della sua area (per esempio i pagamenti per le fatture).

### Scaricare l'archivio di un periodo
1. In **Documenti** premi «Scarica archivio».
2. Scegli il «Periodo» (al massimo 24 mesi), l'«Immobile» e i «Tipi di documento» (almeno uno).
3. Premi «Scarica» e non chiudere la finestra finché non compare «Archivio scaricato.»
4. Se è «troppo grande» scegli un periodo più breve o meno tipi.

### Chiudere un soggiorno con il check-out
**Ti serve:** il permesso di modificare le prenotazioni; una prenotazione confermata o con arrivo registrato, dal giorno di arrivo in poi; sapere come è stata riscossa l'imposta di soggiorno.
1. Apri la prenotazione da **Prenotazioni** e avvia il check-out, oppure premi «Registra partenza» sulla voce «Chiudi la partenza di {nome}» in Adempimenti.
2. Passo **Soggiorno**: spunta «Confermo che l'ospite ha lasciato la struttura.»
3. Passo **Alloggiati**: leggi lo stato; se mancano dati degli ospiti premi «Completa i dati degli ospiti».
4. Passo **Pulizie**: scegli il fornitore e il tipo di servizio, oppure salta.
5. Passo **Imposta**: indica come è stata riscossa.
6. Passo **Proprietà pronta**: rispondi «Sì, è pronta» o «Non ancora».
7. Premi «Chiudi soggiorno». Vedi «Il soggiorno è chiuso» con il riepilogo e il «Prossimo passo».

Se non hai risposto a un passo obbligatorio compare un avviso (per esempio «Conferma che l'ospite ha lasciato la struttura.» o «Indica come è stata riscossa l'imposta di soggiorno.»).

### Dichiarare la casa pronta dopo un check-out
1. Apri **Adempimenti** e premi «Conferma» sulla voce «Dichiara pronto l'immobile dopo {nome}».
2. Nella schermata del check-out premi «Dichiara la proprietà pronta».

## Flussi completi

### Flusso: dalla prenotazione al versamento al comune
1. Prenotazione (diretta, inserita da te o da un portale): CasaZen calcola l'imposta o segnala che manca la tariffa (in quel caso la inserisci tu, vedi «Inserire la tariffa del tuo comune»).
2. Check-in ([[ospiti-checkin]]): l'ospite indica età dei minori e, dove attivo, paga l'imposta online.
3. Check-out: indichi come è stata riscossa.
4. Ogni mese o periodo apri **Imposta di soggiorno: dovuta e versata** e controlli «Dovuta».
5. Fai il versamento o la dichiarazione al comune (per Como su StayTour), poi premi «Registra versamento» con la ricevuta.
6. A fine anno, se attivo, scarichi i file della pagina di fine anno e li consegni.

### Flusso: dal check-out alla casa pronta
1. Registri la partenza e rispondi ai passi.
2. Se la casa non è pronta, risponde «Non ancora»: la voce resta in **Adempimenti › Da chiudere**.
3. Quando è pronta, dichiari «Dichiara la proprietà pronta».
4. Se Alloggiati non è ancora inviato, il check-out non si blocca: vedi [[alloggiati-istat]].

## Regole e limiti
- **Solo immobili in Italia** nel riepilogo per comune.
- **Periodo** del report: al massimo un anno; archivio documenti: al massimo 24 mesi.
- **Ricevute dei versamenti**: PDF, JPEG o PNG, fino a 10 MB.
- **Nessun importo inventato**: senza tariffa il calcolo dice che non è disponibile.
- **Tetti annuali non applicati**: il massimo di notti vale per soggiorno, non per anno.
- **Scadenze**: CasaZen non conosce la scadenza del tuo comune per la dichiarazione e il versamento: va letta sul sito o nel regolamento del comune.
- **Chi può cosa**: leggere il report e scaricare il CSV richiede il permesso di leggere i pagamenti; registrare o eliminare un versamento il permesso di modificarli e l'accesso a tutti gli immobili; il commercialista legge e non modifica; inserire la tariffa del comune richiede il permesso di modificare gli immobili.
- **Ricevute e prove** restano 5 anni; poi CasaZen le cancella.
- **Anonimizzazione e cancellazione** non si possono annullare.
- **CasaZen non presenta dichiarazioni** né paga il comune per te.

## Domande frequenti

### CasaZen paga l'imposta al comune per me?
No. Calcola, raccoglie e rendiconta. Il versamento lo fai tu e lo registri con «Registra versamento»: quel pulsante non paga, annota un pagamento che hai già fatto.

### Il mio comune non ha tariffa in CasaZen. Cosa faccio?
Verifica con il comune se l'imposta è dovuta e con quale tariffa. Puoi attivare lo stesso l'immobile. Poi inserisci tu la tariffa nel check-in guidato, passo «Imposta di soggiorno», con «Inserisci l'imposta del tuo comune» (vedi «Inserire la tariffa del tuo comune»). CasaZen non mette mai zero al posto di una tariffa mancante.

### Dove inserisco la tariffa del mio comune?
Nel check-in guidato di una prenotazione, passo «Imposta di soggiorno», pulsante «Inserisci l'imposta del tuo comune». La voce «Inserisci l'imposta di soggiorno del comune» in Adempimenti ti porta alla scheda dell'immobile, che non ha il campo: usa il check-in guidato.

### Quando devo dichiarare e versare l'imposta di soggiorno?
Lo decide il tuo comune: CasaZen non conosce la scadenza e non la inventa. La trovi nel regolamento o sul sito del comune (per Como, su StayTour). Quando un mese è finito, in Adempimenti compare la voce «Dichiara e paga l'imposta di soggiorno di {mese}».

### Perché il saldo non torna?
Il saldo confronta ciò che è registrato sui soggiorni con i versamenti che hai registrato: controlla i soggiorni segnalati come «Importo incompleto» e che i versamenti abbiano il periodo giusto.

### CasaZen applica il tetto annuale di notti del mio comune?
No. CasaZen conta il massimo di notti tassate per soggiorno, non per anno. Se il regolamento del tuo comune ha un tetto annuale, l'importo calcolato può essere più alto del dovuto: controlla sul sito del comune.

### Posso modificare un versamento già registrato?
No: lo elimini (con la ricevuta) e lo registri di nuovo.

### Perché non vedo un documento nell'archivio?
Perché non hai il permesso dell'area di quel documento, o perché l'immobile a cui appartiene è stato eliminato.

### Il check-out è obbligatorio?
No. Nessun passo lo blocca (né Alloggiati né la casa non pronta): si chiude anche con risposte «Non ancora». Ma è lì che indichi come hai riscosso l'imposta, chiedi le pulizie e dichiari la casa pronta: se lo salti queste voci restano negli Adempimenti, in «Da chiudere».

## Glossario
- **Imposta di soggiorno**: l'imposta comunale a persona per notte (detta anche tassa di soggiorno).
- **Versamento**: il pagamento che hai fatto al comune, registrato da te.
- **Saldo**: dovuta meno versata.
- **Conto dell'agente**: il rendiconto dell'imposta riscossa e versata, comune per comune.
- **StayTour**: il portale del Comune di Como per la dichiarazione dell'imposta di soggiorno.
- **SPID / CIE**: l'identità digitale e la carta d'identità elettronica con cui si entra nei portali pubblici.
- **Check-out**: la chiusura del soggiorno.
- **Anonimizzare**: sostituire i dati personali in modo che l'ospite non sia più identificabile.

## Vedi anche
- [[alloggiati-istat]]: Adempimenti, Alloggiati Web, ISTAT.
- [[cin-identificazione-ticino]]: CIN, identificazione e Ticino.
- [[prenotazioni]]: le prenotazioni e il calendario.
- [[fisco-documenti]]: documenti fiscali emessi da CasaZen.
- [[report-commercialista]]: i report per il commercialista.
