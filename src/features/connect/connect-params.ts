import type { SiteConnectionAuthorizeRequest } from '@/types/site-connection.types';

/*
 * What the plugin for WordPress puts in the address of the page `/app/connect/wordpress` (site integration plan §10.6, NF-201): `site` (the origin of the WordPress site), `return` (the address
 * of the screen of the plugin the browser goes back to), `state`, `challenge` (the PKCE challenge, the SHA-256 of a verifier that stays in WordPress) and `method`. None of them is a secret of the
 * agency: the code that opens the connection is made by the server after the confirmation and is never in this address.
 *
 * The page checks them shallowly, the server checks them for good (`SiteConnectionRules`: any breach of the contract is the one answer 400 `site_connection_invalid_request`): every value
 * is there, `method` is `S256`, the site and the return address are addresses of the web with a host and no credentials (the host is what the page shows in full, so it has to be readable),
 * and no value is longer than the server accepts.
 */

const MAX_SITE_LENGTH = 300;
const MAX_RETURN_LENGTH = 2048;
const MAX_STATE_LENGTH = 128;
const MAX_CHALLENGE_LENGTH = 128;
const MAX_REDIRECT_LENGTH = MAX_RETURN_LENGTH + 512;

export interface ConnectRequest extends SiteConnectionAuthorizeRequest {
  siteHost: string;
}

function webAddress(value: string, maxLength: number): URL | null {
  if (value.length > maxLength || value !== value.trim()) return null;
  try {
    const url = new URL(value);
    const web = url.protocol === 'https:' || url.protocol === 'http:';
    return web && url.hostname !== '' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function present(params: URLSearchParams, name: string, maxLength: number): string | null {
  const value = params.get(name);
  return value !== null && value.trim() !== '' && value.length <= maxLength ? value : null;
}

export function readConnectRequest(params: URLSearchParams): ConnectRequest | null {
  const site = present(params, 'site', MAX_SITE_LENGTH);
  const returnUrl = present(params, 'return', MAX_RETURN_LENGTH);
  const state = present(params, 'state', MAX_STATE_LENGTH);
  const challenge = present(params, 'challenge', MAX_CHALLENGE_LENGTH);
  if (site === null || returnUrl === null || state === null || challenge === null || params.get('method') !== 'S256') return null;

  const siteAddress = webAddress(site, MAX_SITE_LENGTH);
  if (siteAddress === null || webAddress(returnUrl, MAX_RETURN_LENGTH) === null) return null;

  return { siteUrl: site, siteHost: siteAddress.host, returnUrl, state, codeChallenge: challenge, codeChallengeMethod: 'S256' };
}

export function toAuthorizeRequest(request: ConnectRequest): SiteConnectionAuthorizeRequest {
  const { siteUrl, returnUrl, state, codeChallenge, codeChallengeMethod } = request;
  return { siteUrl, returnUrl, state, codeChallenge, codeChallengeMethod };
}

/**
 * The address the whole window goes to once the server has confirmed: its `redirectUrl`, which carries the one-time code and the state, and only if it is an address of the web on the origin
 * of the site that asked. The page never builds that address and never follows the `return` of its own address: anything else (another origin, a script, a credential) is refused.
 */
export function safeRedirectTarget(redirectUrl: string, siteUrl: string): string | null {
  const target = webAddress(redirectUrl, MAX_REDIRECT_LENGTH);
  const site = webAddress(siteUrl, MAX_SITE_LENGTH);
  return target !== null && site !== null && target.origin === site.origin ? target.href : null;
}
