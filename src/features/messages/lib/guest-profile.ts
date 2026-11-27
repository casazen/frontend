import { ROUTE_MANIFEST, hasEntryPermission, isEntryFeatureEnabled, type PermissionPredicate } from '@/config/route-manifest';
import type { FeatureFlags } from '@/config/feature-flags';

/**
 * The page of the guest in the manifest. The profile of the customer (CRM-01, epic E07) has its own page behind its flag, keyed by a
 * profile of its own that a conversation does not carry; the page of the guest record is the one that is built from the id of the guest
 * of the booking, which is what the conversation gives.
 */
const GUEST_PAGE = '/app/short-rent/guests/:id';

/**
 * Where «Apri il profilo dell'ospite» leads, built from the id of the guest of the conversation; `null` when there is no guest (a request
 * has no booking yet) or when the page is not in the manifest, is behind a flag that is off, or asks a permission the user lacks: the
 * link is hidden then, never a link that ends on the page of no access.
 */
export function guestProfilePath(guestId: string | null | undefined, hasPermission?: PermissionPredicate, features?: Partial<FeatureFlags>): string | null {
  const page = ROUTE_MANIFEST.find((entry) => entry.path === GUEST_PAGE);
  if (!guestId || !page || !hasEntryPermission(page, hasPermission) || !isEntryFeatureEnabled(page, features)) return null;
  return page.path.replace(':id', encodeURIComponent(guestId));
}
