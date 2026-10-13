import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { publicRentApi } from '@/api/rent.api';
import { httpError } from '@/features/leases/__tests__/lease-test-utils';
import { RentPaymentPage } from '../rent-payment-page';
import type { PublicRentPayment } from '@/types';

// LT-06: the tenant pays an installment from the link of the email. "Paid" only from the backend (Stripe webhook).
vi.mock('@/api/rent.api', () => ({
  publicRentApi: { getPayment: vi.fn(), createPaymentSession: vi.fn() },
}));

const stripe = vi.hoisted(() => ({ confirmPayment: vi.fn() }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: unknown }) => children,
  PaymentElement: () => null,
  useStripe: () => stripe,
  useElements: () => ({}),
}));

const getPayment = vi.mocked(publicRentApi.getPayment);
const createSession = vi.mocked(publicRentApi.createPaymentSession);

const INSTALLMENT_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const TOKEN = 'tok_rent';

function payment(overrides: Partial<PublicRentPayment> = {}): PublicRentPayment {
  return {
    installmentId: INSTALLMENT_ID,
    propertyName: 'Casa Trastevere',
    landlordName: 'Rossi Immobili',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    dueDate: '2026-10-05',
    amount: 950,
    currency: 'EUR',
    state: 'Payable',
    lastPaymentFailed: false,
    ...overrides,
  };
}

function renderPage(path = `/rent/pay/${INSTALLMENT_ID}?token=${TOKEN}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/rent/pay/:installmentId" element={<RentPaymentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RentPaymentPage (LT-06)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('render_Payable_ShowsTheInstallmentAndStartsThePaymentOnTheLandlordAccount', async () => {
    getPayment.mockResolvedValue(payment());
    createSession.mockResolvedValue({
      installmentId: INSTALLMENT_ID,
      clientSecret: 'pi_1_secret',
      publishableKey: 'pk_test',
      stripeAccountId: 'acct_landlord',
    });

    renderPage();

    const summary = await screen.findByTestId('rent-payment-summary');
    expect(summary).toHaveTextContent('Casa Trastevere');
    expect(summary).toHaveTextContent('Rossi Immobili');
    expect(summary).toHaveTextContent('950,00');
    expect(getPayment).toHaveBeenCalledWith(INSTALLMENT_ID, TOKEN);
    fireEvent.click(screen.getByTestId('rent-payment-start'));

    await waitFor(() => expect(createSession).toHaveBeenCalledWith(INSTALLMENT_ID, TOKEN));
    expect(await screen.findByTestId('checkout-payment-step')).toBeInTheDocument();
  });

  it('confirm_StripeSucceeded_ShowsWaitingForConfirmationNotPaid', async () => {
    getPayment.mockResolvedValue(payment());
    createSession.mockResolvedValue({
      installmentId: INSTALLMENT_ID,
      clientSecret: 'pi_1_secret',
      publishableKey: 'pk_test',
      stripeAccountId: 'acct_landlord',
    });
    stripe.confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } });

    renderPage();
    fireEvent.click(await screen.findByTestId('rent-payment-start'));
    await screen.findByTestId('checkout-payment-step');
    fireEvent.click(screen.getByRole('button', { name: 'Paga ora' }));

    expect(await screen.findByTestId('rent-payment-processing')).toHaveTextContent('conferma di Stripe');
    expect(screen.queryByTestId('rent-payment-paid')).not.toBeInTheDocument();
  });

  it('render_PaidByTheBackend_ShowsPaidWithoutPaymentButton', async () => {
    getPayment.mockResolvedValue(payment({ state: 'Paid' }));

    renderPage();

    expect(await screen.findByTestId('rent-payment-paid')).toBeInTheDocument();
    expect(screen.queryByTestId('rent-payment-start')).not.toBeInTheDocument();
  });

  it('render_LastPaymentFailed_OffersARetry', async () => {
    getPayment.mockResolvedValue(payment({ state: 'Payable', lastPaymentFailed: true }));

    renderPage();

    expect(await screen.findByTestId('rent-payment-failed')).toHaveTextContent('non è andato a buon fine');
    expect(screen.getByTestId('rent-payment-start')).toBeEnabled();
  });

  it('render_WrongOrReplacedLink_ShowsInvalidLink', async () => {
    getPayment.mockRejectedValue(httpError(404, { code: 'rent_payment_link_invalid' }));

    renderPage();

    expect(await screen.findByTestId('rent-payment-invalid-link')).toBeInTheDocument();
  });

  it('render_NoToken_ShowsInvalidLinkWithoutCallingTheApi', async () => {
    renderPage(`/rent/pay/${INSTALLMENT_ID}`);

    expect(await screen.findByTestId('rent-payment-invalid-link')).toBeInTheDocument();
    expect(getPayment).not.toHaveBeenCalled();
  });

  it('render_ServerError_ShowsAnErrorWithRetryNotInvalidLink', async () => {
    getPayment.mockRejectedValue(httpError(500));

    renderPage();

    expect(await screen.findByTestId('rent-payment-error')).toBeInTheDocument();
    expect(screen.queryByTestId('rent-payment-invalid-link')).not.toBeInTheDocument();
  });

  it('startPayment_InstallmentPaidMeanwhile_ShowsTheServerReason', async () => {
    getPayment.mockResolvedValue(payment());
    createSession.mockRejectedValue(httpError(409, { code: 'rent_installment_not_payable' }));

    renderPage();
    fireEvent.click(await screen.findByTestId('rent-payment-start'));

    expect(await screen.findByTestId('rent-payment-session-error')).toHaveTextContent('già pagata');
  });
});
