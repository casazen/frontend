import type { RouteObject } from 'react-router-dom';

/**
 * Pages for the people who build the app, served by the dev server only (`import.meta.env.DEV`): `/dev/primitives` shows
 * the primitives of UI-07 on one page, for the eyes and for the Playwright runs of the demo mode (axe, the widths of a
 * phone); `/dev/list-view` shows the unified list (UI-14) on made-up stays; `/dev/detail-drawer` shows the global detail
 * drawer, the timeline and the tabs between pages (UI-15); `/dev/calm-blocks` shows the calm blocks of the screens (UI-16) in
 * every variant; `/dev/stay-pickers` shows the pickers of the stay of the public site (DB-20: the range calendar with the
 * prices, the guests, the sheet and the search bar) on made-up nights. The build replaces `import.meta.env.DEV` with
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
      {
        path: '/dev/detail-drawer',
        lazy: async () => ({ Component: (await import('@/pages/dev/detail-drawer-page')).default }),
      },
      {
        path: '/dev/calm-blocks',
        lazy: async () => ({ Component: (await import('@/pages/dev/calm-blocks-page')).default }),
      },
      {
        path: '/dev/stay-pickers',
        lazy: async () => ({ Component: (await import('@/pages/dev/stay-pickers-page')).default }),
      },
    ]
  : [];
