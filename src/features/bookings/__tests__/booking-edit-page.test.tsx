import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { propertiesApi } from '@/api/properties.api';
import type { Booking, BookingChangeOptions, BookingEditQuote, BookingOctorateSync, Property, UpdatedBooking } from '@/types';
import type { DirectBookingQuote } from '@/types/direct-booking.types';
import { BookingEditPage } from '../booking-edit-page';
import { SYNC_PENDING_LIMIT_MS, SYNC_WATCH_MS } from '../lib/octorate-sync';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getById: vi.fn(), update: vi.fn(), quote: vi.fn(), editQuote: vi.fn(), retryOctorateSync: vi.fn() },
}));
vi.mock('@/api/properties.api', () => ({
  propertiesApi: { getAll: vi.fn() },
}));
// The permissions of the person at the keyboard: all of them unless a test takes one away.
const permissions = new Set<string>();
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_area: string, permission: string) => permissions.has(permission) }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const WAIT = { timeout: 5000 };
const BOOKING_ID = 'booking-1';

/** `changeOptions` as the API answers it: a booking of the host, or a confirmed one of the booking site, that has not started, can be changed. */
const optionsOf = ({ status, source }: Pick<Booking, 'status' | 'source'>): BookingChangeOptions => {
  const open = (source === 'Manual' || (source === 'Direct' && status === 'Confirmed')) && (status === 'Pending' || status === 'Confirmed');
  return { canEdit: open, canCancel: status !== 'Cancelled' && status !== 'CheckedOut', reasonCode: null, guidanceKey: null, channel: null };
};

const booking = (overrides: Partial<Booking> = {}): Booking => {
  const base: Booking = {
    id: BOOKING_ID,
    propertyId: 'property-1',
    userId: 'auth0|host',
    checkInDate: '2027-10-01T00:00:00Z',
    checkOutDate: '2027-10-05T00:00:00Z',
    numberOfGuests: 2,
    numberOfAdults: 2,
    numberOfChildren: 0,
    basePrice: 450,
    cleaningFee: 50,
    touristTax: 0,
    totalPrice: 450,
    currency: 'EUR',
    status: 'Confirmed',
    source: 'Manual',
    specialRequests: '',
    guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '+393331234567', country: 'IT' },
    createdAt: '2026-09-24T08:00:00Z',
    updatedAt: '2026-09-24T08:00:00Z',
    ...overrides,
  };
  const changeOptions = overrides.changeOptions ?? optionsOf(base);
  return { ...base, changeOptions, canEdit: overrides.canEdit ?? { allowed: changeOptions.canEdit, reason: changeOptions.canEdit ? null : 'SourceLocked' } };
};

const sync = (overrides: Partial<BookingOctorateSync> = {}): BookingOctorateSync => ({
  state: 'Synced',
  lastOperation: 'Update',
  lastSyncedAt: '2026-09-24T08:01:00Z',
  errorCode: null,
  canRetry: false,
  ...overrides,
});

const editQuote = (overrides: Partial<BookingEditQuote> = {}): BookingEditQuote => ({
  currency: 'EUR',
  previousTotal: 450,
  newTotal: 520,
  paidSoFar: 450,
  difference: 70,
  action: 'paymentLink',
  amount: 70,
  offlineRefundDue: 0,
  ...overrides,
});

const saved = (overrides: Partial<UpdatedBooking> = {}): UpdatedBooking => ({
  ...booking({ checkOutDate: '2027-10-06T00:00:00Z' }),
  settlement: { action: 'none', state: 'none', amount: 0, offlineRefundDue: 0, currency: 'EUR' },
  ...overrides,
});

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

const conflict = (data: unknown) => problem(409, data);

function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [`/app/short-rent/bookings/${BOOKING_ID}/edit`] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/bookings/:id/edit', element: createElement(BookingEditPage) }),
            createElement(Route, { path: '/app/short-rent/bookings/:id', element: createElement('p', null, 'booking-detail') }),
          )))),
  );
}

const changeCheckOut = async (value: string) =>
  fireEvent.change(await screen.findByLabelText(i18n.t('booking.form.checkOutDate'), undefined, WAIT), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('booking.form.update') }));

beforeEach(async () => {
  vi.clearAllMocks();
  permissions.clear();
  ['booking.write', 'payment.read', 'payment.write'].forEach((permission) => permissions.add(permission));
  await i18n.changeLanguage('it');
  vi.mocked(propertiesApi.getAll).mockResolvedValue([{ id: 'property-1', name: 'Casa Mare', city: 'Rimini' } as Property]);
  vi.mocked(bookingsApi.quote).mockResolvedValue({
    propertyId: 'property-1',
    checkInDate: '2027-10-01',
    checkOutDate: '2027-10-06',
    nights: 5,
    nightlyRate: 100,
    lodgingTotal: 500,
    cleaningFee: 50,
    basePrice: 550,
    touristTax: { status: 'RateUnavailable', amount: null, taxableNights: 0, ageRulesApply: false, categories: [] },
    totalPrice: 550,
    currency: 'EUR',
  } as DirectBookingQuote);
});

describe('BookingEditPage', { timeout: 20000 }, () => {
  it('BookingEditPage_ManualBooking_SendsOnlyDatesGuestsAndNotesAndGoesBackToTheDetail', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(bookingsApi.update).mockResolvedValue(saved());
    renderPage();

    await changeCheckOut('2027-10-06');
    fireEvent.change(screen.getByLabelText(i18n.t('booking.form.specialRequests')), { target: { value: 'Culla' } });
    expect(await screen.findByTestId('booking-price-total', undefined, WAIT)).toHaveTextContent('550,00');
    submit();

    await waitFor(() => expect(bookingsApi.update).toHaveBeenCalled(), WAIT);
    const [id, payload] = vi.mocked(bookingsApi.update).mock.calls[0];
    expect(id).toBe(BOOKING_ID);
    expect(payload).toEqual({
      checkInDate: '2027-10-01',
      checkOutDate: '2027-10-06',
      numberOfGuests: 2,
      numberOfChildren: 0,
      specialRequests: 'Culla',
    });
    // The booking of the host moves no money and is not on the channel manager: nothing to add, back to the booking.
    expect(bookingsApi.editQuote).not.toHaveBeenCalled();
    expect(await screen.findByText('booking-detail', undefined, WAIT)).toBeInTheDocument();
  });

  it('BookingEditPage_OverlappingDates_ShowsThe409NextToTheForm', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(bookingsApi.update).mockRejectedValue(
      conflict({ status: 409, code: 'booking_dates_unavailable', detail: "L'immobile non è disponibile." }),
    );
    renderPage();

    await changeCheckOut('2027-10-06');
    submit();

    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.bookingDatesUnavailable'),
    );
    expect(screen.queryByText('booking-detail')).not.toBeInTheDocument();
  });

  it('BookingEditPage_RequestOfTheBookingSite_LocksDatesAndGuestsButKeepsTheNotes', async () => {
    // A "pay at the property" request waiting for the host is not a booking yet: the API says the stay is locked.
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct', status: 'Pending' }));
    renderPage();

    expect(await screen.findByTestId('booking-stay-locked', undefined, WAIT)).toHaveTextContent(
      i18n.t('booking.form.stayLockedSource'),
    );
    expect(screen.getByLabelText(i18n.t('booking.form.checkInDate'))).toBeDisabled();
    expect(screen.getByLabelText(i18n.t('booking.form.numberOfGuests'))).toBeDisabled();
    expect(screen.getByLabelText(i18n.t('booking.form.specialRequests'))).toBeEnabled();
    expect(bookingsApi.quote).not.toHaveBeenCalled();
  });

  it('BookingEditPage_StayThatHasStarted_LocksDatesAndGuestsWithTheStartedSentence', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'CheckedIn', changeOptions: { canEdit: false, canCancel: true }, canEdit: { allowed: false, reason: 'Started' } }),
    );
    renderPage();

    expect(await screen.findByTestId('booking-stay-locked', undefined, WAIT)).toHaveTextContent(i18n.t('booking.form.stayLockedStarted'));
  });

  it('BookingEditPage_CancelButton_GoesBackToTheDetailWithoutSaving', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: i18n.t('booking.form.cancel') }, WAIT));

    expect(await screen.findByText('booking-detail', undefined, WAIT)).toBeInTheDocument();
    expect(bookingsApi.update).not.toHaveBeenCalled();
  });

  it('BookingEditPage_CancelledBooking_SaysItCannotBeChangedAndShowsNoForm', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'Cancelled', changeOptions: { canEdit: false, canCancel: false }, canEdit: { allowed: false, reason: 'Cancelled' } }),
    );
    renderPage();

    expect(await screen.findByTestId('booking-not-editable', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('booking.form.update') })).not.toBeInTheDocument();
  });

  describe('a booking of the booking site: the money is read before the save (NF-75)', () => {
    it('BookingEditPage_DirectBookingWithANewStay_ShowsWhatHappensToTheMoneyBeforeAnythingIsSaved', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
      vi.mocked(bookingsApi.editQuote).mockResolvedValue(editQuote());
      renderPage();

      await changeCheckOut('2027-10-06');
      submit();

      const review = await screen.findByTestId('booking-edit-review', undefined, WAIT);
      expect(within(review).getByTestId('booking-edit-settlement-price')).toHaveTextContent(/Il prezzo passa da 450,00\s€ a 520,00\s€/);
      expect(within(review).getByTestId('booking-edit-settlement-action')).toHaveTextContent(/L'ospite riceve un link per pagare 70,00\s€/);
      // The quote went with the same body as the save will, and nothing was saved.
      expect(bookingsApi.editQuote).toHaveBeenCalledWith(BOOKING_ID, {
        checkInDate: '2027-10-01',
        checkOutDate: '2027-10-06',
        numberOfGuests: 2,
        numberOfChildren: 0,
        specialRequests: '',
      });
      expect(bookingsApi.update).not.toHaveBeenCalled();
    });

    it('BookingEditPage_ConfirmAndSave_SendsTheSameBodyAndSaysWhatWasDoneWithTheMoney', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
      vi.mocked(bookingsApi.editQuote).mockResolvedValue(editQuote({ action: 'refund', newTotal: 380, difference: -70 }));
      vi.mocked(bookingsApi.update).mockResolvedValue(
        saved({ settlement: { action: 'refund', state: 'pending', amount: 70, offlineRefundDue: 0, currency: 'EUR' } }),
      );
      renderPage();

      await changeCheckOut('2027-10-06');
      submit();
      fireEvent.click(await screen.findByTestId('booking-edit-review-confirm', undefined, WAIT));

      await waitFor(() => expect(bookingsApi.update).toHaveBeenCalledTimes(1), WAIT);
      expect(vi.mocked(bookingsApi.update).mock.calls[0][1]).toEqual(vi.mocked(bookingsApi.editQuote).mock.calls[0][1]);
      const result = await screen.findByTestId('booking-edit-saved', undefined, WAIT);
      // A refund Stripe has not confirmed is never told as confirmed.
      expect(within(result).getByText(/Stripe non l'ha ancora confermato/)).toBeInTheDocument();
      expect(within(result).queryByText(/confermato da Stripe/)).not.toBeInTheDocument();
      expect(screen.queryByText('booking-detail')).not.toBeInTheDocument();
    });

    it('BookingEditPage_BackFromTheMoney_ReturnsToTheFormWithWhatWasTyped', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
      vi.mocked(bookingsApi.editQuote).mockResolvedValue(editQuote());
      renderPage();

      await changeCheckOut('2027-10-06');
      fireEvent.change(screen.getByLabelText(i18n.t('booking.form.specialRequests')), { target: { value: 'Culla' } });
      submit();
      fireEvent.click(await screen.findByTestId('booking-edit-review-back', undefined, WAIT));

      expect(await screen.findByLabelText(i18n.t('booking.form.checkOutDate'), undefined, WAIT)).toHaveValue('2027-10-06');
      expect(screen.getByLabelText(i18n.t('booking.form.specialRequests'))).toHaveValue('Culla');
      expect(bookingsApi.update).not.toHaveBeenCalled();
    });

    it('BookingEditPage_OnlyTheNotesChange_SavesAtOnceWithNoMoneyToRead', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
      vi.mocked(bookingsApi.update).mockResolvedValue(saved({ checkOutDate: '2027-10-05T00:00:00Z' }));
      renderPage();

      fireEvent.change(await screen.findByLabelText(i18n.t('booking.form.specialRequests'), undefined, WAIT), { target: { value: 'Culla' } });
      submit();

      await waitFor(() => expect(bookingsApi.update).toHaveBeenCalled(), WAIT);
      expect(bookingsApi.editQuote).not.toHaveBeenCalled();
    });

    it('BookingEditPage_QuoteRefusedBecauseTheDatesAreTaken_ShowsThe409NextToTheForm', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
      vi.mocked(bookingsApi.editQuote).mockRejectedValue(conflict({ status: 409, code: 'booking_dates_unavailable' }));
      renderPage();

      await changeCheckOut('2027-10-06');
      submit();

      expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.bookingDatesUnavailable'));
      expect(screen.queryByTestId('booking-edit-review')).not.toBeInTheDocument();
      expect(bookingsApi.update).not.toHaveBeenCalled();
    });

    it('BookingEditPage_StripeRefusesTheMoneyAtTheSave_StaysOnTheMoneyWithTheReasonAndSavesNothing', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
      vi.mocked(bookingsApi.editQuote).mockResolvedValue(editQuote());
      vi.mocked(bookingsApi.update).mockRejectedValue(problem(422, { status: 422, code: 'booking_settlement_failed' }));
      renderPage();

      await changeCheckOut('2027-10-06');
      submit();
      fireEvent.click(await screen.findByTestId('booking-edit-review-confirm', undefined, WAIT));

      expect(await screen.findByTestId('booking-edit-review-error', undefined, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.bookingSettlementFailed'));
      expect(screen.queryByTestId('booking-edit-saved')).not.toBeInTheDocument();
      // The host can go back, or ask again: the buttons are free again.
      expect(screen.getByTestId('booking-edit-review-confirm')).toBeEnabled();
    });

    it('BookingEditPage_WithoutPermissionToReadPayments_SavesWithoutAskingForTheQuote', async () => {
      permissions.delete('payment.read');
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
      vi.mocked(bookingsApi.update).mockRejectedValue(
        problem(403, { status: 403, code: 'booking_edit_payment_permission_required' }),
      );
      renderPage();

      await changeCheckOut('2027-10-06');
      submit();

      // A quote the person may not read is never asked for (the API would refuse it); the save is the server's to refuse, and it says why next to the form.
      expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(
        i18n.t('apiErrors.codes.bookingEditPaymentPermissionRequired'),
      );
      expect(bookingsApi.editQuote).not.toHaveBeenCalled();
    });

    describe('what the answer of the save says of the money (the part of an overpayment paid outside CasaZen)', () => {
      // The plan of an overpayment paid in cash moves no money, so anyone who may write the booking can save it, and the answer carries what is left to give back by hand.
      const withAnOverpaymentPaidByHand = () =>
        saved({ settlement: { action: 'none', state: 'none', amount: 0, offlineRefundDue: 30, currency: 'EUR' } });

      it('BookingEditPage_WithoutPermissionToReadPayments_SaysNothingOfTheMoneyTheAnswerCarries', async () => {
        permissions.delete('payment.read');
        vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct', octorateSync: sync() }));
        vi.mocked(bookingsApi.update).mockResolvedValue(withAnOverpaymentPaidByHand());
        renderPage();

        await changeCheckOut('2027-10-06');
        submit();

        const result = await screen.findByTestId('booking-edit-saved', undefined, WAIT);
        expect(result).toHaveTextContent('Prenotazione aggiornata.');
        expect(within(result).queryByTestId('booking-edit-settlement-result')).not.toBeInTheDocument();
        expect(result).not.toHaveTextContent(/30,00/);
        expect(bookingsApi.editQuote).not.toHaveBeenCalled();
      });

      it('BookingEditPage_WithoutPermissionToReadPayments_AnEditNotOnTheChannelManagerGoesBackToTheBooking', async () => {
        permissions.delete('payment.read');
        vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
        vi.mocked(bookingsApi.update).mockResolvedValue(withAnOverpaymentPaidByHand());
        renderPage();

        await changeCheckOut('2027-10-06');
        submit();

        // The part to give back is money, and there is no push to follow: nothing to say here, the host is back on the booking.
        expect(await screen.findByText('booking-detail', undefined, WAIT)).toBeInTheDocument();
        expect(screen.queryByTestId('booking-edit-saved')).not.toBeInTheDocument();
      });

      it('BookingEditPage_WithPermissionToReadPayments_SaysThePartToGiveBackByHand', async () => {
        vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
        vi.mocked(bookingsApi.editQuote).mockResolvedValue(editQuote({ newTotal: 450, difference: 0, action: 'none', amount: 0, offlineRefundDue: 30 }));
        vi.mocked(bookingsApi.update).mockResolvedValue(withAnOverpaymentPaidByHand());
        renderPage();

        await changeCheckOut('2027-10-06');
        submit();
        fireEvent.click(await screen.findByTestId('booking-edit-review-confirm', undefined, WAIT));

        const result = await screen.findByTestId('booking-edit-saved', undefined, WAIT);
        expect(within(result).getByTestId('booking-edit-settlement-offline')).toHaveTextContent(/Restano 30,00\s€ da restituire all'ospite/);
      });
    });

    it('BookingEditPage_MoneyMovesButTheHostMayNotWritePayments_BlocksTheConfirmationAndSaysWhy', async () => {
      permissions.delete('payment.write');
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
      vi.mocked(bookingsApi.editQuote).mockResolvedValue(editQuote());
      renderPage();

      await changeCheckOut('2027-10-06');
      submit();

      expect(await screen.findByTestId('booking-edit-review-blocked', undefined, WAIT)).toHaveTextContent(
        i18n.t('apiErrors.codes.bookingEditPaymentPermissionRequired'),
      );
      expect(screen.getByTestId('booking-edit-review-confirm')).toBeDisabled();
    });

    it('BookingEditPage_NoMoneyMovesAndNoPermissionOnPayments_CanStillConfirm', async () => {
      permissions.delete('payment.write');
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
      vi.mocked(bookingsApi.editQuote).mockResolvedValue(editQuote({ newTotal: 450, difference: 0, action: 'none', amount: 0 }));
      renderPage();

      await changeCheckOut('2027-10-06');
      submit();

      expect(await screen.findByTestId('booking-edit-settlement-price', undefined, WAIT)).toHaveTextContent('Il prezzo non cambia.');
      expect(screen.getByTestId('booking-edit-review-confirm')).toBeEnabled();
    });
  });

  describe('a booking of a channel (NF-75)', () => {
    const closedChannel: BookingChangeOptions = {
      canEdit: false,
      canCancel: false,
      reasonCode: 'ota_booking_change_not_allowed',
      guidanceKey: 'OtaChannelModifyGuidanceBookingCom',
      channel: 'BookingCom',
      cancelReasonCode: 'ota_booking_cancel_not_allowed',
      cancelGuidanceKey: 'OtaChannelCancelGuidanceBookingCom',
    };

    it('BookingEditPage_ChannelClosedForTheChange_ShowsTheOneSentenceAndNoForm', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({ source: 'BookingCom', changeOptions: closedChannel, canEdit: { allowed: false, reason: 'SourceLocked' } }),
      );
      renderPage();

      const guidance = await screen.findByTestId('booking-edit-channel-guidance', undefined, WAIT);
      expect(within(guidance).getByTestId('ota-change-guidance')).toHaveTextContent("Su Booking.com l'ospite cambia le date dall'app o dall'extranet");
      expect(screen.queryByRole('button', { name: i18n.t('booking.form.update') })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(i18n.t('booking.form.checkInDate'))).not.toBeInTheDocument();
    });

    it('BookingEditPage_ChannelOpenForTheChange_StillLocksTheStayButKeepsTheNotes', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({
          source: 'Airbnb',
          changeOptions: { ...closedChannel, channel: 'Airbnb', reasonCode: 'booking_update_source_locked', canCancel: true, cancelReasonCode: null },
          canEdit: { allowed: false, reason: 'SourceLocked' },
        }),
      );
      renderPage();

      expect(await screen.findByTestId('booking-stay-locked', undefined, WAIT)).toBeInTheDocument();
      expect(screen.getByLabelText(i18n.t('booking.form.specialRequests'))).toBeEnabled();
      expect(screen.queryByTestId('booking-edit-channel-guidance')).not.toBeInTheDocument();
    });
  });

  describe('the channel manager after the save (NF-74, NF-75)', () => {
    it('BookingEditPage_MirroredBookingSaved_SaysTheChangeIsBeingSent', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: sync() }));
      vi.mocked(bookingsApi.update).mockResolvedValue(saved());
      renderPage();

      await changeCheckOut('2027-10-06');
      // What the server holds right after the save: the push has started.
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: sync({ state: 'Pending' }) }));
      submit();

      const result = await screen.findByTestId('booking-edit-saved', undefined, WAIT);
      expect(await within(result).findByTestId('booking-sync-pending', undefined, WAIT)).toHaveTextContent('Sto inviando la modifica al tuo channel manager');
      expect(screen.queryByText('booking-detail')).not.toBeInTheDocument();
    });

    it('BookingEditPage_MirroredBookingSavedAndTheServerHasNotStartedThePush_SaysNothingExtra', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: sync() }));
      vi.mocked(bookingsApi.update).mockResolvedValue(saved());
      renderPage();

      await changeCheckOut('2027-10-06');
      submit();

      const result = await screen.findByTestId('booking-edit-saved', undefined, WAIT);
      expect(result).toHaveTextContent('Prenotazione aggiornata.');
      // Synced says nothing: a success the server did not confirm is never claimed.
      expect(within(result).queryByText(/channel manager/)).not.toBeInTheDocument();
    });

    it('BookingEditPage_PushFailed_SaysSavedInCasaZenButNotInTheChannelManagerAndOffersRetryNow', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({ octorateSync: sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true }) }),
      );
      vi.mocked(bookingsApi.retryOctorateSync).mockResolvedValue({ bookingId: BOOKING_ID, state: 'Pending' });
      renderPage();

      const failed = await screen.findByTestId('booking-sync-failed', undefined, WAIT);
      expect(failed).toHaveTextContent('Salvata in CasaZen, non ancora nel tuo channel manager');
      fireEvent.click(within(failed).getByRole('button', { name: 'Riprova ora' }));

      await waitFor(() => expect(bookingsApi.retryOctorateSync).toHaveBeenCalledWith(BOOKING_ID, false), WAIT);
    });

    it('BookingEditPage_RetryNowInFlight_DisablesTheButtonsOfThePage', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({ octorateSync: sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true }) }),
      );
      let release: (value: { bookingId: string; state: 'Pending' }) => void = () => undefined;
      vi.mocked(bookingsApi.retryOctorateSync).mockReturnValue(new Promise((resolve) => (release = resolve)));
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Riprova ora' }, WAIT));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Riprova ora' })).toBeDisabled(), WAIT);
      expect(screen.getByRole('button', { name: i18n.t('booking.form.update') })).toBeDisabled();
      release({ bookingId: BOOKING_ID, state: 'Pending' });
      await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('booking.form.update') })).toBeEnabled(), WAIT);
    });

    it('BookingEditPage_RetryRefused_SaysWhyNextToTheButton', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({ octorateSync: sync({ state: 'Failed', errorCode: 'octorate_rejected', canRetry: true }) }),
      );
      vi.mocked(bookingsApi.retryOctorateSync).mockRejectedValue(problem(409, { status: 409, code: 'octorate_sync_not_retryable' }));
      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Riprova ora' }, WAIT));

      expect(await within(screen.getByTestId('booking-sync-failed')).findByText(i18n.t('apiErrors.codes.octorateSyncNotRetryable'), undefined, WAIT)).toBeInTheDocument();
    });

    it('BookingEditPage_PushUnderWay_AsksTheBookingAgainByItselfUntilTheChannelManagerAnswers', async () => {
      // The outcome of a sync has no push notification: the open page asks again, and stops when the row is final.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: sync({ state: 'Pending' }) }));
        renderPage();
        expect(await screen.findByTestId('booking-sync-pending', undefined, WAIT)).toBeInTheDocument();
        const reads = vi.mocked(bookingsApi.getById).mock.calls.length;

        // The channel manager answers; the page finds out without a reload.
        vi.mocked(bookingsApi.getById).mockResolvedValue(
          booking({ octorateSync: sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true }) }),
        );
        await vi.advanceTimersByTimeAsync(3500);
        expect(await screen.findByTestId('booking-sync-failed', undefined, WAIT)).toBeInTheDocument();
        expect(vi.mocked(bookingsApi.getById).mock.calls.length).toBeGreaterThan(reads);

        // A final state is final for this visit: it stops asking.
        await vi.advanceTimersByTimeAsync(500);
        const settled = vi.mocked(bookingsApi.getById).mock.calls.length;
        await vi.advanceTimersByTimeAsync(20_000);
        expect(vi.mocked(bookingsApi.getById).mock.calls.length).toBe(settled);
      } finally {
        vi.useRealTimers();
      }
    });

    it('BookingEditPage_PushStillPendingTenMinutesAfterTheOpening_StopsAskingAndSaysItHasNoAnswerYet', async () => {
      // A push that stopped halfway leaves the row Pending for good, and the host cannot ask again from there.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: sync({ state: 'Pending' }) }));
        renderPage();
        expect(await screen.findByTestId('booking-sync-pending', undefined, WAIT)).toBeInTheDocument();

        await vi.advanceTimersByTimeAsync(SYNC_PENDING_LIMIT_MS + 1_000);

        const waiting = await screen.findByTestId('booking-sync-waiting', undefined, WAIT);
        expect(waiting).toHaveTextContent('non ha ancora risposto');
        expect(screen.queryByTestId('booking-sync-pending')).not.toBeInTheDocument();
        const settled = vi.mocked(bookingsApi.getById).mock.calls.length;
        await vi.advanceTimersByTimeAsync(2 * SYNC_WATCH_MS);
        expect(vi.mocked(bookingsApi.getById).mock.calls.length).toBe(settled);

        // «Controlla di nuovo» reads the booking once more, and the answer that has come is shown.
        vi.mocked(bookingsApi.getById).mockResolvedValue(
          booking({ octorateSync: sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true }) }),
        );
        fireEvent.click(within(waiting).getByRole('button', { name: 'Controlla di nuovo' }));

        expect(await screen.findByTestId('booking-sync-failed', undefined, WAIT)).toBeInTheDocument();
        expect(screen.queryByTestId('booking-sync-waiting')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('BookingEditPage_CheckAgainWhileStillPending_WaitsForOneMoreMinuteAndThenSaysItAgain', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ octorateSync: sync({ state: 'Pending' }) }));
        renderPage();
        await screen.findByTestId('booking-sync-pending', undefined, WAIT);
        await vi.advanceTimersByTimeAsync(SYNC_PENDING_LIMIT_MS + 1_000);
        fireEvent.click(within(await screen.findByTestId('booking-sync-waiting', undefined, WAIT)).getByRole('button', { name: 'Controlla di nuovo' }));

        // The minute after the asking: it asks again every few seconds, and says "being sent" meanwhile.
        const asked = vi.mocked(bookingsApi.getById).mock.calls.length;
        await vi.advanceTimersByTimeAsync(SYNC_WATCH_MS / 2);
        expect(vi.mocked(bookingsApi.getById).mock.calls.length).toBeGreaterThan(asked + 3);
        expect(await screen.findByTestId('booking-sync-pending', undefined, WAIT)).toBeInTheDocument();

        // And when the minute is over without an answer it stops again and says so.
        await vi.advanceTimersByTimeAsync(SYNC_WATCH_MS);
        expect(await screen.findByTestId('booking-sync-waiting', undefined, WAIT)).toBeInTheDocument();
        const settled = vi.mocked(bookingsApi.getById).mock.calls.length;
        await vi.advanceTimersByTimeAsync(2 * SYNC_WATCH_MS);
        expect(vi.mocked(bookingsApi.getById).mock.calls.length).toBe(settled);
      } finally {
        vi.useRealTimers();
      }
    });

    describe('conflict', () => {
      const conflicted = () =>
        booking({
          source: 'Direct',
          octorateSync: sync({
            state: 'Conflict',
            errorCode: 'octorate_reservation_changed',
            canRetry: true,
            octorateVersion: { checkIn: '2027-10-03T00:00:00Z', checkOut: '2027-10-08T00:00:00Z', guests: 3 },
          }),
        });

      it('BookingEditPage_Conflict_ShowsBothVersionsAndTheTwoChoices', async () => {
        vi.mocked(bookingsApi.getById).mockResolvedValue(conflicted());
        renderPage();

        const alert = await screen.findByTestId('booking-sync-conflict', undefined, WAIT);
        expect(alert).toHaveAttribute('role', 'alert');
        expect(within(screen.getByTestId('booking-conflict-casazen')).getByText(/1 ott 2027 → 5 ott 2027/)).toBeInTheDocument();
        expect(within(screen.getByTestId('booking-conflict-channel')).getByText(/3 ott 2027 → 8 ott 2027/)).toBeInTheDocument();
        expect(within(alert).getByRole('button', { name: 'Tieni la versione di CasaZen' })).toBeInTheDocument();
        expect(within(alert).getByRole('button', { name: 'Usa la versione del channel manager' })).toBeInTheDocument();
      });

      it('BookingEditPage_KeepTheCasazenVersion_AsksTheServerToWriteItOverTheOtherOne', async () => {
        vi.mocked(bookingsApi.getById).mockResolvedValue(conflicted());
        vi.mocked(bookingsApi.retryOctorateSync).mockResolvedValue({ bookingId: BOOKING_ID, state: 'Pending' });
        renderPage();

        fireEvent.click(await screen.findByRole('button', { name: 'Tieni la versione di CasaZen' }, WAIT));

        await waitFor(() => expect(bookingsApi.retryOctorateSync).toHaveBeenCalledWith(BOOKING_ID, true), WAIT);
        expect(bookingsApi.update).not.toHaveBeenCalled();
      });

      it('BookingEditPage_CreationRefusedForTheDates_SaysTheyAreTakenAndAsksAgainWithoutWritingOverAnything', async () => {
        // The creation of the booking in the channel manager found the dates taken: no reservation exists there, so there are no two versions to choose between.
        vi.mocked(bookingsApi.getById).mockResolvedValue(
          booking({ source: 'Direct', octorateSync: sync({ state: 'Conflict', lastOperation: 'Create', errorCode: 'octorate_dates_unavailable', canRetry: true }) }),
        );
        vi.mocked(bookingsApi.retryOctorateSync).mockResolvedValue({ bookingId: BOOKING_ID, state: 'Pending' });
        renderPage();

        const failed = await screen.findByTestId('booking-sync-failed', undefined, WAIT);
        expect(failed).toHaveTextContent(i18n.t('booking.syncReason.datesUnavailable'));
        expect(screen.queryByTestId('booking-sync-conflict')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Usa la versione del channel manager' })).not.toBeInTheDocument();

        fireEvent.click(within(failed).getByRole('button', { name: 'Riprova ora' }));

        await waitFor(() => expect(bookingsApi.retryOctorateSync).toHaveBeenCalledWith(BOOKING_ID, false), WAIT);
      });

      it('BookingEditPage_VersionThatDoesNotSayTheGuests_OffersOnlyKeepingTheCasazenVersion', async () => {
        // The server takes the version of the channel manager as the booking's only when it says the dates and the guests: this one would conflict again.
        vi.mocked(bookingsApi.getById).mockResolvedValue(
          booking({
            source: 'Direct',
            octorateSync: sync({
              state: 'Conflict',
              errorCode: 'octorate_reservation_changed',
              canRetry: true,
              octorateVersion: { checkIn: '2027-10-03T00:00:00Z', checkOut: '2027-10-08T00:00:00Z', guests: null },
            }),
          }),
        );
        renderPage();

        const alert = await screen.findByTestId('booking-sync-conflict', undefined, WAIT);
        expect(within(alert).getByRole('button', { name: 'Tieni la versione di CasaZen' })).toBeInTheDocument();
        expect(within(alert).queryByRole('button', { name: 'Usa la versione del channel manager' })).not.toBeInTheDocument();
      });

      it('BookingEditPage_UseTheChannelManagerVersion_OpensTheFormWithItsDatesAndGuestsAndSavesNothing', async () => {
        vi.mocked(bookingsApi.getById).mockResolvedValue(conflicted());
        renderPage();

        fireEvent.click(await screen.findByRole('button', { name: 'Usa la versione del channel manager' }, WAIT));

        expect(await screen.findByLabelText(i18n.t('booking.form.checkInDate'), undefined, WAIT)).toHaveValue('2027-10-03');
        expect(screen.getByLabelText(i18n.t('booking.form.checkOutDate'))).toHaveValue('2027-10-08');
        expect(screen.getByLabelText(i18n.t('booking.form.numberOfGuests'))).toHaveValue(3);
        // Nothing was written: the CasaZen version is still the saved one until the host saves the form.
        expect(bookingsApi.update).not.toHaveBeenCalled();
        expect(bookingsApi.retryOctorateSync).not.toHaveBeenCalled();
      });
    });
  });

  describe('the page is read fresh and says what the server says (lessons of the reviews)', () => {
    it('BookingEditPage_BookingInTheCacheFromAnEarlierVisit_NeverStartsTheForm', async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      // What the detail page left in the cache, with other guests than the booking has now.
      client.setQueryData(['bookings', BOOKING_ID], booking({ numberOfGuests: 5 }));
      vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ numberOfGuests: 2 }));
      renderPage(client);

      expect(await screen.findByLabelText(i18n.t('booking.form.numberOfGuests'), undefined, WAIT)).toHaveValue(2);
      expect(bookingsApi.getById).toHaveBeenCalledTimes(1);
    });

    it('BookingEditPage_NotFoundWhileTheCacheStillHoldsTheBooking_SaysNotFoundAndShowsNoForm', async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      client.setQueryData(['bookings', BOOKING_ID], booking());
      vi.mocked(bookingsApi.getById).mockRejectedValue(problem(404, { status: 404, code: 'not_found' }));
      renderPage(client);

      expect(await screen.findByText(i18n.t('booking.edit.notFound'), undefined, WAIT)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: i18n.t('booking.form.update') })).not.toBeInTheDocument();
    });

    it('BookingEditPage_ServerErrorOnTheFirstRead_IsNeverShownAsNotFound', async () => {
      vi.mocked(bookingsApi.getById).mockRejectedValue(problem(500, { status: 500 }));
      renderPage();

      expect(await screen.findByRole('button', { name: i18n.t('booking.detailPage.retry') }, WAIT)).toBeInTheDocument();
      expect(screen.queryByText(i18n.t('booking.edit.notFound'))).not.toBeInTheDocument();
    });
  });
});
