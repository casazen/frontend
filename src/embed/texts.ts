/**
 * The texts the two scripts write in the page of an agency's website: the loader (`LOADER_TEXTS`, NF-145) and the search bar (`SEARCH_TEXTS`, NF-146).
 * Italian and English only, the two languages of the plugin and of the booking site: the page that includes the script asks for one with `lang` (`it`,
 * `en`, or `auto`, the `<html lang>` of the page).
 *
 * Plain objects, not i18next: the scripts are a few kilobytes with no dependency, and they run in a page that has no copy of the app's dictionaries. Each
 * script's bundle takes only its own set (an unused one is dropped by the build, and a test checks it). A text never names another booking system and never
 * speaks of a conversion of currency (a property keeps its own).
 */

export type EmbedLang = 'it' | 'en';

/** The words of `SEARCH_TEXTS`: one set per language. A `{max}` or a `{date}` in a text is where the bar writes the number or the day. */
export interface SearchText {
  /** The name of the search form for a screen reader. */
  form: string;
  where: string;
  anywhere: string;
  when: string;
  addDates: string;
  guests: string;
  fewer: string;
  more: string;
  go: string;
  /** The name of the calendar (a dialog). */
  calendar: string;
  previous: string;
  next: string;
  arrival: string;
  departure: string;
  /** Said after the arrival is chosen, after «Arrivo 12 marzo.». */
  chooseDeparture: string;
  night: string;
  nights: string;
  pastDay: string;
  needDates: string;
  order: string;
  past: string;
  guestsRange: string;
  badTarget: string;
  preview: string;
}

/** What the search bar writes (NF-146): the same words as the search of the booking site, in the two languages of the plugin. */
export const SEARCH_TEXTS: Record<EmbedLang, SearchText> = {
  it: {
    form: 'Cerca disponibilità',
    where: 'Dove',
    anywhere: 'Ovunque',
    when: 'Quando',
    addDates: 'Aggiungi le date',
    guests: 'Ospiti',
    fewer: 'Meno ospiti',
    more: 'Più ospiti',
    go: 'Verifica disponibilità',
    calendar: 'Scegli le date',
    previous: 'Mese precedente',
    next: 'Mese successivo',
    arrival: 'Arrivo',
    departure: 'Partenza',
    chooseDeparture: 'Scegli la partenza.',
    night: 'notte',
    nights: 'notti',
    pastDay: 'giorno passato',
    needDates: 'Scegli il giorno di arrivo e quello di partenza per cercare.',
    order: 'La partenza deve essere dopo l’arrivo.',
    past: 'Questo giorno è già passato: scegli un altro giorno.',
    guestsRange: 'Scegli da 1 a {max} ospiti.',
    badTarget: 'Non riusciamo ad aprire la pagina di ricerca: l’indirizzo non è valido.',
    preview: 'Anteprima: la ricerca non apre la pagina di prenotazione.',
  },
  en: {
    form: 'Search availability',
    where: 'Where',
    anywhere: 'Anywhere',
    when: 'When',
    addDates: 'Add the dates',
    guests: 'Guests',
    fewer: 'Fewer guests',
    more: 'More guests',
    go: 'Check availability',
    calendar: 'Choose the dates',
    previous: 'Previous month',
    next: 'Next month',
    arrival: 'Arrival',
    departure: 'Departure',
    chooseDeparture: 'Choose the departure.',
    night: 'night',
    nights: 'nights',
    pastDay: 'day gone by',
    needDates: 'Choose the day of arrival and the day of departure to search.',
    order: 'The departure must be after the arrival.',
    past: 'This day has already gone by: choose another day.',
    guestsRange: 'Choose from 1 to {max} guests.',
    badTarget: 'We cannot open the search page: the address is not valid.',
    preview: 'Preview: the search does not open the booking page.',
  },
};

/** What the loader writes: the title of each frame, the placeholder while it loads, and the lead of the link that replaces it when it does not. */
export const LOADER_TEXTS = {
  it: {
    loading: 'Caricamento…',
    book: 'Prenota su',
    manage: 'Gestisci la tua prenotazione su',
    booking: 'Prenotazione',
    property: 'Scheda alloggio',
    'guest-access': 'Accesso alla prenotazione',
  },
  en: {
    loading: 'Loading…',
    book: 'Book on',
    manage: 'Manage your booking on',
    booking: 'Booking',
    property: 'Property',
    'guest-access': 'Manage your booking',
  },
} as const;
