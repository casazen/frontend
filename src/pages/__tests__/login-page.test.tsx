import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth0 = vi.hoisted(() => ({
  error: undefined as Error | undefined,
}));

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children }: { children: ReactNode }) => children,
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: false,
    error: auth0.error,
    user: undefined,
    loginWithRedirect: vi.fn(async () => undefined),
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn(async () => 'token'),
  }),
}));

import { AuthAppProviders } from '@/contexts/auth-bridge';
import { LoginPage } from '../login-page';

function renderLogin() {
  return render(
    <AuthAppProviders>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthAppProviders>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    auth0.error = undefined;
  });
  afterEach(cleanup);

  it('render_noAuthError_showsNoAlert', () => {
    renderLogin();

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('render_auth0CallbackError_showsGenericAlertWithCodeButNotTheDescription', () => {
    const description = 'Client "abc" is not authorized to access resource server "https://api-prod".';
    auth0.error = Object.assign(new Error(description), { error: 'invalid_request', error_description: description });

    renderLogin();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('invalid_request');
    expect(alert.textContent).not.toContain('resource server');
    expect(alert.textContent).not.toContain('abc');
  });
});
