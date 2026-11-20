/**
 * The texts the loader draws in the page of an agency's website (NF-145, NF-146). Italian and English only, the two languages of the plugin and of the
 * booking site: the page that includes the script asks for one with `lang` (`it`, `en`, or `auto`, the `<html lang>` of the page).
 *
 * Plain objects, not i18next: the loader is a few kilobytes with no dependency, and it runs in a page that has no copy of the app's dictionaries.
 * A text never names another booking system and never speaks of a conversion of currency (a property keeps its own).
 */

export type EmbedLang = 'it' | 'en';

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
