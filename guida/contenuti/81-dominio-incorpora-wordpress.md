---
id: dominio-incorpora
titolo: Dominio, widget e plugin WordPress
sezione: Sito e portali
ordine: 81
riassunto: Come dare al tuo sito di prenotazione un indirizzo tuo (sottodominio o dominio personalizzato), come metterlo dentro il sito che hai già con i widget da incollare o con il plugin per WordPress, e cosa passa dal tuo dominio. Ti serve? Non per cominciare.
chi: [amministratore, gestore, ospite]
dove: Impostazioni › Dominio pubblico · Impostazioni › Incorpora nel tuo sito
parole_chiave: [dominio, mio dominio, dominio personalizzato, indirizzo del sito, www, sottodominio, registrar, DNS, CNAME, TXT, white label, area ospite, incorporare, widget, plugin, WordPress, shortcode, Elementor, Polylang, WPML, Google Tag Manager, GTM, iframe, barra di ricerca]
copre: [/app/short-rent/settings/domain, /app/short-rent/settings/embed, /embed/:orgSlug/booking, /embed/:orgSlug/property/:propertySlugOrId, /embed/:orgSlug/guest-access, /embed/booking, /embed/property/:propertySlugOrId, /embed/guest-access, /embed/* (non-utente)]
stato: disponibile
fonte_codice: [frontend/src/features/settings/domain/custom-domain-settings-page.tsx, frontend/src/features/settings/domain/dns-instructions-panel.tsx, frontend/src/features/settings/domain/domain-status-panel.tsx, frontend/src/features/settings/domain/domain-surfaces-panel.tsx, frontend/src/features/settings/domain/domain-state.ts, frontend/src/features/settings/domain/use-org-domain.ts, frontend/src/features/settings/embed/embed-settings-page.tsx, frontend/src/features/settings/embed/embed-widget-block.tsx, frontend/src/features/settings/embed/embed-snippet.ts, frontend/src/features/settings/embed/embed-snippet-panel.tsx, frontend/src/features/settings/embed/embed-plugin-steps.tsx, frontend/src/features/settings/embed/embed-gtm-field.tsx, frontend/src/features/settings/embed/embed-domain-status.tsx, frontend/src/routes/embed-routes.tsx, frontend/src/routes/host-site-routes.tsx, frontend/src/features/embed, frontend/src/features/host-tracking, frontend/integrations/wordpress/casazen/casazen.php, frontend/integrations/wordpress/casazen/includes, frontend/integrations/wordpress/casazen/readme.txt, backend/Casazen.Web/Controllers/OrgDomainController.cs, backend/Casazen.Infrastructure/Services/OrgDomainService.cs, backend/Casazen.Infrastructure/Services/DomainRecheckService.cs, backend/Casazen.Core/Options/PublicHostOptions.cs, backend/Casazen.Infrastructure/Services/EntitlementService.cs, backend/Casazen.Core/Services/HostSurfaceRules.cs, backend/Casazen.Core/Features/FeatureFlags.cs, backend/docs/runbooks/site-integration.md]
---

## In breve
Il tuo sito di prenotazione ([[sito-prenotazione]]) di solito si apre da un indirizzo di CasaZen. Da **Impostazioni › Dominio pubblico** puoi dargli un indirizzo tuo: un **sottodominio CasaZen** oppure, con il piano **Pro** o **Scale**, un **dominio personalizzato** (per esempio `prenota.latuaagenzia.it`). Se hai già un sito, da **Impostazioni › Incorpora nel tuo sito** copi un **widget** da incollare nelle tue pagine, oppure usi il **plugin per WordPress**.

**Ti serve?** Non per cominciare: il sito funziona già con l'indirizzo di CasaZen. Ti serve se vuoi un indirizzo tuo o se vuoi mostrare le prenotazioni dentro un sito che hai già. Per un dominio tuo devi: avere **già comprato** il dominio presso chi vende domini (in CasaZen non si compra), avere il piano Pro o Scale e poter modificare il **DNS**. Il DNS è l'elenco di istruzioni, tenuto da chi gestisce il tuo dominio, che dice a internet dove trovare il tuo sito: CasaZen ti mostra poche righe da copiare lì. Se non l'hai mai fatto, manda quei valori a chi gestisce il dominio o al supporto di chi te l'ha venduto: sa cosa farne.

Tutto questo lo gestisce l'**amministratore** dell'organizzazione. Il dominio proprio è attivo solo dopo che hai creato alcuni record DNS presso chi gestisce il tuo dominio. «Incorpora nel tuo sito» e le scelte su cosa passa dal tuo dominio sono **su attivazione** (vedi [[per-iniziare#cosa-significa-su-attivazione]]): le accende CasaZen. Se non le vedi, scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza») e chiedi di attivarle.

## Funzionalità
| Funzionalità | Cosa fa | Dove si trova | Chi può usarla | Disponibilità | Come si usa |
|---|---|---|---|---|---|
| Indirizzo del sito: percorso, sottodominio o dominio proprio | Sceglie l'indirizzo con cui gli ospiti arrivano al sito | Impostazioni › Dominio pubblico | amministratore | Disponibile (dominio proprio con il piano Pro o Scale) | Scegliere l'indirizzo del sito |
| Collegamento di un dominio proprio | Verifica il dominio con i record DNS e lo attiva | Impostazioni › Dominio pubblico | amministratore | Disponibile (piano Pro o Scale) | Collegare un dominio tuo |
| Stato e controllo del dominio | Dice se il dominio è «Attivo», in attesa o non attivo; «Controlla ora» | Impostazioni › Dominio pubblico › «Configurazione attuale» | amministratore | Disponibile | Controllare lo stato del dominio |
| Cosa passa dal tuo dominio | Area ospite, portale proprietari e link delle e-mail con il tuo indirizzo | Impostazioni › Dominio pubblico › «Cosa passa dal tuo dominio» | amministratore | Su attivazione | Far passare area ospite e link dal tuo dominio |
| Widget da incollare | Prenotazione, un alloggio, area ospite, barra di ricerca | Impostazioni › Incorpora nel tuo sito | amministratore | Su attivazione | Incollare un widget nel tuo sito |
| Plugin per WordPress | Blocchi, shortcode e pagine già pronte per un sito WordPress | Impostazioni › Incorpora nel tuo sito › «Plugin per WordPress» | amministratore | Su attivazione | Installare il plugin per WordPress |
| Google Tag Manager | Carica il tuo contenitore sulle pagine di prenotazione del tuo dominio, con il consenso dell'ospite | Impostazioni › Incorpora nel tuo sito › «Google Tag Manager» | amministratore | Su attivazione | Collegare Google Tag Manager |

## Come funziona

### Le tre modalità di indirizzo
Nel menu **«Modalità di pubblicazione»** scegli una delle tre.

| Modalità | Indirizzo che ottieni | Piano |
|---|---|---|
| **Percorso CasaZen** | L'indirizzo base di CasaZen seguito da `/book/` e dal nome del tuo sito | Tutti |
| **Sottodominio CasaZen** | Un indirizzo del tipo `nome.indirizzo-di-casazen`, dove «nome» lo scegli tu | Tutti |
| **Dominio personalizzato (Pro)** | Il tuo dominio, per esempio `prenota.latuaagenzia.it` | Pro o Scale |

Nella pagina vedi sempre i tre indirizzi possibili sotto «Configurazione attuale»: **URL percorso**, **URL sottodominio**, **URL dominio personalizzato**. Quello che hai scelto è l'indirizzo che CasaZen userà quando ti dà un link da copiare ([[sito-prenotazione#controllare-il-tuo-sito-e-copiare-il-link]]), nei widget e, se lo decidi, nelle e-mail agli ospiti.

**Sottodominio.** Il nome (**«Etichetta sottodominio»**) può avere lettere minuscole, cifre e trattini, non può iniziare né finire con un trattino e arriva a 63 caratteri. Se lo lasci vuoto vale il nome del tuo sito. Non puoi usare nomi riservati (`www`, `api`, `app`, `admin`, `staging`, `test`, `mail`) né un nome già preso da un altro sito CasaZen.

**Dominio personalizzato.** Serve il piano **Pro** o **Scale**. Nel menu la voce è disattivata se il tuo piano non lo comprende, e sotto compare «I domini personalizzati sono disponibili con Pro» con il link «Passa a Pro» ([[account-team-piano#piano-limiti-e-moduli]]). Se un dominio proprio è già attivo e poi il piano scade o scende, compare «Il tuo piano non include più il dominio personalizzato»: finché non torni a Pro il sito **non risponde** su quel dominio e i tuoi ospiti usano il percorso CasaZen.

Cambiare modalità o dominio ha effetto subito sui link che CasaZen ti dà da copiare: i link già condivisi con il vecchio indirizzo vanno aggiornati da te.

### Come si attiva un dominio proprio
1. Tu scrivi il dominio e salvi. CasaZen ti mostra i **record DNS da creare** presso chi gestisce il tuo dominio (il registrar, cioè chi te l'ha venduto, o il provider dove lo gestisci).
2. Tu crei i record. I valori esatti li copi dalla pagina: sono tre tipi.
   - **Record TXT di proprietà**: dimostra che il dominio è tuo.
   - **Record CNAME**: fa puntare il dominio al servizio di CasaZen. Si usa per un nome con un prefisso come `www` o `prenota`.
   - **Record A** (in alternativa al CNAME): per un dominio **senza** `www` (la radice del dominio non può avere un CNAME) crei un record A per ogni indirizzo indicato.
   - **Record TXT del fornitore del servizio**: compare **solo se** il dominio risulta già usato su un altro account dello stesso fornitore; serve a confermare che è tuo.
3. Il DNS impiega un po' a propagarsi, **di solito alcune ore**. CasaZen ricontrolla da solo **ogni 30 minuti** e, appena i record sono a posto, attiva il dominio. Il certificato di sicurezza (SSL, il lucchetto «https») si crea da solo dopo l'attivazione.
4. Se non vuoi aspettare, premi **«Controlla ora»**.

Se per 14 giorni dal salvataggio il dominio non si attiva, il controllo automatico si ferma («Il controllo automatico è sospeso…»): dopo aver sistemato i record premi «Controlla ora». Quando il dominio è attivo CasaZen continua a controllarlo **ogni giorno**: se i record vengono tolti, dopo due controlli andati male il dominio smette di risultare attivo.

### Gli stati del dominio
| Stato | Cosa vedi | Cosa fai |
|---|---|---|
| **Attivo** | «Il tuo dominio è attivo»; l'ospite può prenotare da lì | Niente |
| **In attesa del DNS** | «In attesa dei record DNS» | Crea o controlla i record e premi «Controlla ora» |
| **In attivazione** | «Attivazione in corso»: i record non sono il problema, la piattaforma sta completando l'attivazione e riprova da sola | Aspetta; se il problema dura, scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza») |
| **Non attivo** | «Il dominio non può essere attivato» | Controlla che il dominio sia scritto bene o scegline un altro |

Sotto lo stato vedi **«Ultimo controllo»**, **«Attivo dal»** e se il controllo automatico è in corso. Se il motivo è noto, la pagina lo spiega: record TXT non trovato, dominio che non punta ancora a CasaZen, dominio già usato da un altro sito CasaZen, dominio già collegato a un altro progetto del fornitore, dominio rifiutato.

### Cosa passa dal tuo dominio (su attivazione)
Con un dominio proprio **attivo** puoi decidere cosa serve dal tuo indirizzo, con tre interruttori che si salvano appena li sposti.

| Interruttore | Effetto |
|---|---|
| **Area ospite sul mio dominio** | I tuoi ospiti gestiscono la prenotazione e fanno il check-in dal tuo indirizzo, con il tuo marchio e la scritta «Powered by CasaZen» |
| **Portale proprietari sul mio dominio** | I proprietari che gestisci accedono dal tuo indirizzo ([[agenzie-proprietari]]). I loro link si spostano solo quando l'accesso è attivo |
| **Usa il mio dominio nei link che invio** | Check-in, gestione della prenotazione, conferme e inviti partono dal tuo indirizzo e non da quello di CasaZen |

Quello che lasci spento resta sull'indirizzo di CasaZen. Sotto gli interruttori la riga **«Accesso dei proprietari»** dice a che punto è l'accesso sul tuo dominio: «non ancora richiesto», «registrazione in corso», «in attesa di abilitazione da parte di CasaZen» (la fa CasaZen, non devi fare nulla), «attivo», «registrazione non riuscita» (con il pulsante «Riprova»). Se un interruttore è acceso ma non ancora in funzione, sotto leggi «Per ora … resta sull'indirizzo di CasaZen».

Un sottodominio CasaZen non serve mai queste cose: valgono solo per un **dominio proprio verificato**.

Sul tuo dominio funzionano soltanto: il sito di prenotazione (con indirizzi puliti, per esempio `/` e `/property/…`), i widget, le pagine di check-in e del portale ospite quando le hai accese e il portale proprietari. Tutto il resto del mondo CasaZen (login, app, ricerca) sul tuo dominio risponde «Pagina non trovata». I documenti legali di CasaZen rimandano al sito di CasaZen.

### Incorporare il sito dentro il sito che hai già
Se hai già un sito (WordPress o altro) non devi per forza usare un indirizzo nuovo: puoi mettere nelle tue pagine un **widget**. La pagina **Incorpora nel tuo sito** (solo per l'amministratore) ti dà il codice da incollare, con l'anteprima del widget vero.

Ci sono quattro widget:

| Widget | Cosa mostra |
|---|---|
| **Prenotazione** | Il motore di prenotazione completo: date, ospiti e case disponibili |
| **Un alloggio** | La pagina di una casa, con calendario e prezzo |
| **Area ospite** | L'ingresso degli ospiti: scrivono il codice della prenotazione e gestiscono il soggiorno in una pagina intera |
| **Barra di ricerca** | Una barra con date e ospiti per la prima pagina del tuo sito: porta l'ospite alla pagina del tuo sito che contiene il motore di prenotazione |

Cosa devi sapere:
- Il **pagamento non avviene mai dentro il widget**: quando l'ospite preme «Prenota», si apre una pagina intera sul tuo indirizzo di prenotazione (con date e ospiti già scelti).
- Il widget segue la **lingua** della pagina che lo contiene e si adatta alla sua altezza.
- Il widget non usa cookie né memoria del browser.
- Il sito che ospita il widget deve essere in **https**.
- Un widget mostra solo le case **pubblicate** ([[sito-prenotazione#quando-una-casa-compare-sul-sito]]).
- Senza un dominio attivo il codice usa l'indirizzo di CasaZen e il nome del tuo sito: quando il dominio sarà attivo copia di nuovo il codice, perché il vecchio resta quello con l'indirizzo di CasaZen.
- Se la tua installazione non ha la funzione attiva, il widget mostra «Questo widget non è disponibile»: la pagina «Incorpora nel tuo sito» non c'è nemmeno nel menu.

### Il plugin per WordPress
Se il tuo sito è in WordPress (il programma con cui è fatto il sito di molti; un **plugin** è un componente aggiuntivo) non devi incollare codice: il plugin **«CasaZen per WordPress»** aggiunge blocchi e shortcode, crea per te le pagine e le voci di menu e funziona con Elementor, Polylang e WPML. Il plugin non è ancora nell'elenco di WordPress.org: lo installi da un file ZIP. Nella pagina «Incorpora nel tuo sito» trovi il link «Scarica il plugin» solo se il file è disponibile nella tua installazione; se non lo vedi, scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza») e chiedi il file ZIP.

**Requisiti**: WordPress 6.4 o successivo, PHP 7.4 o successivo, un indirizzo del tuo sito di prenotazione CasaZen (meglio il tuo dominio attivo) e la funzione «Incorpora» attiva ([[per-iniziare#cosa-significa-su-attivazione]]). Finché non lo è, il plugin non mostra nulla ai visitatori e avvisa solo gli amministratori del sito WordPress.

**Come lo configuri** (in WordPress, **Impostazioni › CasaZen**):
- **Indirizzo CasaZen**: l'indirizzo del tuo sito di prenotazione, per esempio `https://prenota.latuaagenzia.it`. Deve essere `https`.
- **Identificativo dell'organizzazione (slug)**: serve solo se l'indirizzo è quello di CasaZen e non un tuo dominio.
- **Associazione delle lingue**: una riga per lingua del sito, per dire se un widget deve parlare italiano (`it`), inglese (`en`) o seguire la pagina (`auto`).
- La casella **«Carica lo script di CasaZen nelle pagine che lo usano»** resta accesa, salvo che tu lo carichi in un altro modo.
- Salvando un indirizzo nuovo il plugin prova subito la connessione; il pulsante **«Prova la connessione»** la ripete. Il riquadro **«Stato della connessione»** mostra il nome dell'agenzia, se l'incorporamento è «Attivo», se l'accesso dei proprietari è «Pronto» e quando è stata fatta l'ultima verifica.

**Shortcode e blocchi.** Ogni widget è un blocco dell'editor (categoria «Widget») e uno shortcode.

| Shortcode | Blocco | Cosa mostra |
|---|---|---|
| `[casazen_booking]` | Prenotazione CasaZen | Il motore di prenotazione |
| `[casazen_property slug="…"]` | Alloggio CasaZen | La scheda di una casa (lo `slug` è il nome della casa nel suo indirizzo) |
| `[casazen_search target="/prenota/"]` | Barra di ricerca CasaZen | La barra per la home: porta alla pagina `target` |
| `[casazen_guest_access]` | Accesso ospiti CasaZen | Il punto in cui l'ospite apre la sua prenotazione con codice e ultime 4 cifre del telefono (o e-mail) |
| `[casazen_owner_login]` | Accesso proprietari CasaZen | Un collegamento all'accesso dei proprietari |

Negli shortcode puoi aggiungere, tra l'altro, `lang`, `checkin`, `checkout`, `guests` (date e ospiti con cui il widget si apre), `primary` (colore), `radius`, `font`. Un valore non valido viene ignorato.

**Procedura guidata.** In **Impostazioni › CasaZen**, scheda **«Procedura guidata»**, il plugin crea le pagine **«Prenota»**, **«Check-in online»** e **«Area proprietari»** (nella lingua del sito) e, se vuoi, le aggiunge a un menu. Si può eseguire due volte senza danni: non sovrascrive né duplica nulla, e non cancella mai una pagina.

**Elementor.** Aggiungi il widget **Shortcode** e incolla lo shortcode. Nell'editor di Elementor vedi un segnaposto: il widget vero compare nella pagina pubblicata.

**Lingue.** Con Polylang o WPML il widget segue la lingua della pagina. Le tre pagine create dalla procedura nascono nella lingua predefinita: vanno tradotte.

**Cache e ottimizzazione.** Se una pagina resta vuota e usi un plugin di cache (WP Rocket, LiteSpeed Cache, Autoptimize, SG Optimizer…), escludi dalle opzioni che ritardano, uniscono o minimizzano il JavaScript gli indirizzi che contengono `/embed/v1/`, poi svuota la cache.

**Privacy.** Il plugin non usa cookie e non salva dati dei visitatori: il server del tuo sito contatta il tuo indirizzo CasaZen solo dalla schermata delle impostazioni e dai controlli periodici (ogni 12 ore).

**Disinstallazione.** «Elimina» il plugin toglie le sue impostazioni; le pagine create e le voci di menu **restano**, sono tue.

### Google Tag Manager
Se usi Google Tag Manager scrivi qui l'**identificativo del contenitore** (`GTM-` seguito da 4-12 lettere o cifre, per esempio `GTM-ABC123`). Le pagine di prenotazione sul tuo dominio lo caricano **solo con il consenso dell'ospite**. Lasciando il campo vuoto e salvando, il contenitore viene tolto. I widget mandano gli eventi di ricerca, scelta della casa e inizio prenotazione al `dataLayer` della tua pagina.

## Come fare

### Scegliere l'indirizzo del sito
**Ti serve:** essere amministratore. Per il solo sottodominio non serve altro; per un dominio tuo vedi il compito successivo.
1. Apri **Impostazioni › Dominio pubblico**.
2. Nel menu **«Modalità di pubblicazione»** scegli **«Percorso CasaZen»**, **«Sottodominio CasaZen»** o **«Dominio personalizzato (Pro)»**.
3. Per il sottodominio scrivi il nome in **«Etichetta sottodominio»** (vuoto = nome del sito).
4. Premi **«Salva impostazioni dominio»**. Compare «Impostazioni dominio salvate».
5. Sotto **«Configurazione attuale»** controlli gli indirizzi risultanti.

Se il salvataggio dà un errore, la pagina ne dice il motivo: nome riservato, già usato, non valido oppure piano non adatto.

### Collegare un dominio tuo
**Ti serve:** il piano **Pro** o **Scale**; un dominio che hai **già comprato** (CasaZen non vende domini); l'accesso al DNS del dominio, oppure una persona che lo gestisce per te; essere amministratore; qualche ora di attesa. Il sito deve già funzionare con l'indirizzo di CasaZen ([[sito-prenotazione]]).
1. Verifica di avere il piano **Pro** o **Scale** e di poter modificare il DNS del dominio (o di averne l'accesso tramite chi lo gestisce).
2. Apri **Impostazioni › Dominio pubblico**, scegli **«Dominio personalizzato (Pro)»** e scrivi il dominio nel campo **«Dominio personalizzato»**, per esempio `prenota.latuaagenzia.it`.
3. Premi **«Salva impostazioni dominio»**. Compare la card **«Record DNS da creare»**.
4. Presso chi gestisce il dominio crea i record: il **TXT** di proprietà e il **CNAME** (oppure i record **A** se non usi `www`). Copia ogni valore con i pulsanti «Copia valore TXT», «Copia valore CNAME». Se non hai mai modificato un DNS, manda questi valori a chi gestisce il dominio o al supporto di chi te l'ha venduto: sa cosa farne.
5. Se la pagina mostra anche il TXT del fornitore del servizio, creane uno anche per questo.
6. Aspetta la propagazione (alcune ore) e premi **«Controlla ora»**. Quando vedi **«Il tuo dominio è attivo»** il dominio funziona.

Cosa succede dopo: gli ospiti che aprono il tuo dominio vedono il sito di prenotazione; i link da copiare nel tuo gestionale usano il tuo indirizzo. È **reversibile**: puoi tornare a «Percorso CasaZen» quando vuoi (i link già condivisi con il dominio smetteranno di funzionare).

> **Attenzione:** se cambi dominio, quello vecchio smette di rispondere e il nuovo riparte da zero (nuovi record TXT).

### Controllare lo stato del dominio
1. Apri **Impostazioni › Dominio pubblico**.
2. Sotto **«Configurazione attuale»** guarda il segno (**«Attivo»**, **«In attesa del DNS»**, **«In attivazione»**, **«Non attivo»**) e la frase sotto.
3. Premi **«Controlla ora»** per un controllo subito.

### Far passare area ospite e link dal tuo dominio
**Ti serve:** un dominio proprio **attivo** e la funzione attiva sul tuo account (su attivazione: se non la vedi, scrivi all'assistenza di CasaZen).
1. Apri **Impostazioni › Dominio pubblico**: in fondo compare **«Cosa passa dal tuo dominio»**.
2. Accendi gli interruttori che vuoi: **«Area ospite sul mio dominio»**, **«Portale proprietari sul mio dominio»**, **«Usa il mio dominio nei link che invio»**. Ognuno si salva da solo.
3. Se vedi «registrazione non riuscita» alla voce **«Accesso dei proprietari»**, premi **«Riprova»**.

Se il blocco non compare, o non c'è un dominio attivo, o la funzione non è attiva sulla tua installazione.

### Incollare un widget nel tuo sito
**Ti serve:** la funzione «Incorpora nel tuo sito» attiva (se non la vedi nel menu Impostazioni, scrivi all'assistenza di CasaZen: in alto premi **Guida** e scegli «Scrivi all'assistenza»), almeno una casa «Pubblicata» e un sito in **https** dove incollare il codice.
1. Apri **Impostazioni › Incorpora nel tuo sito**. In alto, sotto «Il tuo dominio», vedi il dominio che usa il codice; **«Gestisci il dominio»** porta alla pagina del dominio.
2. Sotto **«Cosa incorporare»** scegli il widget: **«Prenotazione»**, **«Un alloggio»**, **«Area ospite»** o **«Barra di ricerca»**.
3. Per **«Un alloggio»** scegli la casa dal menu **«Alloggio»** (solo le case pubblicate).
4. Per **«Barra di ricerca»** scrivi l'indirizzo completo della pagina del tuo sito con il motore di prenotazione (**«Pagina del tuo sito con il motore di prenotazione»**, per esempio `https://www.esempio.it/prenota`): deve iniziare con `http://` o `https://`. La barra propone le località delle tue case così come sono oggi: se aggiungi case in un posto nuovo copia di nuovo il codice.
5. Controlla l'**Anteprima**: è il widget vero. Se provi a prenotare, il pagamento si apre in una pagina intera.
6. Premi **«Copia»** sopra il **«Codice da incollare»**. Il pulsante diventa «Copiato».
7. Incolla il codice nella tua pagina, dove vuoi il widget. In WordPress usa un blocco **«HTML personalizzato»**.

Finché la scelta non è completa (nessuna casa scelta, indirizzo mancante) non c'è codice da copiare.

### Installare il plugin per WordPress
**Ti serve:** la funzione «Incorpora nel tuo sito» attiva sulla tua installazione, un sito WordPress 6.4 o successivo (PHP 7.4 o successivo) di cui sei amministratore, il file ZIP del plugin e l'indirizzo del tuo sito di prenotazione CasaZen.
1. In **Impostazioni › Incorpora nel tuo sito**, sotto **«Plugin per WordPress»**, premi **«Scarica il plugin»**. Se il link non c'è, il file non è ancora disponibile nella tua installazione: scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza») e chiedi il file ZIP.
2. In WordPress apri **Plugin › Aggiungi nuovo › Carica plugin**, scegli il file ZIP, premi **Installa ora** e poi **Attiva**.
3. Apri **Impostazioni › CasaZen** e scrivi **«Indirizzo CasaZen»** (e lo slug se è l'indirizzo di CasaZen). Salva.
4. Premi **«Prova la connessione»**. Quando leggi «La connessione funziona» puoi andare avanti. Se il test dice che l'incorporamento «non è ancora attivo per la tua agenzia», la funzione non è attiva: scrivi all'assistenza di CasaZen e chiedi di attivare «Incorpora nel tuo sito», poi riprova.
5. Apri la scheda **«Procedura guidata»**, lascia le tre pagine, scegli il menu e premi **«Crea le pagine»**.
6. Apri le tre pagine («Prenota», «Check-in online», «Area proprietari») e controlla che il widget compaia.
7. Per la barra di ricerca nella tua home, aggiungi `[casazen_search target="/prenota/"]`.

Il test di connessione può dire cose diverse: «L'indirizzo non è raggiungibile» (controlla che sia scritto giusto, in `https`, che il sito sia online e che l'hosting non blocchi le richieste in uscita), «non è un indirizzo CasaZen che supporta l'incorporamento» (hai scritto l'indirizzo del sito WordPress invece di quello di prenotazione), «CasaZen non conosce questo indirizzo o questo identificativo» (il dominio deve essere verificato in CasaZen; sul dominio di CasaZen serve lo slug).

### Collegare Google Tag Manager
**Ti serve:** la funzione «Incorpora nel tuo sito» attiva e un contenitore Google Tag Manager tuo.
1. Apri **Impostazioni › Incorpora nel tuo sito**, sezione **«Google Tag Manager»**.
2. Scrivi l'**Identificativo del contenitore**, per esempio `GTM-ABC123`.
3. Premi **«Salva»**. Per toglierlo, svuota il campo e salva: «Identificativo rimosso».
4. Se compare «Non è un identificativo valido», controlla di aver scritto `GTM-` seguito da 4-12 lettere o cifre.

## Flussi completi

### Flusso: dal sito di CasaZen al tuo dominio
1. **Tu** compri il dominio (fuori da CasaZen) e passi al piano Pro o Scale ([[account-team-piano#piano-limiti-e-moduli]]).
2. **Tu** scegli «Dominio personalizzato (Pro)» e scrivi il dominio in **Impostazioni › Dominio pubblico**.
3. **Tu** (o chi gestisce il tuo dominio) crei i record TXT e CNAME o A.
4. **CasaZen** ricontrolla ogni 30 minuti e attiva il dominio, poi crea il certificato.
5. **Tu** controlli che sia «Attivo» e, se vuoi, accendi area ospite e link dal tuo dominio.
6. **Tu** copi i link del sito dalla pagina [[sito-prenotazione]]: ora usano il tuo dominio.

### Flusso: dal tuo sito WordPress alla prenotazione
1. **Tu** installi il plugin e provi la connessione.
2. **Tu** crei le pagine con la procedura guidata.
3. **L'ospite** apre «Prenota» sul tuo sito, sceglie le date e preme «Prenota» nel widget.
4. **CasaZen** porta l'intera pagina al checkout sul tuo indirizzo di prenotazione, con date e ospiti già scelti.
5. **L'ospite** paga e riceve la conferma: [[sito-prenotazione#come-prenota-un-ospite-dal-tuo-sito]].
6. **L'ospite** usa «Check-in online» sul tuo sito per gestire la sua prenotazione ([[portale-ospite]]).

## Regole e limiti
- Dominio e widget li gestisce solo l'**amministratore**. Chi non lo è vede «Riservato all'amministratore dell'organizzazione» nella pagina «Incorpora nel tuo sito».
- Il **dominio personalizzato** richiede il piano **Pro** o **Scale**. Senza il piano il sito torna sul percorso CasaZen.
- Un dominio può servire **un solo sito CasaZen** alla volta.
- Controllo automatico: ogni 30 minuti per 14 giorni; poi solo con «Controlla ora». A dominio attivo: una volta al giorno; dopo due controlli andati male il dominio non risulta più attivo.
- Un sottodominio è lungo al massimo 63 caratteri e non può essere uno dei nomi riservati.
- I widget funzionano solo su siti **https**.
- Il campo del contenitore di Google Tag Manager accetta solo `GTM-` più 4-12 lettere o cifre.
- Il plugin richiede WordPress 6.4+ e PHP 7.4+; le sue pagine create non vengono mai cancellate dal plugin.
- Widget, plugin e «Cosa passa dal tuo dominio» sono su attivazione: li accende CasaZen.

## Domande frequenti

### Mi serve un dominio per usare il sito di prenotazione?
No. Il sito funziona già con l'indirizzo di CasaZen. Il dominio ti serve solo se vuoi un indirizzo tuo (per esempio `prenota.latuaagenzia.it`): in quel caso devi averlo già comprato e avere il piano Pro o Scale.

### Dove compro un dominio?
Non in CasaZen: lo compri presso un gestore di domini a tua scelta (il «registrar»). Poi lo colleghi qui ([[dominio-incorpora#collegare-un-dominio-tuo]]).

### Non so cosa sono i record DNS: come faccio?
Apri la pagina del dominio, copia i valori dei record (TXT e CNAME o A) e mandali a chi gestisce il tuo dominio o al supporto di chi te l'ha venduto: sa cosa farne. Poi torna in CasaZen e premi «Controlla ora».

### Ho creato i record DNS ma il dominio non diventa «Attivo». Cosa faccio?
Aspetta la propagazione (può servire qualche ora) e premi «Controlla ora». Se dopo 14 giorni dal salvataggio il controllo automatico si è fermato, premi «Controlla ora» dopo aver verificato i record. Leggi la frase sotto lo stato: spiega se manca il TXT o se il CNAME non punta ancora a CasaZen.

### Posso usare il dominio senza `www`?
Sì, ma il record CNAME non si può mettere sulla radice: usa i **record A** indicati nella pagina.

### Perché il sito non risponde più sul mio dominio?
Se il piano non include più il dominio personalizzato, compare un avviso e gli ospiti usano il percorso CasaZen. Torna a Pro o Scale e il dominio riparte.

### Non vedo «Incorpora nel tuo sito» o il plugin: perché?
Sono funzioni su attivazione: le accende CasaZen. Scrivi all'assistenza di CasaZen (in alto premi **Guida** e scegli «Scrivi all'assistenza») e chiedi di attivare «Incorpora nel tuo sito».

### Il widget dice «Questo widget non è disponibile».
La funzione non è attiva per il tuo sito oppure l'indirizzo del codice non è corretto. Controlla di aver incollato il codice intero e che la casa sia pubblicata.

### Il widget non compare su una pagina con la cache attiva.
Escludi dalle ottimizzazioni gli indirizzi che contengono `/embed/v1/` e svuota la cache.

### Posso tenere il mio sito attuale e usare il dominio solo per le prenotazioni?
Sì. Il tuo sito principale resta dov'è (per esempio `www.latuaagenzia.it`) e per CasaZen colleghi un sottodominio come `prenota.latuaagenzia.it`. In alternativa incolli un widget nelle pagine del sito che hai già.

## Glossario
- **Dominio**: l'indirizzo del sito, per esempio `latuaagenzia.it`.
- **Sottodominio**: un nome davanti al dominio, per esempio `prenota.latuaagenzia.it`.
- **Registrar**: l'azienda che ti ha venduto il dominio.
- **DNS** e **record DNS**: l'elenco di istruzioni che dice a internet dove trovare un dominio; lo gestisce chi tiene il dominio. Un record è una riga di quell'elenco.
- **TXT**: un record che dimostra che sei il proprietario del dominio.
- **CNAME**: un record che fa puntare un nome (come `prenota`) al servizio di CasaZen.
- **Record A**: un record che fa puntare un dominio senza `www` a un indirizzo preciso.
- **SSL**: il lucchetto «https» che protegge il sito; CasaZen lo crea da solo dopo l'attivazione.
- **Widget**: un pezzo del sito di prenotazione che incolli in un'altra pagina.
- **Plugin**: un componente aggiuntivo di WordPress, il programma con cui è fatto il sito di molti.
- **Shortcode**: un codice tra parentesi quadre che WordPress trasforma in un widget.
- **Slug**: il nome di un sito o di una casa dentro il suo indirizzo (minuscole, numeri, trattini).

## Vedi anche
- [[sito-prenotazione]]: cosa vede l'ospite, aspetto e documenti del sito.
- [[portale-ospite]]: area ospite e check-in sul tuo dominio.
- [[account-team-piano]]: piano Pro e dati dell'organizzazione.
- [[agenzie-proprietari]]: il portale proprietari sul tuo dominio.
