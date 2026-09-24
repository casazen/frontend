import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { AuthAppProviders, PublicAppProviders } from '@/contexts/auth-bridge';
import { FeatureFlagsProvider } from '@/contexts/feature-flags-provider';
import { queryClient } from '@/lib/query-client';
import { NO_ACCESS_PATH, setApiForbiddenHandler, setApiOnboardingRequiredHandler } from '@/lib/axios';
import { openOnboardingAfterGate } from '@/lib/onboarding-gate';
import { isPublicUnauthenticatedPath, isSecureAuth0Origin } from '@/lib/secure-origin';
import { safeReturnTo } from '@/lib/auth-return-to';
import { InsecureOriginPage } from '@/pages/insecure-origin-page';
import { router } from '@/routes';
import { I18nLocaleSync } from '@/i18n/i18n-locale-sync';

function AppShell() {
  useEffect(() => {
    // 403 on a protected read → existing no-access page. `replace` keeps Back from reopening the
    // forbidden page (which would 403 again).
    setApiForbiddenHandler(() => {
      if (router.state.location.pathname !== NO_ACCESS_PATH) {
        void router.navigate(NO_ACCESS_PATH, { replace: true });
      }
    });
    // 403 onboarding_required (PL-02): the backend withholds the host features until the onboarding and the current
    // consents; open the onboarding (the wizard shows the consents step), never the no-access page.
    setApiOnboardingRequiredHandler(() => {
      openOnboardingAfterGate(router, queryClient);
    });
    return () => {
      setApiForbiddenHandler(null);
      setApiOnboardingRequiredHandler(null);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nLocaleSync />
      <FeatureFlagsProvider>
        <RouterProvider router={router} />
      </FeatureFlagsProvider>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

/**
 * After the Auth0 redirect: open the `returnTo` path passed to `login` through the router (a bare
 * `history.replaceState` would not re-render the route), otherwise only drop `code`/`state` from the
 * URL as the SDK does by default.
 */
function handleAuthRedirect(appState?: { returnTo?: unknown }) {
  const returnTo = safeReturnTo(appState?.returnTo);
  if (returnTo) {
    void router.navigate(returnTo, { replace: true });
    return;
  }
  window.history.replaceState({}, document.title, window.location.pathname);
}

function App() {
  const pathname = window.location.pathname;
  const publicPath = isPublicUnauthenticatedPath(pathname);
  const secureOrigin = isSecureAuth0Origin();

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
        <AppShell />
      </AuthAppProviders>
    </ErrorBoundary>
  );
}

export default App;
