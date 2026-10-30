import { hasConsent } from '@/lib/cookie-consent';

/**
 * Optional Plausible analytics for the SEO funnel (SE-04, #300 AC8): a configured domain means "the product owner added
 * the Plausible script to the site", and the app then also sends its funnel events to it. Without the variable
 * nothing is sent to a third party; with the variable, and the visitor allowing statistics, the events reach CasaZen's own API
 * (`POST /api/public/seo/events`) and Plausible; without the consent they reach neither (DB-02b, `lib/cookie-consent.ts`).
 * The script itself is not loaded by the app: see backend `docs/runbooks/seo-funnel.md`.
 */
export function resolvePlausibleDomain(value: unknown): string | null {
  const domain = typeof value === 'string' ? value.trim() : '';
  return domain.length > 0 ? domain : null;
}

const configuredPlausibleDomain = resolvePlausibleDomain(import.meta.env.VITE_PLAUSIBLE_DOMAIN);

export const analyticsConfig = {
  /**
   * The domain of Plausible while the visitor allows statistics, else null: a read without the consent finds none, so no
   * caller can send to a third party without it.
   */
  get plausibleDomain(): string | null {
    return hasConsent('statistics') ? configuredPlausibleDomain : null;
  },
};
