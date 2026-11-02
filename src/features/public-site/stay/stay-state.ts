import { createPath } from 'react-router-dom';
import { mergeBookingSearchParams, parseBookingSearchParams } from '@/lib/booking-url';

/**
 * The stay of the public site as the address keeps it (DB-20): `checkin`, `checkout`, `guests` (all the people, children
 * included), `children` and `pets`. It carries no personal data, and it is what the links between the pages of the site hand over
 * (the search, the property page, the checkout) so that a person never has to choose the dates twice.
 */

/** The query parameter of a pet; the others are those of `booking-url.ts`. */
const PETS_QUERY_KEY = 'pets';

export interface StayState {
  /** First night, `YYYY-MM-DD`; empty while not chosen. */
  checkIn: string;
  /** Day of the departure; empty while not chosen. */
  checkOut: string;
  adults: number;
  children: number;
  pets: boolean;
}

/** What is wrong with a stay that an address carries (a link from an old page, a typed one). */
export type StayProblem = 'checkInPast' | 'checkOutNotAfterCheckIn' | 'overCapacity' | 'petsNotAllowed';

export interface StayLimits {
  /** Today in Europe/Rome. */
  today: string;
  /** Most people the home takes, adults and children together. */
  maxGuests?: number;
  /** False when the home takes no pets; left out when it is not known (a site with many homes: the search says which take them). */
  petsAllowed?: boolean;
}

/** The stay as the address says it, without any check. */
export function readRawStay(search: URLSearchParams): StayState {
  const params = parseBookingSearchParams(search);
  const pets = search.get(PETS_QUERY_KEY)?.trim().toLowerCase();
  return {
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adults: Math.max(1, params.guests - params.children),
    children: params.children,
    pets: pets === '1' || pets === 'true',
  };
}

/**
 * The stay of an address, made sound: dates in the past are dropped (with the departure that depended on them), a departure
 * that is not after the arrival is dropped. More people than the home takes, and a pet that the home does not take, are reported
 * and left as they are, so that the page can say it (the picker stops at the limit when someone changes the guests): a guest who
 * said they travel with a pet is never booked into a home without them as if they had not said it.
 */
export function readStay(search: URLSearchParams, limits: StayLimits): { stay: StayState; problems: StayProblem[] } {
  const raw = readRawStay(search);
  const problems: StayProblem[] = [];
  let { checkIn, checkOut } = raw;

  if (checkIn && checkIn < limits.today) {
    problems.push('checkInPast');
    checkIn = '';
    checkOut = '';
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    problems.push('checkOutNotAfterCheckIn');
    checkOut = '';
  }
  if (!checkIn) checkOut = '';
  if (limits.maxGuests !== undefined && raw.adults + raw.children > limits.maxGuests) problems.push('overCapacity');
  if (raw.pets && limits.petsAllowed === false) problems.push('petsNotAllowed');

  return { stay: { ...raw, checkIn, checkOut }, problems };
}

/**
 * `search` with the changes of `patch` written: the other parameters (the language, the destination) stay, the dates are the
 * same as ever (`checkin`, `checkout`), and the pet is written only when there is one.
 */
export function writeStay(search: URLSearchParams, patch: Partial<StayState>): URLSearchParams {
  const merged = { ...readRawStay(search), ...patch };
  const next = mergeBookingSearchParams(search, {
    checkIn: merged.checkIn,
    checkOut: merged.checkOut,
    guests: Math.max(1, merged.adults) + Math.max(0, merged.children),
    children: Math.max(0, merged.children),
  });
  if (merged.pets) next.set(PETS_QUERY_KEY, '1');
  else next.delete(PETS_QUERY_KEY);
  return next;
}

/** A link to `path` that carries the stay (and the other parameters of `base`, if given). */
export function stayHref(path: string, stay: Partial<StayState>, base: URLSearchParams = new URLSearchParams()): string {
  return createPath({ pathname: path, search: writeStay(base, stay).toString() });
}
