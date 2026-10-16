import { lazy } from 'react';
import { registerDetail } from '@/components/shared/detail-drawer/detail-registry';

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
