import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { loadStripe } from '@stripe/stripe-js';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { FinancialConnectionsTransfer, StripeRentTransferDialog } from '../financial-connections-transfer';
import { resetStripeTransferAttempts } from '../transfer-attempt';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn() }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);
const collect = vi.fn();

const linked = { linked: true, accountId: 'fca_1', institutionName: 'Banca Test', last4: '6789', displayName: null };
const unlinked = { linked: false, accountId: null, institutionName: null, last4: null, displayName: null };

function renderOrg() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <FinancialConnectionsTransfer
          mode="org"
          leaseId="lease-1"
          dueId="due-1"
          amount={1050}
          currency="USD"
          reference="CZ-2026-11-ABC"
          publishableKey="pk_test"
        />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function transferCalls() {
  return post.mock.calls.filter((call) => String(call[0]).endsWith('/payments'));
}

function idempotencyKeyOf(call: unknown[]): string {
  const options = call[2] as { headers: { 'Idempotency-Key': string } };
  return options.headers['Idempotency-Key'];
}

describe('FinancialConnectionsTransfer', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(loadStripe).mockResolvedValue({ collectFinancialConnectionsAccounts: collect } as never);
    collect.mockResolvedValue({
      financialConnectionsSession: { id: 'fcsess_1', accounts: [{ id: 'fca_1' }] },
    });
    get.mockResolvedValue({ data: unlinked });
  });

  afterEach(() => {
    cleanup();
    resetStripeTransferAttempts();
    get.mockReset();
    post.mockReset();
    vi.clearAllMocks();
  });

  it('links with Stripe’s screen and starts the org debit without marking the due paid', async () => {
    post.mockImplementation((url: string) => {
      const path = String(url);
      if (path.endsWith('/sessions')) return Promise.resolve({ data: { sessionId: 'fcsess_1', clientSecret: 'fcsess_secret' } });
      if (path.endsWith('/payments')) {
        return Promise.resolve({
          data: {
            paymentId: 'pay-1',
            paymentIntentId: 'pi_1',
            clientSecret: null,
            stripeStatus: 'succeeded',
            paymentMethodType: 'us_bank_account',
            dueSettled: false,
          },
        });
      }
      return Promise.resolve({ data: linked });
    });

    renderOrg();

    expect(await screen.findByTestId('stripe-transfer-amount')).toHaveTextContent(/1\.?050,00/);
    expect(screen.getByTestId('stripe-transfer-reference')).toHaveTextContent('CZ-2026-11-ABC');
    expect(screen.queryByText('Accetta e continua')).not.toBeInTheDocument();
    expect(screen.queryByText('Pagata')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/orgs/me/bank-links', expect.anything());

    fireEvent.click(screen.getByTestId('stripe-link-account'));

    await waitFor(() => expect(collect).toHaveBeenCalledWith({ clientSecret: 'fcsess_secret' }));
    expect(loadStripe).toHaveBeenCalledWith('pk_test');
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/orgs/me/bank-links', { accountId: 'fca_1' }, undefined),
    );

    fireEvent.click(await screen.findByTestId('stripe-start-transfer'));

    await waitFor(() => expect(transferCalls()).toHaveLength(1));
    expect(transferCalls()[0][0]).toBe('/orgs/me/bank-links/payments');
    expect(transferCalls()[0][1]).toEqual({
      amountCents: 105000,
      currency: 'usd',
      leaseId: 'lease-1',
      installmentId: 'due-1',
    });
    expect(await screen.findByTestId('stripe-transfer-pending')).toHaveTextContent('non è segnata come pagata');
    expect(screen.queryByText('Pagata')).not.toBeInTheDocument();
  });

  it('a second click and a remounted dialog send one payment with one key', async () => {
    get.mockResolvedValue({ data: linked });
    let finish: (value: { data: unknown }) => void = () => {};
    post.mockImplementation(
      (url: string) =>
        new Promise((resolve) => {
          if (String(url).endsWith('/payments')) finish = resolve;
          else resolve({ data: {} });
        }),
    );

    const first = renderOrg();
    const start = await screen.findByTestId('stripe-start-transfer');
    fireEvent.click(start);
    fireEvent.click(start);
    await waitFor(() => expect(transferCalls()).toHaveLength(1));
    const key = idempotencyKeyOf(transferCalls()[0]);

    first.unmount();
    const duringFlight = renderOrg();
    fireEvent.click(await screen.findByTestId('stripe-start-transfer'));
    await waitFor(() => expect(transferCalls()).toHaveLength(1));
    duringFlight.unmount();

    finish({
      data: {
        paymentId: 'pay-1',
        paymentIntentId: 'pi_1',
        clientSecret: null,
        stripeStatus: 'processing',
        paymentMethodType: 'us_bank_account',
        dueSettled: false,
      },
    });
    renderOrg();
    expect(await screen.findByTestId('stripe-transfer-pending')).toBeInTheDocument();
    expect(transferCalls()).toHaveLength(1);
    expect(idempotencyKeyOf(transferCalls()[0])).toBe(key);
  });

  it('does not tell the landlord that the tenant declaration is on this screen', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={i18n}>
          <StripeRentTransferDialog
            open
            leaseId="lease-1"
            dueId="due-1"
            amount={1050}
            currency="USD"
            reference="CZ-2026-11-ABC"
            onOpenChange={() => {}}
          />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    const note = await screen.findByTestId('stripe-manual-stays');
    expect(note).toHaveTextContent("registrare l'incasso");
    expect(note).not.toHaveTextContent('Ho effettuato il bonifico');
  });
});
