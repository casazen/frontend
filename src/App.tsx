import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { AuthAppProviders, PublicAppProviders } from '@/contexts/auth-bridge';
import { queryClient } from '@/lib/query-client';
import { isPublicUnauthenticatedPath, isSecureAuth0Origin } from '@/lib/secure-origin';
import { InsecureOriginPage } from '@/pages/insecure-origin-page';
import { router } from '@/routes';
import { I18nLocaleSync } from '@/i18n/i18n-locale-sync';

function AppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nLocaleSync />
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
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
      <AuthAppProviders>
        <AppShell />
      </AuthAppProviders>
    </ErrorBoundary>
  );
}

export default App;
