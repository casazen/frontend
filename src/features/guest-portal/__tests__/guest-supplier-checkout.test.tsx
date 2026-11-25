import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@/api/client';
import { GuestSupplierOrders } from '../guest-supplier-orders';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/features/public-booking/components/stripe-intent-payment', () => ({
  StripeIntentPayment: ({ onSubmitted, onError, returnUrl, publishableKey }: {
    onSubmitted: () => void; onError: (error: string) => void; returnUrl: string; publishableKey: string;
  }) => <section data-testid="payment" data-return={returnUrl} data-key={publishableKey}>
    <button onClick={() => onError('Card declined')}>Decline</button>
    <button onClick={() => onSubmitted()}>Confirm with Stripe</button>
  </section>,
}));

const base = '/public/guest-portal/test/supplier-orders';
const order = { id: 'o1', state: 'Quoted', serviceName: 'Transfer', supplierName: 'Acme', stripeSandbox: true,
  requestedFor: '2026-11-26T17:00:00Z', supplierPriceCents: 1000, commissionCents: 100, totalCents: 1100, refundCents: 0 };
const response = { environment: 'stripe-sandbox', offers: [], orders: [order] };
const checkout = { publishableKey: 'pk_test_example', clientSecret: 'pi_test_secret' };
function Location() { return <output data-testid="location">{useLocation().search}</output>; }
function show(search = '?page=supplier-orders&lang=en') {
  render(<QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={['/s/test' + search]}>
      <GuestSupplierOrders path="/public/guest-portal/test" language="en" />
      <Location />
    </MemoryRouter>
  </QueryClientProvider>);
}

describe('guest supplier sandbox checkout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(ApiClient.get).mockResolvedValue(response);
  });

  it('confirms the displayed amount, retries a declined card and trusts server reconciliation', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(checkout).mockResolvedValueOnce({ ...order, state: 'Authorized' });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Authorize with test card' }));
    const element = await screen.findByTestId('payment');
    expect(element).toHaveAttribute('data-key', checkout.publishableKey);
    expect(new URL(element.getAttribute('data-return')!).searchParams.get('supplierOrderReturn')).toBe('o1');
    fireEvent.click(screen.getByText('Decline'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Card declined');
    fireEvent.click(screen.getByText('Confirm with Stripe'));
    await waitFor(() => expect(screen.queryByTestId('payment')).not.toBeInTheDocument());
    expect(ApiClient.post).toHaveBeenNthCalledWith(1, base + '/o1/checkout', { totalCents: 1100 }, { public: true });
    expect(ApiClient.post).toHaveBeenNthCalledWith(2, base + '/o1/reconcile', {}, { public: true });
    expect(await screen.findByText(/Amount authorized/i)).toBeInTheDocument();
  });

  it('scrubs Stripe redirect parameters, retries a failed reconciliation and keeps the guest language', async () => {
    vi.mocked(ApiClient.post).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...order, state: 'Authorized' });
    show('?page=supplier-orders&lang=en&supplierOrderReturn=o1&payment_intent=pi_test&payment_intent_client_secret=secret&redirect_status=succeeded');
    fireEvent.click(await screen.findByRole('button', { name: 'Check status' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?page=supplier-orders&lang=en'));
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('?page=supplier-orders&lang=en'));
    expect(await screen.findByText(/Amount authorized/i)).toBeInTheDocument();
    expect(ApiClient.post).toHaveBeenCalledTimes(2);
  });

  it('never mounts Stripe with a live publishable key in the sandbox', async () => {
    vi.mocked(ApiClient.post).mockResolvedValue({ ...checkout, publishableKey: 'pk_live_example' });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Authorize with test card' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify authorization');
    expect(screen.queryByTestId('payment')).not.toBeInTheDocument();
  });

  it('keeps simulated orders on their original endpoint and never mounts Stripe for them', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue({ environment: 'simulation', offers: [], orders: [{ ...order, stripeSandbox: false }] });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Authorize simulated payment' }));
    await waitFor(() => expect(ApiClient.post).toHaveBeenCalledWith(base + '/o1/authorize', { totalCents: 1100 }, { public: true }));
    expect(screen.queryByTestId('payment')).not.toBeInTheDocument();
  });
});
