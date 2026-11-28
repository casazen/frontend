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

registerDetail('ical', {
  title: lazy(() => import('@/features/bookings/calendar-item-drawers').then((module) => ({ default: module.BlockDrawerTitle }))),
  Content: lazy(() => import('@/features/bookings/calendar-item-drawers').then((module) => ({ default: module.IcalDrawerContent }))),
});

registerDetail('block', {
  title: lazy(() => import('@/features/bookings/calendar-item-drawers').then((module) => ({ default: module.BlockDrawerTitle }))),
  Content: lazy(() => import('@/features/bookings/calendar-item-drawers').then((module) => ({ default: module.BlockDrawerContent }))),
});

registerDetail('intervention', {
  title: lazy(() => import('@/features/service-requests/interventions/intervention-drawer').then((module) => ({ default: module.InterventionDrawerTitle }))),
  Content: lazy(() => import('@/features/service-requests/interventions/intervention-drawer').then((module) => ({ default: module.InterventionDrawerContent }))),
  pageHref: (id) => interventionPath(id),
});

registerDetail(TICINO_LAYER_KIND, {
  title: lazy(() => import('@/features/compliance/ticino/ticino-notification-layer').then((module) => ({ default: module.TicinoLayerTitle }))),
  Content: lazy(() => import('@/features/compliance/ticino/ticino-notification-layer').then((module) => ({ default: module.TicinoLayerContent }))),
  width: 'wide',
});

registerDetail(SWISS_LAYER_KIND, {
  title: lazy(() => import('@/features/compliance/swiss/swiss-notification-layer').then((module) => ({ default: module.SwissLayerTitle }))),
  Content: lazy(() => import('@/features/compliance/swiss/swiss-notification-layer').then((module) => ({ default: module.SwissLayerContent }))),
  width: 'wide',
});

registerDetail(GUEST_REGISTER_LAYER_KIND, {
  title: lazy(() => import('@/features/properties/components/guest-register-layer').then((module) => ({ default: module.GuestRegisterLayerTitle }))),
  Content: lazy(() => import('@/features/properties/components/guest-register-layer').then((module) => ({ default: module.GuestRegisterLayerContent }))),
});
