/**
 * Optional Plausible analytics for the SEO funnel (SE-04, #300 AC8): a configured domain means "the product owner added
 * the Plausible script to the site", and the app then also sends its funnel events to it. Without the variable
 * nothing is sent to a third party; the events always reach the CasaZen API (`POST /api/public/seo/events`) either way.
 * The script itself is not loaded by the app: see backend `docs/runbooks/seo-funnel.md`.
 */
export function resolvePlausibleDomain(value: unknown): string | null {
  const domain = typeof value === 'string' ? value.trim() : '';
  return domain.length > 0 ? domain : null;
}

export const analyticsConfig = {
  plausibleDomain: resolvePlausibleDomain(import.meta.env.VITE_PLAUSIBLE_DOMAIN),
} as const;
