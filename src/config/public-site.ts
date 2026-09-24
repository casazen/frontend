/**
 * Host of the public web app, from `VITE_PUBLIC_SITE_URL` (the same domain as the backend `App__PublicSiteBaseUrl`).
 * No default domain in code (decision D3): `null` when the variable is not set (Vercel previews, local) or not a URL.
 */
export function getPublicSiteHost(value: unknown = import.meta.env.VITE_PUBLIC_SITE_URL): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new URL(value.trim()).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Origin (scheme, host and port) of the public web app, from `VITE_PUBLIC_SITE_URL`; `null` when the variable is not
 * set or not an http(s) URL. The backend accepts Stripe return pages only on this origin (PL-11).
 */
export function getPublicSiteOrigin(value: unknown = import.meta.env.VITE_PUBLIC_SITE_URL): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}
