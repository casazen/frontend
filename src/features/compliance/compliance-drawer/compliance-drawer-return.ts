import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { isHttpsAddress } from '@/lib/onboarding-panel';
import { isRelativeAppRoute } from './compliance-drawer-model';

/**
 * The way out of CasaZen and back in, for «Verifica nel tuo Cassetto Compliance» (CHK-15, E03/F05/US02).
 *
 * Out: the host leaves in the SAME tab (`openDestination`: top-level navigation to the one address the server returned; never an iframe, a
 * new tab or `window.open`), after the tab has kept where to come back to. That record holds the relative route, its filters and the id of
 * the handoff, and nothing else: no name, no outcome, no credential. It is `sessionStorage`, so it dies with the tab.
 *
 * Back: when CasaZen is loaded again (the browser's back, or a normal navigation) the record is read ONCE and forgotten: the shell leads to the
 * route with its filters, the control that started the handoff takes the focus, and the page says «Bentornato nel Cassetto Compliance». The
 * return asks nothing («È stato inviato?»), records no result and changes no compliance state: what the connected area shows stays there.
 */

/** Where the tab keeps the record of a handoff in progress. */
export const RETURN_STORAGE_KEY = 'cz-compliance-drawer-return';

/** How long a record may be restored when the server does not say (the server's default is an hour). */
const FALLBACK_LIFETIME_MS = 60 * 60 * 1000;

/** The longest the id of a handoff (opaque, random) or the key of a control may be in the record. */
const MAX_TOKEN_LENGTH = 200;

/** The longest the filters (the query string) of the route may be in the record. */
const MAX_FILTERS_LENGTH = 1024;

/** How long, after the return, the control that started the handoff may still take the focus (its row may need a moment to load). */
const FOCUS_WINDOW_MS = 15_000;

/** What the tab keeps while the host is away. */
export interface SavedReturn {
  handoffId: string;
  /** The page the host comes from: a relative route of the app, without its query. */
  route: string;
  /** The query string of that page (`''` or `?…`): its filters. */
  filters: string;
  /** The key of the control that started the handoff (`originKeyOf`): it takes the focus when the host is back. */
  origin: string;
  /** Until when it may be restored (ms since the epoch). */
  expiresAt: number;
}

export interface ReturnToSave {
  handoffId: string;
  route: string;
  filters: string;
  origin: string;
  /** The server's `expiresAt` (ISO, UTC). */
  expiresAt: string;
}

const isToken = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_TOKEN_LENGTH && !/\s/.test(value);

const isFilters = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= MAX_FILTERS_LENGTH &&
  (value === '' || (value.startsWith('?') && !/[\s\\]/.test(value) && !value.includes('://')));

/** True when the record holds exactly what it should: the id, a relative route of the app, its filters, the control and a future expiry. */
function isSavedReturn(value: unknown, now: number): value is SavedReturn {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    isToken(record.handoffId) &&
    isRelativeAppRoute(record.route) &&
    !/[?#]/.test(record.route) &&
    isFilters(record.filters) &&
    isToken(record.origin) &&
    typeof record.expiresAt === 'number' &&
    Number.isFinite(record.expiresAt) &&
    record.expiresAt > now
  );
}

/**
 * Keeps where to come back to, before the host leaves. False when the record is not one the shell would restore or the tab cannot keep it
 * (the storage is blocked or full): the host still goes, and comes back by the browser's back button to the page as it was.
 */
export function saveReturn(input: ReturnToSave, now: number = Date.now()): boolean {
  const expires = Date.parse(input.expiresAt);
  const record: SavedReturn = {
    handoffId: input.handoffId,
    route: input.route,
    filters: input.filters,
    origin: input.origin,
    expiresAt: Number.isFinite(expires) ? expires : now + FALLBACK_LIFETIME_MS,
  };
  if (!isSavedReturn(record, now)) return false;
  try {
    window.sessionStorage.setItem(RETURN_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/** Forgets the record: it is restored once, and never after the host has been back. */
export function forgetReturn(): void {
  try {
    window.sessionStorage.removeItem(RETURN_STORAGE_KEY);
  } catch {
    // Nothing to forget if the storage cannot be reached.
  }
}

/** The record of the tab, or `null` when there is none, it cannot be read, it is not what it should be or it has expired (and then it is forgotten). */
export function readReturn(now: number = Date.now()): SavedReturn | null {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(RETURN_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (isSavedReturn(value, now)) {
      // Only the fields of the record: whatever else the storage held is not carried on.
      return { handoffId: value.handoffId, route: value.route, filters: value.filters, origin: value.origin, expiresAt: value.expiresAt };
    }
  } catch {
    // Not JSON: the same as a record that is not valid.
  }
  forgetReturn();
  return null;
}

/**
 * The one way out of CasaZen: the same tab, to the address the server returned. An address that is not https is never opened (false: the host
 * stays in CasaZen). The address is opened exactly as it came; nothing is added to it: no property, no stay, no person.
 */
export function openDestination(address: string): boolean {
  if (!isHttpsAddress(address)) return false;
  window.location.assign(address);
  return true;
}

/** A return that has been restored: where the host was put back and which control to give the focus to. */
export interface Arrival {
  route: string;
  filters: string;
  origin: string;
  /** The control has taken the focus (or there is none to take it): it is asked for once. */
  focused: boolean;
}

let arrival: Arrival | null = null;
const listeners = new Set<() => void>();

function publish(next: Arrival | null): void {
  arrival = next;
  listeners.forEach((listener) => listener());
}

export function subscribeArrival(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getArrival(): Arrival | null {
  return arrival;
}

/**
 * Reads the record of the tab ONCE and forgets it: the return of the host. It is called when the shell mounts, and again when the browser brings
 * a page back from its memory (`pageshow`). Without a record it answers the return already taken, if any, so a second call (a render run twice)
 * changes nothing.
 */
export function takeArrival(now: number = Date.now()): Arrival | null {
  const saved = readReturn(now);
  if (saved === null) return arrival;
  forgetReturn();
  publish({ route: saved.route, filters: saved.filters, origin: saved.origin, focused: false });
  // The control is asked for the focus for a short while only: one that is not on the page by then (a row that is gone) never takes it later.
  window.setTimeout(markArrivalFocused, FOCUS_WINDOW_MS);
  return arrival;
}

/** The control of the return has taken the focus: nobody else asks for it again. */
export function markArrivalFocused(): void {
  if (arrival !== null && !arrival.focused) publish({ ...arrival, focused: true });
}

/** The host moved on, or closed the notice: the return is over. */
export function clearArrival(): void {
  if (arrival !== null) publish(null);
}

/** For the tests: the return, and what the tab keeps, as if the page had just loaded. */
export function resetReturnForTests(): void {
  forgetReturn();
  publish(null);
}

/**
 * The control that started a handoff takes the focus when the host is back (a ref for the element). It is asked for once, by the control whose
 * key is the one of the return; a control that is not on the page (a row that is no longer there) never takes it.
 */
export function useReturnFocus<T extends HTMLElement>(origin: string): RefObject<T | null> {
  const ref = useRef<T>(null);
  const current = useSyncExternalStore(subscribeArrival, getArrival, getArrival);
  const wanted = current !== null && !current.focused && current.origin === origin;

  useEffect(() => {
    if (!wanted || ref.current === null) return;
    ref.current.focus();
    markArrivalFocused();
  }, [wanted]);

  return ref;
}
