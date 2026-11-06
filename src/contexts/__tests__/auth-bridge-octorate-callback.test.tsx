import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';

const providerOptions = vi.fn();

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children, skipRedirectCallback }: { children: ReactNode; skipRedirectCallback?: boolean }) => {
    providerOptions(skipRedirectCallback);
    return children;
  },
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'auth0|u1' },
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn(),
  }),
}));
vi.mock('@/config/demo.config', () => ({ isDemoMode: false, getDemoUser: () => undefined }));
vi.mock('@/lib/axios', () => ({ setApiAuthHandlers: vi.fn() }));

import { AuthAppProviders } from '../auth-bridge';

afterEach(() => {
  cleanup();
  providerOptions.mockClear();
  window.history.replaceState({}, '', '/');
});

/** What the Auth0 SDK is told about the address the app opens on. */
function skipRedirectCallbackFor(address: string): boolean | undefined {
  window.history.replaceState({}, '', address);
  render(
    <AuthAppProviders>
      <div />
    </AuthAppProviders>,
  );
  return providerOptions.mock.calls[0]?.[0];
}

describe('Auth0 and the callback of the channel manager (E02/F01/US01/T04)', () => {
  it('AuthBridge_CallbackPageOfTheChannelManager_IsLeftAloneByTheAuth0Sdk', () => {
    // The SDK takes any address with a `code` and a `state` for the end of its own login and would fail on these.
    expect(skipRedirectCallbackFor('/app/short-rent/integrations/octorate?code=the-code&state=the-state')).toBe(true);
  });

  it.each(['/', '/app/short-rent', '/app/short-rent/integrations/octorate/other', '/?code=auth0-code&state=auth0-state'])(
    'AuthBridge_%s_StillHandlesTheRedirectOfAuth0',
    (address) => {
      expect(skipRedirectCallbackFor(address)).toBe(false);
    },
  );
});
