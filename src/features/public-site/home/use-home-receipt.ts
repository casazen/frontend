import { addDays, todayInRome } from '@/lib/stay-dates';
import { cheapestCard } from '@/features/public-site/cards/house-card-model';
import { useOrgStays, usePublicStayQuote } from '@/queries/use-public-stays';
import type { DirectBookingQuote } from '@/types';
import type { PublicStayCard } from '@/types/public-stays.types';

/** The example of the home is for two adults and, at least, three nights. */
const RECEIPT_ADULTS = 2;
const RECEIPT_MIN_NIGHTS = 3;

export interface HomeReceipt {
  card: PublicStayCard;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  quote: DirectBookingQuote;
}

/**
 * The real example of «Perché prenotare direttamente» (DB-07b): the cheapest home of the site on its first free nights, priced by
 * the server. The home is the one with the lowest night; the nights are its first free stay of the length of its minimum (three
 * at least), found by asking the search of the site for the days after tomorrow, which says for each home when it is free next;
 * the amounts are the quote of that stay, the same call the checkout makes. Nothing is added up on the page. It is three calls in
 * a row, none of them above the fold, and the example simply is not there while they are not done or when one fails (there is no
 * home free in the next months, the quote is refused): a section that shows an invented example is worse than one without.
 */
export function useHomeReceipt(slug: string, cards: readonly PublicStayCard[]): HomeReceipt | null {
  const cheapest = cheapestCard(cards);
  const nights = Math.max(RECEIPT_MIN_NIGHTS, cheapest?.availability.minNights ?? 1);
  const from = addDays(todayInRome(), 1);

  const week = useOrgStays(
    slug,
    { checkIn: from, checkOut: addDays(from, nights), adults: RECEIPT_ADULTS },
    { enabled: Boolean(cheapest) },
  );
  const row = week.data?.items.find((card) => card.id === cheapest?.id);
  const checkIn = row ? (row.availability.available ? from : (row.availability.firstFreeCheckIn ?? null)) : null;
  const checkOut = checkIn ? addDays(checkIn, nights) : null;

  const quote = usePublicStayQuote(
    cheapest && checkIn && checkOut
      ? {
          propertyId: cheapest.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numberOfAdults: RECEIPT_ADULTS,
          numberOfChildren: 0,
        }
      : null,
  );

  if (!cheapest || !checkIn || !checkOut || !quote.data) return null;
  return { card: cheapest, checkIn, checkOut, nights: quote.data.nights, adults: RECEIPT_ADULTS, quote: quote.data };
}
