import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode, isTransientRequestError } from '@/lib/api-errors';

/**
 * The link of the email that invites a person to an org (`/invite/accept?token=…`, backend `PublicSiteLinks.OrgInvitationAccept`).
 *
 * The token is the secret of the invitation (64 hex characters): whoever has it can accept as the invited person, so it is never
 * logged, never in analytics, never in `localStorage` and never in a URL of the API. The page takes it out of the address as soon as
 * it has read it, keeps it in `sessionStorage` (this tab only, gone with it) while the person signs in, and sends it only in the body
 * of `POST /org-invitations/lookup` and `/accept`. Storage errors are ignored: the person opens the link of the email again.
 */
export const ORG_INVITE_ACCEPT_PATH = '/invite/accept';

const STORAGE_KEY = 'cz-org-invite';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** The token as the backend reads it (trimmed, lowercase), or `null` for anything that is not one: the link does not work. */
export function normalizeOrgInviteToken(value: string | null | undefined): string | null {
  const token = value?.trim().toLowerCase() ?? '';
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function savePendingOrgInvite(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage unavailable: the person opens the link of the email again after signing in.
  }
}

function readPendingOrgInvite(): string | null {
  try {
    return normalizeOrgInviteToken(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearPendingOrgInvite(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}

/**
 * The token of this visit: the one in the address (the link of the email, even when it is not a token: then the link does not work
 * and an older one is not put in its place), otherwise the one kept in this tab while the person signed in.
 */
export function readOrgInviteToken(params: URLSearchParams): string | null {
  return params.has('token') ? normalizeOrgInviteToken(params.get('token')) : readPendingOrgInvite();
}

/** `marta.rossi@example.com` → `m***@example.com`: the address an invitation is for, without giving all of it to whoever holds the link. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** Why a link cannot be used. The anonymous lookup says only `invalid`; the acceptance can say which. */
export type UnusableReason = 'invalid' | 'expired' | 'used' | 'revoked';

/** What the anonymous lookup of a link can fail with. */
export type LookupFailure = 'invalid' | 'unavailable' | 'retry';

export function lookupFailureOf(error: unknown): LookupFailure {
  const status = getHttpStatus(error);
  // 410 is the one answer for every link that does not work; 400 is a malformed one.
  if (status === 410 || status === 400) return 'invalid';
  if (status === 404) return 'unavailable';
  return 'retry';
}

/** What the acceptance can fail with, by what the person has to do about it. */
export type AcceptFailure =
  | { kind: 'unusable'; reason: UnusableReason }
  | { kind: 'emailMismatch' | 'emailNotVerified' | 'platformAdmin' | 'hasOrganization' | 'alreadyMember' | 'consents' | 'retry' | 'other' };

const UNUSABLE_CODES: Record<string, UnusableReason> = {
  invitation_invalid: 'invalid',
  invitation_expired: 'expired',
  invitation_used: 'used',
  invitation_revoked: 'revoked',
};

export function acceptFailureOf(error: unknown): AcceptFailure {
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  if (code && Object.hasOwn(UNUSABLE_CODES, code)) return { kind: 'unusable', reason: UNUSABLE_CODES[code] };
  switch (code) {
    case 'invitation_email_mismatch':
      return { kind: 'emailMismatch' };
    case 'invitation_email_not_verified':
      return { kind: 'emailNotVerified' };
    case 'invitation_platform_admin':
      return { kind: 'platformAdmin' };
    case 'invitation_user_has_organization':
    case 'org_member_other_org':
      return { kind: 'hasOrganization' };
    case 'org_member_already_member':
      return { kind: 'alreadyMember' };
    case 'consents_incomplete':
    case 'stale_documents':
      return { kind: 'consents' };
    default:
      // No answer, a 5xx or the limit of the requests: asking again may work; anything else will not.
      return isTransientRequestError(error) || getHttpStatus(error) === 429 ? { kind: 'retry' } : { kind: 'other' };
  }
}

/** How a person without an account gets in (AM-D13). */
export type InviteeEntryMode = 'signup' | 'password' | 'login';

/**
 * AM-D13, one line to change: how an invited person who has no account gets in while the sign-ups of Auth0 are closed. `signup`
 * («Crea il tuo account», the sign-up screen, as the invitation of a host does) works with the backend as it is. `password` («Imposta la
 * password») is the default decision (b) and needs AM-02e, which creates the account and sends the link to choose the password in the
 * email: switch to it when that is in. `login` (only «Accedi») is decision (c).
 */
export const INVITEE_ENTRY_MODE: InviteeEntryMode = 'signup';

export interface InviteEntryButton {
  labelKey: string;
  /** Sent to Auth0 with the login; `screen_hint: 'signup'` opens the sign-up screen. */
  authorizationParams?: Record<string, string>;
  testId: string;
}

export interface InviteEntry {
  primary: InviteEntryButton;
  secondary: InviteEntryButton | null;
  /** A line under the buttons, when the way in needs explaining. */
  hintKey: string | null;
}

const LOGIN: InviteEntryButton = { labelKey: 'invitation.entry.login', testId: 'invite-accept-login' };

/** The buttons that let an invited person who is not signed in come in: the page only draws what this says. */
export function inviteEntryAction(mode: InviteeEntryMode = INVITEE_ENTRY_MODE): InviteEntry {
  switch (mode) {
    case 'signup':
      return {
        primary: { labelKey: 'invitation.entry.signup', authorizationParams: { screen_hint: 'signup' }, testId: 'invite-accept-signup' },
        secondary: { labelKey: 'invitation.entry.haveAccount', testId: LOGIN.testId },
        hintKey: null,
      };
    case 'password':
      return {
        primary: { labelKey: 'invitation.entry.setPassword', testId: 'invite-accept-password' },
        secondary: null,
        hintKey: 'invitation.entry.setPasswordHint',
      };
    case 'login':
      return { primary: LOGIN, secondary: null, hintKey: null };
  }
}
