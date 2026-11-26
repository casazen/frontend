import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { GuestPortalPayments } from '../guest-portal-payments';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/features/public-booking/components/stripe-intent-payment', () => ({
  StripeIntentPayment: ({ onSubmitted }: { onSubmitted: (status: 'succeeded') => void }) => (
    <button type="button" onClick={() => onSubmitted('succeeded')}>Confirm card payment</button>
  ),
}));

const path = '/public/guest-portal/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const labels = {
  balance: 'Booking balance',
  total: 'Stay total',
  paid: 'Already paid',
  tax: 'Tourist tax',
  payNow: 'Pay now',
  loading: 'Loading',
  failed: 'Payment could not be completed',
  settled: 'Nothing left to pay.',
  deferred: 'Scheduled for the deadline',
  processing: 'Payment is being verified.',
  unavailable: 'Online payment unavailable',
  documents: 'Documents and receipts',
  payTax: 'Pay tourist tax',
  services: 'Service payments',
  refresh: 'Refresh status',
};
const booking = { amount: 150, total: 250, currency: 'EUR', canPay: true, deferred: false, processing: false, external: false };

function Location() {
  return <output>{useLocation().search}</output>;
}

function renderPayments(search = '?page=payments') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/s/test${search}`]}>
        <GuestPortalPayments path={path} language="en" direct checkIn="/checkin/stay_test" documents="?page=documents" labels={labels} />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('guest portal balance', () => {
  it('opens a payment for exactly the stay in the link and waits for the server to confirm', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue(booking);
    vi.mocked(ApiClient.post).mockResolvedValue({ amount: 150, clientSecret: 'secret', stripeAccountId: 'acct_test', publishableKey: 'pk_test' });
    renderPayments();

    fireEvent.click(await screen.findByRole('button', { name: 'Pay now' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm card payment' }));
    expect(ApiClient.post).toHaveBeenCalledWith(`${path}/payments/payment-session`, undefined, { public: true });
    expect(await screen.findByText(labels.processing)).toBeInTheDocument();
    expect(screen.queryByText(labels.settled)).not.toBeInTheDocument();

    vi.mocked(ApiClient.get).mockResolvedValue({ ...booking, amount: 0, canPay: false });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh status' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByText(labels.settled)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: labels.documents })).toHaveAttribute('href', '/s/test?page=documents');
  });

  it('clears Stripe return parameters from the address and preserves the portal tab', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue(booking);
    renderPayments('?page=payments&lang=en&payment_intent=pi_test&payment_intent_client_secret=secret&redirect_status=succeeded');

    expect(await screen.findByText(labels.processing)).toBeInTheDocument();
    expect(screen.getByText('?page=payments&lang=en')).toBeInTheDocument();
  });
});
