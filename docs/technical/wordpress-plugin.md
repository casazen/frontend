# Plugin WordPress

Il plugin **CasaZen per WordPress** sta nella cartella `integrations/wordpress/casazen/` di questo repository. Collega il sito WordPress di un’agenzia al suo sito di prenotazione CasaZen: blocchi e shortcode per il motore di prenotazione, la barra di ricerca, l’accesso degli ospiti e il collegamento all’area proprietari, una procedura guidata che crea le pagine e le voci di menu, compatibilità con Elementor, Polylang e WPML. Il PHP è sottile di proposito: i widget sono lo script `/embed/v1/embed.js` (e `search.js`) che CasaZen serve dall’indirizzo dell’agenzia, quindi un cambio dei widget non richiede un aggiornamento del plugin. Il pagamento non avviene mai in un frame.

La guida per chi installa il plugin (italiano e inglese) è il [README del plugin](../../integrations/wordpress/casazen/README.md). Questo documento è per chi lo mantiene e per chi lo collauda: struttura, comandi, CI, rilascio e checklist del pilota. Il contratto di incorporamento (messaggi `postMessage`, `embed.js`, manifesto) è nel codice di `src/embed/` e di `src/features/embed/`.

## Struttura

```
integrations/wordpress/casazen/
├── casazen.php            intestazione del plugin, costanti (CASAZEN_VERSION), caricatore delle classi
├── uninstall.php          disinstallazione pulita (opzioni, risultati in memoria, eventi; le pagine restano)
├── includes/              una classe per file (class-*.php); compat/ per Elementor e Polylang/WPML
├── blocks/src/            sorgenti dei blocchi (block.json + index.js); blocks/build/ si genera con npm run build
├── languages/             casazen.pot e casazen-it_IT.po; i .mo e i .json si compilano nel pacchetto
├── readme.txt, license.txt, README.md
├── tests/phpunit/         PHPUnit con la libreria di test di WordPress
├── tests/smoke/           prova su WordPress vero: smoke.sh e mu-plugins/casazen-mock-http.php
├── tests/start-wp-env.sh  avvia wp-env, con un nuovo tentativo se la rete fa fallire la costruzione delle immagini
├── tools/                 strumenti di sviluppo (non nello ZIP): sintassi PHP, versione, ZIP e le loro prove
└── .wp-env.json, phpcs.xml.dist, phpunit.xml.dist, composer.json, package.json, .distignore
```

**Traduzioni dei blocchi.** Il `.po` (e il `.pot`) cita come origine dei testi dell’editor gli script costruiti, `blocks/build/<blocco>/index.js`, non i sorgenti: WordPress cerca il file `languages/casazen-it_IT-<md5 del percorso dello script costruito>.json`, e `wp i18n make-json` dà ai file il nome dall’md5 del percorso che il `.po` cita. Se rigeneri il catalogo dai sorgenti (`blocks/src`) rimetti quei riferimenti, altrimenti i `.json` nello ZIP non vengono mai caricati e i testi dell’editor restano in inglese: `npm run test:tools` lo controlla.

Non c’è nessuna dipendenza Composer a runtime: Composer serve solo agli strumenti di sviluppo (`require-dev`). Il plugin deve funzionare su PHP 7.4 e 8.3 e su WordPress 6.4 e successivi.

## Comandi

Dalla cartella `integrations/wordpress/casazen/`:

| Comando | Cosa fa |
|---|---|
| `npm ci` | Installa gli strumenti Node: `@wordpress/scripts` (blocchi), `@wordpress/env`, `archiver`, `php-parser` |
| `npm run lint:php-syntax` | Controlla la sintassi di ogni `*.php` come PHP 7.4 con il parser Node `php-parser` (segnala anche la sintassi di PHP 8). Gira anche dove PHP non c’è |
| `npm run build` | Compila i blocchi: `blocks/src` → `blocks/build` (`wp-scripts`). `npm start` fa lo stesso in modalità watch |
| `npm run check:version` | Controlla che la versione sia una sola (vedi «Regola della versione»); `node tools/check-version.mjs --tag wp-plugin-v<versione>` controlla anche il tag |
| `npm run zip` | Crea `dist/casazen-<versione>.zip` e lo rilegge per controllarne il contenuto. Vuole i blocchi compilati (`npm run build`) e le traduzioni compilate; senza WP-CLI: `node tools/build-zip.mjs --allow-missing-translations` |
| `npm run test:tools` | Prove Node di `check-version.mjs` e `build-zip.mjs` (tag sbagliato, versioni diverse, contenuto dello ZIP) |
| `composer install`, `composer lint` | Strumenti PHP e controllo `phpcs` (standard WordPress e compatibilità con PHP 7.4+, `phpcs.xml.dist`); `composer lint` richiede PHP |
| `composer test` | PHPUnit. **Gira solo in CI** (vedi sotto): serve PHP, un database e la libreria di test di WordPress, che il workflow prepara con wp-env |

### Provare il plugin su WordPress Playground

Senza Docker e senza PHP, per vedere il plugin su un WordPress vero (PHP in WebAssembly, sperimentale in wp-env): dalla cartella del plugin, dopo `npm ci`,

```bash
npm exec --no -- wp-env start --runtime=playground
```

Il primo avvio scarica WordPress e dura circa due minuti. Il sito parte su `http://localhost:8888` (utente `admin`, password `password`, come ogni sito di wp-env), con l’ultimo WordPress; `WP_ENV_PHP_VERSION=7.4` o `8.3` sceglie la versione di PHP. Vale la configurazione di `.wp-env.json`, che nell’ambiente di sviluppo monta `tests/smoke/mu-plugins/`: il mock di rete risponde con l’agenzia di prova «Agenzia Esempio» all’indirizzo `https://prenota.example.com`, quindi per provare le impostazioni basta scrivere quell’indirizzo e non serve nessun indirizzo CasaZen vero. `wp-env run` non è disponibile con Playground. Si ferma con `npm exec --no -- wp-env stop`. È una prova a vista: non sostituisce la CI.

### Riprodurre la CI in locale (con Docker)

Gli stessi passi dei job `phpunit` e `smoke`, con `WP_ENV_PHP_VERSION` (7.4 o 8.3) e `WP_ENV_CORE` (`WordPress/WordPress#6.4`, oppure vuoto per l’ultimo WordPress). La versione di `@wordpress/env` è bloccata dal lock file; wp-env 12 stampa un avviso perché l’ambiente di test e l’opzione `env` sono deprecati: sono ancora supportati e servono qui (PHPUnit gira in un ambiente con un database suo, il mock di rete solo in quello di sviluppo):

```bash
composer install
npm ci && npm run build
npm exec --no -- wp-env start
npm exec --no -- wp-env run tests-cli --env-cwd=wp-content/plugins/casazen vendor/bin/phpunit
bash tests/smoke/smoke.sh
```

## CI: il workflow «WordPress plugin»

`.github/workflows/wordpress-plugin.yml` parte su `pull_request` e `push` (rami `main` e `develop`) **solo** se cambiano `integrations/wordpress/**`, `.github/workflows/wordpress-plugin*.yml` o `.github/actions/build-wordpress-plugin/**`, e a mano (`workflow_dispatch`). Ha `permissions: contents: read`, non usa segreti e non usa mai `pull_request_target`.

**Non è un controllo richiesto.** Ha un filtro sui percorsi: un controllo richiesto che non parte blocca la PR. Il controllo richiesto resta `CI / Lint, typecheck, unit tests, build` (`ci.yml`, senza filtro); `ci.yml` ed `e2e.yml` non sono stati toccati. Per questo ESLint (`globalIgnores`), Vitest (`exclude`), knip e `tsc` della webapp non guardano `integrations/`, e Vercel non porta nulla di `integrations/` nel bundle.

| Job | Cosa prova |
|---|---|
| `lint` (PHP 7.4 e 8.3) | `composer install` (con un secondo tentativo identico: i pacchetti vengono da api.github.com e un timeout è la rete; un errore vero fallisce entrambi); `php -l` su ogni file; il controllo di sintassi Node (`npm run lint:php-syntax`); le prove Node degli strumenti di pacchetto (`npm run test:tools`: tag sbagliato, versioni diverse, contenuto dello ZIP); `phpcs` con `phpcs.xml.dist` (WordPress, WPCS 3, e PHPCompatibilityWP `7.4-`, WordPress minimo 6.4, dominio di testo `casazen`, prefisso `casazen` e namespace `Casazen`) |
| `phpunit` (php 7.4 · wp 6.4, php 8.3 · wp latest) | Costruisce i blocchi, avvia wp-env (`tests/start-wp-env.sh`, fino a tre tentativi: la costruzione delle immagini scarica PHPUnit da api.github.com dentro Docker e un timeout lì è la rete del runner; `.wp-env.json`; versioni da `WP_ENV_PHP_VERSION` e `WP_ENV_CORE`) e lancia `vendor/bin/phpunit` nel contenitore `tests-cli`. In caso di errore carica i log |
| `smoke` (stesse due combinazioni) | `tests/smoke/smoke.sh` su un WordPress vero: prova prima che il log di debug scriva davvero (PHP scrive una riga di controllo e la prova la ritrova in `wp-content/debug.log`: un log vuoto non deve poter voler dire «non scrive nulla»), poi attiva il plugin senza avvisi PHP, salva le impostazioni, prova la connessione (nome dell’agenzia), crea una pagina con `[casazen_booking]`, `[casazen_search]` e `[casazen_owner_login]`, ne controlla gli elementi, UN solo tag `embed.js` con `defer` e il collegamento ai proprietari, entra come amministratore e verifica che `Impostazioni → CasaZen` risponda 200, controlla che `wp-content/debug.log` non abbia `PHP Warning`, `PHP Notice`, `PHP Deprecated`, `PHP Fatal` né `_doing_it_wrong`, poi esegue la disinstallazione e verifica che l’opzione sia sparita |
| `plugin-check` | Costruisce lo ZIP, lo scompatta e lancia `WordPress/plugin-check-action@v1` sulla cartella scompattata (gli errori falliscono, gli avvisi no; le chiamate al servizio CasaZen sono documentate nella sezione «External services» di `readme.txt`) |
| `package` | Dopo `lint`, `phpunit` e `smoke`: costruisce lo ZIP e lo carica come artefatto `casazen-wordpress-plugin` (14 giorni) |

Lo smoke non usa la rete: il mu-plugin `tests/smoke/mu-plugins/casazen-mock-http.php`, mappato nel sito da `.wp-env.json` (solo nell’ambiente di sviluppo, non in quello dei test PHPUnit), risponde con JSON fisso al manifesto, a `resolve-host` e ai luoghi della barra di ricerca, e rifiuta ogni altra richiesta; una richiesta del plugin che il mock non conosce finisce nel log e fa fallire la prova. Il mock dà a WordPress anche la risposta dei suoi tre controlli degli aggiornamenti (nucleo, plugin, temi: «controllato adesso, nessun aggiornamento»): senza, ogni pagina dell’amministrazione li chiederebbe a api.wordpress.org e WordPress stesso scriverebbe tre avvisi nel log che la prova legge; il controllo del log resta stretto come prima, e non esclude nulla. La disinstallazione dello smoke usa `wp plugin uninstall casazen --deactivate --skip-delete`, perché la cartella del plugin è la copia di lavoro montata nel contenitore e non deve essere cancellata.

Lo ZIP (job `package`, azione `.github/actions/build-wordpress-plugin`) si produce così: `node tools/check-version.mjs` (per prima cosa: con il tag di un rilascio si ferma subito se il tag non è la versione), `npm ci`, `npm run build`, `wp i18n make-mo languages` e `wp i18n make-json languages --no-purge`, `node tools/build-zip.mjs`. Ha **una sola** cartella in cima, `casazen/`, e contiene `casazen.php`, `uninstall.php`, `includes/`, `blocks/build/`, `languages/` (con i `.mo` e i `.json`), `readme.txt` e `license.txt`. Resta fuori quello che elenca `.distignore` (test, strumenti, `blocks/src`, `node_modules`, `vendor`, file di Composer e di npm, configurazioni, file nascosti, `dist`) e `build-zip.mjs` rifiuta uno ZIP che ne contenga anche uno solo.

## Rilascio

Il rilascio è un tag `wp-plugin-v<versione>` (un prefisso che non si confonde con i tag dell’applicazione). Il workflow `.github/workflows/wordpress-plugin-release.yml` parte solo sui tag `wp-plugin-v*`, costruisce lo ZIP con la stessa azione, **rifiuta un tag diverso dalla versione del plugin** e crea una release di GitHub (normale, non bozza) con `casazen-<versione>.zip` in allegato, con `gh release create --verify-tag --generate-notes`. È l’unico workflow con `contents: write` e non usa segreti; il checkout non conserva il token sul disco (`persist-credentials: false`), così `npm ci`, la build dei blocchi e le azioni di terzi non lo vedono: lo riceve solo l’ultimo passo, che crea la release. Non pubblica su WordPress.org (decisione dell’utente, a parte).

Per fare un rilascio:

1. Alza la versione in **tre** punti (vedi sotto), apri la PR e uniscila; controlla che il workflow «WordPress plugin» sia verde sul commit.
2. Dal commit unito: `git tag wp-plugin-v0.1.0 && git push origin wp-plugin-v0.1.0` (con la versione giusta al posto di `0.1.0`).
3. Il workflow «WordPress plugin release» crea la release; lo ZIP si scarica dalla pagina delle release del repository frontend. Se il workflow rifiuta il tag perché non coincide con la versione del plugin, la release non viene creata: correggi la versione o il tag e riprova.

### Regola della versione

La stessa stringa compare in: l’intestazione `Version:` di `casazen.php`, la costante `CASAZEN_VERSION` di `casazen.php`, lo `Stable tag:` di `readme.txt` e, nel rilascio, il tag `wp-plugin-v<versione>`. Il file ZIP è `casazen-<versione>.zip`. `tools/check-version.mjs` le confronta (`npm run check:version`) e `tools/build-zip.mjs` non costruisce se differiscono. La guida del plugin e il runbook del pilota citano questo formato del tag e la pagina delle release di questo repository.

## Checklist del pilota

Da seguire su un sito WordPress di prova con il plugin installato dallo ZIP della release, su un dominio dell’agenzia già verificato in CasaZen con le superfici accese (ambiente di test). Ogni riga è un controllo da spuntare, con quello che si deve vedere. / To follow on a test WordPress site with the plugin installed from the ZIP of the release, on an agency domain already verified in CasaZen with the surfaces switched on (test environment). Each line is a check to tick, with what you must see.

1. [ ] **Indirizzo e prova di connessione.** Scrivi l’indirizzo (per esempio `https://prenota.example.com`) in Impostazioni → CasaZen, salva e premi «Prova la connessione»: il riquadro «Stato della connessione» mostra il nome dell’agenzia e «Incorporamento: Attivo».
   *EN — Address and connection test.* Write the address (for example `https://prenota.example.com`) in Settings → CasaZen, save and press «Test connection»: the box «Connection status» shows the name of the agency and «Embedding: On».
2. [ ] **Pagine create.** Scheda «Procedura guidata», con «Pubblica subito le pagine» spuntata, premi «Crea le pagine»: il risultato elenca «Prenota», «Check-in online» e «Area proprietari». Aprile una per una: «Prenota» mostra il motore di prenotazione, «Check-in online» il modulo di accesso alla prenotazione, «Area proprietari» il collegamento all’area proprietari.
   *EN — Pages created.* In the tab «Guided setup», with «Publish the pages now» ticked, press «Create the pages»: the result lists «Book», «Online check-in» and «Owner area» (the titles follow the language of the site). Open each one: «Book» shows the booking engine, «Online check-in» the form to open a booking, «Owner area» the link to the owner area.
3. [ ] **Menu e seconda esecuzione.** Scelto un menu, le tre voci sono in fondo al menu e quelle che c’erano non sono cambiate. Premi di nuovo «Crea le pagine»: ogni pagina dice «La pagina esiste già e non è stata modificata» e «Già presente nel menu», e non compare nessuna pagina né voce doppia.
   *EN — Menu and second run.* With a menu chosen, the three entries are at the end of the menu and the ones that were there did not change. Press «Create the pages» again: each page says «The page already exists and was not changed» and «Already in the menu», and no page or entry is duplicated.
4. [ ] **Barra di ricerca della home.** Nella home, con il widget Shortcode di Elementor, metti `[casazen_search target="/prenota/"]` (la pagina «Prenota»). Scegli date e ospiti e premi «Verifica disponibilità»: si apre «Prenota» con le date e gli ospiti già nel widget.
   *EN — Hero search bar.* In the home page, with the Elementor Shortcode widget, put `[casazen_search target="/prenota/"]` (the page «Book»). Pick dates and guests and press «Check availability»: «Book» opens with the dates and the guests already in the widget.
5. [ ] **Prenotazione fino al checkout.** Nel widget di «Prenota» scegli un alloggio e premi «Prenota»: si sposta l’INTERA pagina (non il frame) sul checkout del dominio dell’agenzia, con `checkin`, `checkout`, `guests` e `utm_medium=embed` nell’indirizzo. Sull’ambiente di test la carta di prova di Stripe `4242 4242 4242 4242` (scadenza futura, CVC qualsiasi) completa un pagamento di prova. Solo in test, mai in produzione.
   *EN — Booking up to the checkout.* In the widget of «Book» choose a home and press «Book»: the WHOLE page (not the frame) moves to the checkout of the agency domain, with `checkin`, `checkout`, `guests` and `utm_medium=embed` in the address. On the test environment the Stripe test card `4242 4242 4242 4242` (future expiry date, any CVC) completes a test payment. Test only, never on production.
6. [ ] **Accesso ospite.** In «Check-in online» scrivi il codice di una prenotazione e le ultime quattro cifre del telefono (oppure l’e-mail): arrivi all’area ospite sul dominio dell’agenzia.
   *EN — Guest access.* In «Online check-in» enter the code of a booking and the last four digits of the phone (or the e-mail): you reach the guest area on the agency domain.
7. [ ] **Accesso proprietario.** In «Area proprietari» premi il collegamento: l’accesso è sul dominio dell’agenzia; dopo l’accesso torni su `/portale-proprietari` e, dopo l’uscita, sul dominio dell’agenzia.
   *EN — Owner access.* In «Owner area» press the link: the sign-in is on the agency domain; after signing in you are back on `/portale-proprietari` and, after signing out, on the agency domain.
8. [ ] **Lingua.** Con Polylang o WPML passa la pagina all’inglese: i widget sono in inglese.
   *EN — Language.* With Polylang or WPML switch the page to English: the widgets are in English.
9. [ ] **Eventi.** Con la pagina aperta, nella console del browser `dataLayer` mostra `view_item_list`, `view_item` e `begin_checkout` man mano che scegli.
   *EN — Events.* With the page open, `dataLayer` in the browser console shows `view_item_list`, `view_item` and `begin_checkout` as you go.
10. [ ] **Cache.** Svuota la cache del plugin di cache e ricarica la pagina: i widget compaiono ancora.
    *EN — Cache.* Purge the cache of the cache plugin and reload the page: the widgets still appear.
11. [ ] **Disinstallazione (su una copia di staging).** Plugin → Elimina: le tre pagine e le voci di menu restano; reinstallando il plugin, Impostazioni → CasaZen ha l’indirizzo vuoto, perché le impostazioni sono state rimosse.
    *EN — Uninstall (on a staging copy).* Plugins → Delete: the three pages and the menu entries stay; after reinstalling the plugin, Settings → CasaZen has an empty address, because the settings were removed.
