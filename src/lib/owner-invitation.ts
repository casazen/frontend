import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, isTransientRequestError } from '@/lib/api-errors';

/**
 * The link of the e-mail that invites a property owner to the owner portal (`/portale-proprietari/invito?token=…`, backend
 * `PublicSiteLinks.OwnerInvitationAccept`, E10/F02/US02/T02, NF-109, ADR-011).
 *
 * The token is the secret of the invitation (64 hex characters): whoever holds it and signs in with the invited address becomes the owner, so it is never
 * logged, never in a toast, never in the cache of the queries, never in `localStorage` or `sessionStorage` and never in a URL of the API. The page takes it
 * out of the address bar as soon as it has read it. While the person signs in at Auth0 it travels in the `appState` of the login, the state the SDK keeps
 * in this browser for exactly this and gives back to the app after the redirect (it is never sent to Auth0); from there it waits in memory only, in
 * this module, until the acceptance. A reload in between loses it: the person opens the link of the e-mail again.
 */
export const OWNER_INVITATION_PATH = '/portale-proprietari/invito';

/** The home of the owner portal: where the owner goes once the invitation is accepted. */
export const OWNER_PORTAL_HOME_PATH = '/portale-proprietari';

/** Name of the value of the token in the `appState` of the Auth0 login. */
export const OWNER_INVITATION_APP_STATE_KEY = 'ownerInvitation';

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** The token as the backend reads it (trimmed, lowercase), or `null` for anything that is not one: the link does not work. */
export function normalizeOwnerInvitationToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim().toLowerCase();
  return TOKEN_PATTERN.test(token) ? token : null;
}

/** The token kept between the page that read it and the acceptance: in memory, in no storage. */
let pendingToken: string | null = null;

/** Keeps the token of an invitation until it is used (the value of the `appState` after the Auth0 redirect, or the one the page just read). */
export function stashOwnerInvitationToken(value: unknown): void {
  const token = normalizeOwnerInvitationToken(value);
  if (token) pendingToken = token;
}

/** The token waiting for the acceptance, without taking it: a page that mounts twice (a development render) finds it both times. */
export function peekOwnerInvitationToken(): string | null {
  return pendingToken;
}

/** Forgets the token: the invitation was accepted, or the server said that the link no longer works. */
export function clearOwnerInvitationToken(): void {
  pendingToken = null;
}

/** Why a link cannot be used: the acceptance answers which. */
export type OwnerInvitationUnusable = 'invalid' | 'expired' | 'used' | 'revoked';

/** What the acceptance can fail with, by what the person has to do about it. */
export type OwnerInvitationFailure =
  | { kind: 'unusable'; reason: OwnerInvitationUnusable }
  | { kind: 'emailMismatch' | 'emailNotVerified' | 'notFound' | 'retry' | 'other' };

const UNUSABLE_CODES: Record<string, OwnerInvitationUnusable> = {
  owner_invitation_invalid: 'invalid',
  owner_invitation_expired: 'expired',
  owner_invitation_used: 'used',
  owner_invitation_revoked: 'revoked',
};

/**
 * The failure of the acceptance in words the page has: a link that does not work (410, with the reason), an account whose e-mail is not the invited one or
 * is not verified (403), a page that does not exist while the owner portal is off (404: «not found», whatever an earlier answer was), a request worth
 * sending again (no answer, 5xx, the limit of the requests) and anything else.
 */
export function ownerInvitationFailureOf(error: unknown): OwnerInvitationFailure {
  const status = getHttpStatus(error);
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (code && Object.hasOwn(UNUSABLE_CODES, code)) return { kind: 'unusable', reason: UNUSABLE_CODES[code] };
  if (code === 'owner_invitation_email_mismatch') return { kind: 'emailMismatch' };
  if (code === 'owner_invitation_email_not_verified') return { kind: 'emailNotVerified' };
  if (status === 410 || status === 400) return { kind: 'unusable', reason: 'invalid' };
  if (status === 404) return { kind: 'notFound' };
  return isTransientRequestError(error) || status === 429 ? { kind: 'retry' } : { kind: 'other' };
}

/** The answer of the acceptance says the claims of the owner portal reached the identity provider: only then is a new token worth asking for. */
export function claimsArePublished(claimsRefresh: unknown): boolean {
  return claimsRefresh === 'published';
}
