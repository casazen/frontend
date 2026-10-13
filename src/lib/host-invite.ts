import { acceptHostInvite } from '@/api/host-invites.api';
import { isTransientRequestError } from '@/lib/api-errors';

/**
 * Link of a host invite (`/invito-host/:token`).
 *
 * The invite does not give a role: the invited person signs up (or logs in) as usual and the link only binds the invite
 * email and records who invited. The token waits in `sessionStorage` (this tab only, gone with it) while the Auth0 signup
 * or login runs, then `POST /host-invites/accept` is called once and the token is forgotten. It is a secret of the link:
 * never logged, never in analytics, never sent anywhere but the two invite endpoints. Storage errors are ignored: the
 * login also returns to the invite page, which carries the token in its address.
 */

export const HOST_INVITE_PATH_PREFIX = '/invito-host/';

const STORAGE_KEY = 'cz-host-invite';
/** Same shape as the other tokens of the platform: URL-safe, no separators. */
const TOKEN_PATTERN = /^[\w.~%+=-]{8,512}$/;

export function isWellFormedHostInviteToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function hostInvitePath(token: string): string {
  return `${HOST_INVITE_PATH_PREFIX}${encodeURIComponent(token)}`;
}

export function savePendingHostInvite(token: string): void {
  if (!isWellFormedHostInviteToken(token)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage unavailable: the login returns to the invite page, which has the token in its address.
  }
}

export function readPendingHostInvite(): string | null {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    return token && isWellFormedHostInviteToken(token) ? token : null;
  } catch {
    return null;
  }
}

export function clearPendingHostInvite(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}

export type HostInviteAcceptOutcome = { ok: true } | { ok: false; error: unknown };

// Tokens being accepted in this page load: a second call for the same token (StrictMode, re-render) is never sent.
const inFlight = new Map<string, Promise<HostInviteAcceptOutcome>>();
// Tokens accepted in this page load: coming back to the invite page does not send them again.
const accepted = new Set<string>();

/**
 * Accepts the invite once. The stored token is removed before the call, so no other tab or render can send it again;
 * it is put back only when the failure is transient (no answer, 5xx) and worth another try.
 */
export function acceptHostInviteOnce(token: string): Promise<HostInviteAcceptOutcome> {
  if (accepted.has(token)) return Promise.resolve({ ok: true });
  const running = inFlight.get(token);
  if (running) return running;

  clearPendingHostInvite();
  const call = acceptHostInvite(token).then(
    (): HostInviteAcceptOutcome => {
      accepted.add(token);
      return { ok: true };
    },
    (error: unknown): HostInviteAcceptOutcome => {
      if (isTransientRequestError(error)) savePendingHostInvite(token);
      return { ok: false, error };
    },
  ).finally(() => {
    inFlight.delete(token);
  });
  inFlight.set(token, call);
  return call;
}
