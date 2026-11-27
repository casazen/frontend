import type { AmenityCatalogEntry } from '@/types';

/** Lower case, without accents and with the spaces collapsed: «Lavatrice», «lavatrìce» and «  LAVATRICE » are the same word. */
function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whether an amenity answers a search by word (NF-33): every word typed is in its Italian or its English label, whichever language the
 * page is in — «lavatrice» finds the washing machine on an English page, «washing» on an Italian one. A blank search finds everything.
 */
export function matchesAmenity(entry: Pick<AmenityCatalogEntry, 'label'>, query: string): boolean {
  const words = normalise(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const labels = normalise(`${entry.label.it} ${entry.label.en}`);
  return words.every((word) => labels.includes(word));
}
