import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';
import { TenantSepaSettings, TenantSepaPayment } from '../tenant-sepa';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('@/features/public-booking/components/stripe-intent-payment', () => ({
  StripeIntentPayment: ({ onSubmitted }: { onSubmitted: (status: string) => void }) => <button onClick={() => onSubmitted('succeeded')}>Stripe consent</button>,
}));
const settings = { authorized: false, automaticEnabled: false, canAuthorize: true, canManage: true,
  authorizationUntil: '2029-12-31', blockedFrom: '2030-01-01', transactionFee: 1 };
function show(element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{element}</QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('tenant SEPA consent and amounts', () => {
  it('does not enable automatic payments when the tenant authorizes the mandate', async () => {
    await i18n.changeLanguage('it');
    vi.mocked(ApiClient.get).mockResolvedValue(settings);
    vi.mocked(ApiClient.post).mockResolvedValue({ clientSecret: 'seti_secret', publishableKey: 'pk_test', stripeAccountId: '' });
    vi.mocked(ApiClient.put).mockResolvedValue({ ...settings, authorized: true });
    show(<TenantSepaSettings leaseId="lease-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Autorizza mandato con Stripe' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Stripe consent' }));
    expect(ApiClient.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mantieni pagamento manuale' }));
    await waitFor(() => expect(ApiClient.put).toHaveBeenCalledWith('/tenant-area/contracts/lease-1/sepa/automatic', { enabled: false }));
  });
  it('requires a separate explicit action to enable monthly automatic collection', async () => {
    await i18n.changeLanguage('it');
    vi.mocked(ApiClient.get).mockResolvedValue({ ...settings, authorized: true });
    vi.mocked(ApiClient.put).mockResolvedValue({ ...settings, authorized: true, automaticEnabled: true });
    show(<TenantSepaSettings leaseId="lease-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Attiva automatico mensile' }));
    await waitFor(() => expect(ApiClient.put).toHaveBeenCalledWith('/tenant-area/contracts/lease-1/sepa/automatic', { enabled: true }));
    expect(await screen.findByText(/Pagamento automatico mensile attivo/)).toBeInTheDocument();
  });
  it('does not offer authorization after the contract cutoff', async () => {
    await i18n.changeLanguage('it');
    vi.mocked(ApiClient.get).mockResolvedValue({ ...settings, canAuthorize: false });
    show(<TenantSepaSettings leaseId="lease-1" />);
    expect(await screen.findByText('Addebiti non disponibili per questo contratto.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('shows rent plus condominium advance and exactly one euro before payment starts', async () => {
    await i18n.changeLanguage('it');
    show(<TenantSepaPayment leaseId="lease-1" dueId="due-1" amount={1100} currency="EUR" />);
    expect(screen.getByTestId('tenant-sepa-payment')).toHaveTextContent('1101,00');
    expect(ApiClient.post).not.toHaveBeenCalled();
  });
});
