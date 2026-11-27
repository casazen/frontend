import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { CancelBookingDialog } from '../cancel-booking-dialog';
import { SYNC_PENDING_LIMIT_MS, SYNC_WATCH_MS } from '../../lib/octorate-sync';
import type { Booking, BookingCancellationQuote, BookingChangeOptions, BookingOctorateSync, CancelBookingResult } from '@/types';

vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getCancellationQuote: vi.fn(), cancel: vi.fn(), getById: vi.fn(), retryOctorateSync: vi.fn() },
}));

const BOOKING_ID = 'book-1';
const WAIT = { timeout: 5000 };

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

const sync = (overrides: Partial<BookingOctorateSync> = {}): BookingOctorateSync => ({
  state: 'Synced',
  lastOperation: 'Update',
  lastSyncedAt: '2027-09-24T08:01:00Z',
  errorCode: null,
  canRetry: false,
  ...overrides,
});

/** A booking the way the detail answers it: of the booking site, which CasaZen holds the money of, unless a test makes it one of a channel. */
const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: BOOKING_ID,
  propertyId: 'property-1',
  userId: 'auth0|host',
  checkInDate: '2027-10-01T00:00:00Z',
  checkOutDate: '2027-10-05T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 400,
  currency: 'EUR',
  status: 'Confirmed',
  source: 'Direct',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '', country: 'IT' },
  createdAt: '2027-09-24T08:00:00Z',
  updatedAt: '2027-09-24T08:00:00Z',
  changeOptions: { canEdit: true, canCancel: true, channel: null },
  ...overrides,
});

/** The change options of a booking that came from a channel (Airbnb), open or closed for the cancellation. */
const channelOptions = (overrides: Partial<BookingChangeOptions> = {}): BookingChangeOptions => ({
  canEdit: false,
  canCancel: true,
  reasonCode: 'booking_update_source_locked',
  guidanceKey: null,
  channel: 'Airbnb',
  cancelReasonCode: null,
  cancelGuidanceKey: null,
  ...overrides,
});

const closedForTheCancellation = channelOptions({
  canCancel: false,
  reasonCode: 'ota_booking_change_not_allowed',
  guidanceKey: 'OtaChannelModifyGuidanceAirbnb',
  cancelReasonCode: 'ota_booking_cancel_not_allowed',
  cancelGuidanceKey: 'OtaChannelCancelGuidanceAirbnb',
});

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function renderDialog(onOpenChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(CancelBookingDialog, { bookingId: BOOKING_ID, open: true, onOpenChange }),
    ),
  );
}

describe('CancelBookingDialog (BK-02)', { timeout: 20000 }, () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
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

  it('confirm_BookingThatCannotBeRead_StillOffersTheCancellationWithTheMoney', async () => {
    // The server decides the path anyway: a booking that could not be read is taken for one CasaZen holds the money of.
    vi.mocked(bookingsApi.getById).mockRejectedValue(problem(500, { status: 500 }));
    vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
    renderDialog();

    expect(await screen.findByRole('button', { name: 'Annulla prenotazione' }, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('cancel-sync-note')).not.toBeInTheDocument();
  });

  it('confirm_DialogInsideAForm_DoesNotSubmitTheFormAround', async () => {
    vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
    vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([]));
    const submitted = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      createElement(
        QueryClientProvider,
        { client },
        createElement('form', { onSubmit: submitted }, createElement(CancelBookingDialog, { bookingId: BOOKING_ID, open: true, onOpenChange: vi.fn() })),
      ),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Annulla prenotazione' }, WAIT));

    await waitFor(() => expect(bookingsApi.cancel).toHaveBeenCalled(), WAIT);
    // The portal passes the event of the dialog's form on to the form that holds it in the tree: the confirmation must stop it.
    expect(submitted).not.toHaveBeenCalled();
  });

  it('render_ClosedAndOpenedAgain_StartsFromScratch', async () => {
    vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
    function Host() {
      const [open, setOpen] = useState(true);
      return createElement(
        'div',
        null,
        createElement('button', { type: 'button', onClick: () => setOpen(!open) }, 'toggle'),
        createElement(CancelBookingDialog, { bookingId: BOOKING_ID, open, onOpenChange: setOpen }),
      );
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(createElement(QueryClientProvider, { client }, createElement(Host)));

    fireEvent.change(await screen.findByLabelText('Motivo (visibile solo a te)', undefined, WAIT), { target: { value: 'Caldaia guasta' } });
    fireEvent.click(screen.getByText('toggle'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WAIT);
    fireEvent.click(screen.getByText('toggle'));

    expect(await screen.findByLabelText('Motivo (visibile solo a te)', undefined, WAIT)).toHaveValue('');
  });

  describe('the channel manager of a booking CasaZen holds (AC-NF76-1)', () => {
    const mirrored = (row?: Partial<BookingOctorateSync>) => booking({ octorateSync: sync(row) });
    const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Annulla prenotazione' }));

    it('render_MirroredBooking_SaysBeforeConfirmingThatTheChannelManagerIsUpdatedToo', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(mirrored());
      vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
      renderDialog();

      expect(await screen.findByTestId('cancel-sync-note', undefined, WAIT)).toHaveTextContent('Anche il tuo channel manager viene aggiornato.');
    });

    it('render_BookingNotMirrored_SaysNothingOfTheChannelManager', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: null }));
      vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
      renderDialog();

      expect(await screen.findByRole('button', { name: 'Annulla prenotazione' }, WAIT)).toBeInTheDocument();
      expect(screen.queryByTestId('cancel-sync-note')).not.toBeInTheDocument();
    });

    it('confirm_Refunds_AreShownAtOnceWhateverTheChannelManagerAnswers', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValueOnce(mirrored());
      vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
      vi.mocked(bookingsApi.cancel).mockResolvedValue(
        cancelled([{ id: 'r1', paymentId: 'p1', amount: 400, status: 'Succeeded', origin: 'BookingCancellation', createdAt: '2026-09-24T10:00:00Z' }]),
      );
      renderDialog();

      await screen.findByTestId('cancel-sync-note', undefined, WAIT);
      // The booking is read again after the cancellation, and the channel manager has not answered: that read never comes back.
      vi.mocked(bookingsApi.getById).mockReturnValue(new Promise(() => undefined));
      confirm();

      expect(await screen.findByText(/Rimborso di 400,00\s€ confermato da Stripe/, undefined, WAIT)).toBeInTheDocument();
      expect(screen.getByText('Prenotazione annullata.')).toBeInTheDocument();
    });

    it.each([
      ['Pending', sync({ state: 'Pending', lastOperation: 'Cancel' }), /Sto annullando la prenotazione nel tuo channel manager/],
      ['Synced', sync({ state: 'Synced', lastOperation: 'Cancel' }), /Annullata anche nel tuo channel manager/],
      ['an older operation still on the row', sync({ state: 'Synced', lastOperation: 'Update' }), /non ha ancora confermato l'annullamento/],
      ['another operation under way', sync({ state: 'Pending', lastOperation: 'Update' }), /non ha ancora confermato l'annullamento/],
      ['not allowed by the channel', sync({ state: 'NotAllowedByChannel', lastOperation: 'Cancel' }), /al channel manager non è stato inviato nulla/],
    ])('confirm_ChannelManagerLine_%s', async (_name, row, text) => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(mirrored());
      vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
      vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([]));
      renderDialog();

      await screen.findByTestId('cancel-sync-note', undefined, WAIT);
      // What the server holds once the cancellation is made.
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Cancelled', octorateSync: row }));
      confirm();

      await screen.findByText('Prenotazione annullata.', undefined, WAIT);
      await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(text), WAIT);
    });

    it('confirm_ChannelManagerAnswersFailed_ShowsTheReasonAndRetryNowThatAsksTheServerAgain', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(mirrored());
      vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
      vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([]));
      vi.mocked(bookingsApi.retryOctorateSync).mockResolvedValue({ bookingId: BOOKING_ID, state: 'Pending' });
      renderDialog();

      await screen.findByTestId('cancel-sync-note', undefined, WAIT);
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({ status: 'Cancelled', octorateSync: sync({ state: 'Failed', lastOperation: 'Cancel', errorCode: 'octorate_unavailable', canRetry: true }) }),
      );
      confirm();

      const failed = await screen.findByTestId('booking-cancel-sync-failed', undefined, WAIT);
      expect(failed).toHaveAttribute('role', 'alert');
      expect(failed).toHaveTextContent('Annullata in CasaZen, non ancora nel tuo channel manager');
      expect(failed).toHaveTextContent('Il channel manager non ha risposto.');
      fireEvent.click(within(failed).getByRole('button', { name: 'Riprova ora' }));

      await waitFor(() => expect(bookingsApi.retryOctorateSync).toHaveBeenCalledWith(BOOKING_ID, undefined), WAIT);
    });

    it('confirm_RetryNowInFlight_DisablesTheButton', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(mirrored());
      vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
      vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([]));
      let release: (value: { bookingId: string; state: 'Pending' }) => void = () => undefined;
      vi.mocked(bookingsApi.retryOctorateSync).mockReturnValue(new Promise((resolve) => (release = resolve)));
      renderDialog();

      await screen.findByTestId('cancel-sync-note', undefined, WAIT);
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({ status: 'Cancelled', octorateSync: sync({ state: 'Failed', lastOperation: 'Cancel', errorCode: 'octorate_rejected', canRetry: true }) }),
      );
      confirm();
      fireEvent.click(await screen.findByRole('button', { name: 'Riprova ora' }, WAIT));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Riprova ora' })).toBeDisabled(), WAIT);
      release({ bookingId: BOOKING_ID, state: 'Pending' });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Riprova ora' })).toBeEnabled(), WAIT);
    });

    it('confirm_ChannelManagerRefusedBecauseTheReservationChanged_SaysTheCancellationInCasazenStands', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(mirrored());
      vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
      vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([]));
      renderDialog();

      await screen.findByTestId('cancel-sync-note', undefined, WAIT);
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({ status: 'Cancelled', octorateSync: sync({ state: 'Conflict', lastOperation: 'Cancel', errorCode: 'octorate_reservation_changed', canRetry: true }) }),
      );
      confirm();

      const failed = await screen.findByTestId('booking-cancel-sync-failed', undefined, WAIT);
      expect(failed).toHaveAttribute('data-state', 'Conflict');
      expect(failed).toHaveTextContent("L'annullamento in CasaZen resta valido");
    });

    it('confirm_CancellationStillBeingSentTenMinutesAfterTheOpening_StopsAskingAndSaysThereIsNoAnswerYet', async () => {
      // The push started and stopped halfway: the row says Pending for good, and the host cannot ask again from there.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.mocked(bookingsApi.getById).mockResolvedValue(mirrored());
        vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
        vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([]));
        renderDialog();

        await screen.findByTestId('cancel-sync-note', undefined, WAIT);
        vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Cancelled', octorateSync: sync({ state: 'Pending', lastOperation: 'Cancel' }) }));
        confirm();
        expect(await screen.findByTestId('booking-cancel-sync-pending', undefined, WAIT)).toBeInTheDocument();

        await vi.advanceTimersByTimeAsync(SYNC_PENDING_LIMIT_MS + SYNC_WATCH_MS);

        const waiting = await screen.findByTestId('booking-cancel-sync-waiting', undefined, WAIT);
        expect(waiting).toHaveTextContent('non ha ancora risposto');
        expect(screen.queryByTestId('booking-cancel-sync-pending')).not.toBeInTheDocument();
        const settled = vi.mocked(bookingsApi.getById).mock.calls.length;
        await vi.advanceTimersByTimeAsync(2 * SYNC_WATCH_MS);
        expect(vi.mocked(bookingsApi.getById).mock.calls.length).toBe(settled);

        // «Controlla di nuovo» reads the booking once more, and the answer that has come is shown.
        vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Cancelled', octorateSync: sync({ state: 'Synced', lastOperation: 'Cancel' }) }));
        fireEvent.click(within(waiting).getByRole('button', { name: 'Controlla di nuovo' }));

        expect(await screen.findByTestId('booking-cancel-sync-synced', undefined, WAIT)).toBeInTheDocument();
        expect(screen.queryByTestId('booking-cancel-sync-waiting')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('confirm_BookingNotMirrored_ShowsNoChannelManagerLineAfterTheCancellation', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: null }));
      vi.mocked(bookingsApi.getCancellationQuote).mockResolvedValue(quote());
      vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([]));
      renderDialog();

      fireEvent.click(await screen.findByRole('button', { name: 'Annulla prenotazione' }, WAIT));

      await screen.findByText('Prenotazione annullata.', undefined, WAIT);
      expect(screen.queryByText(/channel manager/)).not.toBeInTheDocument();
    });
  });

  describe('a booking of a channel (AC-NF76-3)', () => {
    const channelBooking = (options: BookingChangeOptions) => booking({ source: 'Airbnb', otaSource: 'Airbnb', changeOptions: options });

    it('render_ChannelOpenForTheCancellation_AsksToCancelThroughTheChannelManagerAndReadsNoPayments', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(channelBooking(channelOptions()));
      renderDialog();

      expect(await screen.findByRole('heading', { name: 'Chiedi al tuo channel manager di annullare questa prenotazione' }, WAIT)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: "Chiedi l'annullamento" })).toBeInTheDocument();
      // The channel collects its own bookings: there is no refund to choose and no quote of the money to read (which would need `payment.read`).
      expect(screen.queryByText(/Rimborso/)).not.toBeInTheDocument();
      expect(bookingsApi.getCancellationQuote).not.toHaveBeenCalled();
    });

    it('confirm_ChannelConfirms_CancelsWithTheNoteOnlyAndSaysItIsCancelled', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(channelBooking(channelOptions()));
      vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([]));
      renderDialog();

      fireEvent.change(await screen.findByLabelText('Motivo (visibile solo a te)', undefined, WAIT), { target: { value: 'Ospite irreperibile' } });
      // After the cancellation the booking is read again: it is cancelled, and the dialog must still say what happened.
      vi.mocked(bookingsApi.getById).mockResolvedValue(channelBooking(channelOptions({ canCancel: false, cancelReasonCode: 'booking_already_cancelled' })));
      fireEvent.click(screen.getByRole('button', { name: "Chiedi l'annullamento" }));

      await waitFor(() => expect(bookingsApi.cancel).toHaveBeenCalledWith(BOOKING_ID, { reason: 'Ospite irreperibile' }));
      const done = await screen.findByTestId('cancel-channel-done', undefined, WAIT);
      expect(done).toHaveTextContent('Prenotazione annullata.');
      expect(screen.getByText("Il tuo channel manager ha confermato l'annullamento.")).toBeInTheDocument();
    });

    it.each([
      ['the channel manager refuses', 422, 'octorate_cancel_failed'],
      ['the channel is closed', 422, 'ota_booking_cancel_not_allowed'],
      ['the channel manager does not answer', 503, 'octorate_unavailable'],
    ])('confirm_%s_LeavesTheBookingUnchangedAndGivesTheSentenceOfTheChannel', async (_name, status, code) => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(channelBooking(channelOptions()));
      vi.mocked(bookingsApi.cancel).mockRejectedValue(problem(status, { status, code, channel: 'Airbnb', guidanceKey: 'OtaChannelCancelGuidanceAirbnb' }));
      renderDialog();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi l'annullamento" }, WAIT));

      const error = await screen.findByTestId('cancel-channel-error', undefined, WAIT);
      expect(error).toHaveAttribute('data-code', code);
      expect(error).toHaveTextContent("Il canale non l'ha annullata: la prenotazione è rimasta com'era.");
      expect(error).toHaveTextContent("Per cancellare questa prenotazione di Airbnb chiedi all'ospite di annullarla su Airbnb.");
      // Never a success that did not happen.
      expect(screen.queryByText('Prenotazione annullata.')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-channel-done')).not.toBeInTheDocument();
      // The host can ask again.
      expect(screen.getByRole('button', { name: "Chiedi l'annullamento" })).toBeEnabled();
    });

    it('confirm_AnotherFailureOfTheChannelPath_SaysWhatItSaysWithNoSentenceOfTheChannel', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(channelBooking(channelOptions()));
      vi.mocked(bookingsApi.cancel).mockRejectedValue(problem(409, { status: 409, code: 'booking_already_cancelled' }));
      renderDialog();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi l'annullamento" }, WAIT));

      const error = await screen.findByTestId('cancel-channel-error', undefined, WAIT);
      expect(error).not.toHaveTextContent('Il canale non l\'ha annullata');
      expect(screen.queryByTestId('ota-change-guidance')).not.toBeInTheDocument();
    });

    it('render_ChannelClosedForTheCancellation_ShowsOnlyTheSentenceAndNoAction', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(channelBooking(closedForTheCancellation));
      renderDialog();

      expect(await screen.findByTestId('ota-change-guidance', undefined, WAIT)).toHaveTextContent(
        "Per cancellare questa prenotazione di Airbnb chiedi all'ospite di annullarla su Airbnb.",
      );
      expect(screen.queryByRole('button', { name: "Chiedi l'annullamento" })).not.toBeInTheDocument();
      expect(bookingsApi.cancel).not.toHaveBeenCalled();
      expect(bookingsApi.getCancellationQuote).not.toHaveBeenCalled();
    });

    it('render_ChannelBookingAlreadyCancelled_SaysSoAndNotHowToAskTheChannel', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        channelBooking(channelOptions({ canCancel: false, cancelReasonCode: 'booking_already_cancelled' })),
      );
      renderDialog();

      expect(await screen.findByText(/non si può annullare/, undefined, WAIT)).toBeInTheDocument();
      expect(screen.queryByTestId('ota-change-guidance')).not.toBeInTheDocument();
    });

    it('confirm_ChannelCancellationInsideAForm_DoesNotSubmitTheFormAround', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(channelBooking(channelOptions()));
      vi.mocked(bookingsApi.cancel).mockResolvedValue(cancelled([]));
      const submitted = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      render(
        createElement(
          QueryClientProvider,
          { client },
          createElement('form', { onSubmit: submitted }, createElement(CancelBookingDialog, { bookingId: BOOKING_ID, open: true, onOpenChange: vi.fn() })),
        ),
      );

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi l'annullamento" }, WAIT));

      await waitFor(() => expect(bookingsApi.cancel).toHaveBeenCalled(), WAIT);
      expect(submitted).not.toHaveBeenCalled();
    });

    it('render_English_UsesTheEnglishWords', async () => {
      await i18n.changeLanguage('en');
      vi.mocked(bookingsApi.getById).mockResolvedValue(channelBooking(channelOptions()));
      renderDialog();

      expect(await screen.findByRole('heading', { name: 'Ask your channel manager to cancel this booking' }, WAIT)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ask to cancel' })).toBeInTheDocument();
    });
  });
});
