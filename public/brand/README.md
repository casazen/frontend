# CasaZen · marchio

Cerchio zen a pennello in terracotta **#e2622d** che incornicia la casa in inchiostro **#1f3a3d**. Wordmark: Figtree 600, minuscolo, tracking −3%.
Su fondo scuro: cerchio #ff9b6b, casa #9fd0cf. Su terracotta o foto: versione bianca.

## Regole
- Spazio di rispetto: almeno la larghezza della casa su ogni lato.
- Dimensione minima: marchio 16 px; lockup 24 px di altezza.
- Non ruotare, non ricolorare fuori dalle varianti elencate, non aggiungere ombre.

## Nell'app e nel sito
Il marchio e il lockup sono il componente `src/components/brand/casazen-mark.tsx` (`CasaZenMark`, `CasaZenLogo`): il colore si sceglie con `tone` (`light`, `dark`, `white`, `mono`) in base allo sfondo, non segue il tema scuro del sistema operativo perché l'app e le pagine pubbliche sono solo chiare. Il wordmark è testo (Inter, minuscolo).

## File di questa cartella
- `marchio.svg`, `marchio-bianco.svg` — marchio da solo (due colori; bianco).
- `lockup.svg`, `lockup-scuro.svg`, `lockup-bianco.svg`, `lockup-verticale.svg` — marchio + wordmark. Il wordmark è testo con Figtree 600 se installato, altrimenti un sans di sistema: per la stampa convertire il testo in tracce.
- `icona-app-1024.png` — icona app (angoli già arrotondati).

Fuori da questa cartella, in `public/`: `favicon.svg`, `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (iOS), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` e `site.webmanifest` (Android e PWA).
