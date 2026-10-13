/**
 * Claim of a supplier profile registered without an account (SU-02, A4-02).
 *
 * The anonymous `POST /suppliers/register` returns a one-use claim token, bound to the registered email and valid
 * for a few days. The app keeps it here while the supplier creates the Auth0 account (also in the login `appState`),
 * then `/register/claim` sends it to `POST /suppliers/claim` and forgets it. The token alone gives nothing: the
 * backend links it only to a signed-in account with the registered email.
 *
 * Kept in `localStorage` (not `sessionStorage`) so it survives the email verification of a new account, which often
 * ends in another tab; it is dropped once used, refused or expired. Storage errors (private mode, quota) are
 * ignored: the claim then relies on the `appState` of the login redirect.
 */

/** Page that links the signed-in account to the pending supplier profile. */
export const SUPPLIER_CLAIM_PATH = '/register/claim';

const STORAGE_KEY = 'cz-supplier-claim';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export interface PendingSupplierClaim {
  token: string;
  /** Email of the registration: the account to sign in with. */
  email: string;
  /** ISO UTC expiry of the token. */
  expiresAt: string;
}

/** A well-formed, not yet expired claim, or null. */
export function parsePendingSupplierClaim(value: unknown, now: Date = new Date()): PendingSupplierClaim | null {
  if (typeof value !== 'object' || value === null) return null;
  const { token, email, expiresAt } = value as Record<string, unknown>;
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null;
  if (typeof email !== 'string' || email.trim().length === 0) return null;
  if (typeof expiresAt !== 'string') return null;
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry) || expiry <= now.getTime()) return null;
  return { token, email: email.trim(), expiresAt };
}

export function savePendingSupplierClaim(claim: PendingSupplierClaim): void {
  if (!parsePendingSupplierClaim(claim)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(claim));
  } catch {
    // Storage unavailable: the login appState still carries the claim back to the app.
  }
}

/** The stored claim when still usable; an expired or unreadable one is removed. */
export function readPendingSupplierClaim(now: Date = new Date()): PendingSupplierClaim | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let claim: PendingSupplierClaim | null = null;
  try {
    claim = parsePendingSupplierClaim(JSON.parse(raw), now);
  } catch {
    claim = null;
  }
  if (!claim) clearPendingSupplierClaim();
  return claim;
}

export function clearPendingSupplierClaim(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}
