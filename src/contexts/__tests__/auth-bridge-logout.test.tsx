import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { readWizardDraft, writeWizardDraft } from '@/lib/wizard-draft';

const auth0Logout = vi.fn();
const auth0Login = vi.fn();

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children }: { children: ReactNode }) => children,
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'auth0|u1' },
    loginWithRedirect: auth0Login,
    logout: auth0Logout,
    getAccessTokenSilently: vi.fn(),
  }),
}));
vi.mock('@/config/demo.config', () => ({ isDemoMode: false, getDemoUser: () => undefined }));
vi.mock('@/lib/axios', () => ({ setApiAuthHandlers: vi.fn() }));

import { AuthAppProviders, useAuthBridge } from '../auth-bridge';
import { setApiAuthHandlers } from '@/lib/axios';

/** One button for each way out of the session. */
function Probe() {
  const { logout, logoutToLogin } = useAuthBridge();
  return (
    <>
      <button type="button" data-testid="logout" onClick={() => logout()} />
      <button type="button" data-testid="logoutToLogin" onClick={() => logoutToLogin()} />
    </>
  );
}

const DRAFT = { step: 'documents', values: { name: 'Casa' } };

beforeEach(() => {
  sessionStorage.clear();
  auth0Logout.mockClear();
  render(
    <AuthAppProviders>
      <Probe />
    </AuthAppProviders>,
  );
});

afterEach(cleanup);

describe('sign out and the drafts of the guided flows', () => {
  it.each(['logout', 'logoutToLogin'] as const)('AuthBridge_%s_DeletesEveryDraftOfThisTab', (method) => {
    writeWizardDraft('property-new', { userId: 'auth0|u1', orgId: 'org-1' }, DRAFT);
    writeWizardDraft('checkout-b1', { userId: 'auth0|u1', orgId: null }, DRAFT);
    sessionStorage.setItem('casazen.pendingCheckout', '{"keep":"me"}');

    fireEvent.click(screen.getByTestId(method));

    expect(readWizardDraft('property-new', { userId: 'auth0|u1', orgId: 'org-1' })).toBeNull();
    expect(readWizardDraft('checkout-b1', { userId: 'auth0|u1', orgId: null })).toBeNull();
    // Only the drafts: whatever else the app keeps in the tab is not its business here.
    expect(sessionStorage.getItem('casazen.pendingCheckout')).toBe('{"keep":"me"}');
    expect(auth0Logout).toHaveBeenCalledTimes(1);
  });
});

it('re-authentication preserves the leaseId of the upload page', () => {
  const path = '/app/long-rent/documents/upload?leaseId=0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
  window.history.replaceState({}, '', path);
  const handlers = vi.mocked(setApiAuthHandlers).mock.calls.filter(([value]) => value !== null).at(-1)?.[0];
  handlers?.onSessionExpired?.();
  expect(auth0Login).toHaveBeenCalledWith(expect.objectContaining({ appState: { returnTo: path } }));
  window.history.replaceState({}, '', '/');
});
