import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import type { AppContextKey, PermissionPredicate } from '@/config/route-manifest';
import { CommandPaletteProvider } from '../command-palette-provider';
import type { RemoteCommandSource } from '../types';
import { HarnessPage } from './harness-page';
import { makeContext } from './test-context';

export interface ShellOptions {
  /** The areas of the user. Default: short rent. */
  areas?: AppContextKey[];
  activeArea?: AppContextKey;
  hasPermission?: PermissionPredicate;
  flags?: Partial<FeatureFlags>;
  /** What the pages loaded: the palette reads it. */
  queryClient?: QueryClient;
  /** Who is signed in: without one nothing is remembered. */
  userId?: string | null;
  path?: string;
  remoteSource?: RemoteCommandSource;
  /** More things in the page. */
  page?: React.ReactNode;
}

/**
 * The shell as the palette sees it: a router, the workspace of the user, the flags, the cache of the queries, and the
 * provider with the search of the header and a page. `makeContext` answers the questions of the workspace, so the palette is
 * asked what the sources of the tests were asked.
 */
export function renderShell(options: ShellOptions = {}) {
  const areas = options.areas ?? ['short-rent'];
  const activeArea = options.activeArea ?? areas[0];
  const context = makeContext({ areas, activeArea, hasPermission: options.hasPermission, flags: options.flags });
  const client = options.queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const contexts = areas.map((contextKey) => ({
    contextKey,
    displayName: contextKey,
    roleKey: contextKey,
    permissions: [],
    defaultRoute: `/app/${contextKey}`,
  }));

  const view = render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, ...options.flags }, isLoading: false }}>
        <WorkspaceContext.Provider
          value={{
            contexts,
            activeContext: activeArea,
            isReady: true,
            setActiveContext: vi.fn(),
            hasPermission: context.hasPermission,
            getDefaultRoute: context.getDefaultRoute,
          }}
        >
          <MemoryRouter initialEntries={[options.path ?? `/app/${activeArea}`]}>
            <CommandPaletteProvider
              contextKey={activeArea}
              userId={options.userId === undefined ? 'auth0|test-user' : options.userId}
              remoteSource={options.remoteSource}
            >
              <HarnessPage extra={options.page} />
            </CommandPaletteProvider>
          </MemoryRouter>
        </WorkspaceContext.Provider>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );

  return {
    ...view,
    client,
    /** The search of the header (by test id: it is hidden from the role queries while the palette is open). */
    trigger: () => screen.getByTestId('command-palette-trigger'),
    location: () => screen.getByTestId('location').textContent,
  };
}
