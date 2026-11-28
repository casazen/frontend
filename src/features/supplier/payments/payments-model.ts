export const PAYMENTS_TAB = 'pagamenti';

/**
 * Where the pages point to the payments account of the supplier: the "Pagamenti" tab of the settings. The page of the settings is also
 * the address the server sends the supplier back to from Stripe (`?stripe_return=1`, `?stripe_refresh=1`, built by the API in SP-14, with
 * no tab): it is never renamed, and the marks alone open this tab.
 */
export const SUPPLIER_PAYMENTS_PATH = `/app/supplier/settings?tab=${PAYMENTS_TAB}`;

export type StripeMark = 'return' | 'refresh';

export function stripeMarkOf(params: URLSearchParams): StripeMark | null {
  if (params.get('stripe_return') === '1') return 'return';
  if (params.get('stripe_refresh') === '1') return 'refresh';
  return null;
}

export type RequirementGroup = 'person' | 'business' | 'bank' | 'terms' | 'other';

const GROUPS_IN_ORDER: RequirementGroup[] = ['person', 'business', 'bank', 'terms', 'other'];

export function requirementGroupOf(field: string): RequirementGroup {
  if (field === 'external_account' || field.startsWith('external_account.')) return 'bank';
  if (/^(individual|representative|relationship|person_|directors|owners|executives)/.test(field)) return 'person';
  if (/^(company|business_profile|business_type)/.test(field)) return 'business';
  if (field.startsWith('tos_acceptance')) return 'terms';
  return 'other';
}

export function requirementGroups(fields: readonly string[]): RequirementGroup[] {
  const found = new Set(fields.map(requirementGroupOf));
  return GROUPS_IN_ORDER.filter((group) => found.has(group));
}
