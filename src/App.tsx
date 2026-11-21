import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AppToaster } from '@/components/shared/app-toaster';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { AuthAppProviders, PublicAppProviders } from '@/contexts/auth-bridge';
import { FeatureFlagsProvider } from '@/contexts/feature-flags-provider';
import { ownerPortalPaths, SIGN_IN_FAILED_STATE } from '@/features/owner-portal/paths';
import { useAuth } from '@/hooks/use-auth';
import { isEmbedPath } from '@/lib/embed-path';
import { queryClient } from '@/lib/query-client';
import {
  ACCOUNT_INACTIVE_PATH,
  NO_ACCESS_PATH,
  setApiAccountInactiveHandler,
  setApiForbiddenHandler,
  setApiOnboardingRequiredHandler,
} from '@/lib/axios';
import { openOnboardingAfterGate } from '@/lib/onboarding-gate';
import { hostNeedsAuth, isPublicUnauthenticatedPath, isSecureAuth0Origin, isSignInErrorReturn } from '@/lib/secure-origin';
import { safeReturnTo } from '@/lib/auth-return-to';
import { recordLandingTouch } from '@/lib/signup-attribution';
import { stashOwnerInvitationToken } from '@/lib/owner-invitation';
import { stashOwnerContactToken } from '@/lib/owner-contact-invitation';
import { parsePendingSupplierClaim, savePendingSupplierClaim } from '@/lib/supplier-claim';
import { InsecureOriginPage } from '@/pages/insecure-origin-page';
import { getRouter } from '@/routes';
import { UiVersionSync } from '@/routes/ui-version-sync';
import { I18nLocaleSync } from '@/i18n/i18n-locale-sync';
import { getHostSite } from '@/lib/host-site';

function AppShell() {
  const router = getRouter();
  useEffect(() => {
    // 403 on a protected read → existing no-access page. `replace` keeps Back from reopening the
    // forbidden page (which would 403 again). On the own domain of an agency `/app/*` is «not found» and the only protected reads are those of the owner portal: the page of that
    // domain says the account has no access to this agency and gives the way out (sign out), instead of a «not found» with no way to leave the account.
    const noAccessPath = getHostSite() !== null ? ownerPortalPaths.noAccess : NO_ACCESS_PATH;
    setApiForbiddenHandler(() => {
      if (router.state.location.pathname !== noAccessPath) {
        void router.navigate(noAccessPath, { replace: true });
      }
    });
    // 403 onboarding_required (PL-02): the backend withholds the host features until the onboarding and the current
    // consents; open the onboarding (the wizard shows the consents step), never the no-access page.
    setApiOnboardingRequiredHandler(() => {
      openOnboardingAfterGate(router, queryClient);
    });
    // 403 account_inactive (PL-03): the account was deactivated, every request would fail. Show the dedicated page
    // (support contact + logout) instead of a UI full of errors. It takes precedence over onboarding_required.
    setApiAccountInactiveHandler(() => {
      if (router.state.location.pathname !== ACCOUNT_INACTIVE_PATH) {
        void router.navigate(ACCOUNT_INACTIVE_PATH, { replace: true });
      }
    });
    return () => {
      setApiForbiddenHandler(null);
      setApiOnboardingRequiredHandler(null);
      setApiAccountInactiveHandler(null);
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nLocaleSync />
      <FeatureFlagsProvider>
        <UiVersionSync router={router} />
        <RouterProvider router={router} />
      </FeatureFlagsProvider>
      <AppToaster />
    </QueryClientProvider>
  );
}

/**
 * After the Auth0 redirect: open the `returnTo` path passed to `login` through the router (a bare
 * `history.replaceState` would not re-render the route), otherwise only drop `code`/`state` from the
 * URL as the SDK does by default.
 */
function handleAuthRedirect(appState?: { returnTo?: unknown; supplierClaim?: unknown; ownerInvitation?: unknown; ownerContactInvitation?: unknown }) {
  // Supplier registered without an account (SU-02): keep the claim for `/register/claim`, even when it could not be
  // stored before the redirect.
  const supplierClaim = parsePendingSupplierClaim(appState?.supplierClaim);
  if (supplierClaim) savePendingSupplierClaim(supplierClaim);

  // Property owner who came from the link of an invitation (NF-109): the secret travelled in the `appState` of the login, and waits in memory (no
  // storage) for `/portale-proprietari/invito`, which sends it once.
  stashOwnerInvitationToken(appState?.ownerInvitation);
  // The same for a CONTACT an owner invited (NF-111): its secret waits in memory for `/portale-proprietari/contatto`, which sends it once.
  stashOwnerContactToken(appState?.ownerContactInvitation);

  const returnTo = safeReturnTo(appState?.returnTo);
  if (returnTo) {
    // Auth0 publishes the authenticated user immediately after this callback. Commit the return
    // route first so the landing route cannot send an invited user to host onboarding.
    void getRouter().navigate(returnTo, { replace: true, flushSync: true });
    return;
  }
  window.history.replaceState({}, document.title, window.location.pathname);
}

/**
 * The sign-in of an owner on the own domain of an agency came back with an error (`?error=…&state=…`, E40/F02/US01/T02, NF-141): the sign-in service does not complete such a return and does not call
 * `handleAuthRedirect`, so without this the person would be left on the booking site with the answer of the sign-in in the address bar and no word about it. Once the service has read the answer, the
 * sign-in page of the domain opens in its place (the address is replaced, so the answer is not kept in the history) and says that the sign-in did not complete, with the way to try again.
 */
function HostSignInFailure() {
  const { error, isLoading } = useAuth();
  useEffect(() => {
    if (isLoading || !error) return;
    void getRouter().navigate(ownerPortalPaths.signIn, { replace: true, state: SIGN_IN_FAILED_STATE });
  }, [error, isLoading]);
  return null;
}

function App() {
  const pathname = window.location.pathname;
  const hostSite = getHostSite();
  // An org's own host (BK-16) only ever shows the org's public booking site, whatever the clean address looks like, and never loads the sign-in service: except the owner portal of a host
  // that is registered with it, and the address the sign-in comes back to (E40/F02/US01/T02, NF-141; `hostNeedsAuth`).
  const publicPath = hostSite !== null ? !hostNeedsAuth(hostSite, pathname, window.location.search) : isPublicUnauthenticatedPath(pathname);
  const secureOrigin = isSecureAuth0Origin();

  useEffect(() => {
    // SE-03: first page of the visit (landing path, referrer host, UTM) for the signup attribution. Never on a page of the embeddable
    // widgets (NF-144): it is a frame of another site, and `recordLandingTouch` reads the consent from `localStorage`.
    if (publicPath && !isEmbedPath(pathname)) recordLandingTouch();
  }, [publicPath, pathname]);

  // Direct booking & other public surfaces must never load auth0-spa-js
  // (it throws on http://LAN-IP — see Auth0 SPA FAQ secure origin).
  if (publicPath) {
    return (
      <ErrorBoundary>
        <PublicAppProviders>
          <AppShell />
        </PublicAppProviders>
      </ErrorBoundary>
    );
  }

  if (!secureOrigin) {
    return (
      <ErrorBoundary>
        <InsecureOriginPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AuthAppProviders onRedirectCallback={handleAuthRedirect}>
        {hostSite !== null && isSignInErrorReturn(window.location.search) ? <HostSignInFailure /> : null}
        <AppShell />
      </AuthAppProviders>
    </ErrorBoundary>
  );
}

export default App;
