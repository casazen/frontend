import type { TFunction } from 'i18next';
import { buildPropertyBookingPath } from '@/lib/booking-url';
import { formatDayMonth } from '@/features/public-site/stay/stay-format';
import { stayHref, type StayState } from '@/features/public-site/stay/stay-state';
import type {
  PublicLocalizedText,
  PublicStayCard,
  PublicStayTaxState,
} from '@/types/public-stays.types';

/**
 * What a card of a home decides before it draws anything (DB-07b, DB-07c): which words, which price, which label. All of it from
 * the data of the server; nothing here adds up a price or guesses a fact (D24: no sentence on the page that is not true).
 */

/** A text of the host in the language of the page: the English one when there is one, else the Italian (DB-D8). */
export function localizedText(value: string | PublicLocalizedText | null | undefined, language: string | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  const english = language?.toLowerCase().startsWith('en') ? value.en?.trim() : '';
  return english || value.it?.trim() || '';
}

/** Where the home is: the zone the host wrote, else the comune. */
export function placeOfCard(card: Pick<PublicStayCard, 'zone' | 'comune'>, language: string | undefined): string {
  return localizedText(card.zone, language) || card.comune?.trim() || '';
}

/** A «Preferita dagli ospiti» needs a high mark given by enough guests: a mark from one or two of them says nothing. */
export const FAVOURITE_MIN_AVERAGE = 4.8;
export const FAVOURITE_MIN_REVIEWS = 5;

export function isGuestFavourite(card: Pick<PublicStayCard, 'rating'>): boolean {
  const rating = card.rating;
  return Boolean(rating && rating.count >= FAVOURITE_MIN_REVIEWS && rating.average >= FAVOURITE_MIN_AVERAGE);
}

/** The price line of a card: the lowest night while no dates are chosen, the total of the quote once they are. */
export type CardPrice =
  | { kind: 'from'; perNightCents: number }
  | { kind: 'total'; totalCents: number; perNightCents: number; nights: number; tax: PublicStayTaxState };

/**
 * `nights` comes from the answer of the search (`result.nights`). A home that is not free for the stay, or that the quote refuses,
 * has no total: its card falls back to the night price.
 */
export function cardPrice(card: Pick<PublicStayCard, 'price'>, nights: number | null | undefined): CardPrice {
  const { totalCents, perNightCents, includesTouristTax } = card.price;
  if (nights && nights > 0 && typeof totalCents === 'number' && totalCents > 0) {
    return { kind: 'total', totalCents, perNightCents, nights, tax: includesTouristTax ?? 'notIncluded' };
  }
  return { kind: 'from', perNightCents };
}

/** The last day of the free cancellation, only when the guest can really use it (the dates are a promise the system keeps). */
export function freeCancellationUntil(card: Pick<PublicStayCard, 'cancellation'>): string | null {
  const cancellation = card.cancellation;
  if (!cancellation?.selfServiceAvailable || !cancellation.fullRefundUntil) return null;
  return cancellation.fullRefundUntil;
}

/** The facts of a home worth a line, in the order a guest looks for them; a number the home did not say is left out. */
export function cardFacts(card: Pick<PublicStayCard, 'maxGuests' | 'bedrooms' | 'bathrooms' | 'areaSqm'>): {
  guests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqm: number | null;
} {
  const positive = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);
  return {
    guests: positive(card.maxGuests),
    bedrooms: positive(card.bedrooms),
    bathrooms: positive(card.bathrooms),
    areaSqm: positive(card.areaSqm),
  };
}

/** The page of the home on the booking site, carrying the stay when dates are chosen (the guest never chooses them twice). */
export function cardLink(orgSlug: string, card: Pick<PublicStayCard, 'id' | 'slug'>, stay: StayState | null): string {
  const path = buildPropertyBookingPath(orgSlug, card);
  return stay && stay.checkIn && stay.checkOut ? stayHref(path, stay) : path;
}


/** The home that costs least per night, for the examples that need one (the receipt of the home, the zones). */
export function cheapestCard<T extends Pick<PublicStayCard, 'price'>>(cards: readonly T[]): T | undefined {
  return cards.reduce<T | undefined>(
    (best, card) => (best === undefined || card.price.perNightCents < best.price.perNightCents ? card : best),
    undefined,
  );
}

/**
 * Why a home is not free for the stay, in a sentence that also says what to do about it («Libera dal 12 novembre», «Soggiorno minimo
 * 3 notti»); `null` for a home that is free. The server gives the reason, the first free day and the minimum stay; nothing is guessed.
 */
export function availabilityNote(
  card: Pick<PublicStayCard, 'availability' | 'maxGuests'>,
  t: TFunction,
  locale: string,
): string | null {
  const { available, reason, minNights, firstFreeCheckIn } = card.availability;
  if (available) return null;
  switch (reason) {
    case 'busy':
      return firstFreeCheckIn
        ? t('siteHome.card.freeFrom', { date: formatDayMonth(firstFreeCheckIn, locale) })
        : t('siteHome.card.busy');
    case 'min_nights':
      return t('siteHome.card.minNights', { count: minNights ?? 1 });
    case 'guests':
      return t('siteHome.card.tooManyGuests', { count: card.maxGuests });
    case 'pets':
      return t('siteHome.card.noPets');
    case 'not_bookable':
      return t('siteHome.card.notBookable');
    default:
      return t('siteHome.card.busy');
  }
}
