/**
 * The link of the verification e-mail: `/fornitori/:slug/conferma?hold=<id>#token=<token>`. The token is in the **fragment**, which a
 * browser never sends to a server, so it is in no access log; an older link carried it in the query, and that still opens. Pure.
 */
export interface ConfirmLink {
  /** The hold the e-mail was about. */
  hold: string | null;
  /** The secret of the link; single use. */
  token: string | null;
  /** The link was about a request on measure (`?inquiry=<id>`, SP-12c), not about a booking. */
  inquiry: string | null;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The token is 32 random bytes in base64url (43 characters); anything longer than this is not one. */
const TOKEN_MAX_LENGTH = 200;

const guid = (value: string | null) => (value && GUID.test(value) ? value.toLowerCase() : null);

export function readConfirmLink(search: string, hash: string): ConfirmLink {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const token = fragment.get('token') ?? query.get('token');
  return {
    hold: guid(query.get('hold')),
    inquiry: guid(query.get('inquiry')),
    token: token && token.length <= TOKEN_MAX_LENGTH && /^[\w-]+$/.test(token) ? token : null,
  };
}

/** The address of the page without the token (neither in the fragment nor in the query), keeping only what is needed to find it again. */
export function addressWithoutToken(pathname: string, link: ConfirmLink): string {
  if (link.hold) return `${pathname}?hold=${encodeURIComponent(link.hold)}`;
  if (link.inquiry) return `${pathname}?inquiry=${encodeURIComponent(link.inquiry)}`;
  return pathname;
}
