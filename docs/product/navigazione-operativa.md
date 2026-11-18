# CasaZen · Navigazione operativa

## Prima e dopo

Il confronto parte dalla revisione `f4b9f7e` di frontend. Il manifesto contiene 167 destinazioni nelle cinque aree, incluse nove rotte di attivazione da `onboarding-routes.ts`. Le tabelle riportano il menu del checkout per entrambe le versioni. Le differenze si concentrano sugli ingressi dal compito, l’orientamento su telefono e la visibilità per abbonamento.

| Compito e ruolo | Percorso precedente | Percorso consegnato | Attrito ed evidenza |
|---|---|---|---|
| Prospect, valutare il prodotto | Vetrina → invito commerciale. La demo tecnica richiedeva un URL e una persona conosciuti. | Vetrina → demo per area → primo compito su dati sintetici → invito. | Il codice del sito e la configurazione demo permettono di confrontare le destinazioni. L’abbandono prima del primo risultato è un’ipotesi da misurare. |
| Host, controllare un arrivo | Cruscotto → riga di oggi → dettaglio → ricerca dello stato del check-in. | Cruscotto → arrivi → azione check-in → Documenti della prenotazione. La data di riferimento segue Roma. Il risultato dell’assistente porta allo stesso record. | Il percorso diretto e quello assistito condividono immobile, date e permessi. Le prove usano prenotazioni sintetiche. |
| PM, alternare aree e immobili | Da telefono intestazione con area e piano, organizzazione nel foglio Altro. Desktop con area nella sidebar e organizzazione in alto. | Telefono con area e organizzazione già in alto. Altro → selettore → nuova area. I filtri sul Cruscotto restringono le attività al contesto scelto. | La larghezza disponibile compete con le azioni dell’header. I nomi lunghi restano disponibili nel selettore. Il cambio di area apre la destinazione iniziale consentita. |
| Locatore, controllare un canone | Immobili → casa → contratto → Canoni. Le quattro scorciatoie di stato in Panoramica passavano da un vecchio redirect che scartava il filtro. | Immobili → casa locata → Verifica i canoni apre direttamente il contratto su Canoni. Panoramica mostra i conteggi e indica dove aprire gli immobili. Scadenze rimane raggiungibile dalla relativa sezione. | Redirect e filtri verificati nel codice. La selezione di gruppi diversi portava allo stesso elenco. Il numero di passaggi si riduce di una selezione per la casa già aperta. |
| Locatore, riprendere una pratica | Panoramica → Adesso → passo suggerito dal server, oppure Immobili → casa → contratto. | Adesso apre la pratica per chi può scrivere. Un lettore raggiunge la scheda contratto. L’avvio di un contratto e la modifica dell’immobile rispettano i permessi del ruolo. | Lo stato dipende dalla risposta del servizio. Nessuna pratica viene avanzata durante l’esplorazione. |
| Amministratore organizzazione, controllare un collaboratore | Amministrazione → Persone → anteprima accessi o invito. | Stesso percorso con nome organizzazione sempre consultabile su telefono. I moduli acquistati partecipano alla costruzione del menu prima di raggruppare sezioni e tab. | Senza il modulo della sezione padre, una pagina figlia acquistata poteva sparire. Test del caso Adempimenti / Identificazione. Priorità operativa a persone e immobili assegnati. |
| Fornitore, prendere in carico una richiesta | Fornitori → Richieste → dettaglio, poi disponibilità e catalogo. | Percorso diretto dalla barra, con conteggio permesso e passaggio esplicito al contesto Fornitori. | Inbox, calendario iCal e schede servizio sono separati; i pagamenti dipendono dal flag del servizio. Priorità alle richieste in attesa. |
| Staff piattaforma, assistere un’organizzazione | Console staff → Utenti o Fornitori. Processi raggruppa job, configurazione AI e ambiente demo. | Console separata dall’Amministrazione cliente. Selettore e Guida seguono il contesto. | Riservato al contesto restituito dall’API. La modifica dei ruoli dell’organizzazione cliente avviene da Amministrazione. Priorità a verifiche aperte e processi in errore, prima delle impostazioni. |

L’evidenza di navigazione deriva dal router, dai componenti e dai test con fixture. Un numero di selezioni descrive il percorso partendo dalla schermata indicata. I dati su abbandono, tempi degli utenti e vendite richiedono misurazione sul prodotto.

## Accesso, orientamento e scorciatoie

- Il backend restituisce aree e permessi in `/api/me/contexts`. L’accesso a un immobile o a una prenotazione si verifica anche sul server. Tutti i permessi elencati in una cella sono necessari. “Area” indica il solo accesso a quell’area. I flag elencati con “o” sono alternativi. I moduli commerciali di un nuovo account si aggiungono a questi controlli.
- L'intestazione offre ricerca, Guida, menu profilo e Chiedi a CasaZen nelle aree operative. Il profilo apre anche lingua e uscita. La Guida apre `/app/<area>/help` per l’area corrente. Il selettore mostra le sole aree disponibili. Le schermate non autorizzate usano la pagina riservata o il redirect previsto dal guard.
- Desktop usa gruppi laterali con nomi e contatori. Da 768 a 1023 px la sidebar è una barra di icone con nomi accessibili. Sotto 768 px la barra inferiore ha fino a quattro destinazioni più Altro. I tab di sezione diventano un selettore sulle larghezze strette. Per il fornitore le pagine figlie sono collegamenti nell’intestazione della sezione.
- Una pagina figlia con permesso e modulo attivi il cui padre è inaccessibile passa ad Altro su telefono e desktop. La stessa visibilità alimenta ricerca e contatori. I link di record richiedono un record visibile e un identificatore assegnato dal servizio. Gli indirizzi di compatibilità portano alla funzione attuale.
- ¹ Il gestore del piano è determinato dalla policy di fatturazione dell’organizzazione. Dove previsto, un accesso diretto di un altro membro mostra chi può intervenire. Nel contesto Staff il controllo è quello della piattaforma.

## Vetrina, onboarding e punti di arrivo esterni

| Superficie / destinatario | Entrata → destinazione | Ambito e azioni |
|---|---|---|
| Vetrina CasaZen / prospect | Home, Affitti brevi, Affitti lunghi, Funzionalità, Fornitori, Chi siamo → demo o richiesta commerciale | Pagine IT/EN del sito SSR. Il percorso di attivazione commerciale usa il signup pubblico configurato. |
| Nuovo host / persona invitata | Login, signup o invito → verifica → onboarding → scelta area o pagina iniziale assegnata | Consensi, organizzazione e ruoli determinano i passi seguenti. Un’organizzazione già attiva può aprire la Guida; l’attivazione Octorate usa il proprio flag. |
| Sito dell’host / ospite | `/book/:orgSlug` o dominio dell’host → immobile → checkout → esito della prenotazione | Ricerca, prenotazioni dell’ospite, recensione e annullamento hanno ingressi specifici. Il pagamento ha un esito distinto dalla prenotazione. |
| Check-in / ospite | Link ricevuto `/checkin/:token` o QR `/checkin/porta/:doorToken` → sessione di check-in | L’host legge lo stato nel PMS. Il portale ha solo il contesto autorizzato dal link verificato dal servizio. |
| Portale inquilino | `/portale-conduttore` → contratto → scadenze, documenti o manutenzione | La richiesta manutenzione si apre dal contratto. Il link `/rent/pay/:installmentId` apre la rata indicata. |
| Portale proprietario | Invito o accesso in `/portale-proprietari` → immobili, calendario o contabilità | Documenti, rendiconti, contatti e messaggi seguono le associazioni dell’utente nel portale. |
| Vetrina fornitore / cliente | `/fornitori/:slug` → servizio → preventivo o prenotazione → conferma o richiesta | Le prenotazioni online dipendono da `supplierShowcaseBooking`. Il pagamento del servizio ha un indirizzo dedicato `/service/pay/:paymentId`. |

## Inventario del manifesto

Le voci del menu e dei tab riprendono le traduzioni IT/EN. Per le pagine che si aprono da una riga, da un invito o da un’azione, la prima colonna identifica il compito nelle due lingue. L’ultima colonna riporta le regole dichiarate nel manifesto. Alcuni componenti aggiungono condizioni sul singolo record, sulla configurazione del servizio o sullo stato della pratica. Le sezioni seguenti costituiscono un inventario statico; le verifiche browser coprono i percorsi prioritari.

### Affitti brevi / Short-term rentals

Prefisso di ogni destinazione `/app/short-rent`. La barra indica il posto da sinistra.

| Voce IT / EN | Destinazione | Desktop | Telefono | Accesso |
|---|---|---|---|---|
| Cruscotto / Dashboard | `/` | Menu · Ogni giorno | Barra 1 | Area |
| Calendario / Calendar | `bookings/calendar` | Menu · Ogni giorno | Barra 2 | `booking.read` |
| Prenotazioni / Bookings | `bookings` | Menu · Ogni giorno | Barra 3 | `booking.read` |
| Messaggi / Messages | `messages` | Menu · Ogni giorno | Altro | `booking.read` |
| Adempimenti / Compliance | `compliance` | Menu · Ogni giorno | Altro | `property.read`, `booking.read` |
| Immobili / Properties | `properties` | Menu · La tua offerta | Barra 4 | `property.read` |
| Sito di prenotazione / Booking site | `vetrina` | Menu · La tua offerta | Altro | Area |
| Marketplace / Marketplace | `marketplace` | Menu · La tua offerta | Altro | `booking.read` |
| Incassi / Payments | `payments` | Menu · Gestione | Altro | `payment.read` |
| CRM Ospiti / Guest CRM | `crm/guests` | Menu · Gestione | Altro | `guest.read` · flag `crmMarketing` |
| Impostazioni / Settings (tab Organizzazione / Organization) | `settings/organization` | Piè di menu | Altro | Area · gestore piano¹ |
| Consiglia CasaZen / Recommend CasaZen | `settings/invitations` | Piè di menu | Altro | `property.read` |
| Commercialista / Accountant | `accountant` | Tab · `payments` | Come desktop | `payment.read` · flag `accountantPackage` |
| Da fare / To do | `activities` | Tab · `/` | Come desktop | `property.read` |
| Alloggiati / Alloggiati | `alloggiati` | Tab · `compliance` | Come desktop | `booking.read` |
| Report Alloggiati / Alloggiati reports | `alloggiati/reports` | Tab · `compliance` | Come desktop | `booking.read` |
| Coda di approvazione / Approval Queue (tab Da approvare / To approve) | `approval-queue` | Tab · `/` | Come desktop | `approval.decide` |
| Automazioni / Automations | `automations` | Tab · `settings/organization` | Come desktop | `property.write` · flag `routines` |
| Scheda prenotazione / Booking details | `bookings/:id` | Prenotazioni, calendario, arrivi o risultato assistente | Come desktop | `booking.read` |
| Check-in / Check-in | `bookings/:id/check-in` | Scheda prenotazione → check-in | Come desktop | `booking.write` |
| Check-out / Check-out | `bookings/:id/checkout` | Scheda prenotazione → partenza | Come desktop | `booking.write` |
| Modifica prenotazione / Edit booking | `bookings/:id/edit` | Scheda prenotazione → modifica | Come desktop | `booking.write` |
| Modifiche calendario / Bulk calendar changes | `bookings/calendar/bulk` | Calendario → azioni | Come desktop | `property.write` |
| Nuova prenotazione / New booking | `bookings/create` | Prenotazioni o calendario → aggiungi | Come desktop | `booking.write` |
| Canali e calendari / Channels and calendars | `channels` | Tab · `properties` | Come desktop | `property.read` |
| CIN / CIN | `compliance/cin` | Tab · `compliance` | Come desktop | `property.read` |
| Identificazione / Identification | `compliance/identification` | Tab · `compliance` | Come desktop | `property.write` |
| Mittente Alloggiati / Alloggiati sender | `compliance/sender` | Adempimenti → mittente | Come desktop | `property.write` |
| Profilo CRM / CRM profile | `crm/guests/:id` | CRM → contatto | Come desktop | `guest.read` · flag `crmMarketing` |
| Duplicati / Duplicates | `crm/merge` | Tab · `crm/guests` | Come desktop | `guest.write` · flag `crmMarketing` |
| Documenti / Documents | `documents` | Tab · `payments` | Come desktop | `property.read` |
| Regime fiscale / Fiscal regime | `fiscal` | Tab · `payments` | Come desktop | `property.read` |
| Documenti fiscali / Fiscal documents | `fiscal/documents` | Tab · `payments` | Come desktop | `property.read`, `payment.read` · flag `fiscalDocumentIssuance` o `octorateDocumentImport` |
| Emittente / Issuer | `fiscal/issuer` | Indirizzo precedente → Fatturazione | Come desktop | Area |
| Report fiscali / Tax reports | `fiscal/reports` | Regime fiscale → report | Come desktop | `property.read` |
| Fatturazione / Invoicing setup | `fiscal/setup` | Regime fiscale → fatturazione | Come desktop | `property.read`, `payment.read` · flag `fiscalDocumentIssuance` |
| Profilo fiscale / Tax profile | `fiscal/wizard` | Regime fiscale → configurazione | Come desktop | `property.write` |
| Ospiti / Guests | `guests` | Tab · `bookings` | Come desktop | `booking.read` |
| Scheda ospite / Guest details | `guests/:id` | Ospiti → riga | Come desktop | `booking.read` |
| Collega i tuoi canali / Connect your channels | `integrations/octorate` | Integrazioni o piano attivazione | Come desktop | `ota.write` · flag `octorateConnector` |
| Interventi / Jobs | `interventions` | Tab · `properties` | Come desktop | `property.read` |
| Scheda intervento / Service request details | `interventions/:id` | Interventi → riga | Come desktop | `property.read` |
| Richiedi un intervento / Request a service | `interventions/request` | Interventi → richiesta | Come desktop | `servicerequest.write` |
| Attiva / Activate | `marketplace/activate/:kind/:code` | Scheda marketplace → attiva | Come desktop | `ota.write` · flag `octorateConnector` |
| Categorie / Categories | `marketplace/categories` | Compatibilità → ricerca | Come desktop | `booking.read` |
| Categoria / Category | `marketplace/categories/:category` | Marketplace → categoria | Come desktop | `booking.read` |
| Le mie app / My apps | `marketplace/mine` | Marketplace → app attivate | Come desktop | `booking.read` |
| Attiva partner / Activate partner | `marketplace/partners/:code/activate` | Scheda partner → attiva | Come desktop | `ota.write` |
| Richiedi funzione / Request module | `marketplace/request/:moduleCode` | Scheda funzione → richiesta | Come desktop | `ota.write` · flag `octorateConnector` |
| Cerca nel marketplace / Search marketplace | `marketplace/search` | Marketplace → ricerca | Come desktop | `booking.read` |
| Fornitore / Supplier details | `marketplace/suppliers/:orgId` | Marketplace → scheda fornitore | Come desktop | `booking.read` |
| Conversazione / Conversation | `messages/:threadKey` | Messaggi → conversazione | Come desktop | `booking.read` |
| Inizia con CasaZen / Start with CasaZen | `onboarding` | Guida o primo accesso → piano | Come desktop | `property.read` · flag `octorateOnboarding` |
| Impostazioni in blocco / Bulk setup | `onboarding/bulk` | Piano agenzia → configurazione in blocco | Come desktop | Area · flag `octorateOnboarding` · gestore piano¹ |
| Configura proprietari / Set up owners | `onboarding/owners` | Piano agenzia → proprietari | Come desktop | `property.read` · flag `octorateOnboarding` · gestore piano¹ |
| Riprendi passo / Resume step | `onboarding/panel` | Attività della guida → passo sospeso | Come desktop | `property.write` · flag `octorateOnboarding` |
| Passo nel pannello / Panel step | `onboarding/panel/:kind` | Parte del piano → pannello | Come desktop | `property.write` · flag `octorateOnboarding` |
| Parte del piano / Setup step | `onboarding/parts/:partKey` | Piano → parte | Come desktop | `property.read` · flag `octorateOnboarding` |
| Riepilogo e attivazione / Summary and activation | `onboarding/summary` | Ultima parte del piano | Come desktop | `property.read` · flag `octorateOnboarding` |
| OTA / OTA | `ota` | Tab · `properties` | Come desktop | `ota.read` · flag `otaPartnerApi` |
| Nuovo canale / New channel | `ota/create` | Canali → collega | Come desktop | `ota.write` · flag `otaPartnerApi` |
| Scheda pagamento / Payment details | `payments/:id` | Incassi → riga | Come desktop | `payment.read` |
| Nuovo pagamento / New payment | `payments/create` | Incassi → aggiungi | Come desktop | `payment.write` |
| Ricavi / Revenue | `payments/revenue` | Tab · `payments` | Come desktop | `payment.read` |
| Profilo / Profile | `profile` | Menu utente o Altro → profilo | Come desktop | Area |
| Notifiche / Notifications | `profile/notifications` | Tab · `profile` | Come desktop | Area |
| Scheda immobile / Property record | `properties/:id` | Immobili → riga | Come desktop | `property.read` |
| Attiva immobile / Activate property | `properties/:id/activation` | Scheda immobile → attivazione | Come desktop | `property.write` |
| Modifica immobile / Edit property | `properties/:id/edit` | Scheda immobile → modifica | Come desktop | `property.write` |
| Cambia modalità / Change rental mode | `properties/:id/mode` | Scheda immobile → menu azioni | Come desktop | `property.write` |
| Prezzi / Pricing | `properties/:id/pricing` | Scheda immobile → tariffe | Come desktop | `property.read` |
| QR di accesso / Entrance QR | `properties/:propertyId/qr` | Identificazione e accesso → immobile | Come desktop | `property.read` |
| Nuovo immobile / New property | `properties/create` | Immobili → aggiungi | Come desktop | `property.write` |
| Report / Reports | `reports` | Tab · `payments` | Come desktop | `payment.read` |
| Costi canali / Channel costs | `reports/channel-costs` | Report → apri | Come desktop | `payment.read` |
| Riscossioni / Collections | `reports/collections` | Report → apri | Come desktop | `payment.read` |
| Imposta di soggiorno / Tourist tax | `reports/tourist-tax` | Report → apri | Come desktop | `payment.read` |
| Recensioni / Reviews | `reviews` | Tab · `bookings` | Come desktop | `booking.read` |
| Assistente / Assistant | `settings/assistant` | Tab · `settings/organization` | Come desktop | `property.write` · flag `messageAssistant` |
| Fatturazione / Billing | `settings/billing` | Piano → fatturazione | Come desktop | Area · gestore piano¹ |
| Dominio pubblico / Public domain | `settings/domain` | Tab · `vetrina` | Come desktop | `property.write` |
| Integrazione / Integration | `settings/integration` | Tab · `settings/organization` | Come desktop | Area · flag `octorateOnboarding` · gestore piano¹ |
| Stripe Connect / Stripe Connect | `settings/payments` | Tab · `payments` | Come desktop | `property.write` |
| Piano / Plan | `settings/plan` | Organizzazione e piano nell’header | Come desktop | Area · gestore piano¹ |
| Aspetto sito / Site appearance | `settings/site-appearance` | Tab · `vetrina` | Come desktop | Area · gestore piano¹ |
| Documenti sito / Site documents | `settings/site-documents` | Tab · `vetrina` | Come desktop | Area · gestore piano¹ |
| Fornitori fidati / Trusted Suppliers | `trusted-suppliers` | Tab · `properties` | Come desktop | `property.read` · flag `agencyTier` |
| Verifiche / Verifications | `verifications` | Tab · `/` | Come desktop | `verification.decision` |

### Affitti lunghi / Long-term rentals

Prefisso di ogni destinazione `/app/long-rent`. La barra indica il posto da sinistra.

| Voce IT / EN | Destinazione | Desktop | Telefono | Accesso |
|---|---|---|---|---|
| Panoramica / Overview | `/` | Menu · Ogni giorno | Barra 1 | `lease.read` |
| Immobili / Properties | `properties` | Menu · Patrimonio | Barra 2 | `property.read` |
| Impostazioni / Settings (tab Organizzazione / Organization) | `settings/organization` | Piè di menu | Altro | Area · gestore piano¹ |
| Consiglia CasaZen / Recommend CasaZen | `settings/invitations` | Piè di menu | Altro | `property.read` |
| Scadenze / Deadlines | `deadlines` | Panoramica → scadenze | Come desktop | `lease.read` |
| Carica documenti / Upload documents | `documents/upload` | Pratica → carica documenti | Come desktop | `lease.read`, `lease.create` |
| Report fiscale / Tax report | `fiscal` | Altro | Come desktop | `lease.read` |
| Contratti / Leases | `leases` | Compatibilità → immobili, con propertyId → contratti della casa | Come desktop | `lease.read` |
| Scheda contratto / Lease record | `leases/:id` | Immobile → contratti → riga | Come desktop | `lease.read` |
| Contratto guidato / Guided lease | `leases/:id/concordatofacile` | Compatibilità → guided-contract | Come desktop | `lease.read`, `lease.create` |
| Riprendi bozza / Resume draft | `leases/:id/edit` | Pratica in preparazione → continua | Come desktop | `lease.read`, `lease.create` |
| Contratto guidato / Guided lease | `leases/:id/guided-contract` | Pratica concordata → accesso al servizio | Come desktop | `lease.read`, `lease.create` |
| Manutenzione / Maintenance | `leases/:id/manutenzione` | Richieste di manutenzione di un contratto | Come desktop | `lease.read` |
| Nuovo contratto / New lease | `leases/new` | Panoramica o immobile → nuovo contratto | Come desktop | `lease.create` |
| Spese condominiali / Condominium payments | `payments` | Altro | Come desktop | `property.read` |
| Profilo / Profile | `profile` | Menu utente o Altro → profilo | Come desktop | Area |
| Scheda immobile / Property record | `properties/:id` | Immobili → riga | Come desktop | `property.read` |
| Modifica immobile / Edit property | `properties/:id/edit` | Scheda immobile → modifica | Come desktop | `property.write` |
| Cambia modalità / Change rental mode | `properties/:id/mode` | Scheda immobile → menu azioni | Come desktop | `property.write` |
| Nuovo immobile / New property | `properties/new` | Immobili → aggiungi | Come desktop | `property.write` |
| Canoni / Rents | `rents` | Panoramica → importi del mese o contratto → Canoni | Come desktop | `lease.read` |
| Interventi / Maintenance | `service-requests` | Sezione Interventi dell’immobile | Come desktop | `property.read` |
| Scheda intervento / Service request details | `service-requests/:id` | Interventi → riga | Come desktop | `property.read` |
| Fatturazione / Billing | `settings/billing` | Piano → fatturazione | Come desktop | Area · gestore piano¹ |
| Piano / Plan | `settings/plan` | Organizzazione e piano nell’header | Come desktop | Area · gestore piano¹ |
| Inquilini / Tenants | `tenants` | Contratto → Inquilini → elenco | Come desktop | `lease.read` |
| Scheda inquilino / Tenant details | `tenants/:id` | Elenco inquilini → riga | Come desktop | `lease.read` |

### Amministrazione / Administration

Prefisso di ogni destinazione `/app/account`. La barra indica il posto da sinistra.

| Voce IT / EN | Destinazione | Desktop | Telefono | Accesso |
|---|---|---|---|---|
| Home / Home | `/` | Menu · Il tuo account | Barra 1 | `org.members.manage` |
| Persone / People | `people` | Menu · Il tuo account | Barra 2 | `org.members.manage` |
| Immobili / Properties | `properties` | Menu · Il tuo account | Barra 3 | `org.members.manage` |
| Proprietari / Owners | `owners` | Menu · Il tuo account | Altro | Area · flag `agencyTier` · gestore piano¹ |
| Chiusura mensile / Month-end close | `owner-close` | Menu · Proprietari | Altro | Area · flag `agencyTier` · gestore piano¹ |
| Fatturazione / Billing | `billing` | Piè di menu | Altro | Area · gestore piano¹ |
| Impostazioni / Settings | `settings` | Piè di menu | Altro | `org.settings.manage` |
| Commissioni dei canali / Channel commissions | `channel-commissions` | Tab · `owner-close` | Come desktop | Area · flag `agencyTier` · gestore piano¹ |
| Versione chiusura / Close version | `owner-close/versions/:versionId` | Chiusura → versione | Come desktop | Area · flag `agencyTier` · gestore piano¹ |
| Fatture ai proprietari / Invoices to the owners | `owner-invoices` | Tab · `owner-close` | Come desktop | Area · flag `ownerInvoicing` · gestore piano¹ |
| Dati finanziari / Financial details | `owners/:ownerId/financial` | Proprietari → proprietario | Come desktop | Area · flag `agencyTier` · gestore piano¹ |
| Anteprima accessi / Access preview | `people/:key/preview` | Persone → persona → anteprima | Come desktop | `org.members.manage` |
| Invita una persona / Invite a person | `people/invite` | Persone → invita | Come desktop | `org.members.manage` |
| Ruoli / Roles | `people/roles` | Persone → ruoli | Come desktop | `org.members.manage` |
| Profilo / Profile | `profile` | Menu utente o Altro → profilo | Come desktop | Area |
| Autofatture (TD17) / Self-billed invoices (TD17) | `self-billing` | Tab · `owner-close` | Come desktop | Area · flag `fiscalDocumentIssuance` · gestore piano¹ |
| Rendiconti / Statements | `statements` | Tab · `owner-close` | Come desktop | Area · flag `agencyTier` · gestore piano¹ |
| Bonifici proprietari / Owner Wire Transfers | `wire-transfers` | Tab · `owner-close` | Come desktop | Area · flag `agencyTier` · gestore piano¹ |
| Ritenute d'acconto / Withholding tax | `withholding` | Tab · `owner-close` | Come desktop | Area · flag `agencyTier` · gestore piano¹ |

### Fornitori / Suppliers

Prefisso di ogni destinazione `/app/supplier`. La barra indica il posto da sinistra.

| Voce IT / EN | Destinazione | Desktop | Telefono | Accesso |
|---|---|---|---|---|
| Dashboard / Dashboard | `dashboard` | Menu · Lavoro | Barra 1 | Area |
| Richieste / Requests | `inbox` | Menu · Lavoro | Barra 2 | Area |
| Disponibilità / Availability | `availability` | Menu · Lavoro | Barra 3 | Area |
| Servizi e prezzi / Services and prices (barra Servizi / Services) | `services` | Menu · La tua attività | Barra 4 | Area |
| Vetrina / Showcase | `showcase` | Menu · La tua attività | Altro | Area |
| Clienti / Clients | `clients` | Menu · La tua attività | Altro | Area |
| Impostazioni / Settings | `settings` | Menu · Gestione | Altro | Area |
| Attivazione / Activation | `activation` | Panoramica fornitore → completa attivazione | Come desktop | Area |
| Calendario / Calendar | `calendar` | Link · `availability` | Come desktop | Area |
| Incassi / Earnings | `earnings` | Link · `settings` | Come desktop | Area · flag `supplierOnlinePayments` |
| Guida iCal / iCal guide | `help/ical` | Altro | Come desktop | Area |
| Dettaglio richiesta / Request details | `inbox/:id` | Richieste → riga | Come desktop | Area |
| Profilo / Profile | `profile` | Altro | Come desktop | Area |
| Scheda servizio / Service details | `services/:id` | Catalogo servizi → riga | Come desktop | Area |
| Nuovo servizio / New service | `services/new` | Catalogo servizi → aggiungi | Come desktop | Area |
| Pubblica vetrina / Publish showcase | `showcase/publish` | Vetrina fornitore → pubblica | Come desktop | Area |

### Console staff / Staff console

Prefisso di ogni destinazione `/app/admin`. La barra indica il posto da sinistra.

| Voce IT / EN | Destinazione | Desktop | Telefono | Accesso |
|---|---|---|---|---|
| Cruscotto / Dashboard | `/` | Menu · Piattaforma | Barra 1 | `admin.stats.read` |
| Utenti / Users | `users` | Menu · Piattaforma | Barra 2 | `admin.users.read` |
| Fornitori / Suppliers | `suppliers` | Menu · Piattaforma | Barra 3 | `admin.users.manage` |
| Richieste di aiuto / Help requests | `onboarding-assist` | Menu · Supporto | Altro | `admin.users.read` · flag `octorateOnboarding` |
| Inviti / Invitations | `suppliers/invite` | Menu · Piattaforma | Altro | `admin.users.manage` |
| Attività / Activities | `activities` | Menu · Supporto | Altro | `admin.users.read` · flag `agencyTier` |
| SEO & Contenuti / SEO & Content | `seo` | Menu · Contenuti | Altro | `admin.seo.read` |
| Conformità / Compliance audit | `cin` | Menu · Sistema | Altro | `admin.cin.read` |
| Processi / Processes | `jobs` | Menu · Sistema | Barra 4 | `admin.jobs.read` |
| Configurazione AI / AI configuration | `ai` | Tab · `jobs` | Come desktop | `admin.seo.read` |
| Regioni ISTAT / ISTAT regions | `compliance/istat-regions` | Tab · `cin` | Come desktop | `admin.cin.read` |
| Dati normativi LTR / LTR reference data | `compliance/ltr-reference-data` | Tab · `cin` | Come desktop | `admin.ltr.manage` |
| Tassa di Soggiorno / Tourist Tax | `compliance/tax-rates` | Tab · `cin` | Come desktop | `admin.cin.read` |
| Ambiente demo / Demo environment | `demo` | Tab · `jobs` | Come desktop | `admin.cin.read` |
| QR invito / Invitation QR | `invite-qr` | Compatibilità → Inviti della console | Come desktop | `admin.users.manage` |
| Marketing / Marketing | `marketing` | Tab · `seo` | Come desktop | `admin.seo.read` |
| Profilo / Profile | `profile` | Menu utente o Altro → profilo | Come desktop | `admin.users.read` |
