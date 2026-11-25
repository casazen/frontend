# Design system CasaZen

Il workspace, i portali e la vetrina usano la stessa palette CasaZen e la stessa scala di tipografia, raggi e spaziature. L’interfaccia operativa usa Inter. I titoli editoriali della vetrina e del Portale ospiti usano Fraunces. I siti di prenotazione personalizzati continuano a usare i temi scelti dall’host.

| Livello | File | Contenuto |
| --- | --- | --- |
| Fondamenta | [design-foundations.css](../../src/styles/design-foundations.css) | Palette Pietra, Inchiostro e Terracotta, accenti delle aree, font e spaziatura |
| Significato | [tokens.css](../../src/styles/tokens.css), [site.css](../../src/site/site.css) | Colori per testo, sfondo, interazione e stati |
| Componenti | [UI](../../src/components/ui), [Calm](../../src/components/shared/calm), [layout](../../src/components/layout) | Pulsanti, campi, intestazioni, navigazione, azioni e riepiloghi |

## Comporre una pagina

- Usa un titolo e un’azione primaria evidente. Nel workspace, `PageHeader` gestisce la posizione dell’azione e raccoglie le azioni secondarie nel menu.
- Dai priorità a un solo compito con `FocusBlock`. Mostra i riepiloghi con `PlainSection`, `DayList` e `StatStrip`. Apri a richiesta grafici, esempi e dettagli densi.
- Usa le icone Lucide con un’etichetta. Quando l’icona ripete il testo accanto, rendila decorativa. Usa `.cz-icon-tile` per le icone in un riquadro.
- Usa foto reali degli immobili e schermate di prodotto che mostrano il flusso descritto. Riserva lo spazio con dimensioni o proporzioni, carica le immagini secondarie in modalità lazy e descrivi quelle informative. `.cz-media-frame` dà alla vetrina e alle anteprime una cornice comune.
- Verifica a 390, 768 e 1440 px, con tastiera e movimento ridotto. L’azione corrente, l’errore e il completamento devono essere riconoscibili anche dal testo.

## Revisione delle PR

La vetrina della #676 è già in `develop`. Le PR #677–#702 sono state integrate in locale per verificare l’effetto combinato.

| PR | Superfici verificate nel diff |
| --- | --- |
| #677–#682 | Shell, wizard, messaggi, cruscotto host, elenchi, locazioni |
| #683–#688 | Portali, assistenza, direct booking, fornitori, compliance, distribuzione |
| #689–#694 | Backoffice, manutenzione, decisioni host, flussi locazione, finanza |
| #695–#702 | Impostazioni AI, amministrazione, inviti, configurazione host, prenotazioni, check-in, documenti e accesso pubblico |

La #675 è in bozza e parte da un commit precedente alla #676. Tocca cinque file in comune con #677, #680 e #685. La prova di merge sul branch di revisione ha rilevato quattro conflitti in `page-header.tsx`, `card.tsx`, `dashboard-page.tsx` e `vetrina-page.tsx`. Per la revisione integrata sono stati usati il workspace, il cruscotto e la vetrina delle PR più recenti.

La verifica GitHub della #685 ha segnalato due test. Il primo assumeva un editor a tutta altezza anche su mobile, mentre il layout ridisegnato scorre normalmente a quella larghezza. Il secondo leggeva il tag `robots` prima che il relativo effetto React avesse finito. I test locali attendono l’effetto e verificano l’uso della variabile dell’intestazione nel layout desktop.

La #679 ha fatto emergere una sovrapposizione tra notifiche e pulsanti in un wizard su telefono. Nei wizard con schermo basso, le notifiche appaiono sotto l’intestazione e lasciano liberi i comandi del piè di pagina.

I due test segnalati per la #686 dipendevano dalla classe tipografica del nome di un fornitore e dall’uso diretto di `PageHeader`. Il test del catalogo usa ora un selettore stabile, mentre le pagine dei servizi delegano a `PageHeader` icona, titolo e schede.

## App nativa

La [PR mobile #23](https://github.com/casazen/mobile/pull/23) è in bozza. Il diff introduce l’Inchiostro `#1F3A3D` e opzioni comuni per la barra di navigazione. Per allineare il tema nativo alle fondamenta, usa `#FBFAF8` per lo sfondo, `#FFFFFF` per le superfici, `#1F3A3D` per il testo di marca e gli stessi accenti semantici delle aree. Le schermate native continuano a usare componenti e unità di React Native.

Typecheck, lint, unit test e bundle della bozza sono passati su GitHub. Maestro si è fermato durante la connessione all’emulatore Android sulla porta 5554. Il collaudo nativo resta aperto.
