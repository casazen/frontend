export const MARKETPLACE_PATH = '/app/short-rent/marketplace';
export const MARKETPLACE_CATEGORIES_PATH = `${MARKETPLACE_PATH}/categories`;
export const MARKETPLACE_SEARCH_PATH = `${MARKETPLACE_PATH}/search`;
export const MARKETPLACE_MINE_PATH = `${MARKETPLACE_PATH}/mine`;

export const CHANNELS_PAGE_PATH = '/app/short-rent/channels';

export const MARKETPLACE_PROPERTY_PARAM = 'propertyId';

export const MARKETPLACE_QUERY_PARAM = 'q';

export const MARKETPLACE_SORT_PARAM = 'sort';
export const MARKETPLACE_VERIFIED_PARAM = 'verified';

export const MARKETPLACE_ENTRY_PARAM = 'entry';

export const marketplaceCategoryPath = (category: string) => `${MARKETPLACE_CATEGORIES_PATH}/${encodeURIComponent(category)}`;

export const marketplaceSupplierPath = (orgId: string) => `${MARKETPLACE_PATH}/suppliers/${encodeURIComponent(orgId)}`;

export const marketplaceActivationPath = (kind: string, code: string) =>
  `${MARKETPLACE_PATH}/activate/${encodeURIComponent(kind.toLowerCase())}/${encodeURIComponent(code)}`;

export const marketplaceFunctionRequestPath = (moduleCode: string) => `${MARKETPLACE_PATH}/request/${encodeURIComponent(moduleCode)}`;

export const marketplacePartnerActivationPath = (code: string) => `${MARKETPLACE_PATH}/partners/${encodeURIComponent(code)}/activate`;

export function marketplaceHref(path: string, propertyId: string | null | undefined, extra: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  if (propertyId) params.set(MARKETPLACE_PROPERTY_PARAM, propertyId);
  for (const [name, value] of Object.entries(extra)) {
    if (value) params.set(name, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
