/**
 * Which look the app has (UI-01, decisions 01-D8 and D26): the current one, or the redesign, which is `<html data-ui="v2">`
 * and is styled by `src/styles/tokens.css` and `fonts.css`. Without the attribute the app looks as it did before the
 * redesign; `src/styles/__tests__/tokens.test.ts` keeps it that way.
 *
 * The redesign is on when any of these is true (`UiVersionSync` applies it):
 *  - the backend flag `uiRedesign` (`GET /api/public/features`, off when absent or unreadable);
 *  - `localStorage['casazen:ui'] === 'v2'`, to try it in one browser (QA): `localStorage.setItem('casazen:ui', 'v2')`;
 *  - the build has `VITE_UI_V2=true` (a preview deployment, a local run).
 * It is never on a route marked `NOT_REDESIGNED_ROUTE_HANDLE` (the public booking site and the pages of guests and
 * tenants): those are migrated by their own tasks (DB-01...), which drop the marker.
 */

/** `localStorage` key of the QA override. */
export const UI_VERSION_STORAGE_KEY = 'casazen:ui';

/**
 * `handle` of a route that is not part of the redesign yet (and of every route under it): the public booking site, the
 * check-in page of a guest, the rent payment page of a tenant. `UiVersionSync` leaves the app as it is there. A page that
 * gets its redesign drops the marker.
 */
export const NOT_REDESIGNED_ROUTE_HANDLE = { redesign: false } as const;

/** `window.localStorage`, or null where reading it throws (blocked storage, some privacy modes). */
function browserStorage(): Pick<Storage, 'getItem'> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** QA and build overrides, readable at once (no request): the flag of the API is the other way to turn the redesign on. */
export function isUiV2Override(
  storage: Pick<Storage, 'getItem'> | null = browserStorage(),
  buildFlag: unknown = import.meta.env.VITE_UI_V2,
): boolean {
  if (buildFlag === 'true') return true;
  try {
    return storage?.getItem(UI_VERSION_STORAGE_KEY) === 'v2';
  } catch {
    return false;
  }
}

/** True when one of the matched routes is marked as not redesigned yet. */
export function isNotRedesignedMatch(matches: readonly { route: { handle?: unknown } }[] | null): boolean {
  return (matches ?? []).some(({ route }) => (route.handle as { redesign?: unknown } | undefined)?.redesign === false);
}

/** Sets or removes `data-ui="v2"` on `<html>`. */
export function applyUiVersion(enabled: boolean, root: HTMLElement = document.documentElement): void {
  if (enabled) root.setAttribute('data-ui', 'v2');
  else root.removeAttribute('data-ui');
}
