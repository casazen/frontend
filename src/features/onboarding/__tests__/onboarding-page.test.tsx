import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import type { OnboardingResponse, UserDetail } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/users.api', () => ({
  UsersApi: { getMe: vi.fn(), postOnboarding: vi.fn(), putOnboarding: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CONSENTS: OnboardingConsentsPayload = {
  tosAccepted: true,
  tosVersion: '2026-06-v1',
  privacyAccepted: true,
  privacyVersion: '2026-06-v1',
  dpaAccepted: true,
  dpaVersion: '2026-06-v1',
  subprocessorsAcknowledged: true,
  subprocessorsVersion: '2026-06-v1',
};

// The consents and plan steps have their own tests: here they only hand their result to the page.
vi.mock('../components/consents-step', () => ({
  ConsentsStep: ({ onContinue }: { onContinue: (payload: OnboardingConsentsPayload) => void }) => (
    <button type="button" data-testid="accept-consents" onClick={() => onContinue(CONSENTS)}>
      accept
    </button>
  ),
}));
vi.mock('@/components/org/plan-selection-grid', () => ({
  PlanSelectionGrid: () => <div data-testid="plan-selection-grid" />,
}));

import { useAuth } from '@/hooks/use-auth';
import { UsersApi } from '@/api/users.api';
import { toast } from 'sonner';
import { OnboardingPage } from '../onboarding-page';

const ROLES_CLAIM = 'https://casazen.app/roles';
const refreshAccessToken = vi.fn(async () => 'fresh-token');
const forceReauth = vi.fn();
const assign = vi.fn();

function mockAuth(roles: string[]) {
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: true,
    user: { [ROLES_CLAIM]: roles },
    getAccessToken: vi.fn(async () => undefined),
    refreshAccessToken,
    forceReauth,
    login: vi.fn(),
    logout: vi.fn(),
    logoutToLogin: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function profile(overrides: Partial<UserDetail> = {}): UserDetail {
  return {
    id: 'auth0|user',
    email: 'user@example.com',
    firstName: 'Mario',
    lastName: 'Rossi',
    role: 'PropertyOwner',
    rentalType: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    onboardingCompletedAt: null,
    orgId: null,
    org: null,
    ...overrides,
  };
}

const ONBOARDED = profile({ orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z', rentalType: 'ShortTerm' });

function response(overrides: Partial<OnboardingResponse> = {}): OnboardingResponse {
  return { rolesAssigned: ['PropertyOwner'], rentalType: 'ShortTerm', orgId: 'org-1', rolesSynced: true, ...overrides };
}

function httpError(status: number, data: object = {}): AxiosError {
  return new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data,
  } as AxiosResponse);
}

function renderPage(entry: string | { pathname: string; search?: string; state?: unknown } = '/onboarding') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/app/admin" element={<p data-testid="admin-area">admin</p>} />
          <Route path="/app/short-rent" element={<p data-testid="short-rent-home">home</p>} />
          <Route path="/app/supplier/activation" element={<p data-testid="supplier-activation">activation</p>} />
          <Route path="/register" element={<p data-testid="supplier-register">register</p>} />
          <Route path="/register/claim" element={<p data-testid="supplier-claim">claim</p>} />
          <Route path="/" element={<p data-testid="root">root</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function chooseShortTermWithConsents() {
  fireEvent.click((await screen.findAllByRole('button', { name: i18n.t('onboarding.choose') }))[0]);
  fireEvent.click(await screen.findByTestId('accept-consents'));
  fireEvent.click(await screen.findByTestId('onboarding-plan-confirm'));
}

describe('OnboardingPage (PL-01)', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('OnboardingPage_HostRolesWithoutOrg_PostsWithConsentsAndReturnsToOrigin', async () => {
    mockAuth(['PropertyOwner']);
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());
    vi.mocked(UsersApi.postOnboarding).mockResolvedValue(response());

    renderPage({ pathname: '/onboarding', state: { from: '/app/short-rent/properties' } });
    await chooseShortTermWithConsents();

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/app/short-rent/properties'));
    expect(UsersApi.postOnboarding).toHaveBeenCalledWith({
      rentalType: 'ShortTerm',
      planTier: 'Starter',
      consents: CONSENTS,
    });
    expect(UsersApi.putOnboarding).not.toHaveBeenCalled();
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('OnboardingPage_RolesNotSynced_ShowsPendingPanelAndRenewsSession', async () => {
    mockAuth([]);
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());
    vi.mocked(UsersApi.postOnboarding).mockResolvedValue(
      response({ rolesSynced: false, rolesSyncError: 'auth0_management_token_failed' }),
    );

    renderPage();
    await chooseShortTermWithConsents();

    expect(await screen.findByTestId('onboarding-roles-pending')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('onboarding.rolesPending.description'))).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('onboarding-roles-renew'));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/app/short-rent'));
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('OnboardingPage_RolesNotSyncedAndSilentRenewalRefused_SignsInAgain', async () => {
    mockAuth([]);
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());
    vi.mocked(UsersApi.postOnboarding).mockResolvedValue(response({ rolesSynced: false }));
    refreshAccessToken.mockRejectedValueOnce(Object.assign(new Error('login required'), { error: 'login_required' }));

    renderPage();
    await chooseShortTermWithConsents();
    fireEvent.click(await screen.findByTestId('onboarding-roles-renew'));

    await waitFor(() => expect(forceReauth).toHaveBeenCalledTimes(1));
    expect(assign).not.toHaveBeenCalled();
  });

  it('OnboardingPage_RolesNotSyncedRetry_PutsAgainAndLeavesOnceSynced', async () => {
    mockAuth([]);
    vi.mocked(UsersApi.getMe).mockResolvedValueOnce(profile()).mockResolvedValue(ONBOARDED);
    vi.mocked(UsersApi.postOnboarding).mockResolvedValue(response({ rolesSynced: false }));
    vi.mocked(UsersApi.putOnboarding).mockResolvedValue(response({ rolesSynced: true }));

    renderPage();
    await chooseShortTermWithConsents();
    expect(await screen.findByTestId('onboarding-roles-pending')).toBeInTheDocument();
    // The profile is reloaded after the first call: the org now exists, so the retry is an idempotent PUT.
    await waitFor(() => expect(UsersApi.getMe).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByTestId('onboarding-roles-retry'));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/app/short-rent'));
    expect(UsersApi.putOnboarding).toHaveBeenCalledWith({ rentalType: 'ShortTerm', planTier: 'Starter' });
  });

  it('OnboardingPage_ConsentsRequiredOnPut_ShowsConsentsAndPosts', async () => {
    mockAuth([]);
    vi.mocked(UsersApi.getMe).mockResolvedValue(ONBOARDED);
    vi.mocked(UsersApi.putOnboarding).mockRejectedValue(httpError(422, { code: 'consents_required' }));
    vi.mocked(UsersApi.postOnboarding).mockResolvedValue(response());

    renderPage('/onboarding?mode=edit');
    fireEvent.click(await screen.findByTestId('onboarding-plan-confirm'));

    fireEvent.click(await screen.findByTestId('accept-consents'));
    fireEvent.click(await screen.findByTestId('onboarding-plan-confirm'));

    await waitFor(() =>
      expect(UsersApi.postOnboarding).toHaveBeenCalledWith({ rentalType: 'ShortTerm', planTier: 'Starter', consents: CONSENTS }),
    );
    expect(toast.error).toHaveBeenCalledWith(i18n.t('onboarding.consentRequiredToast'));
  });

  it('OnboardingPage_SubmitFails_KeepsSelectionAndOffersRetry', async () => {
    mockAuth(['PropertyOwner']);
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());
    vi.mocked(UsersApi.postOnboarding).mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce(response());

    renderPage();
    await chooseShortTermWithConsents();

    expect(await screen.findByTestId('onboarding-retry')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(i18n.t('onboarding.configurationErrorToast'));
    expect(screen.getByTestId('onboarding-plan-confirm')).toBeEnabled();

    fireEvent.click(screen.getByTestId('onboarding-retry'));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/app/short-rent'));
    expect(UsersApi.postOnboarding).toHaveBeenCalledTimes(2);
  });

  it('OnboardingPage_AdminWithoutOrg_CanSkipToTheAdminArea', async () => {
    mockAuth(['Admin']);
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile({ role: 'Admin' }));

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('onboarding.skipForNow') }));

    expect(await screen.findByTestId('admin-area')).toBeInTheDocument();
  });

  it('OnboardingPage_ProfileServerError_ShowsRetryInsteadOfTheWizard', async () => {
    mockAuth(['PropertyOwner']);
    vi.mocked(UsersApi.getMe).mockRejectedValue(httpError(500));

    renderPage();

    expect(await screen.findByTestId('profile-load-error')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('onboarding.choose') })).not.toBeInTheDocument();
  });
});

describe('OnboardingPage supplier option (SU-02)', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('OnboardingPage_UserWithoutOrgOrToken_OffersSupplierRegistration', async () => {
    mockAuth([]);
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());

    renderPage();

    const option = await screen.findByTestId('onboarding-supplier-option');
    expect(option).toHaveTextContent(i18n.t('onboarding.supplierOption.title'));
    fireEvent.click(screen.getByTestId('onboarding-supplier-register'));

    expect(await screen.findByTestId('supplier-register')).toBeInTheDocument();
    expect(UsersApi.postOnboarding).not.toHaveBeenCalled();
  });

  it('OnboardingPage_SupplierOptionClaimLink_OpensTheClaimPage', async () => {
    mockAuth([]);
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());

    renderPage();

    fireEvent.click(await screen.findByTestId('onboarding-supplier-claim'));

    expect(await screen.findByTestId('supplier-claim')).toBeInTheDocument();
  });

  it('OnboardingPage_LinkedSupplierWithoutRoleInToken_GoesToSupplierConsole', async () => {
    mockAuth([]);
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile({ orgId: 'supplier-org', supplierOrgId: 'supplier-org' }));

    renderPage();

    expect(await screen.findByTestId('supplier-activation')).toBeInTheDocument();
    expect(UsersApi.postOnboarding).not.toHaveBeenCalled();
  });

  it('OnboardingPage_EditMode_HidesSupplierOption', async () => {
    mockAuth(['PropertyOwner']);
    vi.mocked(UsersApi.getMe).mockResolvedValue(ONBOARDED);

    renderPage('/onboarding?mode=edit');

    expect(await screen.findByTestId('plan-selection-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-supplier-option')).not.toBeInTheDocument();
  });
});
