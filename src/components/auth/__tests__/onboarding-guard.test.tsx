import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import type { UserDetail } from '@/types';

const demo = vi.hoisted(() => ({ enabled: false }));

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/api/users.api', () => ({ UsersApi: { getMe: vi.fn() } }));
vi.mock('@/config/demo.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/demo.config')>();
  return {
    ...actual,
    get isDemoMode() {
      return demo.enabled;
    },
  };
});

import { useAuth } from '@/hooks/use-auth';
import { UsersApi } from '@/api/users.api';
import { OnboardingGuard } from '../onboarding-guard';

const ROLES_CLAIM = 'https://casazen.app/roles';
const forceReauth = vi.fn();

function mockAuth(options: { roles?: string[]; tokenRoles?: Promise<string[]> } = {}) {
  const getAccessToken = vi.fn(async () => {
    const roles = options.tokenRoles ? await options.tokenRoles : [];
    return accessToken(roles);
  });
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: true,
    user: options.roles ? { [ROLES_CLAIM]: options.roles } : { name: 'No roles in the ID token' },
    getAccessToken,
    refreshAccessToken: getAccessToken,
    forceReauth,
    login: vi.fn(),
    logout: vi.fn(),
    logoutToLogin: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function accessToken(roles: string[]): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({ [ROLES_CLAIM]: roles })}.signature`;
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

function httpError(status: number): AxiosError {
  return new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data: {},
  } as AxiosResponse);
}

function OnboardingProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '';
  return <p data-testid="onboarding-page">onboarding from {from}</p>;
}

function WorkspaceProbe() {
  const location = useLocation();
  return <p data-testid="workspace">workspace {location.pathname}</p>;
}

function renderGuard(path = '/app/short-rent/properties') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingProbe />} />
          <Route path="/register/claim" element={<p data-testid="claim-page">claim</p>} />
          <Route element={<OnboardingGuard />}>
            <Route path="/app/*" element={<WorkspaceProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnboardingGuard (PL-01)', () => {
  beforeEach(() => {
    demo.enabled = false;
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('OnboardingGuard_AdminWithoutOrg_RendersAdminRoutes', async () => {
    mockAuth({ roles: ['Admin'] });
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile({ role: 'Admin' }));

    renderGuard('/app/admin');

    expect(await screen.findByTestId('workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_AdminRoleOnlyInAccessToken_WaitsForRolesThenRendersAdminRoutes', async () => {
    let resolveRoles: (roles: string[]) => void = () => {};
    mockAuth({ tokenRoles: new Promise<string[]>((resolve) => (resolveRoles = resolve)) });
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());

    renderGuard('/app/admin');

    // Profile loaded but roles still unknown: no decision yet (it would wrongly be "no roles → onboarding").
    await waitFor(() => expect(UsersApi.getMe).toHaveBeenCalled());
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace')).not.toBeInTheDocument();

    resolveRoles(['Admin']);

    expect(await screen.findByTestId('workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_HostRolesWithoutOrg_RedirectsToOnboardingWithOrigin', async () => {
    mockAuth({ roles: ['PropertyOwner'] });
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile({ onboardingCompletedAt: '2026-06-16T12:00:00Z' }));

    renderGuard('/app/short-rent/properties');

    expect(await screen.findByTestId('onboarding-page')).toHaveTextContent('onboarding from /app/short-rent/properties');
  });

  it('OnboardingGuard_OnboardedHost_RendersWorkspace', async () => {
    mockAuth({ roles: ['PropertyOwner'] });
    vi.mocked(UsersApi.getMe).mockResolvedValue(
      profile({ orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z' }),
    );

    renderGuard();

    expect(await screen.findByTestId('workspace')).toBeInTheDocument();
  });

  it('OnboardingGuard_ServerError_ShowsRetryInsteadOfOnboarding', async () => {
    mockAuth({ roles: ['PropertyOwner'] });
    vi.mocked(UsersApi.getMe)
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce(profile({ orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z' }));

    renderGuard();

    expect(await screen.findByTestId('profile-load-error')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('shared.profileLoadError.title'))).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('profile-load-retry'));

    expect(await screen.findByTestId('workspace')).toBeInTheDocument();
    expect(UsersApi.getMe).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_NetworkError_ShowsNetworkMessageAndRetry', async () => {
    mockAuth({ roles: ['LongTermLandlord'] });
    vi.mocked(UsersApi.getMe).mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK));

    renderGuard('/app/long-rent/leases');

    expect(await screen.findByTestId('profile-load-error')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('apiErrors.network'))).toBeInTheDocument();
    expect(screen.getByTestId('profile-load-retry')).toBeEnabled();
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_SessionExpired_OffersSignInAgain', async () => {
    mockAuth({ roles: ['PropertyOwner'] });
    vi.mocked(UsersApi.getMe).mockRejectedValue(httpError(401));

    renderGuard();

    fireEvent.click(await screen.findByText(i18n.t('shared.profileLoadError.signInAgain')));
    expect(forceReauth).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_ProfileNotFound_RedirectsToOnboarding', async () => {
    mockAuth({ roles: ['PropertyOwner'] });
    vi.mocked(UsersApi.getMe).mockRejectedValue(httpError(404));

    renderGuard();

    expect(await screen.findByTestId('onboarding-page')).toBeInTheDocument();
  });

  it('OnboardingGuard_DemoModeWithoutApi_UsesPersonaProfileWithoutLoop', async () => {
    demo.enabled = true;
    sessionStorage.setItem('casazen:demo-profile', 'short-stay');
    mockAuth({ roles: ['PropertyOwner'] });
    // Outside Playwright the demo token is rejected (401) or the API is unreachable.
    vi.mocked(UsersApi.getMe).mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK));

    renderGuard();

    expect(await screen.findByTestId('workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-load-error')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_DemoOnboardingPersonaWithoutApi_OpensTheWizard', async () => {
    demo.enabled = true;
    sessionStorage.setItem('casazen:demo-profile', 'onboarding');
    mockAuth({ roles: [] });
    vi.mocked(UsersApi.getMe).mockRejectedValue(httpError(401));

    renderGuard('/app/short-rent');

    expect(await screen.findByTestId('onboarding-page')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-load-error')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_DemoAdminPersonaWithoutApi_RendersAdminRoutes', async () => {
    demo.enabled = true;
    sessionStorage.setItem('casazen:demo-profile', 'admin');
    mockAuth({ roles: ['Admin'] });
    vi.mocked(UsersApi.getMe).mockRejectedValue(httpError(401));

    renderGuard('/app/admin');

    expect(await screen.findByTestId('workspace')).toBeInTheDocument();
  });
});

describe('OnboardingGuard supplier (SU-02)', () => {
  const pendingClaim = {
    token: 'a'.repeat(64),
    email: 'fornitore@example.com',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  };

  beforeEach(() => {
    demo.enabled = false;
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('OnboardingGuard_LinkedSupplierWithoutRoleInToken_RendersSupplierConsole', async () => {
    // Claimed, but the Auth0 Supplier role is not in the token yet (rolesSynced: false).
    mockAuth({ tokenRoles: Promise.resolve([]) });
    vi.mocked(UsersApi.getMe).mockResolvedValue(
      profile({ role: 'PropertyOwner', orgId: 'supplier-org', supplierOrgId: 'supplier-org' }),
    );

    renderGuard('/app/supplier/activation');

    expect(await screen.findByTestId('workspace')).toHaveTextContent('/app/supplier/activation');
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_NoOrgNoRolesNoClaimToken_RedirectsToHostOnboarding', async () => {
    mockAuth({ tokenRoles: Promise.resolve([]) });
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());

    renderGuard('/app/short-rent');

    expect(await screen.findByTestId('onboarding-page')).toBeInTheDocument();
    expect(screen.queryByTestId('claim-page')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_PendingSupplierClaim_RedirectsToClaimPageNotHostOnboarding', async () => {
    localStorage.setItem('cz-supplier-claim', JSON.stringify(pendingClaim));
    mockAuth({ tokenRoles: Promise.resolve([]) });
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());

    renderGuard('/app/short-rent');

    expect(await screen.findByTestId('claim-page')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-page')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_ExpiredPendingClaim_IsDroppedAndOnboardingOpens', async () => {
    localStorage.setItem('cz-supplier-claim', JSON.stringify({ ...pendingClaim, expiresAt: '2020-01-01T00:00:00Z' }));
    mockAuth({ tokenRoles: Promise.resolve([]) });
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile());

    renderGuard('/app/short-rent');

    expect(await screen.findByTestId('onboarding-page')).toBeInTheDocument();
    expect(localStorage.getItem('cz-supplier-claim')).toBeNull();
  });

  it('OnboardingGuard_LinkedSupplierWithLeftoverClaim_RendersConsole', async () => {
    localStorage.setItem('cz-supplier-claim', JSON.stringify(pendingClaim));
    mockAuth({ roles: ['Supplier'] });
    vi.mocked(UsersApi.getMe).mockResolvedValue(profile({ orgId: 'supplier-org', supplierOrgId: 'supplier-org' }));

    renderGuard('/app/supplier/inbox');

    expect(await screen.findByTestId('workspace')).toHaveTextContent('/app/supplier/inbox');
    expect(screen.queryByTestId('claim-page')).not.toBeInTheDocument();
  });

  it('OnboardingGuard_HostWithSupplierProfile_KeepsHostWorkspace', async () => {
    mockAuth({ roles: ['PropertyOwner', 'Supplier'] });
    vi.mocked(UsersApi.getMe).mockResolvedValue(
      profile({ orgId: 'host-org', supplierOrgId: 'supplier-org', onboardingCompletedAt: '2026-06-16T12:00:00Z' }),
    );

    renderGuard('/app/short-rent/properties');

    expect(await screen.findByTestId('workspace')).toHaveTextContent('/app/short-rent/properties');
  });
});
