import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, isTransientRequestError } from '@/lib/api-errors';

/**
 * The link of the e-mail that invites a CONTACT of an owner to the owner portal (`/portale-proprietari/contatto?token=…`, backend `PublicSiteLinks.OwnerContactAccept`,
 * E07/F07/US01/T02, NF-111, ADR-011). Same care as the link that invites an owner (`owner-invitation.ts`): the token is the secret of the invitation (43 characters of
 * the URL-safe base64 alphabet): whoever holds it and signs in with the invited address becomes that contact, so it is never logged, never in a toast, never in the cache
 * of the queries, never in `localStorage` or `sessionStorage` and never in a URL of the API. The page takes it out of the address bar as soon as it has read it; while the
 * person signs in at Auth0 it travels in the `appState` of the login (kept in this browser, never sent to Auth0) and from there waits in memory only, in this module,
 * until the acceptance. A reload in between loses it: the person opens the link of the e-mail again.
 */
export const OWNER_CONTACT_INVITATION_PATH = '/portale-proprietari/contatto';

/** Name of the value of the token in the `appState` of the Auth0 login. */
export const OWNER_CONTACT_APP_STATE_KEY = 'ownerContactInvitation';

/** What the backend accepts as a token: 40 to 64 letters, digits, `-` and `_` (case matters: it is base64url, not hex). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

/** The token as the backend reads it (trimmed), or `null` for anything that is not one: the link does not work. */
export function normalizeOwnerContactToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return TOKEN_PATTERN.test(token) ? token : null;
}

/** The token kept between the page that read it and the acceptance: in memory, in no storage. */
let pendingToken: string | null = null;

/** Keeps the token of an invitation until it is used (the value of the `appState` after the Auth0 redirect, or the one the page just read). */
export function stashOwnerContactToken(value: unknown): void {
  const token = normalizeOwnerContactToken(value);
  if (token) pendingToken = token;
}

/** The token waiting for the acceptance, without taking it: a page that mounts twice (a development render) finds it both times. */
export function peekOwnerContactToken(): string | null {
  return pendingToken;
}

/** Forgets the token: the invitation was accepted, or the server said that the link no longer works. */
export function clearOwnerContactToken(): void {
  pendingToken = null;
}

/** Why a link cannot be used: the acceptance answers which. */
export type OwnerContactUnusable = 'invalid' | 'expired' | 'used' | 'revoked';

/** What the acceptance can fail with, by what the person has to do about it. */
export type OwnerContactFailure =
  | { kind: 'unusable'; reason: OwnerContactUnusable }
  | { kind: 'emailMismatch' | 'emailNotVerified' | 'notFound' | 'retry' | 'other' };

const UNUSABLE_CODES: Record<string, OwnerContactUnusable> = {
  owner_contact_invitation_invalid: 'invalid',
  owner_contact_invitation_expired: 'expired',
  owner_contact_invitation_used: 'used',
  owner_contact_invitation_revoked: 'revoked',
};

/**
 * The failure of the acceptance in words the page has: a link that does not work (410, with the reason), an account whose e-mail is not the invited one or is not verified
 * (403), a page that does not exist while the owner portal is off (404: «not found»), a request worth sending again (no answer, 5xx, the limit of the requests) and anything else.
 */
export function ownerContactFailureOf(error: unknown): OwnerContactFailure {
  const status = getHttpStatus(error);
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (code && Object.hasOwn(UNUSABLE_CODES, code)) return { kind: 'unusable', reason: UNUSABLE_CODES[code] };
  if (code === 'owner_contact_email_mismatch') return { kind: 'emailMismatch' };
  if (code === 'owner_contact_email_not_verified') return { kind: 'emailNotVerified' };
  if (status === 410 || status === 400) return { kind: 'unusable', reason: 'invalid' };
  if (status === 404) return { kind: 'notFound' };
  return isTransientRequestError(error) || status === 429 ? { kind: 'retry' } : { kind: 'other' };
}
