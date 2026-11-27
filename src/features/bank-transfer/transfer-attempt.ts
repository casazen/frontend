/**
 * One Idempotency-Key per due, kept until that transfer is accepted or refused for good.
 * A second click, a retry after a lost answer, and a dialog that remounts all send the same key.
 * Clicks are ignored while that attempt is in flight, including after the dialog closes and the form remounts.
 * The key lives in the tab (`sessionStorage`) so closing the dialog does not mint another one.
 */

const STORAGE_PREFIX = 'cz-stripe-rent-transfer:';

export type StripeTransferPhase = 'idle' | 'inflight' | 'accepted';

export interface StripeTransferAttempt {
  key: string | null;
  phase: StripeTransferPhase;
}

const IDLE: StripeTransferAttempt = { key: null, phase: 'idle' };

interface StoredAttempt {
  key: string;
  outcome?: 'accepted';
}

const cache = new Map<string, StripeTransferAttempt>();
const listeners = new Set<() => void>();

export function dueKey(leaseId: string, dueId: string): string {
  return `${leaseId}:${dueId}`;
}

function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function readStored(id: string): StoredAttempt | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttempt;
    if (!parsed || typeof parsed.key !== 'string' || parsed.key === '') return null;
    return parsed.outcome === 'accepted' ? { key: parsed.key, outcome: 'accepted' } : { key: parsed.key };
  } catch {
    return null;
  }
}

function writeStored(id: string, attempt: StoredAttempt): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(storageKey(id), JSON.stringify(attempt));
  } catch {
    // The in-memory attempt still covers this page.
  }
}

function removeStored(id: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(storageKey(id));
  } catch {
    // Nothing else to clear.
  }
}

function remember(id: string, attempt: StripeTransferAttempt): void {
  const current = cache.get(id);
  if (current && current.key === attempt.key && current.phase === attempt.phase) return;
  cache.set(id, attempt);
  emit();
}

function load(id: string): StripeTransferAttempt {
  const cached = cache.get(id);
  if (cached) return cached;
  const stored = readStored(id);
  const attempt: StripeTransferAttempt = stored
    ? { key: stored.key, phase: stored.outcome === 'accepted' ? 'accepted' : 'idle' }
    : IDLE;
  cache.set(id, attempt);
  return attempt;
}

function newKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `stripe-transfer-${Date.now()}`;
}

export function subscribeStripeTransferAttempts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function stripeTransferAttempt(leaseId: string, dueId: string): StripeTransferAttempt {
  return load(dueKey(leaseId, dueId));
}

/** A due that already failed may be tried again. The next click is a new transfer with a new key. */
export function releaseAcceptedStripeTransfer(leaseId: string, dueId: string): void {
  const id = dueKey(leaseId, dueId);
  const attempt = load(id);
  if (attempt.phase !== 'accepted') return;
  removeStored(id);
  remember(id, IDLE);
}

/**
 * Starts the one open attempt, or refuses when one is already in flight or already accepted.
 * The key is created once and reused until `settleStripeTransfer` says the attempt finished.
 */
export function beginStripeTransfer(leaseId: string, dueId: string): string | null {
  const id = dueKey(leaseId, dueId);
  const attempt = load(id);
  if (attempt.phase === 'inflight' || attempt.phase === 'accepted') return null;
  const key = attempt.key ?? newKey();
  writeStored(id, { key });
  remember(id, { key, phase: 'inflight' });
  return key;
}

/** `accepted` and `failed` finish the attempt. `retry` keeps the same key for the next click. */
export function settleStripeTransfer(leaseId: string, dueId: string, outcome: 'accepted' | 'failed' | 'retry'): void {
  const id = dueKey(leaseId, dueId);
  const attempt = load(id);
  if (outcome === 'retry') {
    remember(id, { key: attempt.key, phase: 'idle' });
    return;
  }
  if (outcome === 'failed') {
    removeStored(id);
    remember(id, IDLE);
    return;
  }
  if (!attempt.key) return;
  writeStored(id, { key: attempt.key, outcome: 'accepted' });
  remember(id, { key: attempt.key, phase: 'accepted' });
}

/** Tests start from an empty tab. */
export function resetStripeTransferAttempts(): void {
  cache.clear();
  if (typeof sessionStorage !== 'undefined') {
    const keys: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  }
  emit();
}
