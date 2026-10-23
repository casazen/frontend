import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth.value }));

import { LoginPage } from '../login-page';

function setAuth(overrides: Record<string, unknown> = {}) {
  const login = vi.fn();
  auth.value = { isAuthenticated: false, isLoading: false, user: undefined, login, ...overrides };
  return login;
}

function renderPage(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app/choose-context" element={<div data-testid="area-picker" />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** `/login` has no page of its own: the address sends the visitor straight to Auth0 (product owner, 2026-10-16). */
describe('LoginPage', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(cleanup);

  it('LoginPage_VisitorWithoutASession_IsSentToAuth0OnceAndSeesNoButton', () => {
    const login = setAuth();

    renderPage();

    expect(login).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('login.redirecting'));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('LoginPage_WhileAuth0IsStarting_WaitsBeforeSendingTheVisitor', () => {
    const login = setAuth({ isLoading: true });

    renderPage();

    expect(login).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('LoginPage_SignedInUser_GoesToTheAreaPickerWithoutLoggingInAgain', () => {
    const login = setAuth({ isAuthenticated: true, user: { sub: 'auth0|host' } });

    renderPage();

    expect(screen.getByTestId('area-picker')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('LoginPage_BackFromAuth0WithinAFewSeconds_OffersTheButtonInsteadOfARedirectLoop', () => {
    sessionStorage.setItem('casazen.login-started-at', String(Date.now()));
    const login = setAuth();

    renderPage();

    expect(login).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('login.signInButton') }));
    expect(login).toHaveBeenCalledTimes(1);
  });

  it('preserves the email destination and leaseId through Auth0 appState', () => {
    const login = setAuth();
    const returnTo = '/app/long-rent/documents/upload?leaseId=0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
    renderPage(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    expect(login).toHaveBeenCalledWith({ returnTo });
  });

  it.each(['https://evil.example/app/', '//evil.example/app/', '/login', '/app/../../login'])('rejects unsafe login destinations: %s', (returnTo) => {
    const login = setAuth();
    renderPage(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    expect(login).toHaveBeenCalledWith(undefined);
  });

  it('LoginPage_LastStartLongAgo_IsSentToAuth0AgainAutomatically', () => {
    sessionStorage.setItem('casazen.login-started-at', String(Date.now() - 60_000));
    const login = setAuth();

    renderPage();

    expect(login).toHaveBeenCalledTimes(1);
  });
});
