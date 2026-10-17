import type { GuestSession } from '@/types';

/**
 * Where the guest area keeps the session of the guest (DB-06a, decision DB-D21): `sessionStorage` of the tab, one entry **per
 * booking site**, never a cookie. The entry is the token, the end of the session and the booking code: **never the email** (it stays
 * in memory while the page is open). A script on the page could read the token, so it is short-lived (two hours by default) and
 * "Esci" removes it; an entry that has expired is dropped when it is read.
 */
const KEY_PREFIX = 'casazen.guestSession.';

function storageKey(siteSlug: string): string {
  return `${KEY_PREFIX}${siteSlug}`;
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    // Storage refused (blocked cookies, some private modes): the session then lives in memory for the page only.
    return null;
  }
}

function isGuestSession(value: unknown): value is GuestSession {
  if (typeof value !== 'object' || value === null) return false;
  const { accessToken, expiresAt, bookingCode } = value as Record<string, unknown>;
  return typeof accessToken === 'string' && typeof expiresAt === 'string' && typeof bookingCode === 'string';
}

/** True while the session works: it ends at `expiresAt`, an instant that cannot be read ends it too. */
export function isGuestSessionActive(session: GuestSession, now: number = Date.now()): boolean {
  const end = Date.parse(session.expiresAt);
  return Number.isFinite(end) && end > now;
}

/** The session kept for the site, or `null` when there is none, it has expired or the entry is not a session. */
export function readGuestSession(siteSlug: string): GuestSession | null {
  const store = sessionStore();
  if (!store) return null;

  try {
    const raw = store.getItem(storageKey(siteSlug));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (isGuestSession(parsed) && isGuestSessionActive(parsed)) return parsed;
    store.removeItem(storageKey(siteSlug));
  } catch {
    // An unreadable entry is as good as none.
  }
  return null;
}

export function writeGuestSession(siteSlug: string, session: GuestSession): void {
  try {
    sessionStore()?.setItem(storageKey(siteSlug), JSON.stringify(session));
  } catch {
    // Full or refused storage: the session stays in memory.
  }
}

/** Forgets the session of the site (sign out, or the server refused the token). */
export function clearGuestSession(siteSlug: string): void {
  try {
    sessionStore()?.removeItem(storageKey(siteSlug));
  } catch {
    // Nothing to forget.
  }
}
