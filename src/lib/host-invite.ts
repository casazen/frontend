import { acceptHostInvite } from '@/api/host-invites.api';
import { isAxiosError } from 'axios';
import { getProblemCode, isTransientRequestError } from '@/lib/api-errors';

/**
 * Link of a host invite (`/invito-host/:token`).
 *
 * The invite does not give a role: the invited person signs up (or logs in) as usual and the link only binds the invite
 * email and records who invited. The token waits in `sessionStorage` (this tab only, gone with it) while the Auth0 signup
 * or login runs, then `POST /host-invites/accept` is called once and the token is forgotten. It is a secret of the link:
 * never logged, never in analytics, never sent anywhere but the two invite endpoints. Storage errors are ignored: the
 * login also returns to the invite page, which carries the token in its address.
 */

export { HOST_INVITE_PATH_PREFIX, hostInvitePath, isWellFormedHostInviteToken } from './host-invite-path';
import { isWellFormedHostInviteToken } from './host-invite-path';
const STORAGE_KEY = 'cz-host-invite';

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

export function hostInviteNeedsEmailVerification(error: unknown): boolean {
  return isAxiosError(error) && getProblemCode(error.response?.data) === 'host_invite_email_not_verified';
}

export type HostInviteAcceptOutcome = { ok: true } | { ok: false; error: unknown };

const inFlight = new Map<string, Promise<HostInviteAcceptOutcome>>();
const accepted = new Set<string>();

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
      if (isTransientRequestError(error) || hostInviteNeedsEmailVerification(error)) savePendingHostInvite(token);
      return { ok: false, error };
    },
  ).finally(() => {
    inFlight.delete(token);
  });
  inFlight.set(token, call);
  return call;
}
