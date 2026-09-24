import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { useAuth } from '@/hooks/use-auth';
import { claimSupplierProfile, type SupplierClaimResult } from '@/services/supplier-api';
import { SupplierClaimPage } from '../supplier-claim-page';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  claimSupplierProfile: vi.fn(),
}));

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const STORAGE_KEY = 'cz-supplier-claim';
const CLAIM = { token: 'd'.repeat(64), email: 'fornitore@example.com', expiresAt: '2999-01-01T00:00:00Z' };

const login = vi.fn();
const refreshAccessToken = vi.fn();
const forceReauth = vi.fn();

function mockAuth(authenticated: boolean) {
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: authenticated,
    user: authenticated ? { email: CLAIM.email } : undefined,
    login,
    logout: vi.fn(),
    logoutToLogin: vi.fn(),
    forceReauth,
    getAccessToken: vi.fn(),
    refreshAccessToken,
  } as ReturnType<typeof useAuth>);
}

function claimResult(overrides: Partial<SupplierClaimResult> = {}): SupplierClaimResult {
  return { orgId: 'org-1', redirectUrl: '/app/supplier/activation', rolesSynced: true, rolesSyncError: null, ...overrides };
}

function problemError(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed with status code ' + status, 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, code, detail: 'server detail' },
  });
}

function storeClaim() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(CLAIM));
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/register/claim']}>
        <Routes>
          <Route path="/register/claim" element={<SupplierClaimPage />} />
          <Route path="/register" element={<p data-testid="register-page">register</p>} />
          <Route path="/app/supplier/activation" element={<p data-testid="activation">activation wizard</p>} />
          <Route path="/" element={<p data-testid="root">root</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SupplierClaimPage (SU-02)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await i18n.changeLanguage('it');
    refreshAccessToken.mockResolvedValue('fresh-token');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('signedOut_WithPendingClaim_OffersSignupAndLoginBackToTheClaim', async () => {
    storeClaim();
    mockAuth(false);

    renderPage();

    expect(await screen.findByText(t('supplier.claim.signInWithEmail', { email: CLAIM.email }))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('supplier.claim.createAccount') }));
    expect(login).toHaveBeenCalledWith({
      returnTo: '/register/claim',
      appState: { supplierClaim: CLAIM },
      authorizationParams: { login_hint: CLAIM.email, screen_hint: 'signup' },
    });
    expect(claimSupplierProfile).not.toHaveBeenCalled();
  });

  it('signedIn_WithPendingClaim_ClaimsWithTokenForgetsItAndOpensActivation', async () => {
    storeClaim();
    mockAuth(true);
    vi.mocked(claimSupplierProfile).mockResolvedValue(claimResult());

    renderPage();

    expect(await screen.findByText(t('supplier.claim.successTitle'))).toBeInTheDocument();
    expect(claimSupplierProfile).toHaveBeenCalledTimes(1);
    expect(claimSupplierProfile).toHaveBeenCalledWith(CLAIM.token);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('supplier.claim.completeProfile') }));

    expect(await screen.findByTestId('activation')).toBeInTheDocument();
    expect(refreshAccessToken).toHaveBeenCalled();
  });

  it('rolesNotSynced_ShowsRolesPendingAndRetryRepeatsTheClaim', async () => {
    storeClaim();
    mockAuth(true);
    vi.mocked(claimSupplierProfile)
      .mockResolvedValueOnce(claimResult({ rolesSynced: false, rolesSyncError: 'auth0_management_error' }))
      .mockResolvedValueOnce(claimResult({ rolesSynced: true }));

    renderPage();

    expect(await screen.findByTestId('onboarding-roles-pending')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('onboarding-roles-retry'));

    expect(await screen.findByText(t('supplier.claim.successTitle'))).toBeInTheDocument();
    expect(claimSupplierProfile).toHaveBeenCalledTimes(2);
    // The retry reuses the token kept in memory: the backend answers the already linked org.
    expect(claimSupplierProfile).toHaveBeenLastCalledWith(CLAIM.token);
  });

  it('rolesNotSynced_RenewSessionContinuesToTheConsole', async () => {
    storeClaim();
    mockAuth(true);
    vi.mocked(claimSupplierProfile).mockResolvedValue(claimResult({ rolesSynced: false }));

    renderPage();

    fireEvent.click(await screen.findByTestId('onboarding-roles-renew'));

    expect(await screen.findByTestId('activation')).toBeInTheDocument();
    expect(forceReauth).not.toHaveBeenCalled();
  });

  it('emailMismatch_KeepsTheClaimAndOffersToSignInWithTheRegisteredEmail', async () => {
    storeClaim();
    mockAuth(true);
    vi.mocked(claimSupplierProfile).mockRejectedValue(problemError(422, 'supplier_claim_email_mismatch'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('apiErrors.codes.supplierClaimEmailMismatch'));
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('supplier.claim.switchAccount', { email: CLAIM.email }) }));
    expect(login).toHaveBeenCalledWith({
      returnTo: '/register/claim',
      appState: { supplierClaim: CLAIM },
      authorizationParams: { login_hint: CLAIM.email, prompt: 'login' },
    });
  });

  it('usedToken_ForgetsTheClaimAndOffersANewRegistration', async () => {
    storeClaim();
    mockAuth(true);
    vi.mocked(claimSupplierProfile).mockRejectedValue(problemError(422, 'supplier_claim_used'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('apiErrors.codes.supplierClaimUsed'));
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeNull());
    expect(screen.queryByRole('button', { name: t('supplier.claim.retry') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('supplier.claim.registerAgain') }));
    expect(await screen.findByTestId('register-page')).toBeInTheDocument();
  });

  it('withoutToken_UnverifiedEmail_ShowsVerifyHintAndRetriesWithAFreshToken', async () => {
    mockAuth(true);
    vi.mocked(claimSupplierProfile)
      .mockRejectedValueOnce(problemError(422, 'supplier_claim_email_unverified'))
      .mockResolvedValueOnce(claimResult());

    renderPage();

    expect(await screen.findByText(t('supplier.claim.verifyEmailHint'))).toBeInTheDocument();
    expect(claimSupplierProfile).toHaveBeenCalledWith(undefined);
    fireEvent.click(screen.getByRole('button', { name: t('supplier.claim.retry') }));

    expect(await screen.findByText(t('supplier.claim.successTitle'))).toBeInTheDocument();
    expect(refreshAccessToken).toHaveBeenCalled();
    expect(claimSupplierProfile).toHaveBeenCalledTimes(2);
  });

  it('networkError_ShowsMessageWithRetryInsteadOfSuccess', async () => {
    storeClaim();
    mockAuth(true);
    vi.mocked(claimSupplierProfile)
      .mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
      .mockResolvedValueOnce(claimResult());

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(t('apiErrors.network'));
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('supplier.claim.retry') }));

    expect(await screen.findByText(t('supplier.claim.successTitle'))).toBeInTheDocument();
  });

  it('skip_ForgetsTheClaimAndLeaves', async () => {
    storeClaim();
    mockAuth(true);
    vi.mocked(claimSupplierProfile).mockRejectedValue(problemError(422, 'supplier_claim_email_mismatch'));

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: t('supplier.claim.skip') }));

    expect(await screen.findByTestId('root')).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
