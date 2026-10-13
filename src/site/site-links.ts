import type { SitePageId } from './site-pages';

/**
 * `SIGNUP_PATH` of `@/lib/signup-attribution`, written here because that module loads the API client, which the static
 * pages must not ship; `src/site/__tests__/site-links.test.ts` keeps the two equal.
 */
export const SITE_SIGNUP_PATH = '/signup';

/** Self-serve registration of suppliers (SU-01): any comune of the official list. */
export const SUPPLIER_REGISTER_PATH = '/register';

/**
 * Signup link of a call to action of the public site: `/signup` with the UTM set that the signup attribution records
 * (SE-03, `SignupAttributionRules`: letters, digits and hyphens only here), so the admin report tells the public site
 * apart from the SEO guides (`utm_source=seo-compliance`).
 */
export function signupHref(page: SitePageId, position: string): string {
  const params = new URLSearchParams({
    utm_source: 'casazen-site',
    utm_medium: 'cta',
    utm_content: `${page}-${position}`,
  });
  return `${SITE_SIGNUP_PATH}?${params.toString()}`;
}
