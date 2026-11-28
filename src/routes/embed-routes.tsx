import type { ReactElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { embedWidgetHandle, type EmbedHostMode, type EmbedWidget } from '@/features/embed/embed-context';
import { EmbedSkeleton } from '@/features/embed/embed-states';
import { NOT_REDESIGNED_ROUTE_HANDLE } from '@/lib/ui-version';

/**
 * The routes of the embeddable widgets (NF-144), declared once for the two places that serve them so that they cannot drift:
 *
 * - `platform`, the CasaZen domain: `/embed/:orgSlug/booking`, `/embed/:orgSlug/property/:propertySlugOrId`, `/embed/:orgSlug/guest-access`
 *   (in `routes/index.tsx`, next to the booking site of the platform);
 * - `host`, an agency's own domain: `/embed/booking`, `/embed/property/:propertySlugOrId`, `/embed/guest-access` (in
 *   `buildHostSiteRoutes`). There the org is the one of the host, never a parameter of the address.
 *
 * One frame with no app chrome for the three of them: `EmbedShell` is the layout, outside `PublicSiteShell` (no header, footer, cookie banner, skip
 * link or favourites), and it stays mounted when the guest moves from one widget to another inside the frame (the cards of the booking widget lead to
 * the property widget), so the conversation with the page (`ready` once, `attached`, the height, the address) never starts again. The layout has no path
 * of its own, so it never matches by itself. The elements are loaded when a route is first needed, so the widgets stay out of the main bundle of the
 * app; until then the skeleton is on the screen.
 *
 * EVERY address under `/embed` that is not one of the three widgets (`/embed`, `/embed/`, `/embed/v1/anything`, a widget with a wrong path) is the last
 * child, `EMBED_CATCH_ALL_PATH`: the shell itself, with nothing to show, which says «not available» with no link and tells the page `not_found`. It must be
 * a route of the frame and never the 404 page of the app or of the agency's site: the pages of `/embed/*` are served with `frame-ancestors https:`
 * (`vercel.json`), so the document may be framed by any page; a link of a 404 page is a navigation of the router inside that frame, which no header
 * looks at again, and it would bring the whole booking site (the guest area, the checkout with the payment) into the frame of another website.
 */
interface EmbedWidgetRoute {
  widget: EmbedWidget;
  path: string;
  load: () => Promise<{ element: ReactElement }>;
}

const WIDGET_ROUTES: readonly EmbedWidgetRoute[] = [
  {
    widget: 'booking',
    path: 'booking',
    load: async () => {
      const { BookingWidget } = await import('@/features/embed/booking-widget');
      return { element: <BookingWidget /> };
    },
  },
  {
    widget: 'property',
    path: 'property/:propertySlugOrId',
    load: async () => {
      const { PropertyWidget } = await import('@/features/embed/property-widget');
      return { element: <PropertyWidget /> };
    },
  },
  {
    widget: 'guest-access',
    path: 'guest-access',
    load: async () => {
      const { GuestAccessWidget } = await import('@/features/embed/guest-access-widget');
      return { element: <GuestAccessWidget /> };
    },
  },
];

/**
 * Everything under `/embed` that no widget route takes: the same on the two domains (the org of a widget is a parameter of the other routes, here there
 * is none). The router ranks a splat below every other route of the frame, so a widget always wins and the 404 pages of the app and of the agency's site
 * (`*`) never get an address of `/embed`. It names no widget: the shell then has nothing to show and says so.
 */
export const EMBED_CATCH_ALL_PATH = '/embed/*';

export function buildEmbedRoutes(mode: EmbedHostMode): RouteObject[] {
  const base = mode === 'host' ? '/embed' : '/embed/:orgSlug';

  return [
    {
      handle: NOT_REDESIGNED_ROUTE_HANDLE,
      HydrateFallback: EmbedSkeleton,
      lazy: async () => {
        const { EmbedShell } = await import('@/features/embed/embed-shell');
        return { element: <EmbedShell mode={mode} /> };
      },
      children: [
        ...WIDGET_ROUTES.map(({ widget, path, load }) => ({ path: `${base}/${path}`, handle: embedWidgetHandle(widget), lazy: load })),
        { path: EMBED_CATCH_ALL_PATH, element: null },
      ],
    },
  ];
}
