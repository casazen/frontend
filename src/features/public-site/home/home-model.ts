import { isPositionSet } from '@/features/site-maps';
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

/** A zone of the home page: the comune, its homes, the lowest night among them and where to put the pin. */
export interface HomeZone {
  /** The id of the destination of the comune (the value of the `where` filter), as the server writes it. */
  id: string;
  name: string;
  count: number;
  /** The lowest night of its homes, in cents. */
  fromPerNightCents: number;
  currency: string;
  /** The photo of the first home of the zone. */
  photo?: string;
  /**
   * The middle of its homes that have a position, already rounded to two decimals (about a kilometre): a map never gets a more exact
   * position. `0, 0` (how the data say «not set») when none of them has one: the map then puts the pin at the comune.
   */
  lat: number;
  lon: number;
}

const roundCoordinate = (value: number) => Math.round(value * 100) / 100;

/**
 * The zones of the site: the comuni of the homes (the host's own descriptions of a zone are not in the data of the site yet, so a
 * zone is a name, a count, a price and a photo). The pin is the middle of the rounded positions of its homes, rounded again: the
 * map refuses a position that is more exact than a kilometre. A home whose host never gave a position (`0, 0`) is still in its zone,
 * but its `0, 0` is left out of the middle (it would drag the pin into the Gulf of Guinea). The id is the one of the destination the
 * server knows for the comune.
 */
export function zonesOf(cards: readonly PublicStayCard[], destinations: readonly PublicDestination[] | undefined): HomeZone[] {
  const idOf = new Map((destinations ?? []).map((destination) => [destination.comune.trim().toLowerCase(), destination.id]));
  const groups = new Map<string, PublicStayCard[]>();
  for (const card of cards) {
    const comune = card.comune?.trim();
    if (!comune) continue;
    groups.set(comune, [...(groups.get(comune) ?? []), card]);
  }
  return [...groups.entries()].map(([comune, homes]) => {
    const placed = homes.filter((home) => isPositionSet(home.latitude, home.longitude));
    const middle = (pick: (home: PublicStayCard) => number) => (placed.length > 0 ? roundCoordinate(placed.reduce((sum, home) => sum + pick(home), 0) / placed.length) : 0);
    return {
      id: idOf.get(comune.toLowerCase()) ?? comune,
      name: comune,
      count: homes.length,
      fromPerNightCents: Math.min(...homes.map((home) => home.price.perNightCents)),
      currency: homes[0].price.currency || 'EUR',
      photo: homes.flatMap((home) => home.photos)[0],
      lat: middle((home) => home.latitude),
      lon: middle((home) => home.longitude),
    };
  });
}
