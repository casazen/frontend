import { lazy } from 'react';
import { registerDetail } from '@/components/shared/detail-drawer/detail-registry';
import { SWISS_LAYER_KIND } from '@/features/compliance/swiss/swiss-layer-address';
import { TICINO_LAYER_KIND } from '@/features/compliance/ticino/ticino-layer-address';
import { GUEST_REGISTER_LAYER_KIND } from '@/features/properties/lib/guest-register-address';
import { interventionPath } from '@/features/service-requests/interventions/paths';

/**
 * What the detail drawer (UI-15) can show, in the one file the shell loads: a kind exists only once its module has run, and
 * the pages are lazy chunks, so a link with `?detail=booking:…` or a Home that opens a booking would find nothing unless the
 * kind were registered here. Each content is a `lazy` component: the registration is a few lines, the content is fetched when
 * the drawer opens.
 */
registerDetail('booking', {
  title: 'detailDrawer.booking.title',
  Content: lazy(() => import('@/features/bookings/booking-drawer').then((module) => ({ default: module.BookingDrawerContent }))),
  pageHref: (id) => `/app/short-rent/bookings/${id}`,
});

// The other things the Timeline of the host calendar (SR-02) shows: a portal's reservation and the host's own block. They have no page
// of their own; their drawer finds them in the days of the calendar on screen.
registerDetail('ical', {
  title: lazy(() => import('@/features/bookings/calendar-item-drawers').then((module) => ({ default: module.BlockDrawerTitle }))),
  Content: lazy(() => import('@/features/bookings/calendar-item-drawers').then((module) => ({ default: module.IcalDrawerContent }))),
});

registerDetail('block', {
  title: lazy(() => import('@/features/bookings/calendar-item-drawers').then((module) => ({ default: module.BlockDrawerTitle }))),
  Content: lazy(() => import('@/features/bookings/calendar-item-drawers').then((module) => ({ default: module.BlockDrawerContent }))),
});

// An intervention of a supplier (SR-08): the calendar, the Home and the list of the interventions open it with the id of the request,
// which the server reads for its host (`GET /api/service-requests/:id`); its page is one press away.
registerDetail('intervention', {
  title: lazy(() => import('@/features/service-requests/interventions/intervention-drawer').then((module) => ({ default: module.InterventionDrawerTitle }))),
  Content: lazy(() => import('@/features/service-requests/interventions/intervention-drawer').then((module) => ({ default: module.InterventionDrawerContent }))),
  pageHref: (id) => interventionPath(id),
});

// The guided notification of the guests of a Ticino property to the cantonal police (E30/F02/US03/T02, casazen/backend#979): `?detail=ticino:<property>[:<day>]` over the cockpit
// of the adempimenti. The cockpit row, the bell, the page of the property and the old address of the page open it; it has no page of its own (the layer replaced it).
registerDetail(TICINO_LAYER_KIND, {
  title: lazy(() => import('@/features/compliance/ticino/ticino-notification-layer').then((module) => ({ default: module.TicinoLayerTitle }))),
  Content: lazy(() => import('@/features/compliance/ticino/ticino-notification-layer').then((module) => ({ default: module.TicinoLayerContent }))),
  width: 'wide',
});

// The assisted notification of the guests of a property in another canton to the cantonal authority (E31/F02/US02/T02, casazen/backend#979): `?detail=swiss-notification:<property>[:<day>]`
// over the cockpit of the adempimenti, as the Ticino one. The cockpit row, the bell and the card of the regime of the property page open it; it has no page of its own. Hidden while
// `Features:GuestRegistrationRegimes` is off.
registerDetail(SWISS_LAYER_KIND, {
  title: lazy(() => import('@/features/compliance/swiss/swiss-notification-layer').then((module) => ({ default: module.SwissLayerTitle }))),
  Content: lazy(() => import('@/features/compliance/swiss/swiss-notification-layer').then((module) => ({ default: module.SwissLayerContent }))),
  width: 'wide',
});

// The guest register of a property in Switzerland (E31/F02/US02/T01, casazen/backend#979): `?detail=guest-register:<property>` over the page that is open (the property page, where the
// card of the regime opens it). The deep link is the drawer: no page, no route of the manifest. Hidden while `Features:GuestRegistrationRegimes` is off.
registerDetail(GUEST_REGISTER_LAYER_KIND, {
  title: lazy(() => import('@/features/properties/components/guest-register-layer').then((module) => ({ default: module.GuestRegisterLayerTitle }))),
  Content: lazy(() => import('@/features/properties/components/guest-register-layer').then((module) => ({ default: module.GuestRegisterLayerContent }))),
});
