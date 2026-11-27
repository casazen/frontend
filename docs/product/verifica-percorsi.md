# Verifica dei percorsi in browser

Chromium 154 su Linux, Playwright 1.60 e axe-core. Il confronto parte da `92c71f3e`. Le tre viste usano lo stesso profilo italiano, un arrivo sintetico, il medesimo viewport in pixel CSS, zoom 100% e movimento ridotto. Le immagini mostrano il primo viewport all’apertura, senza scorrimento. Il server Vite di entrambe le versioni serve la vetrina con il renderer impiegato per il prerender.

## Percorsi riprodotti

| Ruolo e ingresso | Percorso osservato | Esito |
| --- | --- | --- |
| Prospect, 390 px | Affitti brevi → Vedi gli arrivi di oggi → prenotazione campione | Stato del check-in e invito via e-mail all’indirizzo di test configurato. La verifica si ferma al collegamento `mailto:`. |
| Host short-stay, quattro larghezze | Cruscotto filtrato per immobile → Arrivi → collegamento della riga → Documenti → Indietro | Ospite, immobile e sessione in compilazione. Tornando alla home si ritrovano immobile e filtro Arrivi. Attivazione della riga anche con Invio. |
| Host short-stay, 390 px | Chiedi a CasaZen → domanda sugli arrivi incompleti → fonte; Esc → scorciatoia in Oggi → prenotazione | Contesto, data, immobile, stato e collegamento verificati. Esc ripristina il focus sul pulsante di apertura. |
| Locatore long-term, 390 px | Affitti lunghi → Controlla un contratto → Casa dei Tigli → Apri contratto | Raggiungibili la rata mensile campione e il contratto collegato. |

## Schermate confrontabili

| Schermata | 320 × 568 | 390 × 844 | 768 × 1024 | 1440 × 900 |
| --- | --- | --- | --- | --- |
| Vetrina Affitti brevi | [prima](evidenze-percorsi/prima-vetrina-320.jpg) · [dopo](evidenze-percorsi/dopo-vetrina-320.jpg) | [prima](evidenze-percorsi/prima-vetrina-390.jpg) · [dopo](evidenze-percorsi/dopo-vetrina-390.jpg) | [prima](evidenze-percorsi/prima-vetrina-768.jpg) · [dopo](evidenze-percorsi/dopo-vetrina-768.jpg) | [prima](evidenze-percorsi/prima-vetrina-1440.jpg) · [dopo](evidenze-percorsi/dopo-vetrina-1440.jpg) |
| Cruscotto con arrivo | [prima](evidenze-percorsi/prima-cruscotto-320.jpg) · [dopo](evidenze-percorsi/dopo-cruscotto-320.jpg) | [prima](evidenze-percorsi/prima-cruscotto-390.jpg) · [dopo](evidenze-percorsi/dopo-cruscotto-390.jpg) | [prima](evidenze-percorsi/prima-cruscotto-768.jpg) · [dopo](evidenze-percorsi/dopo-cruscotto-768.jpg) | [prima](evidenze-percorsi/prima-cruscotto-1440.jpg) · [dopo](evidenze-percorsi/dopo-cruscotto-1440.jpg) |
| Prenotazione, scheda Documenti | [prima](evidenze-percorsi/prima-prenotazione-320.jpg) · [dopo](evidenze-percorsi/dopo-prenotazione-320.jpg) | [prima](evidenze-percorsi/prima-prenotazione-390.jpg) · [dopo](evidenze-percorsi/dopo-prenotazione-390.jpg) | [prima](evidenze-percorsi/prima-prenotazione-768.jpg) · [dopo](evidenze-percorsi/dopo-prenotazione-768.jpg) | [prima](evidenze-percorsi/prima-prenotazione-1440.jpg) · [dopo](evidenze-percorsi/dopo-prenotazione-1440.jpg) |

[Assistente con fonte prenotazione, 390 × 844](evidenze-percorsi/dopo-assistente-390.jpg)

## Accessibilità e prestazioni locali

I controlli automatici sull’intero documento includono i tag WCAG A/AA 2.0, 2.1 e 2.2. Nella baseline axe rileva testo bianco sul banner demo (2,13:1) e avviso nella scheda Documenti (3,44:1). La tabella indica il totale di elementi segnalati nelle quattro rilevazioni per ogni schermata. Overflow è lo scarto massimo tra larghezza del documento e viewport.

| Schermata | Elementi axe prima → dopo | Overflow massimo prima → dopo | FCP locale prima → dopo |
| --- | ---: | ---: | ---: |
| Vetrina Affitti brevi | 0 → 0 | 0 → 0 px | 0,64 → 0,33 s |
| Cruscotto con arrivo | 4 → 0 | 0 → 0 px | 5,24 → 3,34 s |
| Prenotazione, scheda Documenti | 8 → 0 | 0 → 0 px | 4,58 → 4,81 s |

First Contentful Paint (FCP) è la mediana di quattro singole navigazioni locali, una per larghezza, su server di sviluppo e con moduli non raggruppati. Contesto browser nuovo per ogni larghezza, rete locale con fixture, macchina condivisa e carico variabile. I valori descrivono questa esecuzione. Per valutare la velocità percepita dagli utenti servono misurazioni sulle build distribuite e dati di campo.

La suite controlla focus da tastiera, etichette accessibili, collegamento dell’arrivo di almeno 44 × 44 pixel CSS, attivazione con Invio, chiusura con Esc, destinazione del link sorgente e assenza di scorrimento orizzontale. L’ordine visuale della scheda colloca lo stato del check-in prima del prossimo passo. I pulsanti assistente e guida occupano aree distinte anche su tablet. Axe include il contrasto del testo renderizzato. Un lettore di schermo reale e dispositivi touch fisici restano da verificare.

## Ripetizione

```bash
npm ci
npx playwright install chromium
npm run test:e2e -- e2e/operational-arrivals.spec.ts
```

Sette test di regressione sono passati sulla tranche. Il progetto Playwright demo configura `VITE_API_BASE_URL=/api` e un indirizzo `.test` per l’invito. Il percorso PMS usa le fixture Playwright. Il percorso dalla vetrina usa i dati sintetici della demo guidata. Nessun invito è stato spedito.
