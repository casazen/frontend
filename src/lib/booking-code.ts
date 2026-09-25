/**
 * Booking code of "Le mie prenotazioni" (BK-11): 10 characters of the Crockford base32 alphabet (digits and letters
 * without I, L, O, U), shown as `XXXXX-XXXXX`. It is in the confirmation email and on the checkout outcome page.
 *
 * Mirror of the backend `Casazen.Core/Services/BookingCodes.cs`: keep the two in sync. The backend normalizes again and
 * answers a code in a wrong format like a code that does not exist.
 */

export const BOOKING_CODE_LENGTH = 10;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Every whitespace and every hyphen/dash: ignored in a code. */
const SEPARATORS = /[\s\u0085\-‐-―−]/g;

/** Characters a person may read for others: O as zero, I and L as one. */
const LOOKALIKES: Record<string, string> = { O: '0', I: '1', L: '1' };

/**
 * Stored form of what a guest typed or pasted (spaces and dashes removed, upper case, O → 0, I/L → 1), or `null` when
 * it is not a booking code.
 */
export function normalizeBookingCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value
    .replace(SEPARATORS, '')
    .toUpperCase()
    .replace(/[OIL]/g, (c) => LOOKALIKES[c]);
  if (compact.length !== BOOKING_CODE_LENGTH) return null;
  return [...compact].every((c) => ALPHABET.includes(c)) ? compact : null;
}

/** The code as shown to people (`XXXXX-XXXXX`), or `null` when the value is not a booking code. */
export function formatBookingCode(value: string | null | undefined): string | null {
  const code = normalizeBookingCode(value);
  return code === null ? null : `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** True when the value, once normalized, is a booking code. */
export function isValidBookingCode(value: string | null | undefined): boolean {
  return normalizeBookingCode(value) !== null;
}
