/**
 * The addresses of the pages of the Marketplace of Affitti brevi (MKT): Scopri (which shows the five groups), a category, Cerca, Attivi.
 * The old page of the categories, `…/categories`, leads to Scopri (`MarketplaceCategoriesRedirect`).
 */

export const MARKETPLACE_PATH = '/app/short-rent/marketplace';
/** The base of the pages of one category (`…/categories/cleaning`); the address alone leads to Scopri. */
export const MARKETPLACE_CATEGORIES_PATH = `${MARKETPLACE_PATH}/categories`;
export const MARKETPLACE_SEARCH_PATH = `${MARKETPLACE_PATH}/search`;
/** «Attivi» (the tab was «Le mie app»): the integrations the host has on. */
export const MARKETPLACE_MINE_PATH = `${MARKETPLACE_PATH}/mine`;

/** The page where the channels are connected: the connect-your-channels wizard starts there, and the groups that wait for it lead to it. */
export const CHANNELS_PAGE_PATH = '/app/short-rent/channels';

/** The parameter of the address that holds the property the marketplace is about. */
export const MARKETPLACE_PROPERTY_PARAM = 'propertyId';

/** The parameter of the address that holds the words of the search. */
export const MARKETPLACE_QUERY_PARAM = 'q';

/** The parameters of the address of a list of suppliers: the order and «Solo verificati». */
export const MARKETPLACE_SORT_PARAM = 'sort';
export const MARKETPLACE_VERIFIED_PARAM = 'verified';

/**
 * The parameter of the address of Scopri that opens the detail card of an integration: `?entry=<kind>:<code>`
 * (`?entry=Channel:AIRBNB`). The address can be shared and opens the card on load.
 */
export const MARKETPLACE_ENTRY_PARAM = 'entry';

/** The page of a category: `/app/short-rent/marketplace/categories/cleaning`. */
export const marketplaceCategoryPath = (category: string) => `${MARKETPLACE_CATEGORIES_PATH}/${encodeURIComponent(category)}`;

/** The page of a supplier, which can be shared: `/app/short-rent/marketplace/suppliers/<orgId>`. */
export const marketplaceSupplierPath = (orgId: string) => `${MARKETPLACE_PATH}/suppliers/${encodeURIComponent(orgId)}`;

/**
 * Where the guided activation of a sales channel or a connected tool starts: `/app/short-rent/marketplace/activate/channel/<code>`.
 * The wizard takes `channel` or `tool` whichever way the catalog writes the kind (`Channel`, `Tool`). The routes of the wizards are
 * registered by the tasks of the guided activation.
 */
export const marketplaceActivationPath = (kind: string, code: string) =>
  `${MARKETPLACE_PATH}/activate/${encodeURIComponent(kind.toLowerCase())}/${encodeURIComponent(code)}`;

/** Where the request of a function of the license of the channel manager starts: `/app/short-rent/marketplace/request/<moduleCode>`. */
export const marketplaceFunctionRequestPath = (moduleCode: string) => `${MARKETPLACE_PATH}/request/${encodeURIComponent(moduleCode)}`;

/** Where the guided hand-off to an external partner starts: `/app/short-rent/marketplace/partners/<code>/activate`. */
export const marketplacePartnerActivationPath = (code: string) => `${MARKETPLACE_PATH}/partners/${encodeURIComponent(code)}/activate`;

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
