import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OnboardingPage } from '../onboarding-page';
import { UsersApi } from '@/api/users.api';
import { contextsApi } from '@/api/contexts';
import type { UserDetail } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import i18n from '@/i18n/config';

const { refresh, subscription } = vi.hoisted(() => ({
  refresh: vi.fn(async () => 'fresh-token'),
  subscription: vi.fn(() => ({ data: { status: 'none' } })),
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isLoading: false, isAuthenticated: true, user: { roles: ['Admin'] }, getAccessToken: refresh, refreshAccessToken: refresh }) }));
vi.mock('@/api/users.api', () => ({ UsersApi: { getMe: vi.fn(), postOnboarding: vi.fn(), putOnboarding: vi.fn() } }));
vi.mock('@/api/contexts', () => ({ contextsApi: { getContexts: vi.fn() } }));
vi.mock('@/queries/use-billing', () => ({
  useBillingPlans: () => ({ data: [{ tier: 'Starter', displayName: 'Starter', priceMonthly: 20, currency: 'EUR', purchasable: true, features: [] }] }),
  useBillingSubscription: subscription,
  useOpenBillingPortal: () => ({ mutate: vi.fn() }),
  useStartCheckout: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/api/commercial-signup.api', () => ({ CommercialSignupApi: { getCatalog: async () => [] } }));
const CONSENTS: OnboardingConsentsPayload = { tosAccepted: true, tosVersion: 'v1', privacyAccepted: true, privacyVersion: 'v1', dpaAccepted: true, dpaVersion: 'v1', subprocessorsAcknowledged: true, subprocessorsVersion: 'v1' };
vi.mock('../components/consents-step', () => ({ ConsentsStep: ({ onContinue }: { onContinue: (payload: OnboardingConsentsPayload) => void }) => <button onClick={() => onContinue(CONSENTS)} data-testid="accept-consents">Accept consents</button> }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  subscription.mockReturnValue({ data: { status: 'none' } });
});

it('publishes the saved payment-gated profile after cancelling a pending invalidation, without granting workspace access', async () => {
  const initial = { id: 'auth0|admin', role: 'Admin', isActive: true, orgId: null, onboardingCompletedAt: null } as UserDetail;
  const saved = { ...initial, orgId: 'org-1', rentalType: 'LongTerm', onboardingCompletedAt: '2026-11-17', onboardingRequired: false, consentsAccepted: true, commercialSetupRequired: true, commercialSignup: { profile: 'long-rent', planTier: 'Starter', rooms: 1, addons: [] } } as UserDetail;
  let provisioned = false;
  let savedReads = 0;
  vi.mocked(UsersApi.getMe).mockImplementation(async () => {
    if (!provisioned) return initial;
    savedReads += 1;
    // onSuccess starts an invalidation that is still in flight when the explicit continuation cancels it.
    if (savedReads === 1) return new Promise<UserDetail>(() => undefined);
    return saved;
  });
  vi.mocked(UsersApi.postOnboarding).mockImplementation(async () => {
    provisioned = true;
    return { orgId: 'org-1', orgProvisioned: true, rentalType: 'LongTerm', rolesAssigned: ['LongTermLandlord'], rolesSynced: false };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const cancelled = vi.spyOn(client, 'cancelQueries');
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/onboarding']}><Routes>
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/app/long-rent/properties/new" element={<p data-testid="workspace-entered">workspace</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
  fireEvent.click((await screen.findAllByRole('button', { name: i18n.t('onboarding.choose') }))[1]);
  fireEvent.click(await screen.findByTestId('accept-consents'));
  await waitFor(() => expect(document.getElementById('signup-billing-country')).toBeVisible());
  expect(client.getQueryData(['me'])).toEqual(saved);
  expect(cancelled).toHaveBeenCalledWith({ queryKey: ['me'] });
  expect(savedReads).toBeGreaterThanOrEqual(2);
  expect(UsersApi.postOnboarding).toHaveBeenCalledTimes(1);
  expect(UsersApi.postOnboarding).toHaveBeenCalledWith({ rentalType: 'LongTerm', consents: CONSENTS });
  expect(contextsApi.getContexts).not.toHaveBeenCalled();
  expect(screen.queryByTestId('workspace-entered')).not.toBeInTheDocument();
  expect(screen.queryByTestId('onboarding-access-error')).not.toBeInTheDocument();
});

it('keeps the payment confirmation open when the profile changes before workspace membership is verified', async () => {
  const initial = {
    id: 'auth0|new-host', orgId: 'org-1', isActive: true, rentalType: 'LongTerm', hasProperties: false,
    onboardingRequired: false, consentsAccepted: true, onboardingCompletedAt: '2026-11-17',
    commercialSetupRequired: true, commercialSignup: { profile: 'owner', rentalArea: 'LongTerm', planTier: 'Starter', rooms: 1, addons: [] },
  } as UserDetail;
  const settled = { ...initial, commercialSetupRequired: false };
  vi.mocked(UsersApi.getMe).mockResolvedValue(initial);
  vi.mocked(contextsApi.getContexts)
    .mockRejectedValueOnce({ response: { status: 403 } })
    .mockResolvedValue({ userId: initial.id, contexts: [{ contextKey: 'long-rent', displayName: 'Long', roleKey: 'property_owner', permissions: ['property.write'], defaultRoute: '/app/long-rent' }] });
  subscription.mockReturnValue({ data: { status: 'active' } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/onboarding?checkout=success']}><Routes>
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/app/long-rent/properties/new" element={<p data-testid="first-property">first property</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByRole('heading', { name: i18n.t('commercial.firstPropertyTitle') })).toBeVisible();
  vi.mocked(UsersApi.getMe).mockResolvedValue(settled);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('commercial.enter') }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(client.getQueryData(['me'])).toEqual(initial);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('commercial.enter') }));
  expect(await screen.findByTestId('first-property')).toBeVisible();
  expect(contextsApi.getContexts).toHaveBeenCalledTimes(2);
  expect(UsersApi.postOnboarding).not.toHaveBeenCalled();
});

it('shows the commercial enter step when checkout=success lands after commercialSetupRequired is already cleared', async () => {
  const settled = {
    id: 'auth0|new-host', orgId: 'org-1', isActive: true, rentalType: 'ShortTerm', hasProperties: false,
    onboardingRequired: false, consentsAccepted: true, onboardingCompletedAt: '2026-11-17',
    commercialSetupRequired: false, commercialSignup: { profile: 'owner', rentalArea: 'ShortTerm', planTier: 'Pro', rooms: 1, addons: [] },
  } as UserDetail;
  vi.mocked(UsersApi.getMe).mockResolvedValue(settled);
  vi.mocked(contextsApi.getContexts).mockResolvedValue({
    userId: settled.id,
    contexts: [{ contextKey: 'short-rent', displayName: 'Short', roleKey: 'property_owner', permissions: ['property.write'], defaultRoute: '/app/short-rent' }],
  });
  subscription.mockReturnValue({ data: { status: 'active' } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/onboarding?checkout=success']}><Routes>
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/app/short-rent/properties/create" element={<p data-testid="first-property">first property</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);

  expect(await screen.findByRole('button', { name: i18n.t('commercial.enter') })).toBeVisible();
  expect(screen.queryByRole('heading', { name: /Da dove vuoi iniziare/i })).not.toBeInTheDocument();
});
