import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadStripe } from '@stripe/stripe-js';
import { ApiClient } from '@/api/client';
import { GuestSupplierOrders } from '../guest-supplier-orders';

vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn() }));
vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/features/public-booking/components/stripe-intent-payment', () => ({
  StripeIntentPayment: ({ onSubmitted, onError, returnUrl, publishableKey, mode }: {
    onSubmitted: () => void; onError: (error: string) => void; returnUrl: string; publishableKey: string; mode: string;
  }) => <section data-testid="payment" data-return={returnUrl} data-key={publishableKey} data-mode={mode}>
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

  it('requires explicit consent for the quoted amount and saves a card without charging', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue({ ...response, orders: [{ ...order, stripeDeferred: true }] });
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ ...checkout, mode: 'setup' })
      .mockResolvedValueOnce({ ...order, stripeDeferred: true, state: 'CardSaved' });
    show();
    const button = await screen.findByRole('button', { name: 'Save test card' });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /single charge.*11.*Acme/i }));
    fireEvent.click(button);
    expect(await screen.findByTestId('payment')).toHaveAttribute('data-mode', 'setup');
    fireEvent.click(await screen.findByText('Confirm with Stripe'));
    expect(await screen.findByText(/Test card saved/i)).toBeVisible();
    expect(ApiClient.post).toHaveBeenNthCalledWith(1, base + '/o1/checkout',
      { totalCents: 1100, consentVersion: 'guest-service-order-off-session-v1' }, { public: true });
  });

  it('handles an off-session bank challenge, then rereads the order without a second charge', async () => {
    const handleNextAction = vi.fn().mockResolvedValue({});
    vi.mocked(loadStripe).mockResolvedValue({ handleNextAction } as unknown as NonNullable<Awaited<ReturnType<typeof loadStripe>>>);
    vi.mocked(ApiClient.get).mockResolvedValue({ ...response, orders: [{ ...order, stripeDeferred: true, state: 'PaymentActionRequired' }] });
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ ...checkout, mode: 'next-action' })
      .mockResolvedValueOnce({ ...order, stripeDeferred: true, state: 'Accepted' });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verify with your bank' }));
    expect(await screen.findByText(/Acme.*Booked/i)).toBeVisible();
    expect(handleNextAction).toHaveBeenCalledOnce();
    expect(ApiClient.post).toHaveBeenCalledTimes(2);
  });

  it('reopens the existing payment after a declined off-session charge', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue({ ...response, orders: [{ ...order, stripeDeferred: true, state: 'PaymentFailed' }] });
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ ...checkout, mode: 'payment' })
      .mockResolvedValueOnce({ ...order, stripeDeferred: true, state: 'Accepted' });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));
    fireEvent.click(await screen.findByText('Confirm with Stripe'));
    expect(await screen.findByText(/Acme.*Booked/i)).toBeVisible();
    expect(ApiClient.post).toHaveBeenCalledTimes(2);
  });

  it('never mounts Stripe with a live publishable key in the sandbox', async () => {
    vi.mocked(ApiClient.post).mockResolvedValue({ ...checkout, publishableKey: 'pk_live_example' });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Authorize with test card' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify authorization');
    expect(screen.queryByTestId('payment')).not.toBeInTheDocument();
  });

  it('shows a legacy simulated order as read-only when the catalog is in Stripe sandbox mode', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue({ ...response, orders: [{ ...order, stripeSandbox: false }] });
    show();
    expect(await screen.findByText('Transfer')).toBeVisible();
    expect(screen.queryByRole('button', { name: /authorize/i })).not.toBeInTheDocument();
    expect(ApiClient.post).not.toHaveBeenCalled();
  });

  it('keeps simulated orders on their original endpoint and never mounts Stripe for them', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue({ environment: 'simulation', offers: [], orders: [{ ...order, stripeSandbox: false }] });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Authorize simulated payment' }));
    await waitFor(() => expect(ApiClient.post).toHaveBeenCalledWith(base + '/o1/authorize', { totalCents: 1100 }, { public: true }));
    expect(screen.queryByTestId('payment')).not.toBeInTheDocument();
  });
});
