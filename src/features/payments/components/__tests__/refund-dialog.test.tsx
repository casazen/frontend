import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { paymentsApi } from '@/api/payments.api';
import { RefundDialog } from '../refund-dialog';
import type { Payment, PaymentRefund, PaymentRefundsResponse } from '@/types';

vi.mock('@/api/payments.api', () => ({
  paymentsApi: { refund: vi.fn(), getRefunds: vi.fn() },
}));

const payment: Payment = {
  id: 'pay-1',
  bookingId: 'book-1',
  amount: 300,
  currency: 'EUR',
  status: 'Completed',
  method: 'CreditCard',
  stripePaymentIntentId: 'pi_1',
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
};

const summary = (overrides: Partial<PaymentRefundsResponse> = {}): PaymentRefundsResponse => ({
  paymentId: payment.id,
  paidAmount: 300,
  refundedAmount: 0,
  pendingRefundAmount: 0,
  refundableAmount: 300,
  refundableOnline: true,
  refunds: [],
  ...overrides,
});

const refund = (status: PaymentRefund['status'], failureReason: string | null = null): PaymentRefund => ({
  id: 'ref-1',
  paymentId: payment.id,
  amount: 100,
  status,
  origin: 'Host',
  failureReason,
  createdAt: '2026-09-24T10:00:00Z',
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(RefundDialog, { payment, open: true, onOpenChange: vi.fn() })),
  );
}

async function submitAmount(amount: string) {
  fireEvent.change(await screen.findByLabelText('Importo da rimborsare'), { target: { value: amount } });
  fireEvent.click(screen.getByRole('button', { name: 'Rimborsa su Stripe' }));
}

describe('RefundDialog (BK-02)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(paymentsApi.getRefunds).mockResolvedValue(summary());
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('submit_StripeConfirms_ShowsConfirmedRefund', async () => {
    vi.mocked(paymentsApi.refund).mockResolvedValue(refund('Succeeded'));
    renderDialog();

    await submitAmount('100');

    expect(await screen.findByText(/Rimborso di 100,00\s€ confermato da Stripe/)).toBeInTheDocument();
    expect(paymentsApi.refund).toHaveBeenCalledWith('pay-1', { amount: 100, reason: undefined });
  });

  it('submit_StripePending_ShowsWaitingAndNeverConfirmed', async () => {
    vi.mocked(paymentsApi.refund).mockResolvedValue(refund('Pending'));
    renderDialog();

    await submitAmount('100');

    expect(await screen.findByText(/Stripe non l'ha ancora confermato/)).toBeInTheDocument();
    expect(screen.queryByText(/confermato da Stripe/)).not.toBeInTheDocument();
  });

  it('submit_StripeFailed_ShowsFailureAndReason', async () => {
    vi.mocked(paymentsApi.refund).mockResolvedValue(refund('Failed', 'charge_disputed'));
    renderDialog();

    await submitAmount('100');

    expect(await screen.findByText(/Stripe non ha eseguito il rimborso di 100,00\s€/)).toBeInTheDocument();
    expect(screen.getByText('Motivo indicato da Stripe: charge_disputed')).toBeInTheDocument();
  });

  it('submit_ApiRejects_ShowsProblemMessage', async () => {
    const response = {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { code: 'refund_amount_exceeds_refundable', detail: "L'importo supera quanto si può ancora rimborsare (20,00 €)." },
    };
    vi.mocked(paymentsApi.refund).mockRejectedValue(
      new AxiosError('Request failed', 'ERR_BAD_REQUEST', response.config, null, response),
    );
    renderDialog();

    await submitAmount('100');

    expect(await screen.findByRole('alert')).toHaveTextContent("L'importo supera quanto si può ancora rimborsare (20,00 €).");
  });

  it('submit_AmountAboveRefundable_BlocksWithoutCallingApi', async () => {
    vi.mocked(paymentsApi.getRefunds).mockResolvedValue(summary({ pendingRefundAmount: 200, refundableAmount: 100 }));
    renderDialog();

    await submitAmount('150');

    expect(await screen.findByText(/L'importo supera quanto si può ancora rimborsare/)).toBeInTheDocument();
    expect(paymentsApi.refund).not.toHaveBeenCalled();
    expect(screen.getByText('Rimborsi in attesa di Stripe')).toBeInTheDocument();
  });

  it('submit_EmptyAmount_RefundsEverythingRefundable', async () => {
    vi.mocked(paymentsApi.refund).mockResolvedValue(refund('Succeeded'));
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'Rimborsa su Stripe' }));

    await waitFor(() => expect(paymentsApi.refund).toHaveBeenCalledWith('pay-1', { amount: undefined, reason: undefined }));
  });

  it('render_PaymentOutsideStripe_ExplainsRefundHappensOutsideCasaZen', async () => {
    vi.mocked(paymentsApi.getRefunds).mockResolvedValue(summary({ refundableOnline: false, refundableAmount: 0 }));
    renderDialog();

    expect(await screen.findByText(/non è passato da Stripe/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rimborsa su Stripe' })).not.toBeInTheDocument();
  });

  it('render_AmountsFailToLoad_ShowsErrorNotAnEmptyForm', async () => {
    vi.mocked(paymentsApi.getRefunds).mockRejectedValue(new Error('boom'));
    renderDialog();

    expect(await screen.findByText('Impossibile caricare gli importi rimborsabili.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rimborsa su Stripe' })).not.toBeInTheDocument();
  });
});
