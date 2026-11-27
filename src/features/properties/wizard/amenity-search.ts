import type { AmenityCatalogEntry } from '@/types';

function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesAmenity(entry: Pick<AmenityCatalogEntry, 'label'>, query: string): boolean {
  const words = normalise(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const labels = normalise(`${entry.label.it} ${entry.label.en}`);
  return words.every((word) => labels.includes(word));
}
