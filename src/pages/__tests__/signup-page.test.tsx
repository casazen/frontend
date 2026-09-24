import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PENDING_ATTRIBUTION_STORAGE_KEY, LANDING_TOUCH_STORAGE_KEY } from '@/lib/signup-attribution';

// The real auth bridge over a mocked Auth0 SDK: the test sees the exact loginWithRedirect call of the page.
const auth0 = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: false,
  loginWithRedirect: vi.fn(async () => undefined),
}));

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children }: { children: ReactNode }) => children,
  useAuth0: () => ({
    isLoading: auth0.isLoading,
    isAuthenticated: auth0.isAuthenticated,
    user: auth0.isAuthenticated ? { sub: 'auth0|host' } : undefined,
    loginWithRedirect: auth0.loginWithRedirect,
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn(async () => 'token'),
  }),
}));

import { AuthAppProviders } from '@/contexts/auth-bridge';
import { SignupPage } from '../signup-page';

const SIGNUP_URL =
  '/signup?comune=como&utm_source=seo-compliance&utm_medium=cta&utm_campaign=estate&utm_term=casa%20vacanze' +
  '&utm_content=compliance-guide';

function renderSignup(entry = SIGNUP_URL) {
  return render(
    <AuthAppProviders>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<p data-testid="workspace-root">root</p>} />
          <Route path="/login" element={<p data-testid="login-page">login</p>} />
        </Routes>
      </MemoryRouter>
    </AuthAppProviders>,
  );
}

function pendingAttribution(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(PENDING_ATTRIBUTION_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { attribution: Record<string, unknown> }).attribution : null;
}

describe('SignupPage (SE-03, A8-03)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    auth0.isLoading = false;
    auth0.isAuthenticated = false;
    auth0.loginWithRedirect.mockClear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('SignupPage_AnonymousVisitor_StoresUtmAndComuneAndOpensTheAuth0SignupScreen', async () => {
    window.sessionStorage.setItem(
      LANDING_TOUCH_STORAGE_KEY,
      JSON.stringify({ landingPath: '/p/affitti-brevi/lombardia/como', referrerHost: 'www.google.com', utm: {} }),
    );

    renderSignup();

    await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1));
    expect(auth0.loginWithRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ authorizationParams: expect.objectContaining({ screen_hint: 'signup' }) }),
    );
    expect(pendingAttribution()).toEqual({
      utmSource: 'seo-compliance',
      utmMedium: 'cta',
      utmCampaign: 'estate',
      utmTerm: 'casa vacanze',
      utmContent: 'compliance-guide',
      comune: 'como',
      landingPath: '/p/affitti-brevi/lombardia/como',
      referrerHost: 'www.google.com',
    });
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('SignupPage_WhileAuth0Loads_WaitsThenStartsOnlyOnce', async () => {
    auth0.isLoading = true;
    const { rerender } = renderSignup();
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
    // The attribution is stored before Auth0 is even ready.
    expect(pendingAttribution()).toMatchObject({ comune: 'como' });

    auth0.isLoading = false;
    rerender(
      <AuthAppProviders>
        <MemoryRouter initialEntries={[SIGNUP_URL]}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
          </Routes>
        </MemoryRouter>
      </AuthAppProviders>,
    );

    await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1));
  });

  it('SignupPage_ContinueButton_OpensTheSignupScreenAgain', async () => {
    renderSignup();
    await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1));

    screen.getByTestId('signup-continue').click();

    await waitFor(() => expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(2));
    expect(auth0.loginWithRedirect).toHaveBeenLastCalledWith(
      expect.objectContaining({ authorizationParams: expect.objectContaining({ screen_hint: 'signup' }) }),
    );
  });

  it('SignupPage_AlreadySignedIn_GoesToTheAppWithoutAuth0', async () => {
    auth0.isAuthenticated = true;

    renderSignup();

    expect(await screen.findByTestId('workspace-root')).toBeInTheDocument();
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
  });
});
