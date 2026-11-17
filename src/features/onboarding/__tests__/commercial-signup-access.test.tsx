import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { UsersApi } from '@/api/users.api';
import { contextsApi } from '@/api/contexts';
import type { UserDetail } from '@/types';
import { CommercialSignupWizard } from '../commercial-signup-wizard';
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn(async () => 'fresh') }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ refreshAccessToken: refresh }) }));
vi.mock('@/api/users.api', () => ({ UsersApi: { getMe: vi.fn() } }));
vi.mock('@/api/contexts', () => ({ contextsApi: { getContexts: vi.fn() } }));
vi.mock('@/queries/use-billing', () => ({
  useBillingPlans: () => ({ data: [] }),
  useBillingSubscription: () => ({ data: { status: 'active' } }),
  useOpenBillingPortal: () => ({ mutate: vi.fn() }),
  useStartCheckout: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/api/commercial-signup.api', () => ({ CommercialSignupApi: { getCatalog: async () => [] } }));
const me = { id: 'auth0|host', isActive: true, orgId: 'org-1', onboardingCompletedAt: '2026-11-17', onboardingRequired: false, consentsAccepted: true, commercialSetupRequired: false, hasProperties: true, commercialSignup: { profile: 'owner', planTier: 'Starter', rooms: 1, addons: [] } } as UserDetail;
function start() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Routes><Route path="/" element={<CommercialSignupWizard profile={me} />} /><Route path="/app/short-rent" element={<p data-testid="authorized-workspace">workspace</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(UsersApi.getMe).mockResolvedValue(me);
  vi.mocked(contextsApi.getContexts).mockResolvedValue({ userId: me.id, contexts: [{ contextKey: 'short-rent', displayName: 'Short', roleKey: 'property_owner', permissions: ['property.read'], defaultRoute: '/app/short-rent' }] });
});
afterEach(cleanup);
describe('paid signup continuation', () => {
  it('enters using confirmed server memberships even when silent token renewal fails', async () => {
    refresh.mockRejectedValueOnce(new Error('login_required'));
    start(); fireEvent.click(screen.getByRole('button', { name: i18n.t('commercial.enter') }));
    expect(await screen.findByTestId('authorized-workspace')).toBeVisible();
  });
  it('does not enter when the bootstrap refuses the user', async () => {
    vi.mocked(contextsApi.getContexts).mockRejectedValue({ response: { status: 403 } });
    start(); fireEvent.click(screen.getByRole('button', { name: i18n.t('commercial.enter') }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByTestId('authorized-workspace')).not.toBeInTheDocument();
  });
  it('does not enter while payment is still withheld by the persisted profile', async () => {
    vi.mocked(UsersApi.getMe).mockResolvedValue({ ...me, commercialSetupRequired: true });
    start(); fireEvent.click(screen.getByRole('button', { name: i18n.t('commercial.enter') }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(contextsApi.getContexts).not.toHaveBeenCalled();
  });
});
