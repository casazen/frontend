import { GuestLinkedSection } from '@/features/guest-portal/guest-linked-section';
import { linkedStayPaths } from '@/features/guest-portal/linked-stay-paths';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { buildEmbedRoutes } from './embed-routes';
import { buildHostSiteRoutes } from './host-site-routes';
import { createHostSiteWindow } from './host-site-window';
import { getHostSite } from '@/lib/host-site';
import { MARKETING_CONFIRM_PATH, UNSUBSCRIBE_PATH, WELCOME_PATH } from '@/lib/marketing-link-paths';
import { SupplierLegacyPathRedirect } from './supplier-legacy-redirect';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { OnboardingGuard } from '@/components/auth/onboarding-guard';
import { AuthProviderBoundary } from '@/components/auth/auth-provider-boundary';
import { LoginPage } from '@/pages/login-page';
import { AccountInvitationPage } from '@/pages/account-invitation-page';
import { ACCOUNT_INVITATION_PATH } from '@/lib/account-invitation';
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
import { ConnectWordPressPage } from '@/features/connect/connect-wordpress-page';
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
import { DoorCheckInPage } from '@/pages/DoorCheckInPage';
import { ConfirmPage } from '@/features/public-marketing/confirm-page';
import { UnsubscribePage } from '@/features/public-marketing/unsubscribe-page';
import { WelcomePage } from '@/features/public-marketing/welcome-page';
import { RentPaymentPage } from '@/features/public-rent/rent-payment-page';
import { ServicePaymentPage } from '@/features/public-service-payment/service-payment-page';
import { GuidedFormPage } from '@/features/guided-form/guided-form-page';
import { GUIDED_FORM_PATH } from '@/features/guided-form/lib/guided-form-link';
import { SUPPLIER_SHOWCASE_BASE_PATH } from '@/features/supplier/lib/showcase-paths';
import { SupplierShowcasePage } from '@/pages/supplier-showcase';
import { GuestAccountStaysPage, guestAccountStaysPath } from '@/features/guest-portal/guest-account-stays-page';
import { GuestPortalEntry } from '@/features/guest-portal/guest-portal-page';
import { SupplierAboutPage } from '@/pages/supplier-about';
import { SupplierBookingConfirmPage } from '@/pages/supplier-booking-confirm';
import { SupplierBookingPage } from '@/pages/supplier-booking';
import { SupplierInquiryPage } from '@/pages/supplier-inquiry';
import { PublicFiscalDocumentPage } from '@/pages/public/PublicFiscalDocumentPage';
import { SupplierRequestPage } from '@/pages/supplier-request';
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
import { tenantAreaRoutes } from './tenantAreaRoutes';

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
          permissionMode={entry.permissionMode}
          featureFlag={entry.featureFlag}
          alternatePaths={getOrgBillingPageAlternates(entry)}
          homeWhenDenied={entry.homeWhenDenied}
        >
          <ManifestRoute entry={entry} />
        </ContextRouteGuard>
      ),
    } satisfies RouteObject;
  });

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
        // The page the plugin for WordPress opens to be linked to the agency account (PLG-FE-CONSOLE, NF-201): `/app/connect/wordpress?site=…&return=…&state=…&challenge=…&method=S256`. Inside the
        // signed-in app (a visitor who is not signed in goes to the sign-in through `ProtectedRoute` and comes back to this very address, query included) and outside every area: no menu, no
        // tabs, one block. It is not in the route manifest, which lists the pages of an area; its flag (`SiteEmbed`) and its permission (billing administrator) are read by the page itself.
        path: 'connect/wordpress',
        element: <ConnectWordPressPage />,
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

export const appRoutes: RouteObject[] = [
  {
    element: <AuthProviderBoundary />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: ACCOUNT_INVITATION_PATH,
        element: <AccountInvitationPage />,
      },
      {
        path: '/register',
        element: <SupplierRegisterPage />,
      },
      {
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
        path: SIGNUP_PATH,
        element: <SignupPage />,
      },
      {
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
          { path: guestAccountStaysPath, element: <GuestAccountStaysPage /> },
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
    path: '/register/claim',
    element: <SupplierClaimPage />,
  },
  {
    path: '/book/:orgSlug',
    element: <PublicSiteShell mode="org" />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
    children: [
      { index: true, element: <OrgHomePage /> },
      { path: 'search', element: <SiteSearchPage /> },
      { path: 'my-bookings', element: <GuestBookingsPage /> },
      { path: ORG_DOCUMENT_SEGMENTS.privacy, element: <OrgPrivacyPage /> },
      { path: ORG_DOCUMENT_SEGMENTS.terms, element: <OrgTermsPage /> },
      { path: 'terms', element: <Navigate to={`../${ORG_DOCUMENT_SEGMENTS.terms}`} relative="path" replace /> },
      { path: 'requests/:bookingId/confirm', element: <OnSiteRequestConfirmPage /> },
      { path: 'booking/:bookingId', element: <CheckoutOutcomePage /> },
      { path: 'booking/:bookingId/review', element: <GuestLinkedSection action="review" legacy><ReviewLinkPage /></GuestLinkedSection> },
      { path: 'bookings/:bookingId/cancel', element: <GuestLinkedSection action="cancellation" legacy><GuestCancelLinkPage /></GuestLinkedSection> },
      { path: 'property/:propertySlugOrId', element: <PublicPropertyPage /> },
      { path: 'property/:propertySlugOrId/checkout', element: <CheckoutPage /> },
      { path: ':propertySlugOrId', element: <LegacyPropertyBookingRedirect /> },
    ],
  },
  ...buildEmbedRoutes('platform'),
  {
    element: <PublicSiteShell mode="default" />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
    children: [
      { path: '/search', element: <SearchPage /> },
      { path: SEO_HUB_PATH, element: <SeoHubPage /> },
      { path: '/p/affitti-brevi/:region/:comune', element: <ComplianceGuidePage /> },
      { path: '/p/tassa-soggiorno/:comune', element: <TouristTaxCalculatorPage /> },
      { path: LEGAL_INDEX_PATH, element: <LegalIndexPage /> },
      { path: LEGAL_DOCUMENT_PATHS.tos, element: <TermsPage /> },
      { path: LEGAL_DOCUMENT_PATHS.privacy, element: <PrivacyPage /> },
      { path: LEGAL_DOCUMENT_PATHS.dpa, element: <DpaPage /> },
      { path: LEGAL_SUBPROCESSORS_PATH, element: <SubprocessorsPage /> },
    ],
  },
  {
    path: `${SUPPLIER_SHOWCASE_BASE_PATH}/:slug`,
    element: <SupplierSiteShell />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
    children: [
      { index: true, element: <SupplierShowcasePage /> },
      { path: 'servizi', element: <SupplierServicesPage /> },
      { path: 'servizi/:serviceSlug', element: <SupplierServicePage /> },
      { path: 'chi-siamo', element: <SupplierAboutPage /> },
      { path: 'prenota', element: <SupplierBookingPage /> },
      { path: 'conferma', element: <SupplierBookingConfirmPage /> },
      { path: 'richiesta', element: <SupplierRequestPage /> },
      { path: 'preventivo', element: <SupplierInquiryPage /> },
    ],
  },
  {
    path: '/s/action/org/:orgSlug',
    element: <PublicSiteShell mode="org" />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
    children: [
      { path: linkedStayPaths.review, element: <GuestLinkedSection action="review"><ReviewLinkPage /></GuestLinkedSection> },
      { path: linkedStayPaths.cancellation, element: <GuestLinkedSection action="cancellation"><GuestCancelLinkPage /></GuestLinkedSection> },
    ],
  },
  { path: linkedStayPaths.checkin, element: <GuestLinkedSection action="checkin"><CheckInPage /></GuestLinkedSection>, handle: NOT_REDESIGNED_ROUTE_HANDLE },
  { path: linkedStayPaths.documents, element: <GuestLinkedSection action="documents"><PublicFiscalDocumentPage /></GuestLinkedSection>, handle: NOT_REDESIGNED_ROUTE_HANDLE },
  {
    path: '/s/:slug',
    element: <GuestPortalEntry />,
  },
  {
    // The page the QR code at the door of a property opens (E22/F02/US01/T01): the guest who arrives types the booking code (or the surname) and the arrival date and goes on to the
    // check-in of the stay at the identity step. No sign-in (`/checkin` is a public path), the frame of the check-in, not indexed (`robots.txt` keeps `/checkin/` out). It exists only while the
    // flag `checkInIdentityVerification` is on; the page itself shows the public 404 otherwise.
    path: '/checkin/porta/:doorToken',
    element: <DoorCheckInPage />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
  },
  {
    path: '/checkin/:token',
    element: <GuestLinkedSection action="checkin" legacy><CheckInPage /></GuestLinkedSection>,
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
    path: '/service/pay/:paymentId',
    element: <ServicePaymentPage />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
  },
  {
    // Link of the e-mail that sends a guest the document of the stay (E12/F02/US02): `/documents/view/:documentId?token=…`. A guest's page, no sign-in (Auth0 is not
    // loaded there, `isPublicUnauthenticatedPath`), not indexed, never behind a flag: an e-mail already sent must keep working. The token of the link is the only proof;
    // the page takes it out of the address bar. It keeps its look until it is redesigned (like the pages above).
    path: '/documents/view/:documentId',
    element: <GuestLinkedSection action="documents" legacy><PublicFiscalDocumentPage /></GuestLinkedSection>,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
  },
  {
    // The unsubscribe link of a marketing e-mail (CRM-08, NF-95): `/unsubscribe#orgId=…&emailHash=…&expiresAt=…&signature=…`. A public page of
    // a guest (no sign-in, no menu, not indexed, no analytics), never behind the `crmMarketing` flag: an e-mail already sent must keep
    // working. The signed values are in the fragment, which no server receives; the page takes them out of the address bar.
    path: UNSUBSCRIBE_PATH,
    element: <UnsubscribePage />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
  },
  {
    path: MARKETING_CONFIRM_PATH,
    element: <ConfirmPage />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
  },
  {
    path: WELCOME_PATH,
    element: <WelcomePage />,
    handle: NOT_REDESIGNED_ROUTE_HANDLE,
  },
  {
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
  {
    element: <AuthProviderBoundary />,
    children: ownerPortalRoutes,
  },
  {
    element: <AuthProviderBoundary />,
    children: tenantAreaRoutes,
  },
  ...devRoutes,
  {
    path: '*',
    element: <CatchAllRedirect />,
  },
];

type AppRouter = ReturnType<typeof createBrowserRouter>;

let routerInstance: AppRouter | undefined;

export function getRouter(): AppRouter {
  if (!routerInstance) {
    const hostSite = getHostSite();
    routerInstance = hostSite
      ? createBrowserRouter(buildHostSiteRoutes(appRoutes, hostSite), { window: createHostSiteWindow(window, hostSite.slug) })
      : createBrowserRouter(appRoutes);
  }
  return routerInstance;
}
