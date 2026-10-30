/**
 * The starter texts of the editor of the showcase (SP-13d, rule of `ANALISI.md` §16 and decision VT-D20): a sentence, an introduction and a
 * few tips for "prima che arriviamo", per trade, so that a page does not start blank. They are a text of CasaZen on a page of the
 * supplier, so they say **only what is true of any supplier of that trade by the nature of the job**: what the work is. Never a
 * certification, a guarantee, an insurance, a number of years, a time, a price, a rating, a promise or an adjective that is not measured
 * ("professionale", "esperto", "in 24 ore"). They are offered by a button, never filled in by themselves, and the supplier reads and
 * changes them before publishing; nothing is public until it is. No starter question and answer: those would have to be true for the
 * platform and reviewed by the product owner first (VT-D20), and none is.
 */
export interface StarterContent {
  /** The sentence in large type (at most 90 characters, the limit of the server). */
  tagline: string;
  /** The line under the title (180). */
  intro: string;
  /** "Prima che arriviamo": what the customer can get ready (6 items, 160 each). */
  prep: string[];
}

const CLEANING: StarterContent = {
  tagline: 'Pulizie per case vacanza e appartamenti',
  intro: 'Pulizie tra un check-out e un check-in, per case vacanza e appartamenti.',
  prep: ['Lascia le chiavi nella cassetta o al portiere e indica come accedere.', 'Metti al sicuro oggetti preziosi e documenti.', 'Se ci sono stanze da non toccare, segnalalo prima.'],
};

const LAUNDRY: StarterContent = {
  tagline: 'Lavanderia e biancheria per case vacanza',
  intro: 'Lavaggio e cura della biancheria di case vacanza e appartamenti.',
  prep: ['Metti la biancheria sporca in un sacco, separata da quella pulita.', 'Indica dove ritirarla e quando.'],
};

/** Per code of the service categories of the backend catalog. A trade with no entry (events, rental, excursions) gets no starter. */
const STARTER_BY_CATEGORY: Readonly<Record<string, StarterContent>> = {
  cleaning: CLEANING,
  laundry: LAUNDRY,
  linen: LAUNDRY,
  plumbing: {
    tagline: 'Interventi idraulici per la casa',
    intro: 'Perdite, rubinetti, scarichi e piccoli guasti in casa.',
    prep: ["Chiudi il rubinetto generale dell'acqua se la perdita è importante.", 'Libera lo spazio intorno al punto da riparare.', 'Se puoi, allega una foto del guasto: aiuta a portare i pezzi giusti.'],
  },
  electrical: {
    tagline: 'Interventi sugli impianti elettrici',
    intro: 'Guasti, prese, quadri e luci in casa e negli appartamenti.',
    prep: ['Fai in modo che il quadro elettrico sia raggiungibile.', 'Lascia libere le prese e i punti luce su cui si deve intervenire.', "Se si deve togliere la corrente, avvisa chi abita nell'edificio."],
  },
  gardening: {
    tagline: 'Cura di giardini e uliveti',
    intro: 'Siepi, prati, potature e manutenzione stagionale di giardini, ville e case vacanza.',
    prep: ['Libera il giardino da mobili e vasi leggeri.', 'Indica dove portare il verde di risulta.', 'Segnala la presenza di impianti di irrigazione interrati.'],
  },
  'check-in': {
    tagline: 'Accoglienza degli ospiti nelle case vacanza',
    intro: "Consegna delle chiavi e accoglienza degli ospiti all'arrivo.",
    prep: ['Lascia il codice della cassetta o le chiavi.', "Comunica l'orario previsto di arrivo degli ospiti."],
  },
  maintenance: {
    tagline: 'Piccole manutenzioni per la casa',
    intro: 'Rubinetti, maniglie, silicone e piccole riparazioni.',
    prep: ['Lascia libero lo spazio di lavoro.', 'Descrivi cosa non funziona: se puoi, aggiungi una foto.'],
  },
};

/** The starter of the first category of the profile that has one, in the order of the profile; null when none has. */
export function starterContentFor(categories: readonly string[] | undefined): StarterContent | null {
  for (const category of categories ?? []) {
    const starter = STARTER_BY_CATEGORY[category];
    if (starter) return starter;
  }
  return null;
}
