import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchSupplierRegistrationOptions,
  lookupSupplierInvite,
  registerSupplier,
  type SupplierInvitePreview,
} from '@/services/supplier-api';
import { SupplierRegisterPage } from '../supplier-register-page';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  registerSupplier: vi.fn(),
  lookupSupplierInvite: vi.fn(),
  fetchSupplierRegistrationOptions: vi.fn(),
}));

const TOKEN = 'a'.repeat(64);
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

const invite: SupplierInvitePreview = {
  email: 'pulizie@example.com',
  comuneCode: 'H501',
  comuneName: 'Roma',
  categories: ['cleaning'],
  expiresAt: '2026-10-01T10:00:00Z',
};

const login = vi.fn();
const refreshAccessToken = vi.fn();

function mockAuth(options: { authenticated: boolean; email?: string }) {
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: options.authenticated,
    user: options.authenticated ? { email: options.email } : undefined,
    login,
    logout: vi.fn(),
    logoutToLogin: vi.fn(),
    forceReauth: vi.fn(),
    getAccessToken: vi.fn(),
    refreshAccessToken,
  } as ReturnType<typeof useAuth>);
}

function problemError(status: number, data: object): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed with status code ' + status, 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, ...data },
  });
}

function renderPage(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/register" element={<SupplierRegisterPage />} />
          <Route path="/app/supplier/activation" element={<div>activation wizard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('SupplierRegisterPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await i18n.changeLanguage('it');
    refreshAccessToken.mockResolvedValue('token');
    vi.mocked(fetchSupplierRegistrationOptions).mockResolvedValue({
      selfServeEnabled: true,
      pilotComuni: [
        { code: 'H501', name: 'Roma' },
        { code: 'F205', name: 'Milano' },
      ],
    });
    vi.mocked(registerSupplier).mockResolvedValue({
      orgId: 'org-1',
      authRedirectUrl: '/supplier/activation',
      rolesSynced: true,
      rolesSyncError: null,
    });
  });

  describe('self-serve', () => {
    it('anonymous_EditableEmailAndPilotComune_RegistersAnonymouslyThenOffersSignupToTheClaim', async () => {
      const claimToken = 'c'.repeat(64);
      const claimExpiresAt = '2999-01-01T00:00:00Z';
      vi.mocked(registerSupplier).mockResolvedValue({
        orgId: 'org-1',
        authRedirectUrl: '/supplier/activation',
        rolesSynced: false,
        rolesSyncError: null,
        claimToken,
        claimExpiresAt,
      });
      mockAuth({ authenticated: false });
      renderPage('/register');

      await screen.findByLabelText(t('supplier.register.email'));
      fill(t('supplier.register.email'), ' nuovo@example.com ');
      fill(t('supplier.register.comune'), 'F205');
      fill(t('supplier.register.legalName'), 'Pulizie Rossi');
      fill(t('supplier.register.phone'), '+39 02 123');
      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.complete') }));

      await screen.findByText(t('supplier.register.successDescription', { email: 'nuovo@example.com' }));
      expect(registerSupplier).toHaveBeenCalledWith(
        { email: 'nuovo@example.com', comuneCode: 'F205', legalName: 'Pulizie Rossi', phone: '+39 02 123' },
        { authenticated: false },
      );

      // SU-02: the claim token is kept for the claim page and travels in the login appState.
      const claim = { token: claimToken, email: 'nuovo@example.com', expiresAt: claimExpiresAt };
      expect(JSON.parse(localStorage.getItem('cz-supplier-claim') ?? 'null')).toEqual(claim);

      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.createAccount') }));
      expect(login).toHaveBeenCalledWith({
        returnTo: '/register/claim',
        appState: { supplierClaim: claim },
        authorizationParams: { screen_hint: 'signup', login_hint: 'nuovo@example.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.loginToClaim') }));
      expect(login).toHaveBeenLastCalledWith({
        returnTo: '/register/claim',
        appState: { supplierClaim: claim },
        authorizationParams: { login_hint: 'nuovo@example.com' },
      });
    });

    it('comuneSelect_OffersOnlyThePilotComuni', async () => {
      mockAuth({ authenticated: false });
      renderPage('/register');

      const select = await screen.findByLabelText(t('supplier.register.comune'));
      const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
      expect(options).toEqual(['', 'H501', 'F205']);
    });

    it('missingFields_ShowsValidationMessageWithoutCallingTheApi', async () => {
      mockAuth({ authenticated: false });
      renderPage('/register');

      await screen.findByLabelText(t('supplier.register.email'));
      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.complete') }));

      expect(await screen.findByRole('alert')).toHaveTextContent(t('supplier.register.errorFields'));
      expect(registerSupplier).not.toHaveBeenCalled();
    });

    it('apiError_ShowsTranslatedProblemInsteadOfRawAxiosMessage', async () => {
      mockAuth({ authenticated: false });
      vi.mocked(registerSupplier).mockRejectedValue(problemError(422, { code: 'supplier_comune_not_pilot' }));
      renderPage('/register');

      await screen.findByLabelText(t('supplier.register.email'));
      fill(t('supplier.register.email'), 'nuovo@example.com');
      fill(t('supplier.register.comune'), 'H501');
      fill(t('supplier.register.legalName'), 'Pulizie Rossi');
      fill(t('supplier.register.phone'), '+39 02 123');
      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.complete') }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(t('apiErrors.codes.supplierComuneNotPilot'));
      expect(alert).not.toHaveTextContent('Request failed');
    });

    it('rateLimited_ShowsTooManyRequestsMessage', async () => {
      mockAuth({ authenticated: false });
      vi.mocked(registerSupplier).mockRejectedValue(problemError(429, { code: 'rate_limited' }));
      renderPage('/register');

      await screen.findByLabelText(t('supplier.register.email'));
      fill(t('supplier.register.email'), 'nuovo@example.com');
      fill(t('supplier.register.comune'), 'H501');
      fill(t('supplier.register.legalName'), 'Pulizie Rossi');
      fill(t('supplier.register.phone'), '+39 02 123');
      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.complete') }));

      expect(await screen.findByRole('alert')).toHaveTextContent(t('apiErrors.tooManyRequests'));
    });

    it('signedIn_LocksEmailToAccountRegistersWithTokenAndOpensActivation', async () => {
      mockAuth({ authenticated: true, email: 'host@example.com' });
      renderPage('/register');

      const email = await screen.findByLabelText(t('supplier.register.email'));
      expect(email).toHaveValue('host@example.com');
      expect(email).toHaveAttribute('readonly');
      fill(t('supplier.register.comune'), 'H501');
      fill(t('supplier.register.legalName'), 'Host Servizi');
      fill(t('supplier.register.phone'), '+39 06 1');
      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.complete') }));

      await screen.findByText(t('supplier.register.successSignedIn'));
      expect(registerSupplier).toHaveBeenCalledWith(
        { email: 'host@example.com', comuneCode: 'H501', legalName: 'Host Servizi', phone: '+39 06 1' },
        { authenticated: true },
      );

      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.completeProfile') }));
      await screen.findByText('activation wizard');
      expect(refreshAccessToken).toHaveBeenCalled();
    });

    it('selfServeDisabled_ShowsInviteOnlyMessageWithoutForm', async () => {
      mockAuth({ authenticated: false });
      vi.mocked(fetchSupplierRegistrationOptions).mockResolvedValue({ selfServeEnabled: false, pilotComuni: [] });
      renderPage('/register');

      expect(await screen.findByText(t('supplier.register.selfServeUnavailable'))).toBeInTheDocument();
      expect(screen.queryByLabelText(t('supplier.register.email'))).not.toBeInTheDocument();
    });

    it('optionsError_ShowsErrorWithRetryInsteadOfForm', async () => {
      mockAuth({ authenticated: false });
      vi.mocked(fetchSupplierRegistrationOptions).mockRejectedValue(problemError(500, {}));
      renderPage('/register');

      expect(await screen.findByRole('alert')).toHaveTextContent(t('supplier.register.optionsError'));
      expect(screen.queryByLabelText(t('supplier.register.email'))).not.toBeInTheDocument();

      vi.mocked(fetchSupplierRegistrationOptions).mockResolvedValue({
        selfServeEnabled: true,
        pilotComuni: [{ code: 'H501', name: 'Roma' }],
      });
      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.retry') }));
      expect(await screen.findByLabelText(t('supplier.register.email'))).toBeInTheDocument();
    });
  });

  describe('invite', () => {
    beforeEach(() => {
      vi.mocked(lookupSupplierInvite).mockResolvedValue(invite);
    });

    it('loading_ShowsLoadingStateWhileTheInviteIsChecked', async () => {
      mockAuth({ authenticated: false });
      vi.mocked(lookupSupplierInvite).mockReturnValue(new Promise(() => {}));
      renderPage(`/register?inviteToken=${TOKEN}`);

      expect(await screen.findByRole('status')).toBeInTheDocument();
      expect(lookupSupplierInvite).toHaveBeenCalledWith(TOKEN);
    });

    it('signedOut_ShowsInviteAndStartsAuth0SignupBackToThisPage', async () => {
      mockAuth({ authenticated: false });
      renderPage(`/register?inviteToken=${TOKEN}`);

      expect(await screen.findByTestId('invite-summary')).toHaveTextContent('pulizie@example.com');
      expect(screen.getByTestId('invite-summary')).toHaveTextContent('Roma (H501)');
      expect(screen.queryByLabelText(t('supplier.register.legalName'))).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.inviteSignup') }));
      expect(login).toHaveBeenCalledWith({
        returnTo: `/register?inviteToken=${TOKEN}`,
        authorizationParams: { login_hint: 'pulizie@example.com', screen_hint: 'signup' },
      });
      expect(registerSupplier).not.toHaveBeenCalled();
    });

    it('signedInWithInvitedEmail_LocksEmailAndComuneAndSubmitsTheToken', async () => {
      mockAuth({ authenticated: true, email: 'Pulizie@Example.com' });
      renderPage(`/register?inviteToken=${TOKEN}`);

      const email = await screen.findByLabelText(t('supplier.register.email'));
      expect(email).toHaveValue('pulizie@example.com');
      expect(email).toHaveAttribute('readonly');
      const comune = screen.getByLabelText(t('supplier.register.comune'));
      expect(comune).toHaveValue('Roma (H501)');
      expect(comune).toHaveAttribute('readonly');

      fill(t('supplier.register.legalName'), 'Pulizie Rossi');
      fill(t('supplier.register.phone'), '+39 06 123');
      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.complete') }));

      await screen.findByText(t('supplier.register.successSignedIn'));
      expect(registerSupplier).toHaveBeenCalledWith(
        {
          email: 'pulizie@example.com',
          comuneCode: 'H501',
          legalName: 'Pulizie Rossi',
          phone: '+39 06 123',
          inviteToken: TOKEN,
        },
        { authenticated: true },
      );
    });

    it('signedInWithAnotherEmail_AsksToSignInWithTheInvitedEmail', async () => {
      mockAuth({ authenticated: true, email: 'altro@example.com' });
      renderPage(`/register?inviteToken=${TOKEN}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        t('supplier.register.inviteWrongAccount', { account: 'altro@example.com', invited: 'pulizie@example.com' }),
      );
      expect(screen.queryByLabelText(t('supplier.register.legalName'))).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.inviteSwitchAccount') }));
      expect(login).toHaveBeenCalledWith({
        returnTo: `/register?inviteToken=${TOKEN}`,
        authorizationParams: { login_hint: 'pulizie@example.com', prompt: 'login' },
      });
    });

    it('registerError_ShowsTranslatedProblem', async () => {
      mockAuth({ authenticated: true, email: 'pulizie@example.com' });
      vi.mocked(registerSupplier).mockRejectedValue(problemError(422, { code: 'supplier_invite_used' }));
      renderPage(`/register?inviteToken=${TOKEN}`);

      await screen.findByLabelText(t('supplier.register.legalName'));
      fill(t('supplier.register.legalName'), 'Pulizie Rossi');
      fill(t('supplier.register.phone'), '+39 06 123');
      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.complete') }));

      expect(await screen.findByRole('alert')).toHaveTextContent(t('apiErrors.codes.supplierInviteUsed'));
    });

    it('expiredInvite_ShowsTranslatedErrorWithoutFormOrRetry', async () => {
      mockAuth({ authenticated: false });
      vi.mocked(lookupSupplierInvite).mockRejectedValue(problemError(422, { code: 'supplier_invite_expired' }));
      renderPage(`/register?inviteToken=${TOKEN}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(t('apiErrors.codes.supplierInviteExpired'));
      expect(screen.queryByRole('button', { name: t('supplier.register.retry') })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: t('supplier.register.registerWithoutInvite') })).toHaveAttribute(
        'href',
        '/register',
      );
    });

    it('lookupNetworkError_OffersRetry', async () => {
      mockAuth({ authenticated: false });
      vi.mocked(lookupSupplierInvite).mockRejectedValueOnce(problemError(503, {}));
      renderPage(`/register?inviteToken=${TOKEN}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(t('supplier.register.inviteErrorGeneric'));
      fireEvent.click(screen.getByRole('button', { name: t('supplier.register.retry') }));

      await waitFor(() => expect(screen.getByTestId('invite-summary')).toBeInTheDocument());
    });
  });
});
