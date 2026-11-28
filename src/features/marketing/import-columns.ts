export const IMPORT_FIELDS = ['name', 'email', 'phone', 'language', 'country', 'lastStay', 'firstStay', 'tags'] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ColumnMapping = Partial<Record<ImportField, number>>;

export type ImportBasis = 'consent' | 'softOptIn' | 'serviceOnly';
export const IMPORT_BASES: readonly ImportBasis[] = ['consent', 'softOptIn', 'serviceOnly'];

const MAX_FILE_BYTES = 2 * 1024 * 1024;

interface HeaderNames {
  exact: readonly string[];
  words: readonly string[];
}

const HEADER_NAMES: Record<ImportField, HeaderNames> = {
  email: {
    exact: ['email', 'e mail', 'mail', 'indirizzo email', 'indirizzo e mail', 'posta elettronica', 'email address'],
    words: ['email', 'mail'],
  },
  phone: {
    exact: ['telefono', 'cellulare', 'numero di telefono', 'phone', 'phone number', 'mobile', 'tel', 'cell', 'whatsapp'],
    words: ['telefono', 'cellulare', 'phone', 'mobile', 'whatsapp'],
  },
  name: {
    exact: ['nome', 'nome e cognome', 'nome cognome', 'cognome e nome', 'nominativo', 'nome completo', 'name', 'full name', 'guest name', 'ospite', 'cliente', 'guest'],
    words: ['nome', 'name', 'nominativo', 'ospite', 'cliente', 'guest'],
  },
  language: {
    exact: ['lingua', 'language', 'lang', 'idioma'],
    words: ['lingua', 'language', 'idioma'],
  },
  country: {
    exact: ['paese', 'nazione', 'nazionalita', 'country', 'nation', 'nationality'],
    words: ['paese', 'nazione', 'nazionalita', 'country'],
  },
  lastStay: {
    exact: ['ultimo soggiorno', 'data ultimo soggiorno', 'last stay', 'ultima visita', 'last visit', 'ultimo arrivo', 'check out', 'checkout', 'partenza', 'data partenza', 'data di partenza', 'laststay'],
    words: [],
  },
  firstStay: {
    exact: ['primo soggiorno', 'data primo soggiorno', 'first stay', 'primo arrivo', 'prima visita', 'first visit', 'check in', 'checkin', 'arrivo', 'data arrivo', 'data di arrivo', 'firststay'],
    words: [],
  },
  tags: {
    exact: ['tag', 'tags', 'etichetta', 'etichette', 'categoria', 'categorie'],
    words: ['tag', 'tags', 'etichetta', 'etichette'],
  },
};

const CLAIM_ORDER: readonly ImportField[] = ['email', 'phone', 'name', 'lastStay', 'firstStay', 'language', 'country', 'tags'];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function detectColumns(headers: readonly string[]): ColumnMapping {
  const names = headers.map(normalize);
  const mapping: ColumnMapping = {};
  const taken = new Set<number>();

  const claim = (field: ImportField, matches: (name: string) => boolean) => {
    if (mapping[field] !== undefined) return;
    const index = names.findIndex((name, position) => !taken.has(position) && matches(name));
    if (index < 0) return;
    mapping[field] = index;
    taken.add(index);
  };

  for (const field of CLAIM_ORDER) claim(field, (name) => HEADER_NAMES[field].exact.includes(name));
  for (const field of CLAIM_ORDER) claim(field, (name) => name.split(' ').some((word) => HEADER_NAMES[field].words.includes(word)));
  return mapping;
}

export function canImport(mapping: ColumnMapping): boolean {
  return mapping.email !== undefined || mapping.phone !== undefined;
}

export function wireMapping(mapping: ColumnMapping): Record<string, number> {
  return Object.fromEntries(Object.entries(mapping).filter((entry): entry is [string, number] => entry[1] !== undefined));
}

export function importFileProblem(file: File): 'type' | 'size' | null {
  if (!/\.(csv|xlsx)$/i.test(file.name)) return 'type';
  return file.size > MAX_FILE_BYTES ? 'size' : null;
}

export interface SampleGuest {
  name: string;
  email: string;
  phone: string;
  country: string;
  lastStay: string;
}

export function sampleGuest(row: readonly string[], mapping: ColumnMapping): SampleGuest {
  const read = (field: ImportField) => {
    const index = mapping[field];
    return index === undefined ? '' : (row[index] ?? '').trim();
  };
  return { name: read('name'), email: read('email'), phone: read('phone'), country: read('country'), lastStay: read('lastStay') };
}

const REASON_KEYS: Record<string, string> = {
  invalid_contact: 'contact',
  invalid_stay_dates: 'dates',
  invalid_profile: 'profile',
};

export function importReasonKey(reason: string): string {
  return `marketingHub.importWizard.reasons.${REASON_KEYS[reason] ?? 'other'}`;
}
