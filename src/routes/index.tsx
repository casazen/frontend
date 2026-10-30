import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { buildHostSiteRoutes } from './host-site-routes';
import { createHostSiteWindow } from './host-site-window';
import { getHostSite } from '@/lib/host-site';
import { SupplierLegacyPathRedirect } from './supplier-legacy-redirect';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { OnboardingGuard } from '@/components/auth/onboarding-guard';
import { AuthProviderBoundary } from '@/components/auth/auth-provider-boundary';
import { LoginPage } from '@/pages/login-page';
import { SignupPage } from '@/pages/signup-page';
import { EmailVerifiedPage } from '@/pages/email-verified-page';
import { SIGNUP_PATH } from '@/lib/signup-attribution';
import { SupplierRegisterPage } from '@/pages/supplier-register-page';
import { SupplierClaimPage } from '@/pages/supplier-claim-page';
import { HostInvitePage } from '@/pages/host-invite-page';
import { InviteAcceptPage } from '@/pages/invite-accept-page';
import { ORG_INVITE_ACCEPT_PATH } from '@/lib/org-invitation';
import { SearchPage } from '@/features/search/search-page';
import { WorkspaceProvider } from '@/contexts/workspace-provider';
import { AreaProvider } from '@/contexts/area-provider';
import { NOT_REDESIGNED_ROUTE_HANDLE } from '@/lib/ui-version';
import { ContextLayout } from '@/components/layout/context-layout';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import { ContextPickerPage } from '@/pages/context-picker-page';
import { NoAccessPage } from '@/pages/no-access-page';
import { AccountInactivePage } from '@/pages/account-inactive-page';
import { ACCOUNT_INACTIVE_PATH } from '@/lib/axios';
import { OnboardingPage } from '@/features/onboarding/onboarding-page';
import { getOrgBillingPageAlternates, ROUTE_MANIFEST, type AppContextKey } from '@/config/route-manifest';
import { LegacyRedirect } from './legacy-redirect';
import { ManifestRoute } from './manifest-route';
import { ContextIndexRoute } from './context-index-route';
import { CatchAllRedirect } from './catch-all-redirect';
import { LegacyPropertyBookingRedirect } from './legacy-property-booking-redirect';
import { PublicSiteShell } from '@/layouts/PublicSiteShell';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { OrgHomePage } from '@/features/public-site/home/org-home-page';
import { SiteSearchPage } from '@/features/public-site/search/site-search-page';
import { PublicPropertyPage } from '@/features/public-booking/public-property-page';
import { OrgPrivacyPage, OrgTermsPage } from '@/features/public-booking/org-document-page';
import { ORG_DOCUMENT_SEGMENTS } from '@/lib/org-document-paths';
import { CheckoutPage } from '@/features/public-booking/checkout-page';
import { GuestBookingsPage } from '@/features/public-booking/guest-bookings-page';
import { GuestCancelLinkPage } from '@/features/public-booking/guest-cancel-link-page';
import { OnSiteRequestConfirmPage } from '@/features/public-booking/onsite-request-confirm-page';
import { CheckoutOutcomePage } from '@/features/public-booking/checkout-outcome-page';
import { ReviewLinkPage } from '@/features/reviews/review-link-page';
import { CheckInPage } from '@/features/checkin/checkin-page';
import { RentPaymentPage } from '@/features/public-rent/rent-payment-page';
import { GuidedFormPage } from '@/features/guided-form/guided-form-page';
import { GUIDED_FORM_PATH } from '@/features/guided-form/lib/guided-form-link';
import { SUPPLIER_SHOWCASE_BASE_PATH } from '@/features/supplier/lib/showcase-paths';
import { LegacySupplierShowcaseRedirect, SupplierShowcasePage } from '@/pages/supplier-showcase';
import { SupplierAboutPage } from '@/pages/supplier-about';
import { SupplierServicePage } from '@/pages/supplier-service';
import { SupplierServicesPage } from '@/pages/supplier-services';
import { SupplierSiteShell } from '@/components/supplier-site/supplier-site-shell';
import { ComplianceGuidePage } from '@/features/public-seo/compliance-guide-page';
import { TouristTaxCalculatorPage } from '@/features/public-seo/tourist-tax-calculator-page';
import { SeoHubPage } from '@/features/public-seo/seo-hub-page';
import { LegalIndexPage } from '@/features/legal/legal-index-page';
import { DpaPage, PrivacyPage, TermsPage } from '@/features/legal/legal-document-page';
import { SubprocessorsPage } from '@/features/legal/subprocessors-page';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';
import { IcalHelpPage } from '@/features/supplier/ical-help-page';
import { ProductGuidePage } from '@/features/help/product-guide-page';
import { devRoutes } from './dev-routes';
import { ownerPortalRoutes } from './ownerPortalRoutes';

function buildContextChildren(contextKey: AppContextKey): RouteObject[] {
  const prefix = `/app/${contextKey}`;
  const entries = ROUTE_MANIFEST.filter((entry) => entry.context === contextKey);

  const children: RouteObject[] = entries.map((entry) => {
    const relativePath = entry.path === prefix ? '' : entry.path.slice(`${prefix}/`.length);
    return {
      path: relativePath,
      element: (
        <ContextRouteGuard
          contextKey={contextKey}
          requiredPermissions={entry.requiredPermissions}
          featureFlag={entry.featureFlag}
          alternatePaths={getOrgBillingPageAlternates(entry)}
          homeWhenDenied={entry.homeWhenDenied}
        >
          <ManifestRoute entry={entry} />
        </ContextRouteGuard>
      ),
    } satisfies RouteObject;
  });

  // An area with no page at its bare address (supplier) would open an empty shell: its index opens the home of the area
  // (UI-00). Short-rent, long-rent, account and admin have the page in the manifest.
  if (!entries.some((entry) => entry.path === prefix)) {
    children.unshift({ index: true, element: <ContextIndexRoute contextKey={contextKey} /> });
  }
  children.push({
    path: 'help',
    element: (
      <ContextRouteGuard contextKey={contextKey}>
        <ProductGuidePage />
      </ContextRouteGuard>
    ),
  });
  return children;
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
        {/* data-area on <html>: the accent of the area (UI-01); the area picker and the pages outside an area have none. */}
        <AreaProvider>
          <Outlet />
        </AreaProvider>
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
        path: 'account',
        element: <ContextLayout />,
        children: [...buildContextChildren('account')],
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

/** Route table of the app (exported for the routing tests; the app uses `router`). */
export const appRoutes: RouteObject[] = [
  {
    // Pages that need Auth0: reached client-side from a public page (no Auth0 loaded), they reload themselves.
    element: <AuthProviderBoundary />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <SupplierRegisterPage />,
      },
      {
        // Link of the email that invites an independent host: under Auth0 (it leads to the signup or login) but outside
        // the protected route and the onboarding guard, which would send a new account to the onboarding first.
        path: '/invito-host/:token',
        element: <HostInvitePage />,
      },
      {
        // Link of the email that invites a person to work in an org (AM-04c): the same place as the one above, for the same reason (it
        // leads to the sign-in or the sign-up, and a new account must not be sent to the onboarding before it has accepted). The secret
        // of the link is in `?token=`; the page takes it out of the address at once.
        path: ORG_INVITE_ACCEPT_PATH,
        element: <InviteAcceptPage />,
      },
      {
        // SE-03 (A8-03): CTA entry point, stores the attribution and opens the Auth0 signup screen.
        path: SIGNUP_PATH,
        element: <SignupPage />,
      },
      {
        // Auth0 verification email Redirect To. Not the OAuth callback: Auth0 adds `code=success`.
        path: '/email-verified',
        element: <EmailVerifiedPage />,
      },
      {
        // Deactivated account (PL-03): under the Auth0 boundary so that its logout button always works, but outside
        // the protected route, the onboarding guard and the workspace, which would call the API again.
        path: ACCOUNT_INACTIVE_PATH,
        element: <AccountInactivePage />,
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
    ],
  },
  {
    // Outside the onboarding guard: a supplier who signed up after registering must reach it before any host
    // onboarding redirect (SU-02).
    path: '/register/claim',
    element: <SupplierClaimPage />,
  },
  {
    path: '/book/:orgSlug',
    element: <PublicSiteShell mode="org" />,
    // The public booking site keeps its own look until DB-01: the redesign (data-ui="v2") is never applied here.
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
    children: [
      { index: true, element: <OrgHomePage /> },
      // The results of the site for a stay and a search (DB-07c): in the address, so a search can be shared and Back finds it again.
      { path: 'search', element: <SiteSearchPage /> },
      { path: 'my-bookings', element: <GuestBookingsPage /> },
      // The operator's own privacy notice and booking terms (BK-14, A3-21), not the CasaZen ones (/legale/*).
      { path: ORG_DOCUMENT_SEGMENTS.privacy, element: <OrgPrivacyPage /> },
      { path: ORG_DOCUMENT_SEGMENTS.terms, element: <OrgTermsPage /> },
      // English spelling of the terms address, e.g. typed by hand or linked by older sites.
      { path: 'terms', element: <Navigate to={`../${ORG_DOCUMENT_SEGMENTS.terms}`} relative="path" replace /> },
      // Link of the "request received" email of a "pay at the property" request (BK-06).
      { path: 'requests/:bookingId/confirm', element: <OnSiteRequestConfirmPage /> },
      // Outcome of a checkout, read with its checkout token; also the Stripe return_url of redirect methods (BK-07).
      { path: 'booking/:bookingId', element: <CheckoutOutcomePage /> },
      // The link in the email the host sends after a stay: the guest writes the review of the stay with the signed token (DB-12b).
      { path: 'booking/:bookingId/review', element: <ReviewLinkPage /> },
      // The link of the email that lets the guest cancel (DB-08a/b): what they get back today, and the cancellation, with the signed token.
      { path: 'bookings/:bookingId/cancel', element: <GuestCancelLinkPage /> },
      { path: 'property/:propertySlugOrId', element: <PublicPropertyPage /> },
      { path: 'property/:propertySlugOrId/checkout', element: <CheckoutPage /> },
      // Compat for links missing `/property/` (e.g. older mobile share URLs)
      { path: ':propertySlugOrId', element: <LegacyPropertyBookingRedirect /> },
    ],
  },
  {
    element: <PublicSiteShell mode="default" />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
    children: [
      // Public search across the booking sites (BK-20): in the public shell, never in the host console.
      { path: '/search', element: <SearchPage /> },
      { path: SEO_HUB_PATH, element: <SeoHubPage /> },
      { path: '/p/affitti-brevi/:region/:comune', element: <ComplianceGuidePage /> },
      { path: '/p/tassa-soggiorno/:comune', element: <TouristTaxCalculatorPage /> },
      // CasaZen legal documents (PL-14): public, texts provided by the product owner (D14).
      { path: LEGAL_INDEX_PATH, element: <LegalIndexPage /> },
      { path: LEGAL_DOCUMENT_PATHS.tos, element: <TermsPage /> },
      { path: LEGAL_DOCUMENT_PATHS.privacy, element: <PrivacyPage /> },
      { path: LEGAL_DOCUMENT_PATHS.dpa, element: <DpaPage /> },
      { path: LEGAL_SUBPROCESSORS_PATH, element: <SubprocessorsPage /> },
    ],
  },
  {
    // Public showcase of a supplier (SU-13, A4-16, SP-09-FE): the frame of its own, with the look the supplier chose, not the one of
    // CasaZen's public pages. It keeps the marker: the redesign of the app (`data-ui="v2"`) never reaches it.
    path: `${SUPPLIER_SHOWCASE_BASE_PATH}/:slug`,
    element: <SupplierSiteShell />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
    children: [
      { index: true, element: <SupplierShowcasePage /> },
      // The services of the supplier and one of them with its estimate (they need the list of services, so, like it, the bookings flag);
      // the story of the supplier.
      { path: 'servizi', element: <SupplierServicesPage /> },
      { path: 'servizi/:serviceSlug', element: <SupplierServicePage /> },
      { path: 'chi-siamo', element: <SupplierAboutPage /> },
    ],
  },
  {
    // The first address of the showcase, which never worked (A4-16): kept as a redirect for links already shared.
    path: '/s/:slug',
    element: <LegacySupplierShowcaseRedirect />,
  },
  {
    // A guest's page, not the host's console: it keeps its look until it is redesigned (like the booking site).
    path: '/checkin/:token',
    element: <CheckInPage />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
  },
  {
    // Link of the rent payment request email (LT-06): the tenant pays an installment on the landlord's Stripe account.
    // A tenant's page, not the landlord's console: it keeps its look until it is redesigned.
    path: '/rent/pay/:installmentId',
    element: <RentPaymentPage />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
  },
  {
    // The module of the service that prepares the contract, simulated for the test environments (CF-SIM): the signed link of a
    // contract opens it there. A public page like the real module (no sign-in); where the simulator is off the API answers 404 and
    // the page says it is not available.
    path: GUIDED_FORM_PATH,
    element: <GuidedFormPage />,
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
  // Owner portal routes (ADR-011-R6): dedicated portal with Auth0 login
  {
    element: <AuthProviderBoundary />,
    children: ownerPortalRoutes,
  },
  // Pages for the people who build the app: the dev server only, empty in a build (UI-07).
  ...devRoutes,
  {
    // Public 404 (A8-03): never a redirect to the login.
    path: '*',
    element: <CatchAllRedirect />,
  },
];

type AppRouter = ReturnType<typeof createBrowserRouter>;

let routerInstance: AppRouter | undefined;

/**
 * The router of the app, created on first use: the start-up has found out by then whether the host is the app's own or an
 * org's own host (`getHostSite`, BK-16). On an org's own host the router only knows the org's booking site and shows clean
 * addresses (`/`, `/property/…`); anywhere else it is the full app.
 */
export function getRouter(): AppRouter {
  if (!routerInstance) {
    const hostSite = getHostSite();
    routerInstance = hostSite
      ? createBrowserRouter(buildHostSiteRoutes(appRoutes), { window: createHostSiteWindow(window, hostSite.slug) })
      : createBrowserRouter(appRoutes);
  }
  return routerInstance;
}
