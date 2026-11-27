import { generatePath } from 'react-router-dom';
import { getManifestEntry, type PermissionPredicate } from '@/config/route-manifest';
import type { BookingTab } from '@/features/bookings/lib/booking-tabs';
import { CONNECTION_HEALTH_SECTION } from '@/features/compliance/lib/connection-health-model';
import { SWISS_LAYER_KIND, swissLayerPath } from '@/features/compliance/swiss/swiss-layer-address';
import { COMPLIANCE_COCKPIT_PATH, TICINO_LAYER_KIND, ticinoLayerPath } from '@/features/compliance/ticino/ticino-layer-address';
import type { ComplianceCockpitAction, ComplianceSummaryItem } from '@/types/compliance.types';

type ComplianceArchiveKind = 'AlloggiatiReceipt' | 'IstatProof' | 'TouristTaxDeclaration' | 'TouristTaxPayment';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Parameters a page of the cockpit opens with, for a page that shows its content already filtered (the archive of the proofs): a fixed
 * `kind`, and, when asked, the `property` and the `period` (`yyyy-MM`) of the item. A parameter the item cannot give is left out: the page then
 * shows more than the item, never another thing. `section` is a fixed part of the page to open on (the connection health of the property page).
 * `layer` is a layer of the page that opens on the item instead of another page (`?detail=ticino:<property>:<day>`, E30/F02/US03; `?detail=swiss-notification:<property>:<day>`,
 * E31/F02/US02): the item names the property and, in `period`, the arrival day (a month, or anything that is not a day, is left out: the layer then opens on the first day to notify).
 */
interface ComplianceActionQuery {
  kind?: ComplianceArchiveKind;
  property?: boolean;
  period?: boolean;
  section?: typeof CONNECTION_HEALTH_SECTION;
  layer?: typeof TICINO_LAYER_KIND | typeof SWISS_LAYER_KIND;
}

export interface ComplianceActionRoute {
  path: string;
  tab?: BookingTab;
  query?: ComplianceActionQuery;
}

export interface ComplianceActionTarget {
  target: 'property' | 'booking';
  route: ComplianceActionRoute;
  fallback?: ComplianceActionRoute;
  write: 'property.write' | 'booking.write' | 'payment.write' | 'alloggiati.submit';
  noPage?: true;
}

/**
 * Screen of every cockpit action (CO-04, A5-09). The API sends an action and its target, never a path: the route is
 * built here from the ROUTE_MANIFEST, so a renamed page breaks the tests instead of sending the host to the dashboard.
 * Every action is short-rent: the cockpit is the short-stay compliance of the host.
 */
export const COMPLIANCE_ACTION_TARGETS: Record<ComplianceCockpitAction, ComplianceActionTarget> = {
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
  ConfirmPropertyReady: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id/checkout' },
    fallback: { path: '/app/short-rent/bookings/:id' },
    write: 'booking.write',
  },

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
  ActivateOctorateSend: {
    target: 'property',
    route: { path: '/app/short-rent/compliance/sender', query: { property: true } },
    fallback: { path: '/app/short-rent/properties/:id', query: { section: CONNECTION_HEALTH_SECTION } },
    write: 'property.write',
  },
  // A stay the channel manager does not send by itself: the same section as every Alloggiati to send by hand (CO-11).
  SendAlloggiatiManually: {
    target: 'booking',
    route: { path: '/app/short-rent/bookings/:id', tab: 'alloggiati' },
    write: 'booking.write',
  },
  // The proof of an ISTAT period and the tax of a month: the archive of the proofs, opened on the kind, the property and the month. The archive lets only who may submit the Alloggiati upload a proof
  // (`alloggiati.submit`, the page itself asks it): whoever may only read the bookings is led to the page and told "Apri", never asked to upload what the page will not let them.
  UploadIstatProof: {
    target: 'property',
    route: { path: '/app/short-rent/alloggiati/reports', query: { kind: 'IstatProof', property: true, period: true } },
    write: 'alloggiati.submit',
  },
  // The rate of the municipality is entered in the guided check-in of a stay, at the step «Imposta di soggiorno»: the item is the property's and names no stay, and the page of the
  // property has no field for it. So there is no button (INC-14); the reason of the item says where to enter it.
  EnterMunicipalityTaxRate: {
    target: 'property',
    route: { path: '/app/short-rent/properties/:id' },
    write: 'property.write',
    noPage: true,
  },
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
  // casazen/backend#979: the guided notification of a Ticino property to the cantonal police, on the arrival day of the item. It is a layer over the cockpit (E30/F02/US03/T02:
  // `?detail=ticino:<property>:<day>`), not a page: the cockpit asks what its own route asks (`property.read` and `booking.read`), and whoever may not declare the day
  // (`alloggiati.submit`) is told «Apri» and sees the guests and the file but is not asked to declare it.
  NotifyTicinoPolice: {
    target: 'property',
    route: { path: COMPLIANCE_COCKPIT_PATH, query: { layer: TICINO_LAYER_KIND } },
    write: 'alloggiati.submit',
  },
  // casazen/backend#979 (E31/F02/US02/T02): the assisted notification of the guests of a property in another canton to the cantonal authority, on the arrival day of the item. A layer over the
  // cockpit too (`?detail=swiss-notification:<property>:<day>`): it asks what the cockpit asks (`property.read` and `booking.read`), and whoever may not declare the day
  // (`alloggiati.submit`) is told «Apri» and sees the guests to copy but is not asked to declare it.
  NotifyGuestsAuthority: {
    target: 'property',
    route: { path: COMPLIANCE_COCKPIT_PATH, query: { layer: SWISS_LAYER_KIND } },
    write: 'alloggiati.submit',
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
  if (route.query?.layer === TICINO_LAYER_KIND) return ticinoLayerPath(item.propertyId, item.period);
  if (route.query?.layer === SWISS_LAYER_KIND) return swissLayerPath(item.propertyId, item.period);
  const path = generatePath(entry.path, { id });
  const params = new URLSearchParams();
  if (route.tab && route.tab !== 'details') params.set('tab', route.tab);
  if (route.query?.kind) params.set('kind', route.query.kind);
  if (route.query?.property && item.propertyId) params.set('property', item.propertyId);
  if (route.query?.period && item.period && PERIOD.test(item.period)) params.set('period', item.period);
  if (route.query?.section) params.set('section', route.query.section);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function complianceActionRoute(
  item: Pick<ComplianceSummaryItem, 'action' | 'propertyId' | 'bookingId' | 'period'>,
  hasPermission?: PermissionPredicate,
): string | null {
  const target = Object.hasOwn(COMPLIANCE_ACTION_TARGETS, item.action) ? COMPLIANCE_ACTION_TARGETS[item.action] : undefined;
  if (!target || target.noPage) return null;
  const id = target.target === 'property' ? item.propertyId : item.bookingId;
  if (!id) return null;
  return (
    buildRoute(target.route, id, item, hasPermission) ??
    (target.fallback ? buildRoute(target.fallback, id, item, hasPermission) : null)
  );
}

export function isCurrentAddress(address: string, location: { pathname: string; search: string }): boolean {
  const [path, query = ''] = address.split('?');
  if (path !== location.pathname) return false;
  const here = new URLSearchParams(location.search);
  return [...new URLSearchParams(query)].every(([name, value]) => here.get(name) === value);
}
