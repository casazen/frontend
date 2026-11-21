import { hasConsent } from '@/lib/cookie-consent';

/**
 * A booking is a `purchase` of the agency's analytics ONCE (NF-149): not when its confirmation page is reloaded, not in a second tab, not when the guest opens
 * the link of the e-mail a week later. What remembers it is this device: the ids of the last bookings pushed, in the own `localStorage` of the agency's domain,
 * the same place as the choice of the visitor about the cookies. Another browser or device has no memory of it (there the `transaction_id` is what GA4 itself
 * uses against a duplicate purchase).
 *
 * The id is an opaque id of the booking, never the code the guest is shown. The list is only written after the visitor allowed statistics, as the choice
 * itself is; a browser that cannot write it counts no purchase at all, because "once" could not be kept (and the choice of such a browser is not kept either).
 * A visitor who withdraws the choice keeps the list: it is never read while the choice is off, and it is what stops the same booking from counting twice if
 * they allow statistics again.
 */

export const PURCHASES_STORAGE_KEY = 'cz-ga4-purchases';

/** How many bookings are remembered: the most recent ones. The list never grows over it. */
export const MAX_REMEMBERED_PURCHASES = 50;

/** The ids already pushed; a list that is not one (an older format, a hand-edited value) is read as empty and is replaced by the next write. */
function readSent(): string[] {
  try {
    const raw = window.localStorage.getItem(PURCHASES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && id !== '') : [];
  } catch {
    return [];
  }
}

function writeSent(ids: string[]): boolean {
  try {
    window.localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs `push` only if the booking `bookingId` was never pushed from this browser, and only after the visitor allowed statistics. The id is remembered BEFORE
 * the push: a crash between the two loses one purchase and never counts one twice. Returns whether `push` ran.
 */
export function purchaseOnce(bookingId: string, push: () => void): boolean {
  if (!bookingId || !hasConsent('statistics')) return false;

  const sent = readSent();
  if (sent.includes(bookingId)) return false;
  if (!writeSent([...sent, bookingId].slice(-MAX_REMEMBERED_PURCHASES))) return false;

  push();
  return true;
}
