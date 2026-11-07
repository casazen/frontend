import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { loadStripe } from '@stripe/stripe-js';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { FinancialConnectionsTransfer } from '../financial-connections-transfer';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn() }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);
const collect = vi.fn();

function renderTransfer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <FinancialConnectionsTransfer
          leaseId="lease-1"
          dueId="due-1"
          amount={1050}
          currency="EUR"
          reference="CZ-2026-11-ABC"
        />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('FinancialConnectionsTransfer', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(loadStripe).mockResolvedValue({ collectFinancialConnectionsAccounts: collect } as never);
    collect.mockResolvedValue({ financialConnectionsSession: { id: 'fcsess_1', accounts: [] } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens Stripe’s screen, starts the transfer, and does not mark the due paid', async () => {
    const account = { id: 'fca_1', institutionName: 'Banca Test', last4: '6789', displayName: null };
    let reads = 0;
    get.mockImplementation(() => {
      reads += 1;
      return Promise.resolve({ data: { accounts: reads === 1 ? [] : [account] } });
    });
    post.mockImplementation((url: string) => {
      if (String(url).endsWith('/session')) {
        return Promise.resolve({ data: { clientSecret: 'fcsess_secret', publishableKey: 'pk_test' } });
      }
      return Promise.resolve({ data: { id: 'tr_1', status: 'Paid' } });
    });

    renderTransfer();

    expect(await screen.findByTestId('stripe-transfer-amount')).toHaveTextContent(/1\.?050,00/);
    expect(screen.getByTestId('stripe-transfer-reference')).toHaveTextContent('CZ-2026-11-ABC');
    expect(screen.getByTestId('stripe-manual-stays')).toHaveTextContent('Ho effettuato il bonifico');
    expect(screen.queryByText('Accetta e continua')).not.toBeInTheDocument();
    expect(screen.queryByText('Pagata')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('stripe-link-account'));

    await waitFor(() => expect(collect).toHaveBeenCalledWith({ clientSecret: 'fcsess_secret' }));
    expect(loadStripe).toHaveBeenCalledWith('pk_test');
    expect(screen.queryByText('Accetta e continua')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByTestId('stripe-start-transfer'));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const transferCall = post.mock.calls.find((call) => String(call[0]).includes('stripe-transfer'));
    expect(transferCall?.[0]).toBe('/leases/lease-1/dues/due-1/stripe-transfer');
    expect(transferCall?.[1]).toEqual({
      financialConnectionsAccountId: 'fca_1',
      amount: 1050,
      reference: 'CZ-2026-11-ABC',
    });
    expect(transferCall?.[2]).toEqual({ headers: { 'Idempotency-Key': expect.any(String) } });
    expect(await screen.findByTestId('stripe-transfer-pending')).toHaveTextContent('non è segnata come pagata');
    expect(screen.queryByText('Pagata')).not.toBeInTheDocument();
  });
});
