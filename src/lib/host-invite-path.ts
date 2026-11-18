export const HOST_INVITE_PATH_PREFIX = '/invito-host/';

/** Same shape as the other tokens of the platform: URL-safe, no separators. */
const TOKEN_PATTERN = /^[\w.~%+=-]{8,512}$/;

export function isWellFormedHostInviteToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export function hostInvitePath(token: string): string {
  return `${HOST_INVITE_PATH_PREFIX}${encodeURIComponent(token)}`;
}

/** Only an invitation issued by this normal site's own app (or its configured canonical origin) is opened. */
export function invitationDestination(input: string, allowedOrigins: string[]): string | null {
  try {
    const url = new URL(input.trim());
    if (!allowedOrigins.includes(url.origin) || url.username || url.password || !url.pathname.startsWith(HOST_INVITE_PATH_PREFIX)) return null;
    const token = decodeURIComponent(url.pathname.slice(HOST_INVITE_PATH_PREFIX.length));
    return isWellFormedHostInviteToken(token) ? url.origin + hostInvitePath(token) : null;
  } catch {
    return null;
  }
}
