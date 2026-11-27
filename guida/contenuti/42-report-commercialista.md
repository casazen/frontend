---
id: report-commercialista
titolo: Report e pacchetto per il commercialista
menu: Report per il commercialista
sezione: Incassi e fisco
ordine: 42
riassunto: Come leggi e scarichi i report su ricavi, incassi e costi dei canali, cosa fare a fine mese e come dai al commercialista il pacchetto di dati del mese o dell'anno, a mano o con l'invio automatico.
chi: [gestore, amministratore, commercialista]
dove: Affitti brevi › Incassi › Report e Commercialista
parole_chiave: [report, ricavi, occupazione, ADR, RevPAR, incassato, da incassare, accrediti, costi dei canali, commissioni dei portali, commercialista, contabile, pacchetto, ZIP, fine mese, esportazione, CSV, Excel, chiusura, n.d.]
copre: [/app/short-rent/reports, /app/short-rent/reports/collections, /app/short-rent/reports/channel-costs, /app/short-rent/accountant]
stato: disponibile
fonte_codice: [frontend/src/features/reports/reports-page.tsx, frontend/src/features/reports/report-catalog.ts, frontend/src/features/reports/report-download-dialog.tsx, frontend/src/features/reports/overview/reports-overview.tsx, frontend/src/features/reports/collections/collections-report-page.tsx, frontend/src/features/reports/channel-costs/channel-costs-page.tsx, frontend/src/features/reports/money-reports/money-report-filters.tsx, frontend/src/features/accountant/accountant-package-page.tsx, frontend/src/features/accountant/summary-sections.tsx, frontend/src/features/fiscal/billing-wizard/steps/accountant-step.tsx, backend/Casazen.Web/Controllers/AccountantPackageController.cs, backend/Casazen.Web/Controllers/PublicAccountantPackageController.cs, backend/Casazen.Web/Controllers/ReportsController.cs, backend/Casazen.Infrastructure/Services/AccountantPackageDelivery.cs, backend/Casazen.Core/Services/AccountantPackage.cs, backend/Casazen.Core/Authorization/OrgRoleCatalog.cs, backend/Casazen.Web/appsettings.json]
---

## In breve
In **Affitti brevi › Incassi › Report** leggi come va la tua attività (ricavi, occupazione, **ADR**, cioè il prezzo medio per notte venduta, e **RevPAR**, cioè il ricavo per ogni notte disponibile) e scarichi i report in CSV o Excel. In **Incassi › Commercialista** scarichi in un solo file ZIP il **pacchetto** per il commercialista: documenti agli ospiti, IVA, incassi, imposta di soggiorno e un indice di tutti i file. Puoi anche far partire il pacchetto da solo ogni mese, per e-mail.

Il commercialista **non emette niente**: riceve soltanto questi dati. I documenti li emette CasaZen ([[fisco-documenti]]). A fine mese trovi l'elenco di cosa controllare in [[report-commercialista#flusso-cosa-fare-a-fine-mese-fino-al-commercialista]].

> **Nota:** il pacchetto per il commercialista e il suo invio sono su attivazione ([[per-iniziare#cosa-significa-su-attivazione]]): li accende CasaZen. Per chiederli scrivi all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza». I report, invece, sono disponibili.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Andamento dell'attività | Ricavi, occupazione, ADR e RevPAR con grafico e confronto con l'anno scorso | Incassi › Report (in alto) | gestore, amministratore | Disponibile | Vedere come va la tua attività |
| Elenco dei report | Report da scaricare o da aprire, con il periodo suggerito | Incassi › Report | gestore, amministratore | Disponibile | Scaricare un report |
| Incassato e da incassare | Cosa è entrato (per data, metodo e canale), cosa resta da incassare, accrediti | Report › «Incassato e da incassare» | gestore, amministratore | Disponibile | Vedere cosa è entrato, cosa resta da incassare e cosa è arrivato |
| Costi dei canali | Lordo, commissione e netto di ogni canale | Report › «Costi dei canali» | gestore, amministratore | Disponibile | Vedere quanto costa ogni canale |
| Pacchetto per il commercialista | Un file ZIP con i dati del mese o dell'anno | Incassi › Commercialista | gestore, amministratore, commercialista | Su attivazione | Scaricare il pacchetto per il commercialista |
| Invio automatico mensile | Manda ogni mese al commercialista una e-mail con il link al pacchetto | Fatturazione › passo «Commercialista» | gestore, amministratore | Su attivazione | Mandare il pacchetto al commercialista ogni mese |
| Prova dell'invio | Manda subito il pacchetto del mese scorso | Fatturazione › passo «Commercialista» › «Invia una prova» | gestore, amministratore | Su attivazione | Mandare una prova al commercialista |
| Accesso del commercialista | Il commercialista guarda i dati in CasaZen invece di ricevere il link | Amministrazione › Persone › ruolo «Contabile» | amministratore | Disponibile | Dare accesso al commercialista in CasaZen |

## Come funziona

### Tre modi di contare i soldi
I numeri della pagina **Report** e dell'area Incassi non hanno tutti la stessa base, e la pagina te lo dice sempre. Se due cifre non coincidono, di solito è per questo.
- **Per competenza** (i ricavi): contano le **notti dei soggiorni confermati** nel periodo, alloggio e pulizie, **tassa di soggiorno esclusa**. Valgono per «Andamento dell'attività», «Ricavi per immobile», «Prenotazioni per canale» e «Costi dei canali».
- **Per cassa** (gli incassi): conta il **giorno in cui il denaro è entrato**, non le notti del soggiorno che paga, e i rimborsi sono già tolti. Vale per «Incassato e da incassare» e per «Incassato nel periodo» del pacchetto.
- **Pagamenti completati**: la pagina **Incassi › Ricavi** somma i pagamenti «Completato», per importo pieno e data di creazione ([[incassi#vedere-i-ricavi]]).

**ADR** (in app «Prezzo medio per notte») è il ricavo medio per notte venduta; **RevPAR** (in app «Ricavo per notte disponibile») è il ricavo per ogni notte disponibile, anche quella rimasta vuota.

### Cosa mostrano i report
- **Andamento dell'attività**: «Ricavi», «Occupazione», «ADR» e «RevPAR» del periodo scelto, ognuno con il confronto con gli stessi giorni dell'anno scorso, e un grafico per mese o per settimana. Puoi dividere i numeri «Tutti insieme», «Per immobile», «Per canale» o «Per proprietario». Occupazione e RevPAR non si calcolano per canale, perché appartengono all'immobile.
- **Elenco dei report**: una riga per ogni report (alcune compaiono solo se la funzione è attiva). Alcuni si scaricano, altri aprono la loro pagina:
  - «Ricavi per immobile» (CSV), «Occupazione per immobile» (CSV), «Prenotazioni per canale» (CSV);
  - «Costi dei canali» e «Incassato e da incassare» (pagine con file CSV ed Excel);
  - «Cedolare secca e regime fiscale» e «Ritenute dei portali» (CSV o PDF);
  - «Alloggiati Web» (apre la pagina Alloggiati) e «Estratto pagamenti» (apre i pagamenti del mese scorso);
  - le righe sull'imposta di soggiorno, che trovi spiegate in [[imposta-soggiorno-documenti]].
- **Incassato e da incassare**: quanto è entrato nel periodo (per data, per canale o per metodo), i **saldi ancora da incassare** (con «Scaduto» sui soggiorni finiti con qualcosa da incassare) e gli **accrediti**: per i pagamenti con carta, giorno per giorno e al netto delle commissioni di incasso (non è un bonifico sul tuo conto); per i canali, gli importi netti indicati dal channel manager, «Atteso» o «Accreditato».
- **Costi dei canali**: per ogni canale il «Lordo», la «Commissione», il «Netto», il «Costo sul lordo» e «Come viene pagata» (trattenuta dal pagamento o fatturata a parte). Se un portale non ha comunicato la sua commissione la vedi come «n.d.»: **CasaZen non la conosce e non la inventa**, la prendi dagli estratti e dalle fatture del portale.

### Il pacchetto per il commercialista
È un **file ZIP** (si chiama «casazen-commercialista-AAAA-MM.zip») con sempre la stessa struttura, e un **indice** che elenca ogni file. Cosa contiene:
- **Documenti agli ospiti**: fatture, ricevute e note di credito emesse agli ospiti (PDF, e XML per le fatture);
- **IVA** per aliquota e per chi ha emesso il documento;
- **Incassi**: gli incassi, i saldi ancora da incassare e i costi dei portali (con «n.d.» dove nessuno li ha comunicati);
- **Imposta di soggiorno**;
- solo per le **agenzie**: fatture ai proprietari, rendiconti, ritenute (con i dati per F24 e Certificazione Unica) e riepilogo dell'agenzia. Per un normale host le cartelle dei proprietari restano fuori e l'indice le segna come omesse. Vedi [[agenzie-proprietari]].

Quando lo scarichi tu, il pacchetto si prepara sul momento e CasaZen non lo conserva; quello dell'e-mail resta a disposizione al link per 30 giorni. Il pacchetto lo scarichi tu dalla pagina **Commercialista** (e lo giri), oppure lo manda CasaZen per e-mail con un link, al solo indirizzo che scrivi. Contiene dati, non dichiarazioni: non è un F24 né una Certificazione Unica ufficiale.

### L'invio automatico
Nel percorso «Fatturazione», passo «Commercialista» (facoltativo), imposti l'indirizzo e-mail, il giorno del mese e le cartelle del pacchetto. Il giorno proposto è il 3. Dal giorno scelto (da 1 a 28), ogni mattina CasaZen prova a mandare il pacchetto del mese appena finito, **una volta sola per mese**. L'e-mail contiene un **link valido 30 giorni**: niente allegati. Il commercialista non deve avere un account.

Se un invio non riesce (per esempio il pacchetto è troppo grande o il servizio di posta non ha preso in carico l'e-mail), nel passo «Commercialista» leggi «Ultimo tentativo» con il motivo, e CasaZen riprova ogni mattina finché non parte (se l'invio ogni mese è acceso).

## Come fare

### Vedere come va la tua attività
**Ti serve:** il permesso di vedere i pagamenti; almeno un soggiorno confermato.
1. Apri **Affitti brevi › Incassi › Report**.
2. In alto scegli il «Periodo» («Questo mese», «Mese scorso», «Ultimi 3 mesi», «Quest'anno», «Anno scorso», «Date a scelta»), l'«Immobile» (o «Tutti gli immobili») e «Come dividere i numeri».
3. Per confrontare con lo stesso periodo dell'anno scorso, attiva «Confronta con l'anno scorso».
4. Con «Numero da mostrare» scegli cosa vedere nel grafico.

Se non ci sono soggiorni confermati vedi «Nessun soggiorno confermato in questo periodo». I numeri appaiono appena hai prenotazioni.

### Scaricare un report
**Ti serve:** il permesso di vedere i pagamenti. Per i report fiscali, anche poter vedere gli immobili.
1. In **Report**, scorri l'elenco. Per cercare scrivi in «Cerca un report»; per filtrare usa «Finanziari», «Fiscali» o «Operativi».
2. Sulla riga del report premi «Scarica» (o «Apri» se ha una sua pagina).
3. Nella finestra «Scarica: [nome]» scegli il «Periodo» (se scegli «Date a scelta», scrivi «Dal giorno» e «Al giorno») e il «Formato del file» (CSV o PDF, quando ci sono entrambi).
4. Premi «Scarica». Compare «Report scaricato».

Il CSV si apre con Excel. Un report copre al massimo **24 mesi**; i report fiscali coprono **un solo anno** e partono dall'anno indicato dal messaggio. Se le date non vanno bene, la finestra te lo dice.

I report «Cedolare secca e regime fiscale» e «Ritenute dei portali» sono spiegati in [[fisco-documenti]].

### Vedere cosa è entrato, cosa resta da incassare e cosa è arrivato
**Ti serve:** il permesso di vedere i pagamenti.
1. In **Report** premi «Apri» su «Incassato e da incassare».
2. Scegli il periodo (di partenza «Questo mese») e, se vuoi, l'«Immobile».
3. Con «Come vuoi vedere gli incassi» scegli «Per data», «Per canale» o «Per metodo». Il totale è l'«incassato» della Home per gli stessi giorni.
4. Più in basso trovi «Da incassare» (soggiorni con un saldo; «Scaduto» quando il soggiorno è finito e manca ancora qualcosa) e «Accrediti».
5. Per salvare i dati premi «Scarica CSV» o «Scarica Excel».

Nei saldi non ci sono i nomi degli ospiti. Due valute non si sommano mai tra loro: ogni valuta ha la sua tabella. Una cifra che il sistema non ha è «Non disponibile», mai uno zero.

### Vedere quanto costa ogni canale
**Ti serve:** il permesso di vedere i pagamenti.
1. In **Report** premi «Apri» su «Costi dei canali».
2. Scegli il periodo (di partenza «Ultimi 3 mesi») e, se vuoi, l'«Immobile».
3. Leggi la frase «Quanto costa ogni canale» (con «Il più costoso») e poi la tabella.
4. Per le prenotazioni dirette vedi «commissioni di incasso con carta»: se non sono ancora registrate leggi «Non ancora registrate per questi pagamenti».
5. Per salvare premi «Scarica CSV» o «Scarica Excel».

I soggiorni per cui il canale non ha indicato la commissione sono contati a parte: **non sono considerati gratuiti**. I canali senza costi sono sotto «Senza costi per te». Gli importi sono nella valuta di ogni immobile, sommati senza conversione.

### Scaricare il pacchetto per il commercialista
**Ti serve:** la funzione attiva e il permesso di vedere i pagamenti; un posto dove salvare il file ZIP e un modo per girarlo al commercialista (per esempio la tua e-mail).
1. Apri **Affitti brevi › Incassi › Commercialista**.
2. In «Periodo» scegli un mese (nell'elenco «Mesi») o un anno (nell'elenco «Anni»). Di partenza c'è il mese appena finito.
3. Premi «Scarica il pacchetto».
4. Aspetta: leggi «Sto preparando il pacchetto: può volerci un po'» e poi quanti dati sono arrivati. **Non lasciare la pagina.** Per fermarti premi «Annulla».
5. Alla fine vedi «Il pacchetto è stato scaricato» e hai il file ZIP. Mandalo tu al commercialista.

Se vedi un messaggio sui file troppo numerosi, scegli un periodo più breve. Durante lo scarico il periodo non si può cambiare. Se vedi «Il pacchetto per il commercialista non è attivo», la funzione non è attiva per te.

Sotto il pulsante c'è il riepilogo dello stesso periodo, che coincide con il file: «Documenti emessi» (agli ospiti, per emittente, tipo e valuta) e «Soggiorni, incassi e imposta di soggiorno» (soggiorni e occupazione, incassato nel periodo al netto dei rimborsi, ancora da incassare, costi dei canali, imposta di soggiorno). I costi che nessuno ha comunicato sono «n.d.», mai zero.

### Mandare il pacchetto al commercialista ogni mese
**Ti serve:** il permesso di modificare gli immobili e l'accesso a tutti gli immobili dell'organizzazione; la funzione attiva; l'indirizzo e-mail del commercialista (uno solo).
1. Apri **Incassi › Regime fiscale** e premi «Imposta la fatturazione», poi vai al passo «Commercialista».
2. Scrivi l'«E-mail del commercialista» (un solo indirizzo, semplice, senza nome).
3. Accendi «Invia il pacchetto ogni mese». Scegli il «Giorno del mese» (da 1 a 28).
4. In «Che cosa contiene il pacchetto» spunta le cartelle che vuoi (almeno una). Il pacchetto che scarichi tu le ha sempre tutte. Le cartelle dei proprietari le sceglie solo chi può vedere i rendiconti dei proprietari.
5. Premi «Continua».

Cosa succede dopo: dal giorno scelto, ogni mattina CasaZen prova a mandare il pacchetto del mese appena finito, finché non è partito. L'e-mail va a una persona vera, all'indirizzo che hai scritto: controllalo bene. Sotto vedi «Ultimo invio» con il mese e l'ora, oppure il motivo per cui non è partito. Se spegni l'invio, il pacchetto non parte da solo e lo scarichi tu.

### Mandare una prova al commercialista
**Ti serve:** lo stesso accesso dell'invio mensile e un indirizzo scritto.
1. Nel passo «Commercialista» compila indirizzo e cartelle.
2. Premi «Invia una prova».
3. Se hai cambiato qualcosa, viene salvato prima. CasaZen prepara il pacchetto del **mese scorso** e mette l'e-mail in coda.
4. Leggi «Prova messa in coda»: vedi il mese e fino a che giorno vale il link.

La prova **vale come invio di quel mese**: l'invio automatico non lo rifà. L'e-mail va a una persona vera. Se non arriva, controlla l'indirizzo. Se la risposta non è chiara, guarda «Ultimo invio» prima di riprovare: ogni prova manda un'altra e-mail.

### Dare accesso al commercialista in CasaZen
**Ti serve:** essere amministratore; l'indirizzo e-mail del commercialista; un posto libero nel piano (il «Contabile» conta come una persona del team).
1. Apri **Amministrazione › Persone** e invita il commercialista con il ruolo «Contabile» (come si fa: [[account-team-piano]]).
2. Il «Contabile» ha un ruolo di **sola lettura**: vede immobili, prenotazioni e pagamenti degli affitti brevi, immobili e contratti degli affitti lunghi e le fatture dell'abbonamento a CasaZen, e non può cambiare nulla. Se il pacchetto è attivo apre anche la scheda «Commercialista». I permessi esatti sono nella pagina Ruoli.

Per chi preferisce non avere un account, bastano l'e-mail con il link o il file che scarichi tu e mandi.

## Flussi completi

### Flusso: cosa fare a fine mese, fino al commercialista
1. **Incassi.** Apri **Incassi** e il filtro «Da incassare»: registra i contanti e i bonifici ricevuti ([[incassi#registrare-un-incasso-ricevuto-fuori-da-casazen]]). Per le prenotazioni dei portali non c'è nulla da registrare. Controlla anche **Report › Incassato e da incassare** ([[incassi]]).
2. **Documenti agli ospiti.** In **Incassi › Documenti fiscali** controlla le bozze dei soggiorni finiti ed emetti quelle che servono (se non emetti in automatico), e sistema le fatture «Scartate dallo SDI» ([[fisco-documenti]]).
3. **Adempimenti.** Controlla che non sia rimasto indietro nulla: i dati degli ospiti per Alloggiati Web con la ricevuta caricata, e l'ISTAT se lo usi ([[alloggiati-istat]]). Sono obblighi di legge: CasaZen li prepara, ma l'invio resta a te.
4. **Imposta di soggiorno.** Registra i versamenti che hai fatto al comune ([[imposta-soggiorno-documenti#registrare-un-versamento-al-comune]]). «Registra versamento» **annota** un pagamento che hai già fatto tu: CasaZen non paga il comune.
5. **Commissioni dei portali.** Se vedi «n.d.» alle commissioni di un portale, CasaZen non le conosce: prendile dall'estratto e dalle fatture del portale e dalle al commercialista (con la cedolare secca non sono deducibili).
6. **Il pacchetto.** Dal giorno scelto CasaZen manda al commercialista l'e-mail con il link al pacchetto del mese appena finito; oppure lo scarichi tu da **Commercialista** e lo giri. Se sei un'agenzia, prima chiudi il mese dei proprietari ([[chiusura-mensile]]).
7. Il commercialista scarica lo ZIP (entro 30 giorni dall'e-mail) e lavora sui file e sull'indice.
8. Se qualcosa non torna, correggi con una nota di credito ([[fisco-documenti#correggere-un-documento-emesso-con-una-nota-di-credito]]) e fai un nuovo pacchetto.

### Flusso: chiusura di fine anno
1. In **Commercialista** scegli «Anno [anno]» e scarica il pacchetto.
2. In **Report** scarica «Cedolare secca e regime fiscale» e «Ritenute dei portali» per l'anno.
3. Per l'imposta di soggiorno usa le sue pagine ([[imposta-soggiorno-documenti]]).
4. Se sei un'agenzia, aggiungi i documenti di chiusura dei proprietari ([[chiusura-mensile]]).
5. Porta tutto al commercialista: la dichiarazione la presenta lui, non CasaZen.

## Regole e limiti
- Report, Incassato e da incassare, Costi dei canali e Commercialista richiedono il permesso di vedere i pagamenti. Ogni cifra è limitata agli immobili a cui hai accesso.
- Il pacchetto e il suo invio sono su attivazione: se non sono attivi, la pagina dice «Il pacchetto per il commercialista non è attivo».
- Un report copre al massimo 24 mesi; i report fiscali un anno.
- Il pacchetto ha un tetto sul numero di file: oltre quel numero scegli un periodo più breve. Il numero lo vedi nel messaggio.
- L'invio automatico: giorno da 1 a 28 (proposto: il 3), una volta per mese, link valido 30 giorni, e-mail senza allegati, un solo indirizzo; una prova vale come invio del mese. Le impostazioni sono dell'intera organizzazione: chi vede solo alcuni immobili non può leggerle né cambiarle.
- Il pacchetto non contiene dati di altri: chi non può vedere la contabilità dei proprietari ottiene un pacchetto senza quelle cartelle, indicate come omesse nell'indice.
- Le cifre non sono mai convertite tra valute e un dato mancante è «n.d.» o «Non disponibile».
- CasaZen non invia nulla all'Agenzia delle Entrate né al comune: i report e il pacchetto sono dati per il commercialista.
- Il «Contabile» occupa un posto del piano come ogni altra persona del team.

## Domande frequenti

### Cosa devo fare a fine mese?
Controlla gli incassi da registrare, le bozze dei documenti, gli adempimenti (Alloggiati, ISTAT), i versamenti dell'imposta di soggiorno e le commissioni dei portali che CasaZen mostra come «n.d.»; poi scarica il pacchetto o lascia che parta da solo. L'elenco passo per passo è in [[report-commercialista#flusso-cosa-fare-a-fine-mese-fino-al-commercialista]].

### Come do accesso al commercialista?
Hai due strade. Puoi invitarlo come persona con il ruolo «Contabile» (sola lettura) da **Amministrazione › Persone**: occupa un posto del piano. Oppure non gli dai nessun account e gli mandi il pacchetto: parte da solo ogni mese, per e-mail, con un link che vale 30 giorni, oppure lo scarichi tu e lo giri.

### Il mio commercialista deve avere un account CasaZen?
No. Riceve un link per e-mail (valido 30 giorni) oppure il file che gli giri tu. Se preferisce guardare in CasaZen, invitalo con il ruolo «Contabile».

### Cosa contiene il pacchetto?
Un solo ZIP, sempre con la stessa struttura: documenti agli ospiti, IVA, incassi e imposta di soggiorno, con un indice che elenca ogni file. Per le agenzie anche fatture ai proprietari, rendiconti, ritenute e riepilogo.

### Quando parte il pacchetto da solo e a chi?
Se nel passo «Commercialista» hai acceso «Invia il pacchetto ogni mese», parte dal giorno che hai scelto (da 1 a 28; quello proposto è il 3), una volta sola per mese, all'unico indirizzo che hai scritto. Se non hai acceso l'invio, lo scarichi tu.

### Il link per il commercialista è scaduto: cosa faccio?
Scarica tu il pacchetto da **Commercialista** e giralo, oppure premi «Invia una prova» nel passo «Commercialista» (manda il pacchetto del mese scorso).

### Perché i ricavi del Report e quelli della pagina Ricavi sono diversi?
Il Report conta per competenza (le notti dei soggiorni), la pagina Ricavi somma i pagamenti completati per data di creazione, senza togliere i rimborsi. Sono due basi diverse. Per gli incassi veri al netto dei rimborsi usa «Incassato e da incassare».

### Perché vedo «n.d.» invece di una cifra? Chi mette le commissioni dei portali?
Perché nessuno ha comunicato quel dato (per esempio la commissione di un portale). CasaZen non scrive zero al posto di un dato che non ha. Le commissioni le porti tu: prendile dagli estratti e dalle fatture del portale e dalle al commercialista.

### Perché non vedo la scheda «Commercialista»?
È su attivazione e serve il permesso di vedere i pagamenti. Se la funzione non è attiva per te, la scheda non compare: per chiederla scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza»).

### Posso mandare il pacchetto a due indirizzi?
L'invio automatico accetta un solo indirizzo. Se servono più persone, chi riceve lo gira.

### Il pacchetto include le prenotazioni dei portali?
Sì: i documenti e gli incassi di ogni prenotazione, qualunque sia il canale. Per i pagamenti incassati dal portale gli accrediti e le commissioni dipendono dai dati comunicati dal channel manager.

## Glossario
- **ADR**: il ricavo medio per notte venduta (in app «Prezzo medio per notte»).
- **RevPAR**: il ricavo per ogni notte disponibile, anche quella rimasta vuota (in app «Ricavo per notte disponibile»).
- **Competenza**: contare per le notti del soggiorno, non per il giorno del pagamento.
- **Cassa**: contare per il giorno in cui i soldi sono entrati.
- **Lordo e netto**: prima e dopo le commissioni.
- **Pacchetto**: il file ZIP con i dati per il commercialista.
- **Accredito**: il giorno in cui una somma pagata con carta risulta accreditata.
- **Scaduto**: soggiorno finito con ancora qualcosa da incassare.
- **n.d.**: non disponibile. Il dato non è stato comunicato a CasaZen, che non scrive zero al suo posto.
- **Contabile**: il ruolo di sola lettura adatto al commercialista.

## Vedi anche
- [[incassi]]: pagamenti, rimborsi e collegamento a Stripe.
- [[fisco-documenti]]: regime fiscale, fatturazione e documenti fiscali.
- [[imposta-soggiorno-documenti]]: i report sull'imposta di soggiorno.
- [[agenzie-proprietari]] e [[chiusura-mensile]]: la contabilità dei proprietari.
- [[account-team-piano]]: come invitare il commercialista come persona del team.
