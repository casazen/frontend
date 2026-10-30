# Guida del contratto di locazione

La scheda di un contratto di Affitti lunghi (`/app/long-rent/leases/:id`) si apre sulla scheda **Guida** (`?tab=guida`, la prima).
Dice cosa fare, controllare o chiedere al commercialista per quel contratto, in base al suo tipo (libero 4+4, concordato 3+2,
transitorio), al momento in cui si trova e ai suoi dati, e offre due strumenti per decidere. La scheda **Dati** resta solo i dati
del contratto. Il blocco «Cosa devi fare ora» (il passo che il server indica) sta sopra le schede e la guida non lo ripete.

## Com'è fatta

| File (`src/features/leases/guide/`) | Cosa fa |
|---|---|
| `advice-catalogue.ts` | **Il catalogo**: un elemento per ogni consiglio, scritto come dato. È l'unico file da toccare per cambiare una norma. |
| `guide-facts.ts` | `GuideFacts`: cosa il catalogo sa di un contratto (tipo, fase, regime, canone, deposito, scadenze, conduttore extra-UE…) e `guideValues`, i numeri che i testi possono citare. |
| `select-advice.ts` | `selectAdvice`: i consigli adatti a un contratto, in ordine. `ADVICE_SHOWN` = 3. |
| `lease-guide.tsx` | La scheda: «Per il tuo contratto» (al massimo tre consigli, «Mostra tutti i consigli» per il resto) e «Strumenti». |
| `advice-item.tsx` | Un consiglio: titolo, una o due frasi, **un** gesto, «Perché?» richiudibile con le fonti. |
| `guide-tools.tsx`, `guide-tool-dialog.tsx` | Gli strumenti: una riga ciascuno con la frase di sintesi, e la finestra che li apre. |
| `guide-answers.ts`, `regime-text.ts` | La risposta in una frase: quale regime costa meno nel primo anno, dove sta il canone rispetto all'accordo. Nessuna formula nuova: sono differenze di cifre che il server ha già calcolato. |

Gli strumenti sono i pannelli che la scheda «Dati» ospitava, con un titolo e una frase che dicono a cosa servono:

- `regime` — «Cedolare secca o regime ordinario?» (`CedolareDecisionPanel`, `GET|POST /leases/{id}/rli/advisory`). Si apre con una frase
  di esito con la cifra del primo anno; sotto, che cosa fare nei due casi, le due opzioni a confronto, «Affina la stima», «Come
  l'abbiamo calcolato», «Fonti».
- `rent` — «Il canone rientra nei limiti dell'accordo?» (solo concordato; `ConcordatoRangeCheck`, `CanoneConcordatoCalculator`). Risponde dal
  calcolo che il server ha fatto alla creazione del contratto (`concordatoAssessment`) e lascia ricalcolare con altri dati.
- `attestation` e `imu` — la guida all'attestazione (le organizzazioni dell'accordo) e la comunicazione IMU al comune: si aprono dai consigli,
  non sono strumenti a sé.

## La voce di un consiglio

```ts
{
  id: 'liberoFirstExpiry',                 // stabile; è anche il nome del blocco dei testi
  types: ['Libero'],                       // libero 4+4, concordato 3+2, transitorio
  phases: ['active', 'expiring'],          // draft · signing · toRegister · active · expiring · concluded
  when: (f) => !f.noticeRecorded && !f.terminated && !f.termRenewed,   // condizioni sui dati
  priority: byPhase({ expiring: 28 }, 62), // più basso = prima; una funzione se una scadenza lo rende più urgente
  needsRules: true,                        // i testi citano cifre delle regole del server: aspetta che arrivino
  action: operation('disdetta'),           // il gesto: scheda, finestra (?azione=), operazione (?operazione=), strumento, pagina ufficiale, ricevuta
  sources: ['law431'],                     // sotto «Perché?»
}
```

Un'altra voce facoltativa è `coveredBy`: i codici del passo di «Cosa devi fare ora» che già dicono la stessa cosa (la voce `extraEu` tace
quando il passo è la comunicazione alla Questura). Le fasi sono quelle del server (`LeaseStage`) raggruppate in sei momenti (`phaseOf`); se
il server non risponde si usa lo stato del contratto. Le priorità: la registrazione scaduta (4) e il deposito oltre il limite (9) passano avanti a tutto; il resto del momento sta
tra 40 e 60; i consigli «di sfondo» oltre 60.

## Come si aggiunge un consiglio

1. Una voce in `ADVICE_CATALOGUE` (sopra): tipi, fasi, condizioni, priorità, gesto, fonti.
2. I testi `leaseGuide.advice.<id>.{title, body, why, action}` in `src/i18n/locales/it.json` e `en.json`: stesse chiavi e stessi segnaposto,
   in ordine alfabetico, mai `defaultValue`. Il titolo è corto (spesso una domanda); il testo una o due frasi in italiano semplice che
   dicono **che cosa fare e per chi** (tu, il commercialista, il comune, l'Agenzia delle Entrate); «Perché?» spiega e rimanda alle fonti.
3. Le fonti: `SOURCES` (e `leaseGuide.source.<id>` nelle due lingue). Solo pagine e leggi che il progetto già cita
   (`.claude/context/regulations/` del backend); una legge senza indirizzo si nomina e non si collega.
4. Il test `advice-catalogue.test.ts` controlla da solo che gli id siano unici, che ogni voce abbia i testi nelle due lingue con gli stessi
   segnaposto, che i segnaposto siano numeri che la guida sa dare e che una voce con cifre aspetti le regole.

Regole di contenuto (decisioni LR-D29 e LR-D20):

- **Nessuna cifra di legge scritta nell'interfaccia** se il server può darla: giorni di registrazione, mesi di preavviso, mesi di rinnovo, tetto del
  deposito, durata del transitorio vengono da `GET /long-rent/rules` e nei testi sono `{{registrationDays}}`, `{{noticeMonths}}`… (`guideValues`).
- Dove una cifra o una condizione non è univoca nei documenti del progetto, il consiglio non la scrive e manda al commercialista. Non si inventano
  numeri.
- Sono **suggerimenti senza data certa**: la guida non crea scadenze né promemoria (LR-D20) e non scrive a nessuno.
- Il nome del fornitore del modulo guidato e la parola «partner» non compaiono in nessun testo (`src/i18n/no-supplier-name.test.ts`).

## Le operazioni (LR-OPS-1)

Sotto gli strumenti, la guida ha l'area **Operazioni**: ciò che il locatore può fare ora sulla fine del contratto, una riga per operazione con
una frase di stato e un pulsante che apre una finestra. Ogni operazione dice **quando** serve (la scadenza calcolata dal server), prepara
**una bozza di lettera** con i dati del contratto (un PDF da scaricare, firmare e spedire) e dice **cosa fare dopo**. CasaZen non spedisce
nulla: «Segna come inviata» scrive solo una riga nella cronologia. Il testo di una lettera è una **bozza non approvata** finché il PO non
l'approva sull'host (`LeaseLetters__Variants__…`, runbook `lease-operations.md` del backend): il PDF porta la filigrana «BOZZA — testo non
ancora approvato» e la finestra lo dice in una frase.

| File (`src/features/leases/operations/`) | Cosa fa |
|---|---|
| `lease-operations.tsx` | L'area: legge `GET /leases/:id/operations` (`useLeaseOperations`), mostra le righe disponibili (disdetta, rinnovo, conferma dell'esigenza, recesso) e apre la finestra dall'indirizzo `?operazione=disdetta`, `rinnovo`, `conferma-esigenza` o `recesso`. Senza il permesso `lease.create`, senza nulla da fare o se la risposta fallisce non c'è nessuna sezione. |
| `operation-ids.ts` | I nomi delle operazioni (`LEASE_OPERATIONS`) e il parametro dell'indirizzo; nessun import, perché il catalogo dei consigli e la tabella dei passi li nominano senza trascinarsi dietro le finestre. |
| `disdetta-dialog.tsx` | «Prepara la disdetta»: quando finisce il contratto e entro quando la lettera è in tempo (dal server), il motivo di legge alla prima scadenza (l'unico campo) e «Scarica la bozza». Sotto, «Dopo l'invio»: «Segna come inviata» e il rimando a «Registra la disdetta» (l'azione che ferma il rinnovo). |
| `withdrawal-dialog.tsx` | «Registra il recesso dell'inquilino»: giorno di ricezione, motivo, preavviso del contratto (solo per la facoltà); mostra dove finisce il contratto (anteprima di ciò che calcola il server) e non va avanti se il preavviso scade oltre il periodo in corso. Registrato, la riga offre «Presa d'atto e prossimi passi». |
| `renewal-dialog.tsx` | «Registra il rinnovo» (1b): rinnovo standard (mesi e date dal server) o proroga a un giorno concordato, con l'avviso (stesso di LR-OVERLAP) se un altro contratto dell'immobile è in mezzo; sposta la fine e allunga il piano dei canoni. La finestra si apre solo nell'ultimo tratto prima della fine (`renewal.available`); registrato, la riga offre «Accordo e prossimi passi» (piano già esteso, comunicazione all'Agenzia delle Entrate, bozza dell'accordo da far firmare) finché non si apre la finestra del periodo dopo. |
| `need-confirmation-dialog.tsx` | «Conferma l'esigenza» (1b): per un transitorio la cui esigenza è del locatore, entro quando va spedita la lettera (l'ultimo giorno del contratto: il termine esatto lo conferma il commercialista) e «Scarica la bozza»; sotto, «Segna come inviata». Se l'esigenza è del conduttore non c'è né riga né lettera. |
| `use-sheet-operations.ts` | La query delle operazioni per chi sta sulla scheda (l'area e la guida, per il consiglio che ne dipende): una sola richiesta al server. |
| `letter-sent-form.tsx` | «Segna come inviata»: giorno e mezzo, un evento nella cronologia e nient'altro. |

Dal catalogo dei consigli e dalla tabella dei passi si arriva alle operazioni con `operation('disdetta')` (azione `kind: 'operation'`; il consiglio
`transitorioConfirmNeedLandlord` porta a `operation('conferma-esigenza')` solo quando l'esigenza è del locatore, fatto `landlordConfirmsNeed` che viene
dalle operazioni) e con il
bersaglio `{ kind: 'operation', operation: 'disdetta' }` di `lease-next-step.ts` (`operationPath`). Nessun mese e nessun giorno di legge è scritto qui: i
mesi di preavviso e i giorni per comunicare la fine all'Agenzia delle Entrate vengono da `GET /long-rent/rules`; le date calcolate, dal server.

## Cosa non c'è

La guida non mostra un consiglio che un passo di «Cosa devi fare ora» già dice (`coveredBy`), non ripete il blocco «Contratto registrato: ora
fai valere le agevolazioni» (è il primo consiglio di un concordato registrato: `RegisteredBenefits`, variante `plain`) e non sostituisce il
commercialista: ogni consiglio con effetto fiscale lo rimanda a lui.
