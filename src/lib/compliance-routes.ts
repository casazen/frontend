import { generatePath } from 'react-router-dom';
import { getManifestEntry, type PermissionPredicate } from '@/config/route-manifest';
import type { BookingTab } from '@/features/bookings/lib/booking-tabs';
import type { ComplianceCockpitAction, ComplianceSummaryItem } from '@/types/compliance.types';

/** A page of the ROUTE_MANIFEST (pattern with `:id`), optionally on a tab of the booking detail. */
export interface ComplianceActionRoute {
  path: string;
  tab?: BookingTab;
}

export interface ComplianceActionTarget {
  /** What the id of the item is. */
  target: 'property' | 'booking';
  /** The screen where the host does what the cockpit asks. */
  route: ComplianceActionRoute;
  /** Read-only screen for a user without the permissions of `route` (the guard would send them to the dashboard). */
  fallback?: ComplianceActionRoute;
}

/**
 * Screen of every cockpit action (CO-04, A5-09). The API sends an action and its target, never a path: the route is
 * built here from the ROUTE_MANIFEST, so a renamed page breaks the tests instead of sending the host to the dashboard.
 * Every action is short-rent: the cockpit is the short-stay compliance of the host.
 */
export const COMPLIANCE_ACTION_TARGETS: Record<ComplianceCockpitAction, ComplianceActionTarget> = {
  // The wizard opens on the first blocking step still open, computed by the server (CO-05); a suspended property too.
  ActivateProperty: {
    target: 'property',
    route: { path: '/app/short-rent/properties/:id/activation' },
    fallback: { path: '/app/short-rent/properties/:id' },
  },
  // The item counts stays whose guest data are incomplete for Alloggiati Web: the Alloggiati tab shows what is missing,
  // guest by guest, with the host form "Modifica ospiti" (CO-09, CO-12). Same tab as every "complete the guest data"
  // link of the app (`guestDataCompletionPath`); the check-in link to send or copy is on the next tab, "Ospite".
  CompleteGuestCheckIn: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'alloggiati' },
  },
  CheckOut: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id/checkout' },
    fallback: { path: '/app/short-rent/bookings/:id' },
  },
  // Alloggiati tab: status, deadline, per-guest data to copy on the portal, manual declaration (CO-11).
  SendAlloggiati: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'alloggiati' },
  },
  ResolveAlloggiatiFailure: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'alloggiati' },
  },
  // Stay checked out, property not declared ready (CO-17): the check-out page shows what was declared and the
  // declaration "ready".
  ConfirmPropertyReady: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id/checkout' },
    fallback: { path: '/app/short-rent/bookings/:id' },
  },
};

function buildRoute(route: ComplianceActionRoute, id: string, hasPermission?: PermissionPredicate): string | null {
  const entry = getManifestEntry(route.path);
  if (!entry) return null;
  if (hasPermission && !entry.requiredPermissions.every((permission) => hasPermission(entry.context, permission))) {
    return null;
  }
  const path = generatePath(entry.path, { id });
  return route.tab && route.tab !== 'details' ? `${path}?tab=${route.tab}` : path;
}

/**
 * Route of a cockpit item, or null when there is none to offer: an action unknown to this version of the app, an item
 * without its target, or a user who can open neither the screen nor its read-only fallback.
 */
export function complianceActionRoute(
  item: Pick<ComplianceSummaryItem, 'action' | 'propertyId' | 'bookingId'>,
  hasPermission?: PermissionPredicate,
): string | null {
  const target = Object.hasOwn(COMPLIANCE_ACTION_TARGETS, item.action) ? COMPLIANCE_ACTION_TARGETS[item.action] : undefined;
  if (!target) return null;
  const id = target.target === 'property' ? item.propertyId : item.bookingId;
  if (!id) return null;
  return (
    buildRoute(target.route, id, hasPermission) ??
    (target.fallback ? buildRoute(target.fallback, id, hasPermission) : null)
  );
}
