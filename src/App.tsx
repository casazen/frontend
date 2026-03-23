import { Auth0Provider } from '@auth0/auth0-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { authConfig } from '@/config/auth.config';
import { queryClient } from '@/lib/query-client';
import { router } from '@/routes';

function App() {
  return (
    <ErrorBoundary>
      <Auth0Provider {...authConfig}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors />
        </QueryClientProvider>
      </Auth0Provider>
    </ErrorBoundary>
  );
}

export default App;
