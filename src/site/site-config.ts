import { resolveSupportEmail } from '@/config/support.config';
import { normalizeVatId } from './site-gate';

/**
 * Company data of CasaZen shown by the public site (SEO-VETRINA): the footer of every page and the JSON-LD `Organization`
 * of the home page. It comes only from the build configuration (no value is written in code, decision D3):
 *
 * - `VITE_LEGAL_NAME` (ragione sociale), `VITE_LEGAL_VAT_ID` (partita IVA), `VITE_LEGAL_ADDRESS` (sede legale);
 * - `VITE_SUPPORT_EMAIL` (contact address, the one the app already shows);
 * - `VITE_PUBLIC_SITE_URL` (origin of the canonical URLs and of the sitemap).
 *
 * The partita IVA must be on the home page of the website of a VAT-registered business (art. 35 DPR 633/1972): on Vercel
 * production the site is served only once name and partita IVA are configured (`site-gate.ts`). Elsewhere a missing value
 * is simply not shown.
 */
export interface SiteLegal {
  name: string | null;
  vatId: string | null;
  address: string | null;
  email: string | null;
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

export function readSiteLegal(env: Record<string, unknown>): SiteLegal {
  return {
    name: text(env.VITE_LEGAL_NAME, 200),
    vatId: normalizeVatId(env.VITE_LEGAL_VAT_ID),
    address: text(env.VITE_LEGAL_ADDRESS, 300),
    email: resolveSupportEmail(env.VITE_SUPPORT_EMAIL),
  };
}

/** `https://host[:port]` of `VITE_PUBLIC_SITE_URL`, or null when it is missing or not an https origin. */
export function readSiteOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}
