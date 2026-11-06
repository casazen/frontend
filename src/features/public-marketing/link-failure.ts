import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';

/**
 * Why the call with the signed values of a link of an e-mail did not go through, in the terms the pages of the links use:
 * - `expired`: the link is older than its validity (`link_expired`): a more recent e-mail, or the property, has a new one;
 * - `invalid`: the link is not complete, was changed or was never issued (`invalid_signature`, `signature_missing`, `invalid_timestamp`, a missing value);
 * - `notFound`: the signature is good but the contact is gone (`contact_not_found`, the confirmation only);
 * - `suppressed`: the signature is good but the person opted out, so nothing is confirmed and the opt-out stands (`contact_suppressed`, 409,
 *   the confirmation only): trying again can never work, so the page offers no button;
 * - `retry`: no answer or the server failed (network, timeout, 5xx, 429): the same link works if it is tried again.
 */
export type LinkFailure = 'expired' | 'invalid' | 'notFound' | 'suppressed' | 'retry';

/** Codes of `PublicMarketingController` that say the link itself does not work. */
const INVALID_LINK_CODES: ReadonlySet<string> = new Set([
  'invalid_signature',
  'signature_missing',
  'invalid_timestamp',
  'email_hash_missing',
  'expires_at_missing',
  'org_id_missing',
]);

/** The failure of a call, from its problem code; a 400 or 422 without a code we know is still a link the server refused. */
export function linkFailureOf(error: unknown): LinkFailure {
  if (!isAxiosError(error) || !error.response) return 'retry';

  const { status, data } = error.response;
  const code = getProblemCode(data);
  if (code === 'link_expired') return 'expired';
  if (code === 'contact_not_found') return 'notFound';
  // The only 409 of the two endpoints: the address opted out, and an old confirmation link does not lift that.
  if (code === 'contact_suppressed' || status === 409) return 'suppressed';
  if ((code !== undefined && INVALID_LINK_CODES.has(code)) || status === 400 || status === 422) return 'invalid';
  return 'retry';
}
