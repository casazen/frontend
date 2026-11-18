import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { emailVerificationOutcome } from '../email-verification-outcome';

const auth0 = vi.hoisted(() => ({
  isLoading: false,
  isAuthenticated: false,
  verified: true,
  loginWithRedirect: vi.fn(async () => undefined),
}));

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children }: { children: ReactNode }) => children,
  useAuth0: () => ({
    isLoading: auth0.isLoading,
    isAuthenticated: auth0.isAuthenticated,
    user: auth0.isAuthenticated ? { sub: 'auth0|host', email_verified: auth0.verified } : undefined,
    loginWithRedirect: auth0.loginWithRedirect,
    logout: vi.fn(),
    getAccessTokenSilently: vi.fn(async () => 'token'),
  }),
}));

import { AuthAppProviders } from '@/contexts/auth-bridge';
import { EmailVerifiedPage } from '../email-verified-page';

function renderPage(search = '') {
  return render(
    <AuthAppProviders>
      <MemoryRouter initialEntries={[`/email-verified${search}`]}>
        <Routes>
          <Route path="/email-verified" element={<EmailVerifiedPage />} />
          <Route path="/" element={<div data-testid="home" />} />
        </Routes>
      </MemoryRouter>
    </AuthAppProviders>,
  );
}

describe('emailVerificationOutcome', () => {
  it('reads the Auth0 verification redirect, and a failed result wins over code=success', () => {
    expect(emailVerificationOutcome(new URLSearchParams('success=true&code=success'))).toBe('verified');
    expect(emailVerificationOutcome(new URLSearchParams('code=success'))).toBe('verified');
    expect(emailVerificationOutcome(new URLSearchParams('success=false&code=success'))).toBe('failed');
    expect(emailVerificationOutcome(new URLSearchParams(''))).toBe('unknown');
  });
});

describe('EmailVerifiedPage', () => {
  beforeEach(async () => {
    sessionStorage.removeItem('cz-org-invite');
    auth0.isLoading = false;
    auth0.isAuthenticated = false;
    auth0.verified = true;
    auth0.loginWithRedirect.mockClear();
    await i18n.changeLanguage('it');
  });

  it('shows the confirmed state and opens the login', () => {
    renderPage('?success=true&code=success&message=Your%20email%20was%20verified');

    expect(screen.getByTestId('email-verified-page')).toHaveAttribute('data-outcome', 'verified');
    expect(screen.getByText('Email confermata')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('email-verified-sign-in'));
    expect(auth0.loginWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('resumes a pending team invitation without passing its token to sign-in', () => {
    sessionStorage.setItem('cz-org-invite', 'ab'.repeat(32));
    renderPage('?success=true');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('emailVerified.resumeInvite') }));
    expect(auth0.loginWithRedirect).toHaveBeenCalledWith(expect.objectContaining({ appState: { returnTo: '/invite/accept' } }));
    expect(JSON.stringify(auth0.loginWithRedirect.mock.calls)).not.toContain('ab'.repeat(32));
  });

  it('keeps the instructions visible when verification opens in a new tab with an existing session', () => {
    auth0.isAuthenticated = true;
    renderPage('?success=true');
    expect(screen.getByText(i18n.t('emailVerified.inviteTab'))).toBeVisible();
    expect(screen.getByRole('button', { name: i18n.t('invitation.unusable.goToApp') })).toBeEnabled();
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled();
  });

  it('refreshes an explicitly unverified session before returning to the pending invite', () => {
    sessionStorage.setItem('cz-org-invite', 'ab'.repeat(32));
    auth0.isAuthenticated = true;
    auth0.verified = false;
    renderPage('?success=true');
    fireEvent.click(screen.getByTestId('email-verified-sign-in'));
    expect(auth0.loginWithRedirect).toHaveBeenCalledWith(expect.objectContaining({
      appState: { returnTo: '/invite/accept' },
      authorizationParams: expect.objectContaining({ prompt: 'login' }),
    }));
  });

  it('explains a failed verification instead of the Auth0 English error', () => {
    renderPage('?success=false&message=Your%20email%20address%20could%20not%20be%20verified');

    expect(screen.getByTestId('email-verified-page')).toHaveAttribute('data-outcome', 'failed');
    expect(screen.getByText('Email non verificata')).toBeInTheDocument();
    expect(screen.getByText(/Il link è già stato usato/)).toBeInTheDocument();
  });
});
