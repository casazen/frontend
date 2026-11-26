import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
        <Route path="/portale-proprietari/accedi" element={<LoginPage />} />
        <Route path="/portale-proprietari/messaggi/:id" element={<div data-testid="owner-conversation" />} />
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

  it('returns control after a rejected handoff and retries the same destination once', async () => {
    const login = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    setAuth({ login });
    renderPage('/login?returnTo=%2Fapp%2Fshort-rent%2Fbookings');
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('login.handoffFailed'));
    fireEvent.click(screen.getByRole('button'));
    expect(login).toHaveBeenCalledTimes(2);
    expect(login.mock.calls[0]).toEqual(login.mock.calls[1]);
  });

  it('lets the visitor resume a stalled redirect without restarting it automatically', () => {
    vi.useFakeTimers();
    try {
      const login = setAuth();
      renderPage();
      act(() => vi.advanceTimersByTime(16_000));
      expect(screen.getByRole('button')).toBeEnabled();
      expect(login).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('preserves the email destination and leaseId through Auth0 appState', () => {
    const login = setAuth();
    const returnTo = '/app/long-rent/documents/upload?leaseId=0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
    renderPage(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    expect(login).toHaveBeenCalledWith({ returnTo });
  });

  it('keeps the owner in the portal when starting from its sign-in page', () => {
    const login = setAuth();
    renderPage('/portale-proprietari/accedi');
    expect(login).toHaveBeenCalledWith({ returnTo: '/portale-proprietari' });
  });

  it('resumes the owner conversation from the original link after sign-in', () => {
    setAuth({ isAuthenticated: true, user: { sub: 'owner' } });
    renderPage('/login?returnTo=%2Fportale-proprietari%2Fmessaggi%2Fexample');
    expect(screen.getByTestId('owner-conversation')).toBeInTheDocument();
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
