/**
 * Path of a supplier's public showcase in the web app (SU-13). Only the path: the absolute URL comes from the API
 * (`publicUrl`, built on the configured `App:PublicSiteBaseUrl`), so no domain is written here (decision D3).
 */
export const SUPPLIER_SHOWCASE_BASE_PATH = '/fornitori';

export function supplierShowcasePath(slug: string): string {
  return `${SUPPLIER_SHOWCASE_BASE_PATH}/${encodeURIComponent(slug)}`;
}
