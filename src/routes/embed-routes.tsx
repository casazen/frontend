import type { ReactElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { EmbedHostMode, EmbedWidget } from '@/features/embed/embed-context';
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
 * Every route is a frame with no app chrome: `EmbedShell` is its layout, outside `PublicSiteShell` (no header, footer, cookie banner, skip
 * link or favourites). The elements are loaded when a route is first needed, so the widgets stay out of the main bundle of the app; until then
 * the skeleton is on the screen. No other address under `/embed` exists: the layout has no path of its own, so `/embed` alone and any other
 * path are «not found».
 */
interface EmbedWidgetRoute {
  widget: EmbedWidget;
  /** The path under the base of the widgets of an org. */
  path: string;
  /** The widget itself, as the content of the shell. */
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

export function buildEmbedRoutes(mode: EmbedHostMode): RouteObject[] {
  const base = mode === 'host' ? '/embed' : '/embed/:orgSlug';

  return WIDGET_ROUTES.map(({ widget, path, load }) => ({
    path: `${base}/${path}`,
    // The page of a guest-facing frame keeps its look until it is redesigned (like the booking site): the redesign of the console never reaches it.
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
    // What the frame shows while the shell is being loaded.
    HydrateFallback: EmbedSkeleton,
    lazy: async () => {
      const { EmbedShell } = await import('@/features/embed/embed-shell');
      return { element: <EmbedShell widget={widget} mode={mode} /> };
    },
    children: [{ index: true, lazy: load }],
  }));
}
