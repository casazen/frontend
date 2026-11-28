export const SUPPLIER_SHOWCASE_BASE_PATH = '/fornitori';

export function supplierShowcasePath(slug: string): string {
  return `${SUPPLIER_SHOWCASE_BASE_PATH}/${encodeURIComponent(slug)}`;
}
