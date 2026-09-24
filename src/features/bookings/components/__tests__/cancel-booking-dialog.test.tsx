import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { CancelBookingDialog } from '../cancel-booking-dialog';
import type { BookingCancellationQuote, CancelBookingResult } from '@/types';

vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getCancellationQuote: vi.fn(), cancel: vi.fn() },
}));

const BOOKING_ID = 'book-1';

const quote = (overrides: Partial<BookingCancellationQuote> = {}): BookingCancellationQuote => ({
  bookingId: BOOKING_ID,
  status: 'Confirmed',
  cancellable: true,
  currency: 'EUR',
  paidAmount: 400,
  refundedAmount: 0,
  pendingRefundAmount: 0,
  refundableAmount: 400,
  minimumRefundAmount: 0,
  rule: 'None',
  freeCancellationUntil: null,
  cancellationPolicyName: null,
  offlinePaidAmount: 0,
  hasUncollectedIntent: false,
  requiresRefundDecision: true,
  ...overrides,
});

const cancelled = (refunds: CancelBookingResult['refunds'], canceledIntents = 0): CancelBookingResult => ({
  bookingId: BOOKING_ID,
  status: 'Cancelled',
  refunds,
  canceledIntents,
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(CancelBookingDialog, { bookingId: BOOKING_ID, open: true, onOpenChange: vi.fn() }),
    ),
  );
}

describe('CancelBookingDialog (BK-02)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('confirm_FullRefundByDefault_SendsWholeRefundableAmount', async () => {
    vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
    vi.mocked(bookingsApi.cancel).mockResolvedValue(
      cancelled([{ id: 'r1', paymentId: 'p1', amount: 400, status: 'Succeeded', origin: 'BookingCancellation', createdAt: '2026-09-24T10:00:00Z' }]),
    );
    renderDialog();

    expect(await screen.findByText(/scegli tu quanto rimborsare, fino a 400,00\s€/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));

    await waitFor(() => expect(bookingsApi.cancel).toHaveBeenCalledWith(BOOKING_ID, { refundAmount: 400, reason: undefined }));
    expect(await screen.findByText('Prenotazione annullata.')).toBeInTheDocument();
    expect(screen.getByText(/Rimborso di 400,00\s€ confermato da Stripe/)).toBeInTheDocument();
  });

  it('confirm_PartialRefund_SendsChosenAmountAndShowsPendingRefund', async () => {
    vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
    vi.mocked(bookingsApi.cancel).mockResolvedValue(
      cancelled([{ id: 'r1', paymentId: 'p1', amount: 150, status: 'Pending', origin: 'BookingCancellation', createdAt: '2026-09-24T10:00:00Z' }]),
    );
    renderDialog();

    fireEvent.click(await screen.findByLabelText('Rimborso parziale'));
    fireEvent.change(screen.getByLabelText('Importo da rimborsare'), { target: { value: '150,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));

    await waitFor(() => expect(bookingsApi.cancel).toHaveBeenCalledWith(BOOKING_ID, { refundAmount: 150.5, reason: undefined }));
    expect(await screen.findByText(/Stripe non l'ha ancora confermato/)).toBeInTheDocument();
    expect(screen.queryByText(/confermato da Stripe/)).not.toBeInTheDocument();
  });

  it('confirm_PartialBelowPolicyMinimum_BlocksWithoutCallingApi', async () => {
    vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(
      quote({ rule: 'PropertyCancellationPolicy', cancellationPolicyName: 'Moderata', minimumRefundAmount: 200 }),
    );
    renderDialog();

    expect(await screen.findByText(/Condizioni di cancellazione «Moderata»: rimborso minimo 200,00\s€/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Rimborso parziale'));
    fireEvent.change(screen.getByLabelText('Importo da rimborsare'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));

    expect(await screen.findByText(/L'importo deve essere tra 200,00\s€ e 400,00\s€/)).toBeInTheDocument();
    expect(bookingsApi.cancel).not.toHaveBeenCalled();
  });

  it('render_FreeCancellationDeadline_OffersOnlyFullRefund', async () => {
    vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(
      quote({ rule: 'FreeCancellationDeadline', freeCancellationUntil: '2026-10-13T00:00:00Z', minimumRefundAmount: 400 }),
    );
    renderDialog();

    expect(await screen.findByText(/cancellazione gratuita fino al 13 ottobre 2026/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Rimborso parziale')).not.toBeInTheDocument();
  });

  it('confirm_UnpaidBookingWithIntent_CancelsWithoutRefundDecision', async () => {
    vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(
      quote({ paidAmount: 0, refundableAmount: 0, requiresRefundDecision: false, hasUncollectedIntent: true }),
    );
    vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([], 1));
    renderDialog();

    expect(await screen.findByText(/verrà annullato su Stripe/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));

    await waitFor(() => expect(bookingsApi.cancel).toHaveBeenCalledWith(BOOKING_ID, { refundAmount: undefined, reason: undefined }));
    expect(await screen.findByText('Il pagamento non completato è stato annullato su Stripe.')).toBeInTheDocument();
  });

  it('render_QuoteFails_ShowsErrorNotTheForm', async () => {
    vi.mocked(bookingsApi.getCancellationQuote).mockRejectedValue(new Error('boom'));
    renderDialog();

    expect(await screen.findByText('Impossibile caricare i pagamenti della prenotazione.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annulla prenotazione' })).not.toBeInTheDocument();
  });

  it('render_NotCancellable_ExplainsWhy', async () => {
    vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote({ status: 'CheckedOut', cancellable: false }));
    renderDialog();

    expect(await screen.findByText(/non si può annullare/)).toBeInTheDocument();
  });
});
