import { getHttpStatus, isTransientRequestError } from '@/lib/api-errors';

/**
 * The upload of the sequence of the presence, with the resume of a connection that drops (E72/F02/US01/T01 and T02, NF-192, NF-198): one `send` per try, every try with the SAME `Idempotency-Key` and the SAME frames, so that
 * a request that reached the server and whose answer was lost comes back as the answer the server stored, never as a second decision. Nothing here reads or writes a picture: the caller holds the frames and says how to
 * send them.
 */

/** The waits between a try that failed and the next one: 1 s, 2 s, 4 s. That is three tries after the first, and then the upload gives up. */
export const RETRY_DELAYS_MS: readonly number[] = [1_000, 2_000, 4_000];

/**
 * How long an upload waits for the browser to say it is online again before it gives up: the frames are kept for one manual retry, and the guest is not left looking at a spinner for ever. The wait is for the
 * connection to come back (the browser's `online` event); the waits between the tries are {@link RETRY_DELAYS_MS}.
 */
export const OFFLINE_WAIT_MS = 30_000;

/** What an upload ended in. */
export type UploadOutcome<T> =
  /** The server answered (whatever it decided): the answer. */
  | { kind: 'answered'; answer: T }
  /** The network or the server did not answer after the tries (or the browser stayed offline): the frames are worth keeping, the same request may be sent again with the same key. */
  | { kind: 'gave-up'; error: unknown }
  /** The server answered with a refusal a repeat would not change (a 4xx, or a failure that is not the network's): not repeated. */
  | { kind: 'refused'; error: unknown }
  /** The guest stopped the upload (its `AbortSignal` was aborted) before the server answered: the request that was on its way is given up, and nothing is sent, repeated or waited for any more. */
  | { kind: 'cancelled' };

/** The things an upload needs of the browser, so that a test can bring its own. */
export interface UploadEnvironment {
  /** The browser says it has a connection. */
  isOnline: () => boolean;
  /** Resolves `true` as soon as the browser is online (now, or when its `online` event comes), and `false` when `timeoutMs` has passed first. */
  waitForOnline: (timeoutMs: number) => Promise<boolean>;
  /** Resolves after `ms`. */
  sleep: (ms: number) => Promise<void>;
}

/** The environment of the browser the page runs in. A browser that does not say whether it is online (`navigator.onLine` missing) is taken as online: the request itself tells. */
export function browserEnvironment(): UploadEnvironment {
  const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;
  return {
    isOnline,
    waitForOnline: (timeoutMs) =>
      new Promise<boolean>((resolve) => {
        if (isOnline()) {
          resolve(true);
          return;
        }
        const finish = (online: boolean) => {
          window.removeEventListener('online', onOnline);
          clearTimeout(timer);
          resolve(online);
        };
        const onOnline = () => finish(true);
        const timer = setTimeout(() => finish(false), timeoutMs);
        window.addEventListener('online', onOnline);
      }),
    sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * A failure that a repeat may fix: no answer at all (offline, timeout, the request aborted) or a 5xx other than 501. An answer of the 4xx family is the server saying no, and the same request would get the same no.
 */
export function isWorthRepeating(error: unknown): boolean {
  return isTransientRequestError(error);
}

/** The server refused the request because the guest sent too much, too soon (429): it did not process it, so the same request may be sent again later, with the same key. */
export function isRateLimited(error: unknown): boolean {
  return getHttpStatus(error) === 429;
}

/** What a wait gives when the upload was stopped while it lasted. */
const ABORTED = Symbol('aborted');

/**
 * What `promise` gives, or {@link ABORTED} as soon as `signal` aborts, whichever comes first. The promise is left to settle on its own (a wait for the connection or a pause between two tries costs nothing when it ends
 * later; a request that was on its way is cancelled by the same signal, where the caller handed it to the request). Without a signal it is the promise itself.
 */
function orAborted<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T | typeof ABORTED> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise<T | typeof ABORTED>((resolve, reject) => {
    const onAbort = () => resolve(ABORTED);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Sends with `send(idempotencyKey)` until the server answers or the tries run out. A failure that a repeat may fix is repeated after 1 s, 2 s and 4 s, with the same key every time; while the browser says it is offline
 * nothing is sent: the upload waits for `online` (at most {@link OFFLINE_WAIT_MS}) and then goes on. An answer of the 4xx family is not repeated. The waits and the tries are the same whatever the speed of the network: a slow
 * request is given its whole time.
 *
 * `signal` is the guest stopping the upload (E72/F02/US01/T02): from then on nothing is sent, repeated or waited for, whatever the upload was doing (a request on its way, a pause between two tries, the wait for the connection),
 * and the outcome is `cancelled`. An answer that came before the signal is the answer, never a cancellation: the server decided, and the page shows what it decided.
 */
export async function uploadPresence<T>(
  send: (idempotencyKey: string) => Promise<T>,
  idempotencyKey: string,
  environment: UploadEnvironment = browserEnvironment(),
  signal?: AbortSignal,
): Promise<UploadOutcome<T>> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (signal?.aborted) return { kind: 'cancelled' };

    if (!environment.isOnline()) {
      const online = await orAborted(environment.waitForOnline(OFFLINE_WAIT_MS), signal);
      if (online === ABORTED) return { kind: 'cancelled' };
      if (!online) return { kind: 'gave-up', error: lastError };
    }

    try {
      const answer = await orAborted(send(idempotencyKey), signal);
      if (answer === ABORTED) return { kind: 'cancelled' };
      return { kind: 'answered', answer };
    } catch (error) {
      // The request that was on its way was cancelled with the upload: it is not a failure of the network, and it is not repeated.
      if (signal?.aborted) return { kind: 'cancelled' };
      if (!isWorthRepeating(error)) return { kind: 'refused', error };
      lastError = error;
    }

    if (attempt < RETRY_DELAYS_MS.length && (await orAborted(environment.sleep(RETRY_DELAYS_MS[attempt]), signal)) === ABORTED) return { kind: 'cancelled' };
  }

  return { kind: 'gave-up', error: lastError };
}

/**
 * A new `Idempotency-Key` for one recording: 8 to 64 of letters, digits and hyphens, as the API wants. A UUID where the browser makes one (every browser that has a camera on a secure page does), otherwise 32 random
 * hexadecimal digits. A new recording is a new key; a repeat of the same recording keeps its key, so that the server answers it once.
 */
export function newIdempotencyKey(): string {
  const random = globalThis.crypto;
  if (typeof random.randomUUID === 'function') return random.randomUUID();
  return Array.from(random.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
