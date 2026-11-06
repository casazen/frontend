/**
 * The address of the connect wizard (E02/F01/US01/T04). It is also the callback page of the consent: the channel manager sends the
 * host back to it with the `code` and the `state` in the query string. The backend setting `Octorate__RedirectUri` is this address on
 * the host of the web app, and the channel manager has to know it before it works (backend `deploy-checklist.md`).
 */
export const OCTORATE_CONNECT_PATH = '/app/short-rent/integrations/octorate';

/** The step of the wizard the callback belongs to: the host leaves from it and comes back to it. */
export const CONSENT_STEP_ID = 'consent';

/** What the channel manager puts in the address of the callback (RFC 6749, 4.1.2). */
const CALLBACK_PARAMS = ['code', 'state', 'error', 'error_description', 'error_uri'] as const;

/** What the host comes back with: the code and the state of the consent, or a refusal (or anything that is not a pair). */
export type OctorateCallback = { kind: 'granted'; code: string; state: string } | { kind: 'refused' };

/**
 * What the callback brought, or `null` when the address is not a callback. A refusal is an `error` in the address, or a code without
 * its state (it cannot be completed: the state is what binds the consent to the org and the person who started it).
 */
export function readOctorateCallback(params: URLSearchParams): OctorateCallback | null {
  if (params.has('error')) return { kind: 'refused' };

  const code = params.get('code')?.trim();
  const state = params.get('state')?.trim();
  if (code && state) return { kind: 'granted', code, state };
  return code ? { kind: 'refused' } : null;
}

/**
 * The address once the callback was read: the code and the state are single-use secrets and do not stay in the address bar, in the
 * history or in a reload; `step` names the step the host comes back to, so that a reload or "back" lands on it.
 */
export function withoutOctorateCallback(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const name of CALLBACK_PARAMS) next.delete(name);
  next.set('step', CONSENT_STEP_ID);
  return next;
}

/**
 * True for the page the channel manager sends the host back to. The Auth0 SDK takes any address with a `code` and a `state` for the end
 * of its own login and would fail on these (`Auth0Provider` is told to leave them alone here). The router ignores case and a
 * trailing slash, so does this.
 */
export function isOctorateCallbackPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return path.toLowerCase() === OCTORATE_CONNECT_PATH;
}
