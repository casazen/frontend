export interface ConfirmLink {
  hold: string | null;
  token: string | null;
  inquiry: string | null;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

export function addressWithoutToken(pathname: string, link: ConfirmLink): string {
  if (link.hold) return `${pathname}?hold=${encodeURIComponent(link.hold)}`;
  if (link.inquiry) return `${pathname}?inquiry=${encodeURIComponent(link.inquiry)}`;
  return pathname;
}
