/**
 * When the public site of CasaZen is served (SEO-VETRINA). Pure module (no alias imports, no DOM): `vite.config.ts`
 * (robots.txt), the prerender (sitemap), `src/config/vercel-build-env.ts` and the tests read it; `middleware.ts` keeps its
 * own copy of the rule, checked against this one by `src/test/site-middleware.test.ts`.
 *
 * The home page of a VAT-registered business must show its partita IVA (art. 35 DPR 633/1972), and the company does not
 * exist yet (product owner, 2026-10-13). So on Vercel **production** the public site is served only in one of two cases:
 *
 * 1. the company name (`VITE_LEGAL_NAME`) and a valid partita IVA (`VITE_LEGAL_VAT_ID`) are configured; or
 * 2. the owner chose to publish it **without a partita IVA** (`VITE_PUBLIC_SITE_WITHOUT_VAT_ID=true`), identifying the
 *    holder by name (`VITE_LEGAL_NAME`) and contact e-mail (`VITE_SUPPORT_EMAIL`). That choice needs the advice of an
 *    accountant or a lawyer first (identification of the service provider, privacy notice): it is never on by default.
 *
 * Until then `/` stays the console entry, `/funzionalita` and the other paths are not pages of the site, and neither
 * `robots.txt` nor a sitemap declares them. Preview, test and local builds always serve it (they are never indexed), so the
 * site can be reviewed before any of this exists.
 */

/** Italian partita IVA: 11 digits, optionally written with the `IT` prefix (spaces ignored). */
const VAT_ID = /^(IT)?\d{11}$/;

/** A plain e-mail address (same rule as `resolveSupportEmail`, kept here so that the module has no imports). */
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

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
  /** `VITE_SUPPORT_EMAIL`: the contact of the holder when there is no partita IVA. */
  contactEmail?: unknown;
  /** `VITE_PUBLIC_SITE_WITHOUT_VAT_ID`: the owner chose to publish the site without a partita IVA. */
  withoutVatId?: unknown;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/** True when the owner explicitly asked to publish the site without a partita IVA. */
export function isWithoutVatIdChosen(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

export function isPublicSiteEnabled({
  vercelEnv,
  legalName,
  legalVatId,
  contactEmail,
  withoutVatId,
}: PublicSiteGateInput): boolean {
  if (vercelEnv !== 'production') return true;
  if (!hasText(legalName)) return false;
  if (normalizeVatId(legalVatId) !== null) return true;
  return isWithoutVatIdChosen(withoutVatId) && typeof contactEmail === 'string' && EMAIL.test(contactEmail.trim());
}
