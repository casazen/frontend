import { getHttpStatus, isTransientRequestError } from '@/lib/api-errors';

/**
 * The upload of the sequence of the presence, with the resume of a connection that drops (E72/F02/US01/T01 and T02, NF-192, NF-198): one `send` per try, every try with the SAME `Idempotency-Key` and the SAME frames, so that
 * a request that reached the server and whose answer was lost comes back as the answer the server stored, never as a second decision. Nothing here reads or writes a picture: the caller holds the frames and says how to
 * send them.
 */

export const RETRY_DELAYS_MS: readonly number[] = [1_000, 2_000, 4_000];

/**
 * How long an upload waits for the browser to say it is online again before it gives up: the frames are kept for one manual retry, and the guest is not left looking at a spinner for ever. The wait is for the
 * connection to come back (the browser's `online` event); the waits between the tries are {@link RETRY_DELAYS_MS}.
 */
export const OFFLINE_WAIT_MS = 30_000;

export type UploadOutcome<T> =
  | { kind: 'answered'; answer: T }
  | { kind: 'gave-up'; error: unknown }
  | { kind: 'refused'; error: unknown }
  | { kind: 'cancelled' };

/** The things an upload needs of the browser, so that a test can bring its own. */
export interface UploadEnvironment {
  isOnline: () => boolean;
  waitForOnline: (timeoutMs: number) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
}

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

export function isWorthRepeating(error: unknown): boolean {
  return isTransientRequestError(error);
}

/** The server refused the request because the guest sent too much, too soon (429): it did not process it, so the same request may be sent again later, with the same key. */
export function isRateLimited(error: unknown): boolean {
  return getHttpStatus(error) === 429;
}

const ABORTED = Symbol('aborted');

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
