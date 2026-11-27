---
id: pagine-pubbliche
titolo: Pagine pubbliche di CasaZen
sezione: Sito e portali
ordine: 83
riassunto: Le pagine che chiunque può aprire senza accedere: il sito di presentazione di CasaZen, la ricerca delle case, le guide per comune e il calcolo della tassa di soggiorno, i documenti legali e le pagine di servizio degli ospiti. Cosa pubblica CasaZen, cosa controlli tu e cosa trovano i motori di ricerca.
chi: [gestore, amministratore, ospite]
dove: Pagine pubbliche (senza accesso) · sito di CasaZen
parole_chiave: [pagine pubbliche, SEO, guide per comune, tassa di soggiorno, calcolatore, ricerca case, documenti legali, privacy, termini, sub-responsabili, indicizzazione, sitemap, motori di ricerca, benvenuto, iscrizione, annulla iscrizione]
copre: [/, /affitti-brevi, /affitti-lunghi, /funzionalita, /per-i-fornitori, /chi-siamo, /search, /p/affitti-brevi, /p/affitti-brevi/:region/:comune, /p/tassa-soggiorno/:comune, /legale, /legale/termini, /legale/privacy, /legale/dpa, /legale/sub-responsabili, /benvenuto/:token, /marketing/confirm, /unsubscribe, /app/admin/seo (non-utente), /app/admin/marketing (non-utente)]
stato: disponibile
fonte_codice: [frontend/src/site/site-pages.ts, frontend/src/site/site-gate.ts, frontend/src/site/components/site-pages-content.tsx, frontend/src/features/public-seo/seo-hub-page.tsx, frontend/src/features/public-seo/seo-paths.ts, frontend/src/features/public-seo/compliance-guide-page.tsx, frontend/src/features/public-seo/tourist-tax-calculator-page.tsx, frontend/src/features/public-seo/components/featured-properties.tsx, frontend/src/features/search/search-page.tsx, frontend/src/features/legal/legal-index-page.tsx, frontend/src/features/legal/legal-document-page.tsx, frontend/src/features/legal/subprocessors-page.tsx, frontend/src/features/public-marketing/welcome-page.tsx, frontend/src/features/public-marketing/confirm-page.tsx, frontend/src/features/public-marketing/unsubscribe-page.tsx, frontend/src/features/public-site/hooks/use-org-seo-meta.ts, frontend/src/config/robots-txt.ts, frontend/src/routes/index.tsx, backend/Casazen.Web/Controllers/PublicSeoController.cs, backend/Casazen.Web/Controllers/PublicOrgSitemapController.cs, backend/Casazen.Web/Controllers/PublicPlatformSearchController.cs, backend/Casazen.Web/Controllers/LegalController.cs, backend/docs/runbooks/seo-domain.md, backend/docs/runbooks/legal-documents.md]
---

## In breve
Oltre al tuo sito di prenotazione ([[sito-prenotazione]]), CasaZen ha **pagine pubbliche sue**, che si aprono senza fare il login: il sito che presenta CasaZen (pagina iniziale, affitti brevi, affitti lunghi, funzionalità, fornitori, chi siamo), la **ricerca delle case** degli host, le **guide per comune** con il **calcolo dell'imposta di soggiorno**, i **documenti legali** e alcune pagine di servizio per gli ospiti (benvenuto, iscrizione alle offerte).

Queste pagine le pubblica CasaZen. Tu controlli le tue case e il tuo sito: le trovano poi nella ricerca e, dove c'è, nelle guide del loro comune. Questa pagina spiega cosa sono, cosa puoi farci e cosa trovano i motori di ricerca.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Sito di presentazione di CasaZen | Spiega CasaZen a host, proprietari e fornitori e porta alla richiesta di invito | Indirizzo principale di CasaZen e le sue pagine | chiunque | Disponibile | Le pagine del sito di CasaZen |
| Cerca una casa | Cerca le case libere di tutti gli host CasaZen e porta al loro sito per prenotare | Barra «Cerca una casa» e pagina di ricerca | ospite | Disponibile | Come un ospite cerca una casa |
| Guide per comune | Spiega per ogni comune CIN, Alloggiati Web e imposta di soggiorno con le fonti ufficiali | «Guide per gli affitti brevi» | gestore, ospite | Disponibile | Leggere la guida del tuo comune |
| Calcolo della tassa di soggiorno | Stima la tassa di un soggiorno per un comune | Pagina «Tassa di soggiorno» del comune | gestore, ospite | Disponibile | Calcolare la tassa di soggiorno di un comune |
| Pagina pubblica di una casa e del sito | La scheda della casa e la pagina iniziale del tuo sito | Il tuo sito di prenotazione | ospite | Disponibile | [[sito-prenotazione]] |
| Documenti legali di CasaZen | Termini di servizio, informativa privacy, accordo sul trattamento dei dati ed elenco dei sub-responsabili | «Documenti legali» nel piè di pagina | chiunque | Disponibile | Leggere i documenti legali di CasaZen |
| Pagine di servizio per gli ospiti | Benvenuto dopo un QR, conferma iscrizione e annullamento iscrizione alle offerte | Link di un'e-mail o QR stampato | ospite | Su attivazione | Le pagine che l'ospite apre da un'e-mail o da un QR |

## Come funziona

### Le pagine del sito di CasaZen
Sono pagine di presentazione, in **italiano e inglese** (il menu cambia lingua). Si aprono dall'indirizzo principale di CasaZen e non dal sito di un host: sul sito o sul dominio di un host le stesse pagine non ci sono.

| Pagina | Cosa racconta |
|---|---|
| **Pagina iniziale** | Il messaggio «Affitti in regola. Prenotazioni dirette. Zero commissioni CasaZen.», come funziona, adempimenti, sito di prenotazione, fornitori, guide per comune, domande frequenti e la **ricerca delle case** |
| **Affitti brevi** | CIN, Alloggiati Web, imposta di soggiorno, calendario, sito di prenotazione diretta e collegamento ai canali come Booking.com, Airbnb, Vrbo ed Expedia |
| **Affitti lunghi** | Contratti 4+4, 3+2 e transitori, canoni con Stripe, promemoria di registrazione e cedolare secca |
| **Funzionalità** | Tutto quello che CasaZen fa oggi, spiegato senza giri di parole |
| **Per i fornitori** | Come lavorare con gli host della zona: scegliere categorie e comuni e ricevere le richieste |
| **Chi siamo** | Come lavora CasaZen, i dati societari e i contatti |

Il pulsante «Accedi» porta al login. Se l'accesso è ancora su invito, la pagina lo dice («Per ora si entra solo su invito») e offre «Richiedi un invito».

### Cosa pubblica CasaZen e cosa controlli tu
| Pagina | Chi decide |
|---|---|
| Sito di presentazione, guide per comune, calcolatori, documenti legali | **CasaZen**. Le guide sono riviste da una persona prima della pubblicazione |
| Il tuo sito di prenotazione e le pagine delle tue case | **Tu**: [[sito-prenotazione]] |
| Le tue case nella ricerca di CasaZen | **Tu**, con la pubblicazione delle case: una casa che non è «Pubblicata» non compare |
| Informativa privacy e termini del tuo sito | **Tu**, da «Documenti sito» |
| Documenti legali di CasaZen (termini, privacy, accordo sul trattamento dei dati) | **CasaZen** |

Non puoi modificare le guide per comune né i calcolatori: sono contenuti di CasaZen. Sono **informazioni generali, non consulenza legale**: l'host resta responsabile degli adempimenti.

### Cerca una casa
La ricerca pubblica elenca le case libere di **tutti** gli host CasaZen, con il prezzo dell'intero soggiorno, e porta al sito dell'host per prenotare. Compare nella pagina iniziale di CasaZen (Dove, Arrivo, Partenza, Ospiti) e ha una pagina sua. Solo le case **pubblicate** compaiono ([[sito-prenotazione#quando-una-casa-compare-sul-sito]]); le pagine dei risultati con una ricerca non vengono indicizzate.

### Le guide per comune e la tassa di soggiorno
- **«Guide per gli affitti brevi»** è l'elenco delle guide: una per ogni comune pubblicato, divise in «Guide per comune» e «Calcolo della tassa di soggiorno».
- Ogni **guida** spiega, con le fonti ufficiali, come mettersi in regola con CIN, Alloggiati Web e imposta di soggiorno in quel comune (per la Lombardia anche CIR e flussi turistici). Mostra la data dell'ultimo aggiornamento e dice che il testo è solo in italiano, perché le norme sono italiane. In fondo propone «Prova CasaZen a …» con «Pubblica la tua casa» e l'elenco **«Case disponibili a …»**: le case pubblicate di quel comune, con «Vedi e prenota».
- Ogni **calcolatore** della **tassa di soggiorno** chiede la categoria dell'alloggio, il prezzo di una notte (senza pulizie e altri servizi), la durata e gli ospiti con l'età dei minori, e mostra la **tassa stimata**. È una stima con le tariffe registrate in CasaZen: verifica esenzioni e aggiornamenti sul sito del Comune. Se la tariffa del comune non c'è ancora, la pagina lo dice («Tariffa non ancora disponibile») e non calcola.

Come CasaZen usa queste regole dentro l'app: [[imposta-soggiorno-documenti]], [[alloggiati-istat]].

### I documenti legali di CasaZen
In fondo alle pagine di CasaZen trovi **«Documenti legali»** (indirizzo `/legale`) con: **Termini di Servizio**, **Informativa Privacy**, **Data Processing Agreement** (accordo sul trattamento dei dati) e **Sub-responsabili del trattamento** (l'elenco dei fornitori che trattano dati personali per CasaZen, con finalità, società e sede, luogo del trattamento ed eventuale trasferimento fuori dallo Spazio economico europeo). Ogni documento mostra la **versione** e la data di entrata in vigore; sono **solo in italiano**. Se un testo non è ancora pronto la pagina dice «Il testo di questo documento è in preparazione e sarà pubblicato qui»; se esiste una copia ufficiale, c'è il pulsante «Apri la copia ufficiale del documento».

Non sono i documenti del tuo sito: quelli (informativa privacy e termini di prenotazione agli ospiti) li scrivi e pubblichi tu da **Impostazioni › Documenti sito** ([[sito-prenotazione]]). Sul dominio di un host i documenti legali di CasaZen rimandano al sito di CasaZen.

### Cosa viene trovato dai motori di ricerca
- **Si possono trovare**: la pagina iniziale e le pagine del sito di CasaZen, le guide per comune e i calcolatori, la pagina iniziale del sito di prenotazione di ogni host e le pagine delle sue case pubblicate. Ogni sito di prenotazione con almeno una casa pubblicata compare nelle mappe del sito (sitemap).
- **Non si trovano**: l'app dopo il login, le pagine di check-in e il portale ospite, la pagina di benvenuto del QR, il login, i risultati di ricerca, «Le mie prenotazioni», le pagine di conferma, di cancellazione e di richiesta, il checkout e le pagine di pagamento e dei documenti. Sono pagine di una persona o di una prenotazione in corso.
- Per ogni sito e per ogni casa, titolo e descrizione che compaiono nei motori di ricerca e quando condividi il link vengono da te: il titolo del sito è «Nome — Prenota direttamente», e per la descrizione si usa lo **slogan** del sito (primi 155 caratteri) oppure, per una casa, la **descrizione** della casa. Scrivere bene lo slogan ([[sito-prenotazione#personalizzare-l-aspetto-del-sito]]) e la descrizione di una casa ([[immobili]]) aiuta a farti trovare.
- Un ambiente di prova o di test di CasaZen non è indicizzato per niente.

### Le pagine che l'ospite apre da un'e-mail o da un QR (su attivazione)
Sono pagine semplici, senza menu, che non richiedono l'accesso e funzionano anche se la funzione marketing viene poi spenta, perché un'e-mail già inviata deve continuare a funzionare.
- **Benvenuto** (pagina del QR stampato per una casa). L'ospite vede «Benvenuto a …» e può lasciare un contatto per ricevere novità e offerte: sceglie **E-mail** o **WhatsApp**, conferma di avere almeno 18 anni e preme **«Invia la mia scelta»**. Se sceglie l'e-mail, riceve un messaggio con un link per **confermare**: finché non conferma, non gli viene scritto. Se il codice non è più valido: «Questa pagina non è attiva».
- **Conferma iscrizione**: la pagina del link nell'e-mail («Confermi la tua iscrizione?» › «Conferma iscrizione»). Un link scaduto o modificato dà un messaggio chiaro.
- **Annulla iscrizione**: la pagina del link in fondo a ogni e-mail promozionale («Vuoi annullare l'iscrizione?» › «Annulla iscrizione»). Le comunicazioni sul soggiorno, come conferme e istruzioni di arrivo, continuano ad arrivare.

Come prepari QR, pubblici e campagne: [[routine-ai-crm]].

## Come fare

### Leggere la guida del tuo comune
1. Apri **Guide per gli affitti brevi** dal piè di pagina del sito di CasaZen (`/p/affitti-brevi`).
2. Sotto **«Guide per comune»** scegli il tuo comune.
3. Leggi la guida e controlla la data di aggiornamento.
4. Per verificare importi e regole, usa sempre le fonti ufficiali che la guida cita e il sito del Comune.

Se il tuo comune non c'è, la guida non è ancora pubblicata («La guida per questo comune non è ancora disponibile»).

### Calcolare la tassa di soggiorno di un comune
1. Dal punto **«Guide per gli affitti brevi»** apri **«Tassa di soggiorno»** del tuo comune.
2. Scegli la **Categoria dell'alloggio**.
3. Scrivi il **prezzo di una notte** (senza pulizie e altri servizi), il numero di notti e degli ospiti; per i minori indica l'età.
4. Premi **«Calcola»**: compare «Tassa stimata».
5. Se vedi «Tariffa non disponibile per queste date», controlla la tariffa sul sito del Comune.

Il risultato è una **stima**: non è un conteggio ufficiale.

### Come un ospite cerca una casa
1. Dalla pagina iniziale di CasaZen scrive **Dove**, **Arrivo**, **Partenza** e **Ospiti** e preme **«Cerca una casa»**.
2. Vede le case libere con il prezzo dell'intero soggiorno e ne apre una.
3. Con **«Vedi e prenota»** o aprendo la scheda va al sito dell'host: il resto è come in [[sito-prenotazione#come-prenota-un-ospite-dal-tuo-sito]].

### Le pagine del sito di CasaZen
1. Apri l'indirizzo principale di CasaZen: vedi la pagina iniziale.
2. Dal menu scegli **Funzionalità**, **Per i fornitori**, **Guide**, **Chi siamo** o **Soluzioni** (Affitti brevi, Affitti lunghi).
3. Con il pulsante **«Accedi»** vai al login; con **«Richiedi un invito»** chiedi l'accesso quando è su invito.

### Leggere i documenti legali di CasaZen
1. In fondo a una pagina pubblica di CasaZen apri **«Documenti legali»**.
2. Scegli **Termini di Servizio**, **Informativa Privacy**, **Data Processing Agreement** o **Sub-responsabili**.
3. Controlla la versione e la data di entrata in vigore.

## Flussi completi

### Flusso: dal comune alla prenotazione di una casa
1. **Un host o un ospite** cerca «affitti brevi» di un comune: trova la guida del comune.
2. **CasaZen** mostra nella guida le case pubblicate di quel comune («Case disponibili a …»).
3. **L'ospite** apre una casa e arriva al sito dell'host.
4. **L'ospite** prenota: [[sito-prenotazione]].
5. **L'host** riceve la prenotazione: [[prenotazioni]].

## Regole e limiti
- Le guide e i calcolatori sono **informazioni generali**, non consulenza legale: l'host resta responsabile degli adempimenti.
- Le guide e i documenti legali sono solo in **italiano**.
- Il calcolatore dà una **stima** con le tariffe registrate in CasaZen: verifica sempre sul sito del Comune.
- Solo le case **pubblicate** compaiono nella ricerca e nelle guide.
- Le pagine con segreti o dati di una prenotazione non sono indicizzate.
- Le pagine di servizio degli ospiti (benvenuto, conferma e annullamento iscrizione) non richiedono l'accesso.
- I pulsanti «Accedi» e «Richiedi un invito» dipendono da come è aperto l'accesso a CasaZen.

## Domande frequenti

### Il mio sito compare su Google?
La pagina iniziale del sito di prenotazione e le pagine delle case pubblicate possono essere trovate dai motori di ricerca, ma i tempi dipendono dal motore. Aiuti con uno slogan chiaro, descrizioni complete e foto. Un ambiente di prova non è indicizzato.

### Posso far togliere o cambiare una guida del mio comune?
Le guide sono di CasaZen: se noti un errore, scrivi al supporto dalla pagina «Chi siamo».

### Perché la mia casa non compare nella ricerca di CasaZen?
Perché non è «Pubblicata»: deve essere in affitto breve, attiva, non in pausa e con «Mostra la casa sul sito» acceso ([[sito-prenotazione#quando-una-casa-compare-sul-sito]]).

### Il calcolatore dice «Tariffa non disponibile». Cosa faccio?
Significa che CasaZen non ha ancora la tariffa di quel comune: verifica la tariffa e le esenzioni sul sito del Comune.

### Dove trovo l'informativa privacy del mio sito di prenotazione?
In fondo al tuo sito di prenotazione, voce «Informativa privacy»: l'hai scritta tu in **Documenti sito**.

## Glossario
- **Guida per comune**: pagina di CasaZen che spiega gli adempimenti di un comune.
- **Calcolatore**: pagina che stima la tassa di soggiorno di un comune.
- **Sitemap**: l'elenco delle pagine che CasaZen segnala ai motori di ricerca.
- **Sub-responsabile**: un fornitore che tratta dati personali per conto di CasaZen.
- **Benvenuto**: la pagina del QR stampato per una casa.

## Vedi anche
- [[sito-prenotazione]]: il tuo sito pubblico e le tue case.
- [[dominio-incorpora]]: l'indirizzo e i widget.
- [[portale-ospite]]: la pagina personale del soggiorno.
- [[imposta-soggiorno-documenti]]: come CasaZen gestisce l'imposta.
- [[routine-ai-crm]]: QR, campagne e pubblici per le offerte.
