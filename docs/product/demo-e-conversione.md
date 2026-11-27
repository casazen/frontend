# Demo, inviti e conversione a pagamento

Il sito CasaZen offre accesso su invito. Al punto di partenza le CTA aprivano una mail precompilata se l'indirizzo di supporto era configurato. L'onboarding commerciale esiste per i profili abilitati e la fatturazione passa da Stripe. Nessuno di questi due passaggi attesta che un visitatore della vetrina abbia provato il prodotto. [CTA della vetrina](../../src/site/site-links.ts) · [Onboarding commerciale](../../src/features/onboarding/commercial-signup-wizard.tsx)

| Percorso | Primo risultato osservabile | Passaggio commerciale verificabile |
| --- | --- | --- |
| Prospect · Affitti brevi | Dalla vetrina scopre gli arrivi, apre il soggiorno sintetico e legge il prossimo passo del check-in | Con contatto configurato, «Richiedi un invito» apre il client email. La persona può continuare l'esplorazione. |
| Prospect · Affitti lunghi | Apre la casa campione e legge la situazione del contratto/canone | La medesima richiesta di invito resta legata al momento in cui ha visto l'esempio. |
| Utente invitato · onboarding | Completa accesso, scelta prevista dal profilo e attivazione | Per contare un cliente pagante occorre il primo incasso SaaS positivo collegato all'organizzazione. |

Il sito pubblico mostra esempi interattivi sintetici nelle pagine di prodotto, senza sessione PMS. La build demo può portare alla Home Brevi o alla scheda immobile Lunghi con una persona e fixture locali. La build normale mantiene il confine di autenticazione. In assenza di un recapito configurato, la vetrina consente a chi ha già ricevuto un invito di aprirne il link CasaZen. Nella demo PMS si può preparare una mail al proprio referente, scegliendo personalmente il destinatario. Un invito usato e una richiesta di invito sono eventi distinti. [Ingressi dei tour](../../src/lib/guided-demo/session.ts)

## Cosa si può misurare

| Segnale | Momento di emissione e deduplicazione | Disponibilità |
| --- | --- | --- |
| `demo_enter` | Scelta del percorso Brevi/Lunghi, con la sola area. Più ingressi sono possibili | Client della tranche, con consenso statistico, dominio Plausible e script presenti |
| `demo_first_task` | Primo risultato dell'esempio. Il client tenta una sola emissione per area e scheda del browser usando `sessionStorage` | Client della tranche, stesse condizioni. Una nuova scheda può emettere di nuovo |
| `invitation_mail_open` | Click sul collegamento email. Il completamento dell'invio dipende dal client esterno | Client della tranche, stesse condizioni |
| `referral_mail_open` | Click della demo per scrivere al proprio referente quando manca il recapito di supporto. Il visitatore sceglie il destinatario | Client della tranche, stesse condizioni. Tenere separato da una richiesta ricevuta da CasaZen |
| `commercial_request_received` | Registrare lato CRM o backend l'effettiva ricezione della richiesta e assegnare un identificatore al lead. Duplicati sullo stesso lead confluiscono nel primo evento | Proposto. Il click della mail da solo non verifica ricezione né apertura del client |
| `first_paid_account` | Registrare lato server la prima fattura di abbonamento SaaS saldata con importo effettivamente pagato positivo per organizzazione. Contabilizzare una sola volta l'ID fattura e l'organizzazione | Il backend tratta già il webhook di piattaforma `invoice.paid`. Restano da collegare fattura, lead e demo nel report |

I contatori demo non contengono nomi ospite, ID prenotazione, email o testo digitato. La configurazione analytics esistente richiede consenso statistico e script Plausible. I contatori SEO esistenti riguardano CTA e avvio iscrizione per comune, con valori aggregati e senza chiave individuale. Dalla loro somma non si ricava la coorte demo. [Eventi demo](../../src/lib/guided-demo/events.ts) · [Consenso statistiche](../../src/config/analytics.config.ts) · [Funnel SEO](https://github.com/casazen/backend/blob/0f43955b422cd7ee8c81f777a84a6164fa022806/docs/runbooks/seo-funnel.md) · [Webhook fatture SaaS](https://github.com/casazen/backend/blob/0f43955b422cd7ee8c81f777a84a6164fa022806/Casazen.Infrastructure/External/StripeWebhookHandler.cs)

## Definizione della metrica

**Demo → cliente pagante a 30 giorni.** Formare una coorte settimanale UTC sul primo ingresso effettivo documentato in demo di ogni lead/account commerciale identificabile. Il denominatore comprende tutti i lead/account deduplicati con primo ingresso nella settimana, inclusi quelli senza richiesta successiva. Il numeratore comprende gli stessi soggetti per cui cade nella finestra `[primo_ingresso, primo_ingresso + 30 giorni)` la prima fattura SaaS saldata a importo positivo. Tasso = 100 × numeratore / denominatore. Mostrare entrambi i conteggi e lasciare il tasso assente quando il denominatore è zero.

- Per una demo assistita, il referente commerciale può registrare il primo accesso sul lead già presente, anche se poi non arriva un invito. Per una demo self-service con attribuzione individuale servono una chiave di attribuzione opaca trattata secondo il consenso applicabile e il collegamento successivo tra lead, invito e organizzazione. Una persona può provare la demo anonima anche senza tale collegamento.
- Il CRM deve mantenere un'identità commerciale canonica e la relazione lead → organizzazione dopo l'attivazione. Unificare prima del calcolo lead confluiti nello stesso account, tenere il primo ingresso e il primo pagamento, e assegnare l'area della prima demo. Specificare separatamente il numero di ingressi anonimi non collegabili. Un rapporto basato sui soli prospect che hanno scritto dopo la demo va etichettato «richieste ricevute → paganti».
- Il catalogo può offrire il modulo opzionale AI Agents secondo area, piano, disponibilità e prezzo restituiti dal backend. Selezionare l’extra nel preventivo indica interesse. L’acquisto successivo da parte di un cliente già pagante è espansione dello stesso account. Il conteggio della prima conversione della demo rimane uno per account. [Regole del catalogo](../../src/features/onboarding/commercial-model.ts)
- Escludere organizzazioni già paganti prima dell'ingresso, account interni, sandbox, ricevute degli ospiti, incassi degli affitti e transazioni dei fornitori. Una trial gratuita e una sessione Checkout completata senza incasso non qualificano il numeratore. Usare l'istante dell'incasso, anche quando il webhook arriva in ritardo.
- Pubblicare i tassi solo a finestra completa, con numero di coorti mature, copertura di attribuzione e sorgente (self-service o assistita). Fissare la stessa definizione prima di confrontare le settimane. Per studiare causalità occorre una prova controllata o un disegno di valutazione che consideri anche provenienza dei lead e cambi all'offerta.

**Baseline non disponibile.** Il checkout dà accesso ai contratti degli eventi e alla logica di fatturazione. Per questa analisi non sono disponibili un export dei lead, traffico Plausible, un collegamento lead → account o una serie di pagamenti attribuiti alla demo. Mancano sia numeratore sia denominatore storico. In attesa delle prime coorti, monitorare separatamente ingressi, raggiungimento del primo risultato, click invito e richieste effettivamente ricevute.

## Verifiche complementari in browser

Su Chromium locale con API simulate, 6 casi Playwright su 6 superati in 4,3 minuti. Le possibili interruzioni in tabella sono ipotesi di usabilità. I test riproducono azioni e stati dell'interfaccia.

| Ruolo | Passi riprodotti e risultato | Possibile interruzione | Test |
| --- | --- | --- | --- |
| Staff piattaforma | Una navigazione diretta al modulo invito agenzia mostra il campo per il fondatore e il titolo atteso | Confondere un invito allo staff di un cliente con l'invito del titolare di una nuova organizzazione | [Invito agenzia](../../e2e/admin-supplier-invite.spec.ts) |
| Ospite | Due prove sul link di check-in. Un token sconosciuto mostra l'errore. Un link con fixture valida apre il wizard con nome dell'immobile e progressione | Il link può essere vecchio o inoltrato al destinatario sbagliato | [Portale check-in](../../e2e/guest-checkin-portal.spec.ts) |
| Nuovo cliente | L'apertura dell'onboarding permette di scegliere tra i tre profili del percorso testato | Dubbi su quale profilo avrà accesso alle funzioni desiderate | [Profili onboarding](../../e2e/onboarding.spec.ts) |
| Fornitore | La posta del profilo fornitore è raggiungibile nel viewport mobile della suite | Il passaggio da richiesta alla prossima azione va convalidato con richieste reali del ruolo | [Posta mobile](../../e2e/supplier-layout.spec.ts) |
| Inquilino | «Apri il contratto» → «Paga la scadenza» → dichiarazione del bonifico. La fixture mostra «Inviata» e la rata ancora «Da pagare» | Una dichiarazione inviata potrebbe essere interpretata come saldo verificato | [Contratto e canoni](../../e2e/tenant-canoni.spec.ts) |

La mappa di navigazione copre anche gli ingressi condizionati da ruoli, feature flag e abbonamenti. [Mappa delle aree](navigazione-operativa.md)

## Criteri UX e prossime priorità

La scelta Brevi/Lunghi anticipa l'attività da provare. La Home e il dettaglio danno un nome al compito, mostrano immobile, periodo e prossimo passo, e mantengono il collegamento manuale all'origine. La CTA commerciale arriva dopo il risultato. Per la gerarchia mobile contano la visibilità del compito a 320 px, la lettura senza scorrimento orizzontale e la facilità del ritorno all'elenco. Per le prestazioni usare la stessa vista, viewport, fixture e stato della cache nei confronti. Verificare i dati sul campo quando il traffico lo consente. [Guida UX/UI di Algoritma](https://www.algoritma.it/user-experience-e-user-interface/)

| Ordine | Intervento e impatto atteso | Dipendenza verificabile / misura di accettazione |
| --- | --- | --- |
| 1 | Convalidare i percorsi su staging con un host e un collaboratore assegnato. Riduce il rischio di mostrare immobili o azioni fuori scope | Tenant e credenziali test. Verificare due organizzazioni, accesso diretto, cambio area, ruolo revocato, dati vuoti e 403/404. Conservare esiti senza PII. |
| 2 | Misurare il primo compito e la richiesta realmente ricevuta, prima di ottimizzare la CTA. Rende calcolabile il passaggio per coorte | Indirizzo invito configurato, analytics con consenso, CRM e collegamento alle fatture SaaS. Verificare doppio click, refresh, invito duplicato e replay webhook con dati di prova. |
| 3 | Completare paginazione e filtro lato server degli arrivi incompleti per grandi portafogli. Permette conteggi esaustivi per immobile | Estendere il servizio della giornata o aggiungere una lettura dedicata sotto `HostScope`. Provare un arrivo incompleto oltre la prima finestra e il cambio di data a Roma. |
| 4 | Portare nell'assistente letture di canoni e scadenze con collegamenti a contratto e pratica da riprendere | Proiezioni tipizzate di `long-rent/overview`, `deadlines`, `rents`, permessi e valuta per riga. Verificare rata parziale, contratto concluso, più immobili e assenza permessi. |
| 5 | Collegare bozza confermata e canale test in Messaggi. Evita ricopiature e restituisce l'esito reale | Thread attivo, template approvato, tenant, versione bozza, idempotenza e supporto canale. Provare annullamento, revoca, doppio invio e `ManualVerify`. |
| 6 | Estendere le letture a team, fornitori, routine, ricevute e marketplace in base ai compiti osservati. Valutare in seguito le operazioni di scrittura fiscali e OTA | Permessi specifici, flag/licenze, anteprima per conseguenza, servizi abilitati in staging e almeno una verifica end-to-end per singola capacità. |

Le analisi interne di pre-vendita del segmento agenzie (ottobre 2026) indicano esigenze di routine configurabili, coordinamento con i fornitori e conversazioni sui canali. Queste indicazioni qualitative sostengono la scelta delle aree da valutare. I test con prospect dovranno accertare dove le persone interrompono davvero i compiti e perché.

La frequenza di abbandono, il tempo mediano al primo risultato e l'effetto sulla conversione resteranno da misurare con utenti reali. Per i confini dei servizi e gli equivalenti manuali consultare la matrice dell'assistente. [Copertura AI](../technical/assistente-operativo.md)
