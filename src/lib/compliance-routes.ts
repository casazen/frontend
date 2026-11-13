import { generatePath } from 'react-router-dom';
import { getManifestEntry, type PermissionPredicate } from '@/config/route-manifest';
import type { BookingTab } from '@/features/bookings/lib/booking-tabs';
import type { ComplianceCockpitAction, ComplianceSummaryItem } from '@/types/compliance.types';

/** The kinds of proof the archive page can open on (`ManualProofKind` of the backend): the one a period item is about. */
type ComplianceArchiveKind = 'AlloggiatiReceipt' | 'IstatProof' | 'TouristTaxDeclaration' | 'TouristTaxPayment';

/** The months of the periods the backend sends (`yyyy-MM`): the only shape the address of the archive takes. */
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Parameters a page of the cockpit opens with, for a page that shows its content already filtered (the archive of the proofs): a fixed
 * `kind`, and, when asked, the `property` and the `period` (`yyyy-MM`) of the item. A parameter the item cannot give is left out: the page then
 * shows more than the item, never another thing.
 */
interface ComplianceActionQuery {
  kind?: ComplianceArchiveKind;
  property?: boolean;
  period?: boolean;
}

/** A page of the ROUTE_MANIFEST (pattern with `:id`), optionally on a tab of the booking detail or with the filters of the archive. */
export interface ComplianceActionRoute {
  path: string;
  tab?: BookingTab;
  query?: ComplianceActionQuery;
}

export interface ComplianceActionTarget {
  /** What the id of the item is. */
  target: 'property' | 'booking';
  /** The screen where the host does what the cockpit asks. */
  route: ComplianceActionRoute;
  /** Read-only screen for a user without the permissions of `route` (the guard would send them to the dashboard). */
  fallback?: ComplianceActionRoute;
  /** The permission that does what the action asks: whoever lacks it is led to the page ("Apri"), not told to do it. */
  write: 'property.write' | 'booking.write' | 'payment.write';
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
    write: 'property.write',
  },
  // The item counts stays whose guest data are incomplete for Alloggiati Web: the Alloggiati tab shows what is missing,
  // guest by guest, with the host form "Modifica ospiti" (CO-09, CO-12). Same tab as every "complete the guest data"
  // link of the app (`guestDataCompletionPath`); the check-in link to send or copy is on the next tab, "Ospite".
  CompleteGuestCheckIn: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'alloggiati' },
    write: 'booking.write',
  },
  CheckOut: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id/checkout' },
    fallback: { path: '/app/short-rent/bookings/:id' },
    write: 'booking.write',
  },
  // Alloggiati tab: status, deadline, per-guest data to copy on the portal, manual declaration (CO-11).
  SendAlloggiati: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'alloggiati' },
    write: 'booking.write',
  },
  ResolveAlloggiatiFailure: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'alloggiati' },
    write: 'booking.write',
  },
  // Stay checked out, property not declared ready (CO-17): the check-out page shows what was declared and the
  // declaration "ready".
  ConfirmPropertyReady: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id/checkout' },
    fallback: { path: '/app/short-rent/bookings/:id' },
    write: 'booking.write',
  },

  // CHK-12 (E03/F02/US01/T03, NF-52): the actions the traffic light adds. Each opens a page that already exists in the ROUTE_MANIFEST.
  //
  // The identity of the guest who leaves the document: the "Documenti" tab of the booking, where the check-in link and what the guest
  // sent are (the tab `guest`, the one the online check-in lives in).
  VerifyIdentity: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'guest' },
    write: 'booking.write',
  },
  // The receipt of a communication that was sent: the Alloggiati section of the booking, where the stay's communication is followed
  // (the item targets one stay, so it opens the stay and not the archive, which has no stay to filter on).
  UploadAlloggiatiReceipt: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'alloggiati' },
    write: 'booking.write',
  },
  // The send of the channel manager is the property's: its page.
  ActivateOctorateSend: {
    target: 'property',
    route: { path: '/app/short-rent/properties/:id' },
    write: 'property.write',
  },
  // A stay the channel manager does not send by itself: the same section as every Alloggiati to send by hand (CO-11).
  SendAlloggiatiManually: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'alloggiati' },
    write: 'booking.write',
  },
  // The proof of an ISTAT period and the tax of a month: the archive of the proofs, opened on the kind, the property and the month.
  UploadIstatProof: {
    target: 'property',
    route: { path: '/app/short-rent/alloggiati/reports', query: { kind: 'IstatProof', property: true, period: true } },
    write: 'booking.write',
  },
  EnterMunicipalityTaxRate: {
    target: 'property',
    route: { path: '/app/short-rent/properties/:id' },
    write: 'property.write',
  },
  // The receipt of a tax declaration is a record of money: whoever may not write payments is led to the archive and told "Apri".
  DeclareTouristTax: {
    target: 'property',
    route: { path: '/app/short-rent/alloggiati/reports', query: { kind: 'TouristTaxDeclaration', property: true, period: true } },
    write: 'payment.write',
  },
  // The credentials of the police portal are those of Alloggiati Web: its dashboard.
  RenewPoliceCredentials: {
    target: 'property',
    route: { path: '/app/short-rent/alloggiati' },
    write: 'booking.write',
  },
};

function buildRoute(
  route: ComplianceActionRoute,
  id: string,
  item: Pick<ComplianceSummaryItem, 'propertyId' | 'period'>,
  hasPermission?: PermissionPredicate,
): string | null {
  const entry = getManifestEntry(route.path);
  if (!entry) return null;
  if (hasPermission && !entry.requiredPermissions.every((permission) => hasPermission(entry.context, permission))) {
    return null;
  }
  const path = generatePath(entry.path, { id });
  const params = new URLSearchParams();
  if (route.tab && route.tab !== 'details') params.set('tab', route.tab);
  if (route.query?.kind) params.set('kind', route.query.kind);
  if (route.query?.property && item.propertyId) params.set('property', item.propertyId);
  if (route.query?.period && item.period && PERIOD.test(item.period)) params.set('period', item.period);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Route of a cockpit item, or null when there is none to offer: an action unknown to this version of the app, an item
 * without its target, or a user who can open neither the screen nor its read-only fallback. An item about a month (`period`) opens the
 * archive on that month, that property and that kind of proof.
 */
export function complianceActionRoute(
  item: Pick<ComplianceSummaryItem, 'action' | 'propertyId' | 'bookingId' | 'period'>,
  hasPermission?: PermissionPredicate,
): string | null {
  const target = Object.hasOwn(COMPLIANCE_ACTION_TARGETS, item.action) ? COMPLIANCE_ACTION_TARGETS[item.action] : undefined;
  if (!target) return null;
  const id = target.target === 'property' ? item.propertyId : item.bookingId;
  if (!id) return null;
  return (
    buildRoute(target.route, id, item, hasPermission) ??
    (target.fallback ? buildRoute(target.fallback, id, item, hasPermission) : null)
  );
}
