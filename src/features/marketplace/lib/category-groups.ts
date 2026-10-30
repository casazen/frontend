import type { SupplierPicker } from '@/types/service-request';

/** A row of Scopri shows at most this many suppliers of a category; «Vedi tutti» leads to the page of the category. */
export const CATEGORY_ROW_LIMIT = 6;

export interface CategoryGroup {
  /** A code of the catalog (`GET api/service-categories`). */
  category: string;
  /** Every supplier of the list that offers the category, in the order of the list. */
  suppliers: SupplierPicker[];
}

/** How many suppliers of the list offer each category: a supplier counts in each category it offers. */
export function countByCategory(suppliers: readonly SupplierPicker[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const supplier of suppliers) {
    for (const category of new Set(supplier.categories)) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The rows of Scopri (MKT): one for each category of the catalog that has suppliers around the property, the one with the most
 * suppliers first and then by name (`label` gives the name in the language of the page). A supplier is in the row of each category
 * it offers. A category that is not in the catalog (an old value of a profile) has no row: there is no page to lead to.
 */
export function categoryRows(
  suppliers: readonly SupplierPicker[],
  catalog: readonly string[],
  label: (category: string) => string,
  locale: string,
): CategoryGroup[] {
  return catalog
    .map((category) => ({ category, suppliers: suppliers.filter((supplier) => supplier.categories.includes(category)) }))
    .filter((group) => group.suppliers.length > 0)
    .sort(
      (a, b) => b.suppliers.length - a.suppliers.length || label(a.category).localeCompare(label(b.category), locale),
    );
}
