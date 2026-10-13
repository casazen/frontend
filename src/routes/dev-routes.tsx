import type { RouteObject } from 'react-router-dom';

/**
 * Pages for the people who build the app, served by the dev server only (`import.meta.env.DEV`): `/dev/primitives` shows
 * the primitives of UI-07 on one page, for the eyes and for the Playwright runs of the demo mode (axe, the widths of a
 * phone); `/dev/list-view` shows the unified list (UI-14) on made-up stays. The build replaces `import.meta.env.DEV` with
 * `false`, so this list is empty there and the pages are not in the bundle (a test reads the list with the flag off; the
 * build log of the PR says what `dist/` holds).
 */
export const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/primitives',
        lazy: async () => ({ Component: (await import('@/pages/dev/ui-primitives-page')).default }),
      },
      {
        path: '/dev/list-view',
        lazy: async () => ({ Component: (await import('@/pages/dev/list-view-page')).default }),
      },
    ]
  : [];
