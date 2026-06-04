import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { LoginPage } from '@/pages/login-page';
import { SearchPage } from '@/features/search/search-page';
import { WorkspaceProvider } from '@/contexts/workspace-provider';
import { ContextLayout } from '@/components/layout/context-layout';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import { ContextPickerPage } from '@/pages/context-picker-page';
import { NoAccessPage } from '@/pages/no-access-page';
import { ROUTE_MANIFEST, type AppContextKey } from '@/config/route-manifest';
import { LegacyRedirect } from './legacy-redirect';
import { ManifestRoute } from './manifest-route';

function buildContextChildren(contextKey: AppContextKey): RouteObject[] {
  const prefix = `/app/${contextKey}`;
  const entries = ROUTE_MANIFEST.filter((entry) => entry.context === contextKey);

  return entries.map((entry) => {
    const relativePath = entry.path === prefix ? '' : entry.path.slice(`${prefix}/`.length);
    return {
      path: relativePath,
      element: (
        <ContextRouteGuard contextKey={contextKey} requiredPermissions={entry.requiredPermissions}>
          <ManifestRoute entry={entry} />
        </ContextRouteGuard>
      ),
    } satisfies RouteObject;
  });
}

const legacyPaths = Array.from(
  new Set(
    ROUTE_MANIFEST.flatMap((entry) => entry.legacyPaths ?? [])
      .filter((path) => path !== '/'),
  ),
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/search',
    element: <SearchPage />,
  },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <WorkspaceProvider>
          <Outlet />
        </WorkspaceProvider>
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'choose-context',
        element: <ContextPickerPage />,
      },
      {
        path: 'no-access',
        element: <NoAccessPage />,
      },
      {
        path: 'short-rent',
        element: <ContextLayout />,
        children: [
          ...buildContextChildren('short-rent'),
        ],
      },
      {
        path: 'long-rent',
        element: <ContextLayout />,
        children: [
          ...buildContextChildren('long-rent'),
        ],
      },
      {
        path: 'admin',
        element: <ContextLayout />,
        children: [
          ...buildContextChildren('admin'),
        ],
      },
    ],
  },
  {
    element: (
      <ProtectedRoute>
        <WorkspaceProvider>
          <LegacyRedirect />
        </WorkspaceProvider>
      </ProtectedRoute>
    ),
    children: [],
    path: '/',
  },
  ...legacyPaths.map((path) => ({
    path,
    element: (
      <ProtectedRoute>
        <WorkspaceProvider>
          <LegacyRedirect />
        </WorkspaceProvider>
      </ProtectedRoute>
    ),
  })),
  {
    path: '*',
    element: <Navigate to="/app/choose-context" replace />,
  },
]);
