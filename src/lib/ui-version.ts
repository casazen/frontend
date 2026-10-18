/**
 * Which look the app has: the redesign is the only one. `index.html` sets `<html data-ui="v2">`, styled by
 * `src/styles/tokens.css` and `fonts.css`, and `UiVersionSync` takes the attribute off where the app is not redesigned yet:
 * on a route marked `NOT_REDESIGNED_ROUTE_HANDLE` (the public booking site and the pages of guests and tenants) and on an
 * org's own host. Those are migrated by their own tasks (DB-01...), which drop the marker.
 */

/**
 * `handle` of a route that is not part of the redesign yet (and of every route under it): the public booking site, the
 * check-in page of a guest, the rent payment page of a tenant. `UiVersionSync` takes `data-ui` off there. A page that gets
 * its redesign drops the marker.
 */
export const NOT_REDESIGNED_ROUTE_HANDLE = { redesign: false } as const;

/** True when one of the matched routes is marked as not redesigned yet. */
export function isNotRedesignedMatch(matches: readonly { route: { handle?: unknown } }[] | null): boolean {
  return (matches ?? []).some(({ route }) => (route.handle as { redesign?: unknown } | undefined)?.redesign === false);
}
