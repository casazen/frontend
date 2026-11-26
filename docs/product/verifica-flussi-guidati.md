# Primo accesso, prenotazione e incassi in browser

Il confronto usa la baseline `74959b34` e gli stessi casi sintetici nelle due versioni. L’accesso di ritorno ora spiega dove porterà il pulsante. Nell’invito il destinatario può leggere agenzia, ruolo, area, indirizzo mascherato e scadenza prima di scegliere l’account. A 320 px serve scorrere per vedere entrambe le opzioni di accesso.

## Dalla lettura all’azione

| Persona e compito | Cosa verificare nel confronto | Interazione riprodotta |
| --- | --- | --- |
| Visitatore invitato | L’invito distingue accesso e adesione. Il ritorno dalla pagina di autenticazione ha un titolo e un pulsante esplicito. | Apertura automatica del provider, ritorno, nuovo tentativo con Invio. Dopo un errore 503, il pulsante Riprova ricarica l’invito. Il comando per creare un account passa al provider con il suggerimento di registrazione. |
| Collaboratore già autenticato | L'indirizzo invitato identifica l’account richiesto. | Con un account diverso compare il cambio account prima dei consensi. Nessuna richiesta di adesione viene emessa. [Verifiche di adesione](../../e2e/team-invite-acceptance.spec.ts) |
| Agenzia al primo avvio | L’intestazione nomina il passo corrente e anticipa scelta del piano e conferme. | Su telefono la bozza permette di riprendere la configurazione dopo una ricarica. I consensi richiedono una scelta esplicita. [Verifica del primo avvio](../../e2e/commercial-signup.spec.ts) |
| Prospect che valuta il prodotto | Nel campione Affitti brevi, ospite, immobile, stato del check-in, numero di persone e notti sono già visibili. Aprire il riepilogo aggiunge date e passo operativo. Nell’esempio Affitti lunghi si leggono canone e rate scadute. | Apertura da tastiera del dettaglio pubblico e controllo del link per richiedere l’invito. |
| Host che prepara un arrivo | La scheda evidenzia i dati del soggiorno e raccoglie i riferimenti secondari in un dettaglio espandibile. | Attivazione da tastiera del dettaglio, apertura del check-in, distinzione tra blocco e avviso. Correggi porta il focus al numero del documento. Salva ed esci riporta ai Documenti della stessa prenotazione. |
| Ospite che riceve il link dall’host | I quattro stati distinguono ingresso, ripresa dei dati, errore temporaneo e ricevuta. | Il link emesso dallo staff apre lo stesso soggiorno in una nuova sessione. Una ricevuta già disponibile riapre la conferma. [Verifiche del check-in](../../e2e/guest-checkin-portal.spec.ts) |
| Host che richiede la pulizia | La richiesta richiama immobile e soggiorno e identifica il servizio. | Riprendendo la richiesta si rivaluta la disponibilità prima della conferma. Il browser invia una sola richiesta collegata alla prenotazione. [Verifica housekeeping](../../e2e/marketplace-suppliers.spec.ts) |
| Host che configura l’AI | Impostazioni AI offre accesso diretto alla libreria e un esempio leggibile dal trigger «Al check-out» all’azione «Richiedi la pulizia dell’immobile». | Con il modulo abilitato il percorso permette di scegliere un modello, salvarlo in pausa e simulare una prenotazione autorizzata. [Verifica delle routine](../../e2e/routines-workflow.spec.ts) |
| Locatore che verifica un insoluto | Il riepilogo dei canoni mostra importo, data e stato della rata da controllare. | Il collegamento dal riepilogo dei 900 euro sposta il focus sulla rata scaduta. Provato a 320, 768 e 1440 px con due rate per lo stesso contratto. |
| Collaboratore che cerca Ospiti | Su telefono Altro offre la ricerca delle destinazioni. La guida presenta argomenti selezionabili. | Ricerca senza risultati, azzeramento con ripristino del focus, ricerca Ospiti e apertura con Invio fino al titolo della pagina. |

## Schermate affiancabili

Ogni collegamento apre il JPEG alla risoluzione di acquisizione. Il menu mobile è già aperto. Sui dispositivi più larghi compare la barra laterale nel suo stato iniziale. La vetrina mostra lo stesso esempio aperto all’ancora demo. Nel primo viewport a 320 px la prenotazione dà priorità a «Cosa succede ora». Le due righe dedicate ai dati mostrano il risultato dopo lo stesso scorrimento verso il pannello a 390 px. Le altre immagini mostrano l’ingresso nella pagina.

| Schermata | 320 × 568 | 390 × 844 | 768 × 1024 | 1440 × 900 |
| --- | --- | --- | --- | --- |
| Accesso di ritorno | [Prima](evidenze-flussi-guidati/prima-accesso-320.jpg) · [Dopo](evidenze-flussi-guidati/dopo-accesso-320.jpg) | [Prima](evidenze-flussi-guidati/prima-accesso-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-accesso-390.jpg) | [Prima](evidenze-flussi-guidati/prima-accesso-768.jpg) · [Dopo](evidenze-flussi-guidati/dopo-accesso-768.jpg) | [Prima](evidenze-flussi-guidati/prima-accesso-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-accesso-1440.jpg) |
| Invito organizzazione, senza sessione | [Prima](evidenze-flussi-guidati/prima-invito-320.jpg) · [Dopo](evidenze-flussi-guidati/dopo-invito-320.jpg) | [Prima](evidenze-flussi-guidati/prima-invito-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-invito-390.jpg) | [Prima](evidenze-flussi-guidati/prima-invito-768.jpg) · [Dopo](evidenze-flussi-guidati/dopo-invito-768.jpg) | [Prima](evidenze-flussi-guidati/prima-invito-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-invito-1440.jpg) |
| Scelta del profilo | [Prima](evidenze-flussi-guidati/prima-benvenuto-320.jpg) · [Dopo](evidenze-flussi-guidati/dopo-benvenuto-320.jpg) | [Prima](evidenze-flussi-guidati/prima-benvenuto-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-benvenuto-390.jpg) | [Prima](evidenze-flussi-guidati/prima-benvenuto-768.jpg) · [Dopo](evidenze-flussi-guidati/dopo-benvenuto-768.jpg) | [Prima](evidenze-flussi-guidati/prima-benvenuto-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-benvenuto-1440.jpg) |
| Esempio pubblico di soggiorno aperto | [Prima](evidenze-flussi-guidati/prima-demo-320.jpg) · [Dopo](evidenze-flussi-guidati/dopo-demo-320.jpg) | [Prima](evidenze-flussi-guidati/prima-demo-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-demo-390.jpg) | [Prima](evidenze-flussi-guidati/prima-demo-768.jpg) · [Dopo](evidenze-flussi-guidati/dopo-demo-768.jpg) | [Prima](evidenze-flussi-guidati/prima-demo-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-demo-1440.jpg) |
| Prenotazione, scheda Soggiorno | [Prima](evidenze-flussi-guidati/prima-soggiorno-320.jpg) · [Dopo](evidenze-flussi-guidati/dopo-soggiorno-320.jpg) | [Prima](evidenze-flussi-guidati/prima-soggiorno-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-soggiorno-390.jpg) | [Prima](evidenze-flussi-guidati/prima-soggiorno-768.jpg) · [Dopo](evidenze-flussi-guidati/dopo-soggiorno-768.jpg) | [Prima](evidenze-flussi-guidati/prima-soggiorno-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-soggiorno-1440.jpg) |
| Contratto, scheda Pagamenti | [Prima](evidenze-flussi-guidati/prima-canoni-320.jpg) · [Dopo](evidenze-flussi-guidati/dopo-canoni-320.jpg) | [Prima](evidenze-flussi-guidati/prima-canoni-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-canoni-390.jpg) | [Prima](evidenze-flussi-guidati/prima-canoni-768.jpg) · [Dopo](evidenze-flussi-guidati/dopo-canoni-768.jpg) | [Prima](evidenze-flussi-guidati/prima-canoni-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-canoni-1440.jpg) |
| Menu Altro o barra laterale | [Prima](evidenze-flussi-guidati/prima-navigazione-320.jpg) · [Dopo](evidenze-flussi-guidati/dopo-navigazione-320.jpg) | [Prima](evidenze-flussi-guidati/prima-navigazione-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-navigazione-390.jpg) | [Prima](evidenze-flussi-guidati/prima-navigazione-768.jpg) · [Dopo](evidenze-flussi-guidati/dopo-navigazione-768.jpg) | [Prima](evidenze-flussi-guidati/prima-navigazione-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-navigazione-1440.jpg) |
| Guida CasaZen | [Prima](evidenze-flussi-guidati/prima-guida-320.jpg) · [Dopo](evidenze-flussi-guidati/dopo-guida-320.jpg) | [Prima](evidenze-flussi-guidati/prima-guida-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-guida-390.jpg) | [Prima](evidenze-flussi-guidati/prima-guida-768.jpg) · [Dopo](evidenze-flussi-guidati/dopo-guida-768.jpg) | [Prima](evidenze-flussi-guidati/prima-guida-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-guida-1440.jpg) |
| Dati del soggiorno, dopo scorrimento al titolo | — | [Prima](evidenze-flussi-guidati/prima-dati-soggiorno-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-dati-soggiorno-390.jpg) | — | — |
| Dettaglio canoni, dopo scorrimento al pannello | — | [Prima](evidenze-flussi-guidati/prima-dati-canoni-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-dati-canoni-390.jpg) | — | — |
| Richiesta pulizia dal soggiorno | — | [Prima](evidenze-flussi-guidati/prima-pulizia-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-pulizia-390.jpg) | — | — |
| Impostazioni AI | — | [Prima](evidenze-flussi-guidati/prima-impostazioni-ai-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-impostazioni-ai-390.jpg) | — | [Prima](evidenze-flussi-guidati/prima-impostazioni-ai-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-impostazioni-ai-1440.jpg) |
| Esempio pubblico di contratto | [Dopo](evidenze-flussi-guidati/dopo-demo-lungo-320.jpg) | [Dopo](evidenze-flussi-guidati/dopo-demo-lungo-390.jpg) | [Dopo](evidenze-flussi-guidati/dopo-demo-lungo-768.jpg) | [Dopo](evidenze-flussi-guidati/dopo-demo-lungo-1440.jpg) |
| Tariffe della scheda immobile | [Dopo](evidenze-flussi-guidati/dopo-immobile-tariffe-320.jpg) | [Dopo](evidenze-flussi-guidati/dopo-immobile-tariffe-390.jpg) | [Dopo](evidenze-flussi-guidati/dopo-immobile-tariffe-768.jpg) | [Dopo](evidenze-flussi-guidati/dopo-immobile-tariffe-1440.jpg) |
| Routine AI | — | [Prima](evidenze-flussi-guidati/prima-routine-ai-390.jpg) · [Dopo](evidenze-flussi-guidati/dopo-routine-ai-390.jpg) | — | [Prima](evidenze-flussi-guidati/prima-routine-ai-1440.jpg) · [Dopo](evidenze-flussi-guidati/dopo-routine-ai-1440.jpg) |

Stati del check-in pubblico su telefono, 390 × 844.

- Errore · [Dopo](evidenze-flussi-guidati/dopo-ospite-errore-390.jpg)
- Ingresso · [Dopo](evidenze-flussi-guidati/dopo-ospite-ingresso-390.jpg)
- Ricevuta · [Dopo](evidenze-flussi-guidati/dopo-ospite-ricevuta-390.jpg)
- Ripresa · [Dopo](evidenze-flussi-guidati/dopo-ospite-ripresa-390.jpg)

## Il benvenuto operativo di Affitti brevi

Da **Inizia con CasaZen** si apre **Configura gli affitti brevi**. Con un amministratore e un’organizzazione senza preferenze per gli immobili italiani, la prima decisione è chi invia i dati degli ospiti. La scelta porta a un riepilogo. Il piano indica quindi il prossimo compito disponibile. La Home offre **Riprendi** per il passo messo in pausa su questo dispositivo. Il riferimento scade dopo 24 ore e il frontend ricontrolla stato e permessi prima di proporlo.

La fixture di confronto ha entrambe le opzioni inizialmente vuote, collegamento Octorate assente e zero attività completate su otto disponibili. Con la disposizione precedente si contavano dieci comandi delle attività successive, compresi quelli disabilitati. Nella nuova pagina il piano completo si apre su richiesta. Le catture Chromium comprendono 320 × 568, 390 × 844, 768 × 1024 e desktop a 1440 px. Il comando seguente produce i JPEG e i risultati di axe insieme alle prove di conferma e ripresa.

```sh
npm run test:e2e -- --project=chromium e2e/onboarding-plan-screen.spec.ts
```

[Prove del piano e della ripresa](../../e2e/onboarding-plan-screen.spec.ts) · [Fixture del primo accesso](../../e2e/helpers/onboarding-plan-screen.ts)

## Accessibilità e condizioni di verifica

Chromium 154 su Linux, Playwright 1.60.0 e axe-core 4.13.0. Lingua italiana, zoom al 100%, movimento ridotto e larghezze in pixel CSS. Le scansioni di questa matrice riguardano l’intero documento e le regole axe con tag WCAG 2.0 A/AA, 2.1 A/AA e 2.2 AA. Il conteggio somma gli elementi segnalati alle larghezze indicate. Lo scorrimento indica la massima differenza tra larghezza del documento e del viewport.

| Schermate scansionate | Elementi segnalati prima → dopo | Scorrimento orizzontale massimo prima → dopo |
| --- | ---: | ---: |
| Accesso di ritorno | 0 → 0 | 0 → 0 px |
| Invito organizzazione, senza sessione | 0 → 0 | 0 → 0 px |
| Scelta del profilo | 0 → 0 | 0 → 0 px |
| Esempio pubblico di soggiorno aperto | 0 → 0 | 0 → 0 px |
| Prenotazione, scheda Soggiorno | 0 → 0 | 0 → 0 px |
| Contratto, scheda Pagamenti | 0 → 0 | 0 → 0 px |
| Menu Altro o barra laterale | 0 → 0 | 0 → 0 px |
| Guida CasaZen | 0 → 0 | 0 → 0 px |
| Impostazioni AI | 0 → 0 | 0 → 0 px |
| Dati soggiorno dopo scorrimento | 1 → 0 | 0 → 0 px |
| Dati canoni dopo scorrimento | 0 → 0 | 0 → 0 px |

Dopo lo scorrimento fino al titolo del soggiorno, nella baseline axe segnalava che l’intestazione copriva parzialmente il pulsante del check-in. Ripetendo lo stesso gesto nella versione aggiornata, il controllo ha superato la scansione. Per i quattro stati del check-in ospite a 390 px il contenuto principale ha superato la scansione WCAG 2.1 A/AA e il documento è rimasto entro la larghezza disponibile. Per la vetrina Affitti lunghi è disponibile anche una scansione WCAG 2.1 A/AA della sezione demo desktop e una verifica della larghezza a tutte e quattro le risoluzioni. Le immagini della pulizia documentano lo stesso immobile, soggiorno e fornitore.

Il primo accesso usa l’SDK di autenticazione dell’app collegato a un provider sintetico intercettato nel browser. Le altre richieste applicative usano fixture HTTP. Consegna e-mail, identità reali, operazioni bancarie, uso sul campo e conversioni commerciali richiedono evidenze distinte. Le immagini documentano la disposizione e i dati resi dal browser.

## Riproduzione

Con le dipendenze del repository e Chromium installati, eseguire dalla radice del frontend. Il caso di accesso anonimo prepara un server locale con autenticazione attiva e lo chiude alla fine.

```sh
npm run test:e2e -- --project=chromium e2e/guided-workflows-ux.spec.ts
```

[Regressioni in Playwright](../../e2e/guided-workflows-ux.spec.ts) · [Verifica dei ruoli e degli inviti](revisione-flussi-guidati.md)
