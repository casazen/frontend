import type { Destination } from '@/features/public-site/stay/destination-picker';
import type { PublicDestination, PublicStayCard } from '@/types/public-stays.types';

/**
 * What the home of a booking site works out from the homes the server lists (DB-07b): the numbers of the hero, the limits the
 * search bar needs, the places. Pure functions on the data of the search; nothing is invented, and a figure with nothing behind it
 * is `null` so that the page leaves the sentence out.
 */

export interface SiteRating {
  /** Reviews of all the homes of the site. */
  count: number;
  /** The average of the marks of all of them, one decimal. */
  average: number;
}

/** The mark of the whole site, from the marks of its homes (each weighs as many reviews as it has); `null` while nobody reviewed. */
export function siteRating(cards: readonly Pick<PublicStayCard, 'rating'>[]): SiteRating | null {
  let count = 0;
  let sum = 0;
  for (const { rating } of cards) {
    if (!rating || rating.count <= 0) continue;
    count += rating.count;
    sum += rating.average * rating.count;
  }
  return count > 0 ? { count, average: Math.round((sum / count) * 10) / 10 } : null;
}

/** Most guests any home of the site takes: the search never offers more people than that. `undefined` while the homes are not known. */
export function maxGuestsOf(cards: readonly Pick<PublicStayCard, 'maxGuests'>[]): number | undefined {
  const most = Math.max(0, ...cards.map((card) => card.maxGuests));
  return most > 0 ? most : undefined;
}

/**
 * Whether the switch of the pet is worth offering: some home takes pets. The labels of the homes say it (`pet`); where the host's
 * data give no label at all there is nothing to judge by and the switch stays, since the home itself answers a pet it does not take.
 */
export function petsAllowedOf(cards: readonly Pick<PublicStayCard, 'tags'>[]): boolean {
  if (cards.every((card) => card.tags.length === 0)) return true;
  return cards.some((card) => card.tags.includes('pet'));
}

/** The comuni of the homes, each once, in the order of the list. */
export function comuniOf(cards: readonly Pick<PublicStayCard, 'comune'>[]): string[] {
  const seen = new Set<string>();
  for (const { comune } of cards) {
    const name = comune?.trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

/** `Ostuni, Polignano a Mare e Lecce`: a list in the words of the language of the page. */
export function listOfPlaces(places: readonly string[], locale: string): string {
  if (places.length === 0) return '';
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(places);
  } catch {
    return places.join(', ');
  }
}

/** The places for the «Dove» field, each with how many homes it has (the label is the comune; `sub` is filled by the page, in words). */
export function destinationOptions(destinations: readonly PublicDestination[] | undefined, sub: (count: number) => string): Destination[] {
  return (destinations ?? []).map((destination) => ({ id: destination.id, label: destination.label, sub: sub(destination.count) }));
}
