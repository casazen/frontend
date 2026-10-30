/** The addresses of the pages of the Marketplace of Affitti brevi (MKT): Scopri, Categorie, a category, Cerca, Le mie app. */

export const MARKETPLACE_PATH = '/app/short-rent/marketplace';
export const MARKETPLACE_CATEGORIES_PATH = `${MARKETPLACE_PATH}/categories`;
export const MARKETPLACE_SEARCH_PATH = `${MARKETPLACE_PATH}/search`;
/** «Le mie app»: what the host already uses of the marketplace. */
export const MARKETPLACE_MINE_PATH = `${MARKETPLACE_PATH}/mine`;

/** The parameter of the address that holds the property the marketplace is about. */
export const MARKETPLACE_PROPERTY_PARAM = 'propertyId';

/** The parameter of the address that holds the words of the search. */
export const MARKETPLACE_QUERY_PARAM = 'q';

/** The parameters of the address of a list of suppliers: the order and «Solo verificati». */
export const MARKETPLACE_SORT_PARAM = 'sort';
export const MARKETPLACE_VERIFIED_PARAM = 'verified';

/** The page of a category: `/app/short-rent/marketplace/categories/cleaning`. */
export const marketplaceCategoryPath = (category: string) => `${MARKETPLACE_CATEGORIES_PATH}/${encodeURIComponent(category)}`;

/**
 * `path` with the property the marketplace is about (and any other parameter given): every link of the marketplace carries the
 * property, so that going from Scopri to a category or to a supplier stays on the property that was chosen.
 */
export function marketplaceHref(path: string, propertyId: string | null | undefined, extra: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  if (propertyId) params.set(MARKETPLACE_PROPERTY_PARAM, propertyId);
  for (const [name, value] of Object.entries(extra)) {
    if (value) params.set(name, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
