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
