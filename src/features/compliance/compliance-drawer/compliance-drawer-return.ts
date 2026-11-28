import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { isHttpsAddress } from '@/lib/onboarding-panel';
import { isRelativeAppRoute } from './compliance-drawer-model';

/**
 * The way out of CasaZen and back in, for «Verifica nel tuo Cassetto Compliance» (CHK-15, E03/F05/US02).
 *
 * Out: the host leaves in the SAME tab (`openDestination`: top-level navigation to the one address the server returned; never an embedded
 * frame, a second window or a new tab), after the tab has kept where to come back to. That record holds the relative route, its filters and the id of
 * the handoff, and nothing else: no name, no outcome, no credential. It is `sessionStorage`, so it dies with the tab.
 *
 * Back: when CasaZen is loaded again (the browser's back, or a normal navigation) the record is read ONCE and forgotten: the shell leads to the
 * route with its filters, the control that started the handoff takes the focus, and the page says «Bentornato nel Cassetto Compliance». The
 * return asks nothing («È stato inviato?»), records no result and changes no compliance state: what the connected area shows stays there.
 */

export const RETURN_STORAGE_KEY = 'cz-compliance-drawer-return';

const FALLBACK_LIFETIME_MS = 60 * 60 * 1000;

const MAX_TOKEN_LENGTH = 200;

const MAX_FILTERS_LENGTH = 1024;

const FOCUS_WINDOW_MS = 15_000;

export interface SavedReturn {
  handoffId: string;
  route: string;
  filters: string;
  origin: string;
  /** Until when it may be restored (ms since the epoch). */
  expiresAt: number;
}

export interface ReturnToSave {
  handoffId: string;
  route: string;
  filters: string;
  origin: string;
  expiresAt: string;
}

const isToken = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_TOKEN_LENGTH && !/\s/.test(value);

const isFilters = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= MAX_FILTERS_LENGTH &&
  (value === '' || (value.startsWith('?') && !/[\s\\]/.test(value) && !value.includes('://')));

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

export function forgetReturn(): void {
  try {
    window.sessionStorage.removeItem(RETURN_STORAGE_KEY);
  } catch {
    // Nothing to forget if the storage cannot be reached.
  }
}

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
      return { handoffId: value.handoffId, route: value.route, filters: value.filters, origin: value.origin, expiresAt: value.expiresAt };
    }
  } catch {
    // Not JSON: the same as a record that is not valid.
  }
  forgetReturn();
  return null;
}

export function openDestination(address: string): boolean {
  if (!isHttpsAddress(address)) return false;
  window.location.assign(address);
  return true;
}

export interface Arrival {
  route: string;
  filters: string;
  origin: string;
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

export function takeArrival(now: number = Date.now()): Arrival | null {
  const saved = readReturn(now);
  if (saved === null) return arrival;
  forgetReturn();
  publish({ route: saved.route, filters: saved.filters, origin: saved.origin, focused: false });
  window.setTimeout(markArrivalFocused, FOCUS_WINDOW_MS);
  return arrival;
}

export function markArrivalFocused(): void {
  if (arrival !== null && !arrival.focused) publish({ ...arrival, focused: true });
}

export function clearArrival(): void {
  if (arrival !== null) publish(null);
}

export function resetReturnForTests(): void {
  forgetReturn();
  publish(null);
}

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
