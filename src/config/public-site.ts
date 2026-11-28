export function getPublicSiteHost(value: unknown = import.meta.env.VITE_PUBLIC_SITE_URL): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new URL(value.trim()).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function getPublicSiteOrigin(value: unknown = import.meta.env.VITE_PUBLIC_SITE_URL): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}
