import { lazy } from 'react';
import { registerDetail } from '@/components/shared/detail-drawer/detail-registry';
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
