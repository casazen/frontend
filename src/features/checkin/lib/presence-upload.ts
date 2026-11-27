/**
 * The upload of the sequence of the presence (E72/F02/US01/T01, NF-192): what belongs to one recording and to the call that sends it. Nothing here reads or writes a picture: the caller holds the frames and says how
 * to send them.
 */

/**
 * A new `Idempotency-Key` for one recording: 8 to 64 of letters, digits and hyphens, as the API wants. A UUID where the browser makes one (every browser that has a camera on a secure page does), otherwise 32 random
 * hexadecimal digits. A new recording is a new key; a repeat of the same recording keeps its key, so that the server answers it once.
 */
export function newIdempotencyKey(): string {
  const random = globalThis.crypto;
  if (typeof random.randomUUID === 'function') return random.randomUUID();
  return Array.from(random.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
