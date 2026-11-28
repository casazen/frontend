import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { useEmbed } from '@/features/embed/embed-context';
import { embedCampaignOf, embedPropertyHref } from '@/features/embed/embed-urls';
import { buildPropertyBookingPath } from '@/lib/booking-url';
import { formatDayMonth } from '@/features/public-site/stay/stay-format';
import { stayHref, type StayState } from '@/features/public-site/stay/stay-state';
import type {
  PublicLocalizedText,
  PublicStayCard,
  PublicStayTaxState,
} from '@/types/public-stays.types';

export function localizedText(value: string | PublicLocalizedText | null | undefined, language: string | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  const english = language?.toLowerCase().startsWith('en') ? value.en?.trim() : '';
  return english || value.it?.trim() || '';
}

function countryName(code: string, language: string | undefined): string {
  try {
    return new Intl.DisplayNames([language?.toLowerCase().startsWith('en') ? 'en' : 'it'], { type: 'region' }).of(code.toUpperCase()) ?? '';
  } catch {
    return '';
  }
}

export function placeOfCard(card: Pick<PublicStayCard, 'zone' | 'comune' | 'country'>, language: string | undefined): string {
  const place = localizedText(card.zone, language) || card.comune?.trim() || '';
  const country = card.country && card.country.toUpperCase() !== 'IT' ? countryName(card.country, language) : '';
  return place && country ? `${place}, ${country}` : place;
}

export const FAVOURITE_MIN_AVERAGE = 4.8;
export const FAVOURITE_MIN_REVIEWS = 5;

export function isGuestFavourite(card: Pick<PublicStayCard, 'rating'>): boolean {
  const rating = card.rating;
  return Boolean(rating && rating.count >= FAVOURITE_MIN_REVIEWS && rating.average >= FAVOURITE_MIN_AVERAGE);
}

export type CardPrice =
  | { kind: 'from'; perNightCents: number }
  | { kind: 'total'; totalCents: number; perNightCents: number; nights: number; tax: PublicStayTaxState };

export function cardPrice(card: Pick<PublicStayCard, 'price'>, nights: number | null | undefined): CardPrice {
  const { totalCents, perNightCents, includesTouristTax } = card.price;
  if (nights && nights > 0 && typeof totalCents === 'number' && totalCents > 0) {
    return { kind: 'total', totalCents, perNightCents, nights, tax: includesTouristTax ?? 'notIncluded' };
  }
  return { kind: 'from', perNightCents };
}

export function freeCancellationUntil(card: Pick<PublicStayCard, 'cancellation'>): string | null {
  const cancellation = card.cancellation;
  if (!cancellation?.selfServiceAvailable || !cancellation.fullRefundUntil) return null;
  return cancellation.fullRefundUntil;
}

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

export function cardLink(orgSlug: string, card: Pick<PublicStayCard, 'id' | 'slug'>, stay: StayState | null): string {
  const path = buildPropertyBookingPath(orgSlug, card);
  return stay && stay.checkIn && stay.checkOut ? stayHref(path, stay) : path;
}

export type CardLink = (orgSlug: string, card: Pick<PublicStayCard, 'id' | 'slug'>, stay: StayState | null) => string;

/**
 * Where the card of a home (and its pin, and its row in the list of the ones that are not free) leads. On the booking site it is `cardLink`, the page of
 * the home on the site. Inside the frame of an embeddable widget (NF-144) the site is not there: it is the property widget in the same frame, with the
 * stay, `from=booking` and the campaign of the page (`embedPropertyHref`), so that no link of the frame ever leaves it for `/book/…`.
 */
export function useCardLink(): CardLink {
  const embed = useEmbed();
  const { search } = useLocation();
  const campaign = embed ? embedCampaignOf(search) : null;

  return useCallback<CardLink>(
    (orgSlug, card, stay) => (embed ? embedPropertyHref(embed, card, { stay, campaign }) : cardLink(orgSlug, card, stay)),
    [embed, campaign],
  );
}

export function cheapestCard<T extends Pick<PublicStayCard, 'price'>>(cards: readonly T[]): T | undefined {
  return cards.reduce<T | undefined>(
    (best, card) => (best === undefined || card.price.perNightCents < best.price.perNightCents ? card : best),
    undefined,
  );
}

/**
 * Why a home is not free for the stay, in a sentence that also says what to do about it («Libera dal 12 novembre», «Soggiorno minimo
 * 3 notti»); `null` for a home that is free. The server gives the reason, the first free day and the minimum stay; nothing is guessed.
 * The rules the host set on the nights have their own reasons (closed arrival or departure, the most nights, the advance; NF-36): a
 * reason this page does not know is still said as «busy», never left out.
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
    case 'arrival_closed':
      return t('siteHome.card.arrivalClosed');
    case 'departure_closed':
      return t('siteHome.card.departureClosed');
    case 'max_nights':
      return t('siteHome.card.maxNights');
    case 'advance':
      return t('siteHome.card.advance');
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
