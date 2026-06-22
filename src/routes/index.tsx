import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { OnboardingGuard } from '@/components/auth/onboarding-guard';
import { LoginPage } from '@/pages/login-page';
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
import { PublicBookingShell } from '@/components/layout/public-booking-shell';
import { OrgLandingPage } from '@/features/public-booking/org-landing-page';
import { PublicPropertyPage } from '@/features/public-booking/public-property-page';
import { CheckoutPage } from '@/features/public-booking/checkout-page';
import { GuestBookingsPage } from '@/features/public-booking/guest-bookings-page';
import { CheckInPage } from '@/features/checkin/checkin-page';
import { ComplianceGuidePage } from '@/features/public-seo/compliance-guide-page';
import { TouristTaxCalculatorPage } from '@/features/public-seo/tourist-tax-calculator-page';
import { SupplierShell } from '@/features/supplier/supplier-shell';
import { SupplierActivationPage } from '@/features/supplier/supplier-activation-page';
import { SupplierInboxPage } from '@/features/supplier/supplier-inbox-page';
import { SupplierProfilePage } from '@/features/supplier/supplier-profile-page';
import { SupplierAvailabilityPage } from '@/features/supplier/supplier-availability-page';

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
    path: '/search',
    element: (
      <WorkspaceProvider>
        <SearchPage />
      </WorkspaceProvider>
    ),
  },
  {
    path: '/book/:orgSlug',
    element: <PublicBookingShell />,
    children: [
      { index: true, element: <OrgLandingPage /> },
      { path: 'my-bookings', element: <GuestBookingsPage /> },
      { path: 'property/:propertyId', element: <PublicPropertyPage /> },
      { path: 'property/:propertyId/checkout', element: <CheckoutPage /> },
    ],
  },
  {
    path: '/checkin/:token',
    element: <CheckInPage />,
  },
  {
    path: '/p/affitti-brevi/:region/:comune',
    element: <ComplianceGuidePage />,
  },
  {
    path: '/p/tassa-soggiorno/:comune',
    element: <TouristTaxCalculatorPage />,
  },
  {
    path: '/supplier',
    element: (
      <ProtectedRoute role="Supplier">
        <SupplierShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/supplier/inbox" replace /> },
      { path: 'activation', element: <SupplierActivationPage /> },
      { path: 'inbox', element: <SupplierInboxPage /> },
      { path: 'profile', element: <SupplierProfilePage /> },
      { path: 'availability', element: <SupplierAvailabilityPage /> },
    ],
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
    element: <Navigate to="/app/choose-context" replace />,
  },
]);
