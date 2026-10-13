/**
 * When the public site of CasaZen is served (SEO-VETRINA). Pure module (no alias imports, no DOM): `vite.config.ts`
 * (robots.txt), the prerender (sitemap), `src/config/vercel-build-env.ts` and the tests read it; `middleware.ts` keeps its
 * own copy of the rule, checked against this one by `src/test/site-middleware.test.ts`.
 *
 * The home page of a VAT-registered business must show its partita IVA (art. 35 DPR 633/1972), and the company does not
 * exist yet (product owner, 2026-10-13). So on Vercel **production** the public site is served only when the company name
 * (`VITE_LEGAL_NAME`) and a valid partita IVA (`VITE_LEGAL_VAT_ID`) are configured: until then `/` stays the console entry,
 * `/prezzi` and the other paths are not pages of the site, and neither `robots.txt` nor a sitemap declares them. Preview,
 * test and local builds always serve it (they are never indexed), so the site can be reviewed before the company exists.
 */

/** Italian partita IVA: 11 digits, optionally written with the `IT` prefix (spaces ignored). */
const VAT_ID = /^(IT)?\d{11}$/;

/** The partita IVA as written on the site (`IT` + 11 digits), or null when the value is not one. */
export function normalizeVatId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/\s+/g, '').toUpperCase();
  if (!VAT_ID.test(compact)) return null;
  return compact.startsWith('IT') ? compact : `IT${compact}`;
}

export interface PublicSiteGateInput {
  /** `VERCEL_ENV` (`production`, `preview`, `development`), undefined outside Vercel. */
  vercelEnv: string | undefined;
  legalName: unknown;
  legalVatId: unknown;
}

export function isPublicSiteEnabled({ vercelEnv, legalName, legalVatId }: PublicSiteGateInput): boolean {
  if (vercelEnv !== 'production') return true;
  return typeof legalName === 'string' && legalName.trim() !== '' && normalizeVatId(legalVatId) !== null;
}
