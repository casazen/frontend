const pendingStayKey = 'guest-stay-to-attach';

export function rememberStayForAccount(token: string) {
  try {
    sessionStorage.setItem(pendingStayKey, JSON.stringify({ token, expires: Date.now() + 10 * 60_000 }));
  } catch { /* The guest can still open their existing stays without browser storage. */ }
}

export function readPendingStay(): string | null {
  try {
    const item = JSON.parse(sessionStorage.getItem(pendingStayKey) ?? 'null');
    if (typeof item?.token === 'string' && /^[A-Za-z0-9_-]{32}$/.test(item.token) && item.expires > Date.now()) {
      return item.token;
    }
  } catch { /* Storage may be unavailable in private browsing. */ }
  return null;
}

export function forgetPendingStay() {
  try { sessionStorage.removeItem(pendingStayKey); } catch { /* Storage is optional. */ }
}
