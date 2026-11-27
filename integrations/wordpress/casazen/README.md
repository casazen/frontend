# CasaZen per WordPress · CasaZen for WordPress

[Italiano](#italiano) · [English](#english)

Chi sviluppa il plugin trova struttura, comandi, CI e rilascio in `docs/03-documenti-ai/runbook/frontend/wordpress-plugin.md` (project documentation folder, outside the repository). / Developers: structure, commands, CI and release are in `docs/03-documenti-ai/runbook/frontend/wordpress-plugin.md` (project documentation folder, outside the repository).

## Italiano

### Che cosa fa

CasaZen per WordPress collega il tuo sito WordPress al sito di prenotazione che la tua agenzia usa con CasaZen. Mette sulle tue pagine il motore di prenotazione, la barra di ricerca per la home, l'accesso degli ospiti alla loro prenotazione e il collegamento all'area proprietari, con blocchi o shortcode, e crea per te le pagine e le voci di menu. Con un solo pulsante («Connetti a CasaZen») il sito si collega all'account dell'agenzia: l'indirizzo si compila da solo e il dominio si gestisce dalla schermata del plugin. Il PHP del plugin è sottile di proposito: i widget vivono in un piccolo script che CasaZen serve dal tuo indirizzo, quindi una modifica ai widget non richiede un aggiornamento del plugin. Il pagamento non avviene mai dentro un frame: «Prenota» porta l'intera pagina al checkout del tuo indirizzo CasaZen.

### Requisiti

- WordPress 6.4 o successivo e PHP 7.4 o successivo.
- L'account CasaZen della tua agenzia, con l'incorporamento attivo. Finché non lo è, il plugin non mostra nulla ai visitatori e avvisa gli amministratori del sito.
- Per collegare il sito: essere amministratore dell'agenzia in CasaZen, e un sito il cui indirizzo inizia con `https://` (`http` solo per i server di sviluppo locali) con l'amministrazione di WordPress sullo stesso indirizzo.
- Per usare un dominio tuo (per esempio `prenota.example.com`): il piano Pro. Senza, il sito di prenotazione risponde sull'indirizzo di CasaZen.

### Installazione

Il plugin non è ancora su WordPress.org: si installa lo ZIP.

1. Scarica lo ZIP da CasaZen: nella console, «Incorpora nel tuo sito», pulsante «Scarica il plugin». Una versione numerata è anche nella release di GitHub con il tag `wp-plugin-v<versione>` del repository frontend: <https://github.com/casazen/frontend/releases>.
2. In WordPress apri Plugin → Aggiungi nuovo → Carica plugin, scegli lo ZIP, premi Installa ora e poi Attiva.
3. Apri Impostazioni → CasaZen e premi «Connetti a CasaZen» (vedi sotto).

Lo ZIP scaricato dalla console di un ambiente si collega alla console di quell'ambiente. Per un'installazione di prova con uno ZIP senza indirizzo (per esempio costruito dal repository) aggiungi a `wp-config.php` la costante `define( 'CASAZEN_APP_ORIGIN', 'https://casazen-test-app.vercel.app' );`: «Connetti a CasaZen» apre quella console. Senza la costante e senza indirizzo nello ZIP vale la console di produzione, `https://www.casazen.space`.

### Collegare il sito a CasaZen

1. In Impostazioni → CasaZen premi «Connetti a CasaZen». Si apre la console di CasaZen (se serve, accedi): controlla l'indirizzo del sito che chiede il collegamento e conferma con «Collega».
2. Torni su WordPress e la schermata dice «Collegato a <agenzia>». L'indirizzo CasaZen e l'identificativo dell'organizzazione sono già compilati e la prova di connessione è già fatta: il passo successivo è la procedura guidata («Apri la procedura guidata»).
3. Il collegamento usa una credenziale propria del sito, creata dal pulsante e revocabile. Sta solo nel database di WordPress (l'opzione `casazen_link`, non caricata in automatico e mai mostrata nelle pagine) e serve solo alle schermate di amministrazione del plugin. «Scollega», nella stessa schermata, la restituisce a CasaZen; anche la console di CasaZen elenca i siti collegati e può scollegarli.

Se CasaZen non accetta più il sito (per esempio è stato scollegato dalla console), la schermata dice «Non più collegato» e ripropone «Connetti a CasaZen»: le impostazioni restano. Se l'indirizzo CasaZen non offre il collegamento (una versione più vecchia di CasaZen, o l'incorporamento non attivo per la tua agenzia), la schermata lo dice: usa la configurazione manuale («Avanzate»).

### Dominio

Con il sito collegato, la sezione «Dominio» della schermata gestisce l'indirizzo del tuo sito di prenotazione:

1. Scrivi il dominio (per esempio `prenota.example.com`) e premi «Collega dominio».
2. Compaiono i record DNS da creare dove si gestisce il DNS del dominio, con i pulsanti per copiarne nome e valore: il record TXT di proprietà, il record CNAME (per un dominio senza www, in alternativa i record A) e, solo quando serve, un record TXT del fornitore del servizio. È l'unico passo fuori da WordPress.
3. Lo stato («In attesa dei record DNS», «Attivazione in corso», «Il tuo dominio è attivo» o «Il dominio non può essere attivato», con il motivo e l'ultimo controllo) si aggiorna da solo mentre la schermata è aperta, al massimo ogni 30 secondi e per al massimo 15 minuti; «Controlla ora» lo controlla subito.
4. Quando il dominio è attivo il plugin usa da solo il suo indirizzo: l'indirizzo CasaZen delle impostazioni diventa il dominio e l'identificativo si svuota, e la prova di connessione riparte. «Rimuovi dominio» riporta il sito di prenotazione sull'indirizzo di CasaZen, e il plugin lo segue.
5. Sotto, le tre scelte di cosa passa dal dominio (area ospite, portale proprietari, link nelle e-mail, con «Salva le scelte») e lo stato dell'accesso dei proprietari.

Il dominio personalizzato richiede il piano Pro: senza, la sezione lo dice e porta alla pagina del dominio della console. Piano, fatturazione e Google Tag Manager restano nella console.

### Configurazione manuale («Avanzate»)

Senza collegare il sito puoi scrivere tu l'indirizzo: apri Impostazioni → CasaZen, sezione «Avanzate: configurazione manuale». Con il sito collegato i campi restano, ma indirizzo e identificativo li compila CasaZen.

| Campo | Cosa scrivere |
|---|---|
| Indirizzo CasaZen | L'indirizzo del tuo sito di prenotazione CasaZen, per esempio `https://prenota.example.com`. Si tengono solo schema, nome host e porta. Serve `https` (`http` è accettato solo per i server di sviluppo locali); non ammette nome utente e password. Finché è vuoto il plugin non fa nulla. |
| Identificativo dell'organizzazione (slug) | Serve solo se l'indirizzo qui sopra è il dominio di CasaZen e non un dominio della tua agenzia: lo slug della tua organizzazione (lettere minuscole, numeri e trattini). Altrimenti lascialo vuoto. |
| Associazione delle lingue | Una riga per ogni lingua del sito, nella forma `codice = it`, `codice = en` o `codice = auto`. Vedi «Polylang e WPML». |
| Script | La casella «Carica lo script di CasaZen nelle pagine che lo usano» (attiva di default): il plugin mette lo script `<indirizzo>/embed/v1/embed.js` una sola volta, solo nelle pagine che hanno un widget. Toglila solo se lo carichi tu in un altro modo. |

Quando salvi un indirizzo nuovo il plugin prova subito la connessione. Il pulsante «Prova la connessione» la ripete quando vuoi. Il riquadro «Stato della connessione» mostra il risultato dell'ultima prova: Agenzia (il nome dell'agenzia che risponde a quell'indirizzo), Incorporamento (Attivo, Non attivo o Sconosciuto), Accesso dei proprietari (Pronto, Non ancora pronto o Sconosciuto), Ultima verifica e l'Indirizzo dello script. Il risultato resta in memoria 12 ore (15 minuti se la prova è fallita) e si rinnova in automatico, mai quando un visitatore apre una pagina.

#### Che cosa significa l'esito della prova

Dopo la prova l'indirizzo della pagina finisce con `casazen_result=<codice>`: il codice dice cosa è successo.

| Codice | Cosa leggi | Cosa fare |
|---|---|---|
| `ok` | «La connessione funziona.» | Niente: puoi aggiungere i widget. |
| `embed_disabled` | «La connessione funziona, ma l'incorporamento non è ancora attivo per la tua agenzia. Chiedi al tuo referente CasaZen di attivarlo.» | Chiedi al referente di attivarlo, poi premi di nuovo «Prova la connessione». Fino ad allora i widget restano nascosti. |
| `not_configured` | «Imposta l'indirizzo CasaZen per iniziare.» | Scrivi l'indirizzo nel campo «Indirizzo CasaZen» e salva. |
| `manifest_unreachable` | «L'indirizzo non è raggiungibile. Controlla che sia corretto e che il sito sia online.» | Controlla che sia scritto bene, che sia `https`, che il sito sia online e che l'hosting non blocchi le richieste in uscita dal server di WordPress. |
| `manifest_invalid` | «L'indirizzo ha risposto, ma non è un indirizzo CasaZen che supporta l'incorporamento. Controlla l'indirizzo.» | Controlla di aver scritto l'indirizzo di prenotazione dell'agenzia e non, per esempio, quello del sito WordPress. |
| `resolve_unreachable` | «CasaZen non ha risposto alla verifica come previsto. Riprova tra qualche minuto.» | Riprova tra qualche minuto. |
| `host_not_found` | «CasaZen non conosce questo indirizzo o questo identificativo. Controlla come sono scritti.» | Controlla come sono scritti. Se l'indirizzo è un dominio della tua agenzia, il dominio deve essere verificato in CasaZen; se è il dominio di CasaZen, compila lo slug. |

### Procedura guidata

Apri Impostazioni → CasaZen, scheda «Procedura guidata». Prima esegui la prova di connessione: finché non ha esito positivo la scheda lo chiede.

1. Scegli le pagine da creare: «Pagina di prenotazione» (il motore di prenotazione), «Pagina di accesso degli ospiti» (l'accesso degli ospiti) e «Pagina dell'area proprietari» (il collegamento all'area proprietari). I titoli proposti sono nella lingua del sito: «Prenota», «Check-in online» e «Area proprietari»; su un sito in inglese sono «Book», «Online check-in» e «Owner area». Puoi cambiare ogni titolo o togliere la spunta a una pagina.
2. Lascia la casella «Pubblica subito le pagine» se vuoi le pagine pubblicate; senza spunta restano bozze.
3. Scegli il menu a cui aggiungere le voci, oppure «Non aggiungere voci di menu». Le voci vanno in fondo al menu. Se il tema è a blocchi (editor del sito) i menu non si cambiano da qui: la procedura elenca le pagine e le aggiungi tu al blocco Navigazione.
4. Premi «Crea le pagine». Il risultato elenca ogni pagina con il suo collegamento.

La procedura si può eseguire due volte senza danni, e non sovrascrive nulla: una pagina che ha già il suo ruolo non viene toccata né rifatta; una pagina che ha lo stesso indirizzo ma non è sua non viene mai adottata (la nuova prende il primo indirizzo libero); una voce di menu si aggiunge solo se nel menu non c'è già una voce che porta a quella pagina; niente viene spostato, rinominato o cancellato. Con Polylang le pagine nascono nella lingua predefinita e vanno tradotte (vedi «Polylang e WPML»).

Sotto il modulo la scheda ricorda la barra di ricerca della home: `[casazen_search]`.

### Shortcode e blocchi

Ogni widget ha uno shortcode e un blocco (categoria «Widget» dell'editor) con gli stessi attributi e lo stesso risultato.

| Shortcode | Blocco | Cosa mostra |
|---|---|---|
| `[casazen_booking]` | Prenotazione CasaZen | Il motore di prenotazione: ricerca, risultati e preventivo. «Prenota» porta l'intera pagina al checkout. |
| `[casazen_property slug="…"]` | Alloggio CasaZen | La scheda di un alloggio, con il suo preventivo. |
| `[casazen_search target="/prenota/"]` | Barra di ricerca CasaZen | La barra di ricerca per la hero della home (date, ospiti, luogo): apre la pagina `target` con la scelta. |
| `[casazen_guest_access]` | Accesso ospiti CasaZen | Dove l'ospite apre la sua prenotazione con il codice e le ultime quattro cifre del telefono (o l'e-mail). |
| `[casazen_owner_login]` | Accesso proprietari CasaZen | Un collegamento all'accesso dei proprietari sul tuo indirizzo CasaZen. |

Esempi: `[casazen_booking]` · `[casazen_property slug="villa-rossa"]` · `[casazen_search target="/prenota/"]` · `[casazen_guest_access]` · `[casazen_owner_login]`.

Gli attributi (un valore non valido è ignorato e vale il predefinito; un attributo sconosciuto è ignorato):

| Attributo | Per | Valori | Effetto |
|---|---|---|---|
| `slug` | `casazen_property` | lettere minuscole, numeri, trattini | Obbligatorio: lo slug dell'alloggio in CasaZen. Senza, il widget non compare (gli amministratori vedono una nota). |
| `lang` | tutti tranne `casazen_owner_login` | `it`, `en`, `auto` | La lingua del widget. Predefinito: la lingua della pagina (vedi «Polylang e WPML»). |
| `checkin`, `checkout` | `casazen_booking`, `casazen_property` | data `AAAA-MM-GG` | Date con cui il widget si apre. |
| `guests` | `casazen_booking`, `casazen_property` | da 1 a 30 | Ospiti con cui il widget si apre. |
| `target` | `casazen_search` | un percorso del sito che comincia con una sola `/`, o un indirizzo `https://` | La pagina che la barra apre. Predefinito: la pagina «Prenota» della procedura guidata (nella lingua della pagina), altrimenti la home. |
| `destinations` | `casazen_search` | `yes`, `no` | Con `yes` (predefinito) il campo «Dove» elenca i luoghi delle tue strutture. |
| `max_guests` | `casazen_search` | da 1 a 99 | Il massimo di ospiti che la barra accetta. |
| `datalayer` | `casazen_booking`, `casazen_property`, `casazen_guest_access` | `true`, `false` | Con `true` (predefinito) gli eventi del widget vanno al `dataLayer` della pagina. |
| `sync_url` | `casazen_booking`, `casazen_property` | `true`, `false` | Con `true` lo stato del widget si riflette nell'indirizzo della pagina (`?cz=`). Predefinito `false`. |
| `min_height` | `casazen_booking`, `casazen_property`, `casazen_guest_access` | da 100 a 2000 (pixel) | L'altezza iniziale del frame, prima che il widget misuri se stesso. |
| `primary` | tutti tranne `casazen_owner_login` | colore `#rgb` o `#rrggbb` | Il colore principale del widget. |
| `radius` | tutti tranne `casazen_owner_login` | `8px` (da 0 a 32) o `1rem` (da 0 a 2) | Gli angoli arrotondati. |
| `font` | tutti tranne `casazen_owner_login` | `editoriale`, `moderno`, `classico` | Il carattere del widget. |
| `label` | `casazen_owner_login` | testo, fino a 100 caratteri | Il testo del collegamento. Predefinito: «Area proprietari» (in inglese «Owner area»). |

Se il widget non compare: senza indirizzo nelle impostazioni, gli amministratori vedono la nota «CasaZen: imposta l'indirizzo in Impostazioni → CasaZen» e i visitatori niente; se l'incorporamento non è attivo per l'agenzia, al posto del widget resta un commento HTML (e la nota per gli amministratori).

### Elementor

Nella pagina, o nella home per la barra di ricerca, aggiungi il widget **Shortcode** di Elementor e incolla lo shortcode, per esempio `[casazen_search target="/prenota/"]`. Nell'editor e nell'anteprima di Elementor il widget mostra un segnaposto statico: il widget vero si vede nella pagina pubblicata.

### Polylang e WPML

La lingua del widget segue la lingua della pagina: se la pagina è in inglese il widget è in inglese. Il plugin la legge da Polylang o da WPML; senza nessuno dei due usa la lingua del sito. L'attributo `lang` di uno shortcode, se c'è, vince.

L'associazione delle lingue (Impostazioni → CasaZen) dice come il codice di una lingua diventa `it`, `en` o `auto` (con `auto` lo script legge la lingua della pagina). Una riga per lingua, `codice = valore`; il codice è quello che Polylang (lo slug della lingua) o WPML (il codice della lingua) danno alla pagina, oppure un locale come `it_IT`; maiuscole e `_` o `-` non contano. Un codice senza riga vale `it` per l'italiano, `en` per l'inglese e `auto` per ogni altra lingua. Esempio, per un sito con tre lingue:

```
it = it
en = en
fr = auto
```

Le tre pagine della procedura guidata nascono nella lingua predefinita e non sono tradotte: traduci «Prenota», «Check-in online» e «Area proprietari» con Polylang o con WPML. La barra di ricerca porta l'ospite alla traduzione della pagina «Prenota» nella lingua della pagina in cui si trova. Con WPML le pagine nuove prendono da sole la lingua predefinita.

### Plugin di cache e di ottimizzazione

Lo script ha gli attributi che i plugin di cache e di ottimizzazione leggono per lasciarlo stare: `data-no-optimize`, `data-no-defer`, `data-no-minify`, `data-cfasync="false"`, `data-pagespeed-no-defer` e `data-wpfc-render="false"`. Se una pagina resta vuota (il widget non compare), escludi ogni indirizzo che contiene `/embed/v1/` dalle opzioni che ritardano («delay JavaScript»), minimizzano, combinano o rimandano il JavaScript, in WP Rocket, LiteSpeed Cache, Autoptimize e SG Optimizer, poi svuota la cache delle pagine.

### Privacy

- Il server del tuo sito contatta il tuo indirizzo CasaZen solo dalla schermata delle impostazioni (quando salvi l'indirizzo e quando premi «Prova la connessione») e da eventi in background che rinnovano il risultato dopo 12 ore: `<indirizzo>/embed/v1/manifest.json`, `/api/public/resolve-host`, `/api/public/orgs/<slug>` (solo se hai scritto uno slug e l'indirizzo è il dominio di CasaZen) e `/api/public/orgs/<slug>/destinations`. Si invia solo il nome host del tuo indirizzo e lo slug, dentro l'indirizzo della richiesta, più il nome e la versione del plugin come user agent. Nessun cookie, nessun dato personale, nessun dato dei tuoi visitatori; l'apertura di una pagina da parte di un visitatore non avvia queste richieste.
- Con il sito collegato, il server del tuo sito chiama anche l'API di CasaZen, solo dalle schermate di amministrazione del plugin e alla disinstallazione: il manifesto della console (`<console>/embed/v1/manifest.json`), lo scambio del codice di collegamento (`/api/public/site-connections/token`: il codice, la verifica PKCE e l'indirizzo del sito) e, con la credenziale del sito nell'intestazione `Authorization`, l'account e il dominio dell'agenzia (`/api/site/v1/account`, `/api/site/v1/domain`, `/api/site/v1/domain/verify`, `/api/site/v1/domain/surfaces`) e lo scollegamento (`/api/site/v1/connection`). Sempre `https`, senza reindirizzamenti, con un limite di 10 secondi. La credenziale non compare mai in una pagina, in un indirizzo o in un registro.
- Il browser dei visitatori carica lo script e i frame dei widget dal tuo indirizzo CasaZen (`<indirizzo>/embed/v1/embed.js`), come qualsiasi contenuto incorporato. Le pagine dei widget non usano cookie né archivio del browser.
- Il plugin non imposta nessun cookie. Nel database tiene solo le sue impostazioni (un'opzione), il collegamento all'account (l'opzione `casazen_link`, con la credenziale del sito) e i risultati in memoria della prova di connessione, dei luoghi della barra di ricerca e dell'account dell'agenzia: nessun dato dei visitatori.

### Disinstallazione

Plugin → Elimina restituisce a CasaZen la credenziale del sito collegato (una richiesta; se CasaZen non risponde entro 10 secondi la disinstallazione prosegue comunque) e rimuove il collegamento (`casazen_link`), le impostazioni (`casazen_settings`), la nota della procedura guidata, i risultati in memoria e gli eventi pianificati del plugin. Le pagine create dalla procedura guidata e le loro voci di menu restano: sono contenuti tuoi.

### Risoluzione dei problemi

| Sintomo | Causa e rimedio |
|---|---|
| Nelle pagine non compare nulla e gli amministratori vedono «CasaZen: imposta l'indirizzo in Impostazioni → CasaZen» | L'indirizzo è vuoto. In Impostazioni → CasaZen premi «Connetti a CasaZen», oppure scrivilo in «Avanzate» e salva. |
| La prova dà `host_not_found` | CasaZen non conosce l'indirizzo o lo slug. Controlla come sono scritti; il dominio dell'agenzia deve essere verificato in CasaZen; sul dominio di CasaZen serve lo slug. |
| La prova dà `manifest_unreachable` | L'indirizzo non risponde. Controlla che sia giusto e `https`, che il sito sia online, il DNS e il certificato, e che l'hosting non blocchi le richieste in uscita. |
| Il widget è nascosto e gli amministratori vedono «CasaZen: l'incorporamento non è ancora attivo per questa agenzia.» | L'incorporamento non è attivo per l'agenzia: chiedi al referente CasaZen di attivarlo, poi premi «Prova la connessione». |
| Il frame mostra il collegamento «Prenota su prenota.example.com» (con il nome del tuo indirizzo CasaZen) | Il frame non si è caricato; il collegamento apre il sito di prenotazione nell'intera pagina, così l'ospite può comunque prenotare. Esegui la prova di connessione, controlla che l'incorporamento sia attivo e che nessun plugin di sicurezza o regola del sito blocchi i frame provenienti dal tuo indirizzo CasaZen. |
| La pagina è vuota e c'è un plugin di cache | Vedi «Plugin di cache e di ottimizzazione»: escludi gli indirizzi con `/embed/v1/`, poi svuota la cache. |
| La schermata dice «Non più collegato» | CasaZen non accetta più la credenziale del sito (il collegamento è stato rimosso dalla console). Premi «Connetti a CasaZen»: le impostazioni sono rimaste. |
| Dopo «Connetti a CasaZen» la schermata dice che l'indirizzo CasaZen non offre il collegamento | La versione di CasaZen non ha ancora il collegamento del plugin, oppure l'incorporamento non è attivo per la tua agenzia: usa la configurazione manuale («Avanzate») e chiedi al referente CasaZen. |
| «Connetti a CasaZen» dice che il sito non si può collegare | L'indirizzo del sito non inizia con `https://`, oppure l'amministrazione di WordPress è su un altro indirizzo: usa la configurazione manuale («Avanzate»). |
| Il dominio resta «In attesa dei record DNS» | Controlla i due record presso chi gestisce il DNS del dominio (nome e valore esattamente come nella schermata) e attendi la propagazione, poi premi «Controlla ora». |

## English

### What it does

CasaZen for WordPress connects your WordPress site to the booking site that your agency uses with CasaZen. It puts the booking engine, the search bar for your home page, the access of your guests to their booking and the link to the owner area on your own pages, with blocks or shortcodes, and it creates the pages and the menu entries for you. With one button («Connect to CasaZen») the site is connected to the account of the agency: the address fills in by itself and the domain is managed from the screen of the plugin. The PHP of the plugin is thin on purpose: the widgets live in a small script that CasaZen serves from your own address, so a change to the widgets never needs a plugin update. The payment never happens inside a frame: «Book» takes the whole page to the checkout of your CasaZen address.

### Requirements

- WordPress 6.4 or later and PHP 7.4 or later.
- The CasaZen account of your agency, with embedding switched on. Until it is, the plugin shows nothing to your visitors and tells the administrators of the site.
- To connect the site: being an administrator of the agency in CasaZen, and a site whose address starts with `https://` (`http` only for local development hosts) with the WordPress administration on the same address.
- To use a domain of your own (for example `prenota.example.com`): the Pro plan. Without it, the booking site answers on the CasaZen address.

### Installation

The plugin is not on WordPress.org yet: install the ZIP.

1. Download the ZIP from CasaZen: in the console, «Embed in your site», button «Download the plugin». A numbered version is also in the GitHub release tagged `wp-plugin-v<version>` of the frontend repository: <https://github.com/casazen/frontend/releases>.
2. In WordPress open Plugins → Add New → Upload Plugin, choose the ZIP, press Install Now and then Activate.
3. Open Settings → CasaZen and press «Connect to CasaZen» (see below).

The ZIP downloaded from the console of an environment connects to the console of that environment. For a test install with a ZIP that carries no address (for example one built from the repository), add the constant `define( 'CASAZEN_APP_ORIGIN', 'https://casazen-test-app.vercel.app' );` to `wp-config.php`: «Connect to CasaZen» opens that console. Without the constant and without an address in the ZIP, the production console is used, `https://www.casazen.space`.

### Connect the site to CasaZen

1. In Settings → CasaZen press «Connect to CasaZen». The CasaZen console opens (sign in if needed): check the address of the site that asks to be connected and confirm.
2. Back in WordPress the screen says «Connected to <agency>». The CasaZen address and the organisation slug are already filled in and the connection test has already run: the next step is the guided setup («Open the guided setup»).
3. The connection uses a credential of the site itself, made by the button and revocable. It is kept only in the WordPress database (the option `casazen_link`, not autoloaded and never shown in a page) and only the admin screens of the plugin use it. «Disconnect», on the same screen, gives it back to CasaZen; the CasaZen console also lists the connected sites and can disconnect them.

If CasaZen no longer accepts the site (for example it was disconnected from the console), the screen says «No longer connected» and offers «Connect to CasaZen» again: the settings stay. If the CasaZen address does not offer the connection (an older CasaZen, or embedding not switched on for your agency), the screen says so: use the manual set-up («Advanced»).

### Domain

With the site connected, the section «Domain» of the screen manages the address of your booking site:

1. Write the domain (for example `prenota.example.com`) and press «Connect domain».
2. The DNS records to create where the DNS of the domain is managed appear, with buttons to copy their name and value: the ownership TXT record, the CNAME record (for a domain without www, the A records instead) and, only when it is needed, a TXT record of the service provider. It is the only step outside WordPress.
3. The state («Waiting for the DNS records», «Activation in progress», «Your domain is active» or «The domain cannot be activated», with the reason and the last check) refreshes by itself while the screen is open, at most every 30 seconds and for at most 15 minutes; «Check now» checks it at once.
4. Once the domain is active the plugin uses its address by itself: the CasaZen address of the settings becomes the domain, the slug is cleared and the connection test runs again. «Remove domain» takes the booking site back to the CasaZen address, and the plugin follows.
5. Below, the three choices of what runs on the domain (guest area, owner portal, links in the e-mails, with «Save the choices») and the state of the owner sign-in.

A custom domain needs the Pro plan: without it, the section says so and links to the domain page of the console. Plan, billing and Google Tag Manager stay in the console.

### Manual set-up («Advanced»)

Without connecting the site you can write the address yourself: open Settings → CasaZen, section «Advanced: manual set-up». With the site connected the fields stay, but CasaZen fills in the address and the slug.

| Field | What to enter |
|---|---|
| CasaZen address | The address of your CasaZen booking site, for example `https://prenota.example.com`. Only the scheme, the host and the port are kept. `https` is required (`http` is accepted only for local development hosts); a user name or a password is refused. While it is empty the plugin does nothing. |
| Organisation slug | Needed only if the address above is the CasaZen domain and not a domain of your agency: the slug of your organisation (lower-case letters, numbers and hyphens). Otherwise leave it empty. |
| Language mapping | One line per language of your site, as `code = it`, `code = en` or `code = auto`. See «Polylang and WPML». |
| Script | The box «Load the CasaZen script on the pages that use it» (on by default): the plugin puts the script `<address>/embed/v1/embed.js` in the page once, and only on pages that have a widget. Untick it only if you load the script some other way. |

When you save a new address the plugin tests the connection at once. The button «Test connection» repeats it whenever you want. The box «Connection status» shows the result of the last test: Agency (the name of the agency that answers at that address), Embedding (On, Off or Unknown), Owner sign-in (Ready, Not ready yet or Unknown), Last check and the Script address. The result is kept for 12 hours (15 minutes when the test failed) and renews itself in the background, never when a visitor opens a page.

#### What the result of the test means

After the test the address of the page ends with `casazen_result=<code>`: the code says what happened.

| Code | What you read | What to do |
|---|---|---|
| `ok` | «The connection works.» | Nothing: you can add the widgets. |
| `embed_disabled` | «The connection works, but embedding is not switched on for your agency yet. Ask your CasaZen contact to switch it on.» | Ask your contact to switch it on, then press «Test connection» again. Until then the widgets stay hidden. |
| `not_configured` | «Set the CasaZen address to start.» | Write the address in the field «CasaZen address» and save. |
| `manifest_unreachable` | «The address could not be reached. Check that it is correct and that the site is online.» | Check that it is written correctly, that it is `https`, that the site is online and that the hosting does not block outgoing requests from the WordPress server. |
| `manifest_invalid` | «The address answered, but it is not a CasaZen address that supports embedding. Check the address.» | Check that you wrote the booking address of the agency and not, for example, the address of the WordPress site. |
| `resolve_unreachable` | «CasaZen did not answer the check as expected. Try again in a few minutes.» | Try again in a few minutes. |
| `host_not_found` | «CasaZen does not know this address or this organisation slug. Check how they are written.» | Check how they are written. If the address is a domain of your agency, the domain must be verified in CasaZen; if it is the CasaZen domain, fill in the slug. |

### Guided setup

Open Settings → CasaZen, tab «Guided setup». Run the connection test first: until it succeeds the tab asks for it.

1. Choose the pages to create: «Booking page» (the booking engine), «Guest access page» (the access of your guests) and «Owner area page» (the link to the owner area). The proposed titles are in the language of the site: «Book», «Online check-in» and «Owner area»; on an Italian site they are «Prenota», «Check-in online» and «Area proprietari». You can change any title or untick a page.
2. Leave the box «Publish the pages now» ticked if you want the pages published; without the tick they stay drafts.
3. Choose the menu to add the entries to, or «Do not add menu entries». The entries go at the end of the menu. If your theme is a block theme (Site Editor) menus cannot be changed from here: the setup lists the pages and you add them to the Navigation block yourself.
4. Press «Create the pages». The result lists each page with its link.

The setup is safe to run twice, and it overwrites nothing: a page that already has its role is not touched or made again; a page that has the same address but is not its own is never adopted (the new page takes the next free address); a menu entry is added only when the menu has no entry that points to that page; nothing is moved, renamed or deleted. With Polylang the pages are made in the default language and need translating (see «Polylang and WPML»).

Under the form the tab reminds you of the search bar of the home page: `[casazen_search]`.

### Shortcodes and blocks

Each widget has a shortcode and a block (the «Widgets» category of the editor) with the same attributes and the same result.

| Shortcode | Block | What it shows |
|---|---|---|
| `[casazen_booking]` | CasaZen booking | The booking engine: search, results and quote. «Book» takes the whole page to the checkout. |
| `[casazen_property slug="…"]` | CasaZen property | The page of one property, with its quote. |
| `[casazen_search target="/prenota/"]` | CasaZen search bar | The search bar for the hero of the home page (dates, guests, place): it opens the page `target` with the choice. |
| `[casazen_guest_access]` | CasaZen guest access | Where a guest opens their booking with the booking code and the last four digits of the phone (or the e-mail). |
| `[casazen_owner_login]` | CasaZen owner login | A link to the owner sign-in on your CasaZen address. |

Examples: `[casazen_booking]` · `[casazen_property slug="villa-rossa"]` · `[casazen_search target="/prenota/"]` · `[casazen_guest_access]` · `[casazen_owner_login]`.

The attributes (an invalid value is ignored and the default applies; an unknown attribute is ignored):

| Attribute | For | Values | Effect |
|---|---|---|---|
| `slug` | `casazen_property` | lower-case letters, numbers, hyphens | Required: the slug of the property in CasaZen. Without it the widget does not appear (administrators see a note). |
| `lang` | all but `casazen_owner_login` | `it`, `en`, `auto` | The language of the widget. Default: the language of the page (see «Polylang and WPML»). |
| `checkin`, `checkout` | `casazen_booking`, `casazen_property` | date `YYYY-MM-DD` | Dates the widget opens with. |
| `guests` | `casazen_booking`, `casazen_property` | 1 to 30 | Guests the widget opens with. |
| `target` | `casazen_search` | a path of your site starting with a single `/`, or an `https://` address | The page the bar opens. Default: the page «Book» of the guided setup (in the language of the page), else the home page. |
| `destinations` | `casazen_search` | `yes`, `no` | With `yes` (default) the field «Where» lists the places of your properties. |
| `max_guests` | `casazen_search` | 1 to 99 | The most guests the bar accepts. |
| `datalayer` | `casazen_booking`, `casazen_property`, `casazen_guest_access` | `true`, `false` | With `true` (default) the events of the widget go to the `dataLayer` of the page. |
| `sync_url` | `casazen_booking`, `casazen_property` | `true`, `false` | With `true` the state of the widget is reflected in the address of the page (`?cz=`). Default `false`. |
| `min_height` | `casazen_booking`, `casazen_property`, `casazen_guest_access` | 100 to 2000 (pixels) | The initial height of the frame, before the widget measures itself. |
| `primary` | all but `casazen_owner_login` | colour `#rgb` or `#rrggbb` | The main colour of the widget. |
| `radius` | all but `casazen_owner_login` | `8px` (0 to 32) or `1rem` (0 to 2) | The rounded corners. |
| `font` | all but `casazen_owner_login` | `editoriale`, `moderno`, `classico` | The font of the widget. |
| `label` | `casazen_owner_login` | text, up to 100 characters | The text of the link. Default: «Owner area» (in Italian «Area proprietari»). |

If the widget does not appear: with no address in the settings, administrators see the note «CasaZen: set the address in Settings → CasaZen» and visitors see nothing; if embedding is not switched on for the agency, an HTML comment stays in the place of the widget (and the note for administrators).

### Elementor

In the page, or in the home page for the search bar, add the Elementor **Shortcode** widget and paste the shortcode, for example `[casazen_search target="/prenota/"]`. In the Elementor editor and preview the widget shows a static placeholder: the real widget is visible on the published page.

### Polylang and WPML

The language of the widget follows the language of the page: if the page is in English the widget is in English. The plugin reads it from Polylang or WPML; with neither it uses the language of the site. The `lang` attribute of a shortcode, when there is one, wins.

The language mapping (Settings → CasaZen) says how the code of a language becomes `it`, `en` or `auto` (with `auto` the script reads the language of the page). One line per language, `code = value`; the code is the one that Polylang (the slug of the language) or WPML (the code of the language) gives the page, or a locale such as `it_IT`; case and `_` or `-` do not matter. A code with no line means `it` for Italian, `en` for English and `auto` for every other language. Example, for a site with three languages:

```
it = it
en = en
fr = auto
```

The three pages of the guided setup are made in the default language and are not translated: translate «Book», «Online check-in» and «Owner area» with Polylang or WPML. The search bar takes the guest to the translation of the page «Book» in the language of the page it is on. With WPML new pages take the default language by themselves.

### Cache and optimisation plugins

The script carries the attributes that cache and optimisation plugins read to leave it alone: `data-no-optimize`, `data-no-defer`, `data-no-minify`, `data-cfasync="false"`, `data-pagespeed-no-defer` and `data-wpfc-render="false"`. If a page stays empty (the widget does not appear), exclude every address that contains `/embed/v1/` from the options that delay («delay JavaScript»), minify, combine or defer JavaScript, in WP Rocket, LiteSpeed Cache, Autoptimize and SG Optimizer, then clear the page cache.

### Privacy

- The server of your site contacts your CasaZen address only from the settings screen (when you save the address and when you press «Test connection») and from background events that renew the result after 12 hours: `<address>/embed/v1/manifest.json`, `/api/public/resolve-host`, `/api/public/orgs/<slug>` (only if you wrote a slug and the address is the CasaZen domain) and `/api/public/orgs/<slug>/destinations`. Only the host name of your address and the slug are sent, inside the address of the request, plus the name and version of the plugin as the user agent. No cookie, no personal data, no data about your visitors; a visitor opening a page does not start these requests.
- With the site connected, the server of your site also calls the CasaZen API, only from the admin screens of the plugin and at the uninstall: the manifest of the console (`<console>/embed/v1/manifest.json`), the exchange of the connection code (`/api/public/site-connections/token`: the code, the PKCE verifier and the address of the site) and, with the credential of the site in the `Authorization` header, the account and the domain of the agency (`/api/site/v1/account`, `/api/site/v1/domain`, `/api/site/v1/domain/verify`, `/api/site/v1/domain/surfaces`) and the disconnection (`/api/site/v1/connection`). Always `https`, without redirects, within 10 seconds. The credential never appears in a page, an address or a log.
- The browser of your visitors loads the script and the frames of the widgets from your CasaZen address (`<address>/embed/v1/embed.js`), like any other embedded content. The pages of the widgets use no cookie and no browser storage.
- The plugin sets no cookie. In the database it keeps only its settings (one option), the connection to the account (the option `casazen_link`, with the credential of the site) and the cached results of the connection test, of the places of the search bar and of the account of the agency: no data about visitors.

### Uninstall

Plugins → Delete gives the credential of a connected site back to CasaZen (one request; if CasaZen does not answer within 10 seconds the uninstall goes on all the same) and removes the connection (`casazen_link`), the settings (`casazen_settings`), the note of the guided setup, the cached results and the scheduled events of the plugin. The pages made by the guided setup and their menu entries stay: they are your content.

### Troubleshooting

| Symptom | Cause and remedy |
|---|---|
| Nothing appears on the pages and administrators see «CasaZen: set the address in Settings → CasaZen» | The address is empty. In Settings → CasaZen press «Connect to CasaZen», or write it under «Advanced» and save. |
| The test gives `host_not_found` | CasaZen does not know the address or the slug. Check how they are written; the domain of the agency must be verified in CasaZen; on the CasaZen domain the slug is needed. |
| The test gives `manifest_unreachable` | The address does not answer. Check that it is right and `https`, that the site is online, the DNS and the certificate, and that the hosting does not block outgoing requests. |
| The widget is hidden and administrators see «CasaZen: embedding is not enabled for this agency yet.» | Embedding is not switched on for the agency: ask your CasaZen contact to switch it on, then press «Test connection». |
| The frame shows the link «Book on prenota.example.com» (with the name of your own CasaZen address) | The frame did not load; the link opens the booking site in the whole page, so the guest can still book. Run the connection test, check that embedding is on and that no security plugin or rule of the site blocks frames from your CasaZen address. |
| The page is empty and there is a cache plugin | See «Cache and optimisation plugins»: exclude the addresses with `/embed/v1/`, then clear the cache. |
| The screen says «No longer connected» | CasaZen no longer accepts the credential of the site (the connection was removed from the console). Press «Connect to CasaZen»: the settings stayed. |
| After «Connect to CasaZen» the screen says that the CasaZen address does not offer the connection | That CasaZen does not have the connection of the plugin yet, or embedding is not switched on for your agency: use the manual set-up («Advanced») and ask your CasaZen contact. |
| «Connect to CasaZen» says that the site cannot be connected | The address of the site does not start with `https://`, or the WordPress administration is on another address: use the manual set-up («Advanced»). |
| The domain stays «Waiting for the DNS records» | Check the two records where the DNS of the domain is managed (name and value exactly as on the screen) and wait for them to propagate, then press «Check now». |
