import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { SupplierLegacyPathRedirect } from './supplier-legacy-redirect';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { OnboardingGuard } from '@/components/auth/onboarding-guard';
import { LoginPage } from '@/pages/login-page';
import { SupplierRegisterPage } from '@/pages/supplier-register-page';
import { SearchPage } from '@/features/search/search-page';
import { WorkspaceProvider } from '@/contexts/workspace-provider';
import { ContextLayout } from '@/components/layout/context-layout';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import { ContextPickerPage } from '@/pages/context-picker-page';
import { NoAccessPage } from '@/pages/no-access-page';
import { OnboardingPage } from '@/features/onboarding/onboarding-page';
import { ROUTE_MANIFEST, type AppContextKey } from '@/config/route-manifest';
import { LegacyRedirect } from './legacy-redirect';
import { ManifestRoute } from './manifest-route';
import { CatchAllRedirect } from './catch-all-redirect';
import { LegacyPropertyBookingRedirect } from './legacy-property-booking-redirect';
import { PublicSiteShell } from '@/layouts/PublicSiteShell';
import { OrgLandingPage } from '@/features/public-booking/org-landing-page';
import { PublicPropertyPage } from '@/features/public-booking/public-property-page';
import { CheckoutPage } from '@/features/public-booking/checkout-page';
import { GuestBookingsPage } from '@/features/public-booking/guest-bookings-page';
import { CheckInPage } from '@/features/checkin/checkin-page';
import { SupplierCheckInPage } from '@/pages/supplier-check-in';
import { SupplierShowcasePage } from '@/pages/supplier-showcase';
import { ComplianceGuidePage } from '@/features/public-seo/compliance-guide-page';
import { TouristTaxCalculatorPage } from '@/features/public-seo/tourist-tax-calculator-page';
import { IcalHelpPage } from '@/features/supplier/ical-help-page';

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

const workspaceRoutes: RouteObject[] = [
  {
    path: '/app',
    element: (
      <WorkspaceProvider>
        <Outlet />
      </WorkspaceProvider>
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
        children: [...buildContextChildren('short-rent')],
      },
      {
        path: 'long-rent',
        element: <ContextLayout />,
        children: [...buildContextChildren('long-rent')],
      },
      {
        path: 'admin',
        element: <ContextLayout />,
        children: [...buildContextChildren('admin')],
      },
      {
        path: 'supplier',
        element: <ContextLayout />,
        children: [...buildContextChildren('supplier')],
      },
    ],
  },
  {
    path: '/',
    element: (
      <WorkspaceProvider>
        <LegacyRedirect />
      </WorkspaceProvider>
    ),
  },
  ...legacyPaths.map((path) => ({
    path,
    element: (
      <WorkspaceProvider>
        <LegacyRedirect />
      </WorkspaceProvider>
    ),
  })),
];

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <SupplierRegisterPage />,
  },
  {
    path: '/search',
    element: (
      <WorkspaceProvider>
        <SearchPage />
      </WorkspaceProvider>
    ),
  },
  {
    path: '/book/:orgSlug',
    element: <PublicSiteShell mode="org" />,
    children: [
      { index: true, element: <OrgLandingPage /> },
      { path: 'my-bookings', element: <GuestBookingsPage /> },
      { path: 'property/:propertySlugOrId', element: <PublicPropertyPage /> },
      { path: 'property/:propertySlugOrId/checkout', element: <CheckoutPage /> },
      // Compat for links missing `/property/` (e.g. older mobile share URLs)
      { path: ':propertySlugOrId', element: <LegacyPropertyBookingRedirect /> },
    ],
  },
  {
    element: <PublicSiteShell mode="default" />,
    children: [
      { path: '/p/affitti-brevi/:region/:comune', element: <ComplianceGuidePage /> },
      { path: '/p/tassa-soggiorno/:comune', element: <TouristTaxCalculatorPage /> },
    ],
  },
  {
    path: '/s/:slug',
    element: <SupplierShowcasePage />,
  },
  {
    path: '/check-in/:jobId',
    element: <SupplierCheckInPage />,
  },
  {
    path: '/checkin/:token',
    element: <CheckInPage />,
  },
  {
    path: '/supplier',
    element: <Navigate to="/app/supplier/inbox" replace />,
  },
  {
    path: '/supplier/*',
    element: <SupplierLegacyPathRedirect />,
  },
  {
    path: '/help/ical',
    element: <IcalHelpPage />,
  },
  {
    element: (
      <ProtectedRoute>
        <Outlet />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/onboarding',
        element: <OnboardingPage />,
      },
      {
        element: <OnboardingGuard />,
        children: workspaceRoutes,
      },
    ],
  },
  {
    path: '*',
    element: <CatchAllRedirect />,
  },
]);
