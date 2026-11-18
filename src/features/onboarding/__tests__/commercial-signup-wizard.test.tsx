import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@/i18n/config';
import { UsersApi } from '@/api/users.api';
import { CommercialSignupWizard } from '../commercial-signup-wizard';
const checkout = vi.fn();
vi.mock('@/api/users.api', () => ({ UsersApi: { postOnboarding: vi.fn(async () => ({ orgProvisioned: false })) } }));
vi.mock('../components/consents-step', () => ({
  ConsentsStep: ({ onContinue }: { onContinue: () => void }) => <button onClick={onContinue}>Conferma consensi</button>,
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ refreshAccessToken: vi.fn() }) }));
vi.mock('@/queries/use-billing', () => ({
  useBillingPlans: () => ({ data: ['Starter', 'Pro', 'Agency'].map(tier => ({ tier, displayName: tier, priceMonthly: tier === 'Agency' ? 12 : 20, currency: 'EUR', unitAllowance: 3, features: ['Calendario'], purchasable: true })) }),
  useBillingSubscription: () => ({ data: { status: 'none' } }),
  useOpenBillingPortal: () => ({ mutate: vi.fn() }),
  useStartCheckout: () => ({ mutate: checkout }),
}));
vi.mock('@/api/commercial-signup.api', () => ({ CommercialSignupApi: { getCatalog: async () => [{ code: 'channels', context: 'short-rent', priceMonthly: 3, currency: 'EUR', purchasable: true }] } }));
function start() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Routes><Route path="/" element={<CommercialSignupWizard profile={undefined} />} /><Route path="/register" element={<p>Supplier registration</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}
afterEach(cleanup);
describe('commercial profile and configuration', () => {
  it('offers four profiles and routes suppliers to their registration', async () => {
    start();
    expect(screen.getAllByTestId(/^signup-profile-/)).toHaveLength(4);
    expect(screen.queryByText('Entrambi')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('signup-profile-supplier'));
    expect(await screen.findByText('Supplier registration')).toBeVisible();
  });
  it('locks extras on Starter, unlocks on Pro and clears them when returning to Starter', async () => {
    start(); fireEvent.click(screen.getByTestId('signup-profile-owner'));
    const extra = await screen.findByRole('checkbox'); expect(extra).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Pro/ })); expect(extra).toBeEnabled();
    fireEvent.click(extra); expect(extra).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Starter/ })); expect(extra).not.toBeChecked(); expect(extra).toBeDisabled();
    expect(checkout).not.toHaveBeenCalled();
  });
  it('requires an agency name and explains founder administration and invite-only membership', async () => {
    start(); fireEvent.click(screen.getByTestId('signup-profile-agency'));
    await screen.findByRole('checkbox');
    expect(screen.getByRole('button', { name: 'Vai al riepilogo' })).toBeDisabled();
    expect(screen.getByText(/Ne sarai titolare e amministratore/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nome dell’agenzia'), { target: { value: 'Nuova Agenzia' } });
    expect(screen.getByRole('button', { name: 'Vai al riepilogo' })).toBeEnabled();
  });
  it('updates the estimate for three rooms without changing the commercial selection', async () => {
    start(); fireEvent.click(screen.getByTestId('signup-profile-agency'));
    fireEvent.change(screen.getByLabelText('Nome dell’agenzia'), { target: { value: 'Nuova Agenzia' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(await screen.findByRole('checkbox'));
    expect(screen.getByText('3 camere ipotizzate')).toBeVisible();
    expect(screen.getByText(/45,00/)).toBeVisible();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(screen.getByText(/Inserisci da 1 a 10/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Vai al riepilogo' })).toBeEnabled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vai al riepilogo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continua al pagamento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma consensi' }));
    expect(UsersApi.postOnboarding).toHaveBeenCalledWith(expect.objectContaining({
      commercialSignup: expect.objectContaining({ profile: 'agency', rooms: 1, addons: ['channels'] }),
    }));
  });
});
