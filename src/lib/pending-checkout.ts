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

export function clearPendingCheckout(bookingId: string): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const entry: unknown = raw ? JSON.parse(raw) : null;
    if (!isPendingCheckout(entry) || entry.bookingId === bookingId) sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to forget.
  }
}
