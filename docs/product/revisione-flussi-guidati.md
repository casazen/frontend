# Primo ingresso, inviti e flussi operativi

Un amministratore che invita una persona deve sapere se può invitarla, se l’invito esiste e se l’email è partita. Chi riceve il link deve riconoscere l’agenzia, entrare con l’account giusto e raggiungere la propria area. Le prove seguono questi due percorsi separatamente e includono un errore recuperabile, un requisito mancante e un’interruzione della scheda.

## Invito di un collaboratore

Confronto con il frontend `74959b34`. Nel browser è montato il menu reale di Amministrazione con il permesso `org.members.manage`, le pagine Persone e Invita, il router e le risposte sintetiche delle API. Il menu evidenzia Persone anche dentro l’invito. La fixture fornisce esplicitamente il contesto dell’agenzia perché i profili predefiniti della demo rappresentano altri ruoli. [Percorso riproducibile](../../e2e/team-invite-recovery.spec.ts)

| Punto del percorso | Prima | Comportamento della revisione |
| --- | --- | --- |
| Menu → Persone → Invita, agenzia senza aree attive | Il pulsante **Riprova** rileggeva gli stessi dati e ripresentava il medesimo avviso. Riprodotto in Chromium con l’owner attivo e `areas: []`. | L’avviso spiega che serve un’area attiva. **Torna a Persone** riapre l’elenco senza una nuova richiesta di invito. |
| Invita, errore nel caricamento del team | Un errore di lettura appariva come assenza di aree. | Un messaggio dedicato offre **Riprova** e **Torna a Persone**. Portando la risposta da 503 a 200, il primo passo si apre nella stessa pagina. |
| Invita da un indirizzo salvato, account privato | Compariva un messaggio sul requisito agenzia. Per uscire occorreva usare la navigazione generale. | Il messaggio contiene il ritorno a Persone. La lista del privato nasconde l’azione Invita. |
| Identità compilata → Ruolo | Una matrice valida senza ruoli assegnabili e un errore di lettura proponevano entrambi un nuovo tentativo. Con la matrice illeggibile il ruolo preselezionato poteva superare la validazione locale. | A matrice vuota si legge chi può inviare l’invito, con ritorno a Persone. Su 503 resta **Riprova**, i dati inseriti restano nel wizard e la scelta si sblocca dopo la lettura dei permessi. |

Nel percorso completo, la scelta del ruolo porta ad aree e immobili, quindi al riepilogo. Solo la conferma invia la richiesta. La prova restituisce un invito in attesa con `emailQueued: false` e verifica l’avviso sulla consegna, l’azione per copiare il link e la presenza della persona nell’elenco degli invitati. Con email accodata la conferma descrive la coda di invio. Riaprire il passo finale senza la risposta del server mostra **Verifica lo stato dell’invito** e rimanda a Persone per consultare gli inviti e i membri. La baseline mostrava qui «Invito inviato». La generazione di un nuovo link e la consegna di posta restano fuori da questa prova. [Wizard e test delle risposte del server](../../e2e/team-invite-recovery.spec.ts)

## Ricezione, accesso e benvenuto

| Partenza | Catena osservata | Esito e confine della prova |
| --- | --- | --- |
| Invito organizzazione valido, account corrispondente | Aprire il link → riepilogo con indirizzo mascherato → ricaricare la scheda → accettare le quattro dichiarazioni → risposta positiva della fixture | Una richiesta di accettazione, token eliminato dalla scheda dopo la conferma, apertura di Affitti brevi per il profilo di prova. |
| L’API rifiuta comunque l’identità | Sessione apparentemente compatibile → invio con consensi → risposta `invitation_email_mismatch` → cambia account | Il server mantiene l’ultima parola. La pagina toglie i consensi dopo il rifiuto e offre il cambio account. |
| Link malformato | Aprire il link → messaggio di link inutilizzabile → uscita | Nessuna richiesta di lookup e nessun consenso. A 320 px un invito valido permette invece di raggiungere tutti i consensi e il comando finale. |
| Primo accesso e ritorno di chi ha già completato | Profilo demo senza ruoli → onboarding. Profilo incompleto → scelta profilo. Profilo già completo → area di lavoro. | Tre percorsi distinti eseguiti sulla baseline. Nella revisione il benvenuto dell’amministratore apre il primo compito autorizzato dalla Home. |
| Ritorno dal provider | Test di componente con SDK sostituito → destinazione interna conservata, avvio singolo, ritorno rapido con possibilità di riprovare | Contratto del frontend. Credenziali reali, MFA, configurazione del tenant e consegna delle email richiedono una prova con un’utenza dedicata. |

Le prove dell’invito usano una sola scheda. La copertura comprende la ricarica della pagina e il corpo della richiesta di accettazione. Il percorso associato a un’identità reale con più organizzazioni richiede verifica in test con ruoli effettivamente assegnati. [Ricezione e consenso](../../e2e/team-invite-acceptance.spec.ts) · [Layout invito](../../e2e/organization-invite-layout.spec.ts) · [Instradamento e primo compito](../../e2e/onboarding.spec.ts) · [Ritorno da login](../../src/pages/__tests__/login-page.test.tsx) · [Confronto visivo del primo accesso](verifica-flussi-guidati.md)

## Flussi secondari osservati in Chromium

Le prove sulla baseline hanno usato record sintetici e risposte controllate. Le azioni di seguito indicano il punto raggiunto, così una pagina aperta direttamente non conta come reperibile dal menu.

| Area | Ingresso → compito | Esito, ripresa e copertura |
| --- | --- | --- |
| Staff CasaZen | Pagina inviti agenzia → email → crea | La risposta 201 mostra il link personale e il QR. Coperta la creazione dalla pagina, non la scansione del QR, la consegna o la costituzione dell’agenzia. [Test](../../e2e/admin-supplier-invite.spec.ts) |
| Staff CasaZen | Gestione organizzazione → piano Pro → conferma | Il browser emette la PATCH con il piano scelto. Il test usa un’organizzazione sintetica e non addebita un abbonamento. [Test](../../e2e/plan-management.spec.ts) |
| Fornitore | Servizi e prezzi → nuovo servizio → quattro passi → pubblica → pausa | Provati il ciclo del servizio e due recuperi. Dall’elenco si riapre la bozza con quanto salvato. Se un altro operatore ha cambiato la versione, viene offerta la rilettura senza sovrascrivere la modifica. [Test](../../e2e/supplier-services.spec.ts) |
| Fornitore e menu mobile | Disponibilità → Pagine collegate → Calendario iCal. Su telefono, barra → Altro → voci residue | Nel calendario resta evidenziato Disponibilità. La prova del menu mobile è nel contesto Affitti brevi. Nessuna sincronizzazione iCal esterna fa parte del percorso. [Test](../../e2e/area-navigation.spec.ts) |
| Proprietario | Calendario da telefono → richiedi un soggiorno → rileggi stato. Calendario e rendiconto aperti separatamente | Lo stato identifica la richiesta e il mancato allineamento. Il calendario rende «Occupato» e protegge i dati ospite. Il rendiconto della fixture visualizza CHF. La verifica contabile copre la lettura, non la liquidazione. [Test](../../e2e/owner-portal-responsive.spec.ts) |
| Conduttore | Pagamenti → scadenza già coperta. Errore di apertura → Riprova → Pagamenti | A residuo zero i comandi SEPA e bonifico sono assenti. La risposta ripristinata riapre la pagina. Nessun movimento bancario è stato disposto. [Test](../../e2e/tenant-canoni.spec.ts) |
| Ospite | Link check-in → correggi il nome letto → consenso → documento e selfie sintetici → invia | Asserita la sequenza delle richieste e la correzione nel flusso. OCR, dispositivo fotografico e verifica d’identità reali richiedono una sessione di integrazione. [Test](../../e2e/guest-checkin-portal.spec.ts) |

Nella revisione è stato verificato anche il passaggio dall’host al servizio di pulizia. Da **Soggiorno**, un collaboratore con permesso di richiesta può scegliere fornitore e disponibilità e inviare dal riepilogo. Dopo una ricarica si verificano di nuovo fornitore e slot. La risposta simulata porta alla ricevuta, alla prenotazione o allo stato dell’intervento. Il percorso lato host si chiude alla lettura dello stato. L’accettazione dal diverso account del fornitore e la reale esecuzione del servizio sono passaggi successivi. [Test del compito lato host](../../e2e/marketplace-suppliers.spec.ts)

## Simulare una routine di housekeeping

Il catalogo backend `2026-11-18.2` aggiunge **Controllo biancheria dopo soggiorni di almeno 4 notti (TEST)**. La routine è disattivata e in modalità test. Dopo il caricamento del nuovo catalogo nell’organizzazione demo, aprire **Routine**, selezionare la routine e simulare con la prenotazione sintetica di Villa Lago di quattro notti. La condizione è soddisfatta. Se il provider AI seleziona l’azione, l’anteprima mostra il controllo biancheria. Il risultato può riportare il servizio AI indisponibile. Ripetere con l’arrivo dimostrativo di due notti: la condizione esclude l’attività. Per entrambe le prove la routine può restare spenta.

Il test del backend usa un database in memoria, la conversione del catalogo usata dal seed e il motore di simulazione con un provider sintetico che seleziona le azioni configurate. Verifica entrambi gli esiti e l’assenza di attività, esecuzioni o job creati. La prova browser del simulatore usa risposte HTTP controllate. [Simulatore](../../src/components/routines/RoutineSimulation.tsx)

## Riproduzione e priorità residue

Con dipendenze installate e Chromium disponibile, il progetto Playwright `chromium` avvia il frontend in modalità demo. I test dei collaboratori installano le fixture HTTP e il contesto dell’organizzazione. Per riprodurre la vecchia ripetizione aprire la baseline, usare la stessa fixture con `areas: []` e contare le GET del team prima e dopo **Riprova**. [Configurazione](../../playwright.config.ts)

```sh
npm run test:e2e -- --project=chromium e2e/team-invite-recovery.spec.ts e2e/team-invite-acceptance.spec.ts
npm run test:e2e -- --project=chromium e2e/organization-invite-layout.spec.ts e2e/onboarding.spec.ts
```

1. **Alta — primo accesso reale.** Con due indirizzi di test, aprire un invito per il secondo mentre il primo ha una sessione aperta. Verificare il ritorno all’invito, l’adesione alla sola agenzia attesa e il primo compito consentito. Servono tenant di identità e casella email di test.
2. **Alta — consegna e revoca.** Verificare che il link sostitutivo copiato dopo un errore di consegna permetta l’ingresso e che un link revocato mostri lo stato corretto. Le prove frontend si fermano al contratto dell’API.
3. **Media — persone con compiti diversi.** Far trovare Invita e il primo compito a un amministratore di agenzia, un collaboratore e un fornitore, su telefono e tastiera. Annotare primo click, ritorni al menu, eventuale assistenza e completamento per ruolo. Le fixture misurano il comportamento del software. Tempi e abbandoni richiedono osservazioni di utenti.
