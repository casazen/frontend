/**
 * The checkout started in this browser tab (BK-07, A3-15). If the guest goes back to the checkout form and books the same
 * dates again, their own hold makes the backend answer 409: the checkout page then offers to go back to that booking
 * instead. Kept in `sessionStorage` (this tab only, gone when it is closed); every access may throw (private mode,
 * blocked storage), and then nothing is remembered.
 */
export interface PendingCheckout {
  bookingId: string;
  token: string;
  orgSlug: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
}

const STORAGE_KEY = 'casazen.pendingCheckout';

function isPendingCheckout(value: unknown): value is PendingCheckout {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return ['bookingId', 'token', 'orgSlug', 'propertyId', 'checkIn', 'checkOut'].every(
    (key) => typeof entry[key] === 'string' && entry[key] !== '',
  );
}

export function savePendingCheckout(entry: PendingCheckout): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Storage unavailable: the guest can still use the outcome page they are sent to.
  }
}

/** The checkout of these dates started in this tab, if any. */
export function findPendingCheckout(propertyId: string, checkIn: string, checkOut: string): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const entry: unknown = raw ? JSON.parse(raw) : null;
    if (!isPendingCheckout(entry)) return null;
    return entry.propertyId === propertyId && entry.checkIn === checkIn && entry.checkOut === checkOut ? entry : null;
  } catch {
    return null;
  }
}

/** Forgets the checkout once its outcome is final. */
export function clearPendingCheckout(bookingId: string): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const entry: unknown = raw ? JSON.parse(raw) : null;
    if (!isPendingCheckout(entry) || entry.bookingId === bookingId) sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to forget.
  }
}
