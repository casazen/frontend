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

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn(async () => 'fresh-token') }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isLoading: false, isAuthenticated: true, user: { roles: ['Admin'] }, getAccessToken: refresh, refreshAccessToken: refresh }) }));
vi.mock('@/api/users.api', () => ({ UsersApi: { getMe: vi.fn(), postOnboarding: vi.fn(), putOnboarding: vi.fn() } }));
vi.mock('@/api/contexts', () => ({ contextsApi: { getContexts: vi.fn() } }));
vi.mock('@/queries/use-billing', () => ({
  useBillingPlans: () => ({ data: [{ tier: 'Starter', displayName: 'Starter', priceMonthly: 20, currency: 'EUR', purchasable: true, features: [] }] }),
  useBillingSubscription: () => ({ data: { status: 'none' } }),
  useOpenBillingPortal: () => ({ mutate: vi.fn() }),
  useStartCheckout: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/api/commercial-signup.api', () => ({ CommercialSignupApi: { getCatalog: async () => [] } }));
const CONSENTS: OnboardingConsentsPayload = { tosAccepted: true, tosVersion: 'v1', privacyAccepted: true, privacyVersion: 'v1', dpaAccepted: true, dpaVersion: 'v1', subprocessorsAcknowledged: true, subprocessorsVersion: 'v1' };
vi.mock('../components/consents-step', () => ({ ConsentsStep: ({ onContinue }: { onContinue: (payload: OnboardingConsentsPayload) => void }) => <button onClick={() => onContinue(CONSENTS)} data-testid="accept-consents">Accept consents</button> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
