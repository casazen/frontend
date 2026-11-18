import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@/i18n/config';
import type { UserDetail } from '@/types';
import { CommercialSignupApi } from '@/api/commercial-signup.api';
import { UsersApi } from '@/api/users.api';
import { CommercialSignupWizard } from '../commercial-signup-wizard';
const checkout = vi.fn();
const refreshAccessToken = vi.fn();
vi.mock('@/api/users.api', () => ({ UsersApi: { postOnboarding: vi.fn(async () => ({ orgProvisioned: false, rolesSynced: true })) } }));
vi.mock('../components/consents-step', () => ({
  ConsentsStep: ({ onContinue }: { onContinue: () => void }) => <button onClick={onContinue}>Conferma consensi</button>,
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ refreshAccessToken }) }));
vi.mock('@/queries/use-billing', () => ({
  useBillingPlans: () => ({ data: ['Starter', 'Pro', 'Scale', 'Agency'].map(tier => ({ tier, displayName: tier, priceMonthly: tier === 'Agency' ? 11 : 20, agencyTariff: tier === 'Agency' ? { purchasable: true, minimum: 100, quoteFrom: 400, bands: [{ upTo: 49, unitPrice: 11 }, { upTo: 149, unitPrice: 9.9 }, { upTo: 399, unitPrice: 8.8 }] } : null, currency: 'EUR', unitAllowance: 3, features: ['Calendario'], purchasable: true })) }),
  useBillingSubscription: () => ({ data: { status: 'none' } }),
  useOpenBillingPortal: () => ({ mutate: vi.fn() }),
  useStartCheckout: () => ({ mutate: checkout }),
}));
vi.mock('@/api/commercial-signup.api', () => ({ CommercialSignupApi: { getCatalog: vi.fn(async () => [
  { code: 'channels', context: 'short-rent', priceMonthly: 3, currency: 'EUR', purchasable: true, agencyIncluded: true, agencyPurchasable: true },
  { code: 'ai-agents', context: 'short-rent', priceMonthly: 2, currency: 'EUR', purchasable: true, agencyPurchasable: true, agencyPriceMonthly: 2 },
]) } }));
function start(profile?: UserDetail) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Routes><Route path="/" element={<CommercialSignupWizard profile={profile} />} /><Route path="/register" element={<p>Supplier registration</p>} /></Routes></MemoryRouter></QueryClientProvider>);
}
afterEach(cleanup);
describe('commercial profile and configuration', () => {
  it('offers three profiles and routes suppliers to their registration', async () => {
    start();
    expect(screen.getAllByTestId(/^signup-profile-/)).toHaveLength(3);
    expect(screen.queryByText('Entrambi')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('signup-profile-supplier'));
    expect(await screen.findByText('Supplier registration')).toBeVisible();
  });
  it('chooses rental areas independently and clears incompatible extras', async () => {
    start(); fireEvent.click(screen.getByTestId('signup-profile-owner'));
    fireEvent.click(screen.getByRole('button', { name: /Pro/ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Canali e distribuzione/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Affitti lungo termine' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Affitti brevi e lunghi' }));
    expect(screen.getByRole('checkbox', { name: /Canali e distribuzione/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Vai al riepilogo' }));
    expect(screen.getByText('Affitti brevi e lunghi', { selector: 'dd' })).toBeVisible();
  });
  it('locks extras on Starter, unlocks on Pro and clears them when returning to Starter', async () => {
    start(); fireEvent.click(screen.getByTestId('signup-profile-owner'));
    const extra = await screen.findByRole('checkbox', { name: /Canali e distribuzione/ }); expect(extra).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Pro/ })); expect(extra).toBeEnabled();
    fireEvent.click(extra); expect(extra).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Starter/ })); expect(extra).not.toBeChecked(); expect(extra).toBeDisabled();
    expect(checkout).not.toHaveBeenCalled();
  });
  it.each(['Pro', 'Scale'])('shows missing extra prices separately from plan eligibility on %s', async tier => {
    vi.mocked(CommercialSignupApi.getCatalog).mockResolvedValueOnce([
      { code: 'channels', context: 'short-rent', priceMonthly: null, currency: 'EUR', purchasable: false },
      { code: 'operations', context: 'all', priceMonthly: null, currency: 'EUR', purchasable: true },
      { code: 'crm', context: 'short-rent', priceMonthly: 10, currency: 'EUR', purchasable: false },
      { code: 'fiscal', context: 'all', priceMonthly: 3, currency: 'EUR', purchasable: true, agencyIncluded: true, agencyPurchasable: true },
    ]);
    start();
    fireEvent.click(screen.getByTestId('signup-profile-owner'));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(tier) }));
    const missingPrices = await screen.findAllByRole('checkbox', { name: /Prezzo da configurare/ });
    expect(missingPrices).toHaveLength(2);
    for (const extra of missingPrices) expect(extra).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Non ancora acquistabile/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /3,00/ })).toBeEnabled();
  });
  it('adds included and separately priced modules to the same owner plan', async () => {
    vi.mocked(CommercialSignupApi.getCatalog).mockResolvedValueOnce([
      { code: 'channels', context: 'short-rent', priceMonthly: null, currency: 'EUR', purchasable: false, includedInPlans: ['Pro', 'Scale'] },
      { code: 'direct-booking', context: 'short-rent', priceMonthly: null, currency: 'EUR', purchasable: false, includedInPlans: ['Pro', 'Scale'] },
      { code: 'fiscal', context: 'all', priceMonthly: null, currency: 'EUR', purchasable: false, ownerOffer: { priceMonthly: 3, purchasable: true } },
    ]);
    start();
    fireEvent.click(screen.getByTestId('signup-profile-owner'));
    expect(await screen.findByText('Sincronizzazione dei calendari OTA tramite iCal')).toBeVisible();
    fireEvent.click(await screen.findByRole('button', { name: /Pro/ }));
    expect(await screen.findByText('Sincronizzazione automatica con i portali OTA')).toBeVisible();
    expect(screen.getByText('Sincronizzazione dei contenuti con i portali OTA')).toBeVisible();
    expect(screen.getByText('Hub messaggi integrato con i portali OTA')).toBeVisible();
    expect(screen.queryByText(/tramite iCal/)).not.toBeInTheDocument();
    expect(await screen.findByText('Prenotazioni dirette', { selector: 'li' })).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: /Prenotazioni dirette/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /3,00/ }));
    expect(screen.getByText(/23,00/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Vai al riepilogo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continua al pagamento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma consensi' }));
    expect(UsersApi.postOnboarding).toHaveBeenLastCalledWith(expect.objectContaining({
      commercialSignup: expect.objectContaining({ planTier: 'Pro', addons: ['fiscal', 'channels', 'direct-booking'] }),
    }));
  });
  it('requires an agency name and explains founder administration and invite-only membership', async () => {
    start(); fireEvent.click(screen.getByTestId('signup-profile-agency'));
    await screen.findByText('Sincronizzazione automatica con i portali OTA', { selector: 'li' });
    fireEvent.click(screen.getByRole('button', { name: 'Vai al riepilogo' }));
    expect(screen.getByLabelText('Nome dell’agenzia')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Inserisci il nome');
    expect(screen.getByText(/Ne sarai titolare e amministratore/)).toBeVisible();
    const name = screen.getByRole('textbox', { name: 'Nome dell’agenzia' });
    expect(name).toBeRequired();
    expect(name).toHaveAccessibleDescription('Inserisci il nome dell’agenzia per continuare.');
    fireEvent.change(name, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Vai al riepilogo' })).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Nuova Agenzia' } });
    expect(screen.getByRole('button', { name: 'Vai al riepilogo' })).toBeEnabled();
  });
  it('resumes the scoped review after a reload and pause, and keeps choices when revisiting the same profile', async () => {
    const user = { id: 'user:resume', orgId: null } as UserDetail;
    const wizard = start(user);
    fireEvent.click(screen.getByTestId('signup-profile-agency'));
    fireEvent.change(screen.getByLabelText('Nome dell’agenzia'), { target: { value: 'Agenzia Test' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Affitti brevi e lunghi' }));
    const agentOption = await screen.findByRole('checkbox', { name: /AI Agents/ });
    expect(agentOption).toBeEnabled();
    expect(screen.queryByRole('checkbox', { name: /Canali e distribuzione/ })).not.toBeInTheDocument();
    fireEvent.click(agentOption);
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));
    fireEvent.click(screen.getByTestId('signup-profile-agency'));
    expect(screen.getByRole('checkbox', { name: /AI Agents/ })).toBeChecked();
    expect(screen.getByLabelText('Nome dell’agenzia')).toHaveValue('Agenzia Test');
    fireEvent.click(screen.getByRole('button', { name: 'Vai al riepilogo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Metti in pausa' }));
    expect(screen.getByRole('heading', { name: 'Configurazione in pausa' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Riprendi la configurazione' }));
    expect(screen.getByText('Agenzia Test')).toBeVisible();
    wizard.unmount();
    start({ ...user, id: 'other' });
    expect(screen.getByTestId('signup-profile-owner')).toBeVisible();
    cleanup();
    start(user);
    expect(await screen.findByText('Agenzia Test')).toBeVisible();
    expect(screen.getByText('AI Agents', { selector: 'li' })).toBeVisible();
    expect(screen.getByText('Affitti brevi e lunghi', { selector: 'dd' })).toBeVisible();
    expect(screen.queryByText('Conferma consensi')).not.toBeInTheDocument();
    sessionStorage.clear();
  });

  it('updates the estimate for three rooms without changing the commercial selection', async () => {
    start(); fireEvent.click(screen.getByTestId('signup-profile-agency'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome dell’agenzia' }), { target: { value: 'Nuova Agenzia' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    expect(await screen.findByText('Sincronizzazione automatica con i portali OTA', { selector: 'li' })).toBeVisible();
    expect(screen.getByText('3 camere ipotizzate')).toBeVisible();
    expect(screen.getAllByText(/100,00/).at(-1)).toBeVisible();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(screen.getByText(/Inserisci da 0 a 10/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Vai al riepilogo' })).toBeEnabled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vai al riepilogo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continua all’attivazione' }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma consensi' }));
    expect(UsersApi.postOnboarding).toHaveBeenCalledWith(expect.objectContaining({
      commercialSignup: expect.objectContaining({ profile: 'agency', rooms: 1, addons: ['channels'] }),
    }));
    expect(await screen.findByRole('combobox', { name: 'Paese' })).toBeVisible();
    expect(refreshAccessToken).not.toHaveBeenCalled();
  });
});
