import type { RatingSummary } from './review.types';

/**
 * The search of the booking site of one host (DB-07a, `GET api/public/orgs/{slug}/stays|calendar|destinations`): every home of the
 * site for a stay, in one call. The prices are the ones of the quote, to the cent (the server adds them up, the page never does).
 */

/** Why a home is not free for the stay asked (the stable `reason` of the backend: never renamed). */
export type PublicStayReason = 'busy' | 'min_nights' | 'guests' | 'pets' | 'past' | 'not_bookable';

/** How much of the tourist tax a price includes: the tax worked out for this party, an estimate, or left out. */
export type PublicStayTaxState = 'exact' | 'estimated' | 'notIncluded';

/** A text of the host in Italian and, when written, in English (DB-D8: an English reader gets the Italian one when there is no English). */
export interface PublicLocalizedText {
  it: string;
  en?: string | null;
}

export interface PublicStayAvailability {
  /** Free for the stay and bookable; `true` when no dates were chosen. */
  available: boolean;
  /** Why not, when it is not free. */
  reason?: PublicStayReason | null;
  /** The minimum stay of the home, `null` for none. */
  minNights?: number | null;
  /** The first check-in day, from the one asked on, for which a stay as long as the one asked is free; `null` when nothing is free in the next months. */
  firstFreeCheckIn?: string | null;
}

export interface PublicStayPrice {
  currency: string;
  /** With dates: the average night of the stay; without: the lowest night of the next 30 days. Cleaning and tax are not in it. */
  perNightCents: number;
  /** The total of the quote of the stay (nights, cleaning, tourist tax when it can be worked out); absent without dates. */
  totalCents?: number | null;
  includesTouristTax?: PublicStayTaxState | null;
}

/** What cancelling costs for the stay asked, in dates of Europe/Rome that are still ahead; absent without dates or a policy. */
export interface PublicStayCancellation {
  fullRefundUntil?: string | null;
  partialRefundPercent?: number | null;
  partialRefundUntil?: string | null;
  /** The guest can cancel by themselves: only then do the dates above become a promise the page can make. */
  selfServiceAvailable: boolean;
}

/** A home of the site as the list shows it. Nothing private: the position is rounded to about a kilometre, there is no address. */
export interface PublicStayCard {
  id: string;
  slug?: string | null;
  name: string;
  comune: string;
  /** The zone the host wrote: a text, or `{ it, en }` once the profile of the site gives it in two languages. */
  zone?: string | PublicLocalizedText | null;
  latitude: number;
  longitude: number;
  /** The first photos, the first is the cover. */
  photos: string[];
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  areaSqm?: number | null;
  /** The main amenities, as the names of the `PropertyAmenity` enum. */
  amenities: string[];
  /** The labels of the home (`mare`, `centro`, `piscina`, `pet`, `campagna`, `terrazza`, `vista-mare`); empty until the host or the data give them. */
  tags: string[];
  /** The number and the average of the public reviews; absent without any. */
  rating?: RatingSummary | null;
  availability: PublicStayAvailability;
  price: PublicStayPrice;
  cancellation?: PublicStayCancellation | null;
}

/** A range of dates near the one asked, as long as the stay, with homes that are free. */
export interface PublicStayAlternative {
  checkIn: string;
  checkOut: string;
  availableCount: number;
  fromPerNightCents: number;
}

export interface PublicStaysResult {
  currency: string;
  checkIn?: string | null;
  checkOut?: string | null;
  nights?: number | null;
  adults: number;
  children: number;
  pets: boolean;
  /** Homes that pass the filters (before the page). */
  totalCount: number;
  /** Of those, the ones that are free for the stay (all when no dates were chosen). */
  availableCount: number;
  page: number;
  pageSize: number;
  /** The free homes first, in the sort asked, then the others by name. */
  items: PublicStayCard[];
  /** Up to three nearby ranges with free homes; empty when some home is free already. */
  alternatives: PublicStayAlternative[];
  /** Filters asked and not applied (`amenities:…`, `rules:…`, `tags:…` of a value no home can have). */
  unsupportedFilters: string[];
  generatedAt: string;
}

/** The sorts of the list (`PublicSiteSearch` of the backend). */
export type PublicStaysSort = 'recommended' | 'priceAsc' | 'priceDesc' | 'rating' | 'largest';

/** The query of the list: the stay, then the filters and the sort. Every part is optional. */
export interface PublicStaysQuery {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  pets?: boolean;
  /** The id of a destination (`GET …/destinations`) or the name of a comune. */
  where?: string;
  /** Lowest and highest price per night, in euros. */
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  minSqm?: number;
  /** Names of `PropertyAmenity`, comma separated: the home has all of them. */
  amenities?: string;
  /** `pets,children,selfCheckin,smoking,parties`, comma separated: the home allows all of them. */
  rules?: string;
  /** Labels of the homes, comma separated: the home has all of them. */
  tags?: string;
  sort?: PublicStaysSort;
  page?: number;
  pageSize?: number;
}

/** One night of the whole site: free when some home that sleeps the party is. */
export interface PublicSiteCalendarDay {
  date: string;
  anyAvailable: boolean;
  /** The cheapest night among the homes that are free; absent when none is. */
  fromPriceCents?: number | null;
  /** The shortest minimum stay among them; absent when none is free. */
  minNights?: number | null;
}

export interface PublicSiteCalendar {
  from: string;
  /** End of the range, excluded. */
  to: string;
  /** Today in Europe/Rome. */
  today: string;
  currency: string;
  adults: number;
  children: number;
  days: PublicSiteCalendarDay[];
  generatedAt: string;
}

/** A place of the site: the comune of some published homes. */
export interface PublicDestination {
  /** The value of the `where` filter of the list. */
  id: string;
  label: string;
  comune: string;
  count: number;
}
