import { Auth0Provider } from '@auth0/auth0-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { AuthInitializer } from '@/components/auth/auth-initializer';
import { authConfig } from '@/config/auth.config';
import { queryClient } from '@/lib/query-client';
import { router } from '@/routes';
import { I18nLocaleSync } from '@/i18n/i18n-locale-sync';

function App() {
  return (
    <ErrorBoundary>
      <Auth0Provider {...authConfig}>
        <AuthInitializer>
          <QueryClientProvider client={queryClient}>
            <I18nLocaleSync />
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors />
          </QueryClientProvider>
        </AuthInitializer>
      </Auth0Provider>
    </ErrorBoundary>
  );
}

export default App;
