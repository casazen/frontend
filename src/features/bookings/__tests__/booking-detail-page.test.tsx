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
import * as serviceRequestsApi from '@/api/service-requests.api';
import { fetchServiceCategories } from '@/api/service-categories.api';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { toast } from 'sonner';
import { getBookingStatusLabel } from '@/lib/i18n-labels';
import { addDays, romeWallTimeToUtc, todayInRome } from '@/lib/stay-dates';
import type { Booking } from '@/types';
import { BookingDetailPage } from '../booking-detail-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getById: vi.fn(), approveRequest: vi.fn(), getCancellationQuote: vi.fn(), checkIn: vi.fn() },
}));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getStatus: vi.fn() } }));
vi.mock('@/features/alloggiati/components/alloggiati-booking-panel', () => ({
  AlloggiatiBookingPanel: () => createElement('div', { 'data-testid': 'alloggiati-panel-stub' }),
}));
// The real service request hooks around mocked network calls (SU-07: which query the stay uses).
vi.mock('@/api/service-requests.api', () => ({
  fetchServiceRequests: vi.fn(),
  createServiceRequest: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
  markServiceRequestPaid: vi.fn(),
  markLongRentServiceRequestPaid: vi.fn(),
}));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: vi.fn() }));
// The tab Pagamento shows «Dati di fatturazione» (FIS-01), which reads its own data: kept off the network here.
vi.mock('@/api/invoice-data.api', () => ({
  getInvoiceData: vi.fn().mockResolvedValue({ bookingId: 'b0c1d2e3-0000-4000-8000-000000000001', invoiceRequested: false }),
  saveInvoiceData: vi.fn(),
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: () => true }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
interface HeaderAction {
  label: string;
  to?: string;
  onClick?: () => void;
  testId?: string;
}
// The real header keeps `secondary` in the menu "⋯" (a closed menu has no items in the page): here they are plain buttons and links.
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action, secondary }: { title: string; action?: React.ReactNode; secondary?: (HeaderAction | { separator: true })[] }) =>
    createElement(
      'div',
      null,
      createElement('h1', null, title),
      action,
      ...(secondary ?? []).flatMap((item, index) => {
        if ('separator' in item) return [];
        return [
          item.to
            ? createElement('a', { key: index, href: item.to, 'data-testid': item.testId }, item.label)
            : createElement('button', { key: index, type: 'button', onClick: item.onClick, 'data-testid': item.testId }, item.label),
        ];
      }),
    ),
}));
vi.mock('@/components/shared/breadcrumb', () => ({ Breadcrumb: () => null }));

const WAIT = { timeout: 5000 };
const BOOKING_ID = 'b0c1d2e3-0000-4000-8000-000000000001';

/** `canEdit` as the API answers it (SR-05a): a booking can be changed only when it is the host's own, not cancelled and not started. */
const editabilityOf = ({ status, source }: Pick<Booking, 'status' | 'source'>): NonNullable<Booking['canEdit']> => {
  if (status === 'Cancelled') return { allowed: false, reason: 'Cancelled' };
  if (status === 'CheckedIn' || status === 'CheckedOut') return { allowed: false, reason: 'Started' };
  return source === 'Manual' ? { allowed: true, reason: null } : { allowed: false, reason: 'SourceLocked' };
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
    touristTax: 12,
    totalPrice: 462,
    currency: 'EUR',
    status: 'Confirmed',
    source: 'Manual',
    guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '+393331234567', country: 'IT' },
    createdAt: '2026-09-24T08:00:00Z',
    updatedAt: '2026-09-24T08:00:00Z',
    ...overrides,
  };
  return { ...base, canEdit: overrides.canEdit ?? editabilityOf(base) };
};

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

/** Stay dates (ISO, midnight UTC) relative to today in Europe/Rome. */
const stayDay = (days: number) => `${addDays(todayInRome(), days)}T00:00:00Z`;

function renderPage(
  url = `/app/short-rent/bookings/${BOOKING_ID}`,
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
) {
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [url] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/bookings/:id', element: createElement(BookingDetailPage) }),
          )))),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(serviceRequestsApi.fetchServiceRequests).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  vi.mocked(fetchServiceCategories).mockResolvedValue(['cleaning', 'maintenance']);
  // The block "what happens now" of a confirmed stay also reads whether the guest data are complete (the wizard "Guest check-in").
  vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: true } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);
  await i18n.changeLanguage('it');
});

describe('BookingDetailPage', { timeout: 20000 }, () => {
  it.each(['it', 'en'])('BookingDetailPage_Title_IsTheGuestAndTheCodeIsTheOneTheGuestKnows (%s)', async (lng) => {
    await i18n.changeLanguage(lng);
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ bookingCode: 'ABCDE-12345' }));

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Mario Rossi' }, WAIT)).toBeInTheDocument();
    expect(screen.getByText('ABCDE-12345')).toBeInTheDocument();
    expect(screen.queryByText(BOOKING_ID.slice(0, 8))).not.toBeInTheDocument();
    expect(screen.queryByText(/Booking #/)).not.toBeInTheDocument();
  });

  it('BookingDetailPage_PendingManualBooking_ConfirmsItFromTheDialog', async () => {
    // The detail is read again after the confirmation: the second read returns the confirmed booking.
    vi.mocked(bookingsApi.getById)
      .mockResolvedValueOnce(booking({ status: 'Pending' }))
      .mockResolvedValue(booking({ status: 'Confirmed' }));
    vi.mocked(bookingsApi.approveRequest).mockResolvedValue(booking({ status: 'Confirmed' }));

    renderPage();

    expect(await screen.findByTestId('booking-pending-manual', undefined, WAIT)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-confirm-booking'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('booking.confirm.submit') }));

    await waitFor(() => expect(bookingsApi.approveRequest).toHaveBeenCalledWith(BOOKING_ID));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WAIT);
    await waitFor(
      () => expect(screen.getByTestId('booking-detail-status')).toHaveTextContent(getBookingStatusLabel('Confirmed', i18n.t)),
      WAIT,
    );
    expect(screen.queryByTestId('open-confirm-booking')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_PayAtThePropertyRequestAwaitingTheHost_IsConfirmedThroughTheSameAction', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'Pending', source: 'Direct', paymentOption: 'OnSite', onSiteRequestState: 'AwaitingHostApproval' }),
    );
    vi.mocked(bookingsApi.approveRequest).mockResolvedValue(booking({ status: 'Confirmed', source: 'Direct' }));

    renderPage();

    fireEvent.click(await screen.findByTestId('open-confirm-booking', undefined, WAIT));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('booking.confirm.submit') }));

    await waitFor(() => expect(bookingsApi.approveRequest).toHaveBeenCalledWith(BOOKING_ID));
    expect(screen.queryByTestId('booking-pending-manual')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_CheckoutHoldWaitingForPayment_CannotBeConfirmedByTheHost', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Pending', source: 'Direct', paymentOption: 'Immediate' }));

    renderPage();

    expect(await screen.findByTestId('open-cancel-booking', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('open-confirm-booking')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_ConfirmRejected_ShowsTheApiErrorInTheDialog', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Pending' }));
    vi.mocked(bookingsApi.approveRequest).mockRejectedValue(
      axiosError(409, { status: 409, code: 'booking_dates_unavailable', detail: 'Date non disponibili.' }),
    );

    renderPage();

    fireEvent.click(await screen.findByTestId('open-confirm-booking', undefined, WAIT));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('booking.confirm.submit') }));

    expect(await within(dialog).findByRole('alert', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.bookingDatesUnavailable'),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('BookingDetailPage_ConfirmedBookingFromTheBookingSite_OffersCancelButNotEditNorConfirmAndSaysWhy', async () => {
    // SR-05c: the API refuses to change the dates of a booking from the booking site (`canEdit`, SR-D5): the page offers no "Modifica".
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));

    renderPage();

    expect(await screen.findByTestId('open-cancel-booking', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('edit-booking')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-edit-locked')).toHaveAttribute('data-reason', 'SourceLocked');
    expect(screen.queryByTestId('open-confirm-booking')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_ConfirmedBookingFromTheBookingSite_OffersEditWhenTheApiSaysItMayBeChanged', async () => {
    // E08/F02/US01: a confirmed booking of the booking site is changed, with its money settled: `changeOptions` and `canEdit` say so, and the page follows them.
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ source: 'Direct', changeOptions: { canEdit: true, canCancel: true }, canEdit: { allowed: true, reason: null } }),
    );

    renderPage();

    expect(await screen.findByTestId('edit-booking', undefined, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('open-cancel-booking')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-edit-locked')).not.toBeInTheDocument();
  });

  describe('a booking of a channel (E08/F03/US02, NF-75, NF-76)', () => {
    const closedChannel: NonNullable<Booking['changeOptions']> = {
      canEdit: false,
      canCancel: false,
      reasonCode: 'ota_booking_change_not_allowed',
      guidanceKey: 'OtaChannelModifyGuidanceAirbnb',
      channel: 'Airbnb',
      cancelReasonCode: 'ota_booking_cancel_not_allowed',
      cancelGuidanceKey: 'OtaChannelCancelGuidanceAirbnb',
    };

    it('BookingDetailPage_ChannelClosedForBoth_OffersNeitherAndSaysHowToAskTheGuestOrTheChannel', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({ source: 'Airbnb', otaSource: 'Airbnb', changeOptions: closedChannel, canEdit: { allowed: false, reason: 'SourceLocked' } }),
      );

      renderPage();

      const guidance = await screen.findByTestId('booking-channel-guidance', undefined, WAIT);
      expect(within(guidance).getAllByTestId('ota-change-guidance')).toHaveLength(2);
      expect(guidance).toHaveTextContent("Per modificare questa prenotazione di Airbnb chiedi all'ospite di richiedere la modifica su Airbnb.");
      expect(guidance).toHaveTextContent("Per cancellare questa prenotazione di Airbnb chiedi all'ospite di annullarla su Airbnb.");
      expect(screen.queryByTestId('edit-booking')).not.toBeInTheDocument();
      expect(screen.queryByTestId('open-cancel-booking')).not.toBeInTheDocument();
      // The sentence of the channel replaces the one that would send the host to cancel a booking that cannot be cancelled here.
      expect(screen.queryByTestId('booking-edit-locked')).not.toBeInTheDocument();
    });

    it('BookingDetailPage_ChannelOpenForTheCancellation_OffersCancelAndSaysOnlyHowToChange', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({
          source: 'Airbnb',
          otaSource: 'Airbnb',
          changeOptions: { ...closedChannel, canCancel: true, cancelReasonCode: null, cancelGuidanceKey: null },
          canEdit: { allowed: false, reason: 'SourceLocked' },
        }),
      );

      renderPage();

      expect(await screen.findByTestId('open-cancel-booking', undefined, WAIT)).toBeInTheDocument();
      const guidance = screen.getByTestId('booking-channel-guidance');
      expect(within(guidance).getAllByTestId('ota-change-guidance')).toHaveLength(1);
      expect(guidance).toHaveTextContent(/Per modificare questa prenotazione di Airbnb/);
    });

    it('BookingDetailPage_CancelledBookingOfAChannel_ShowsNoActionAndNoSentence', async () => {
      vi.mocked(bookingsApi.getById).mockResolvedValue(
        booking({
          source: 'Airbnb',
          status: 'Cancelled',
          changeOptions: { canEdit: false, canCancel: false, reasonCode: 'booking_not_editable', channel: 'Airbnb', cancelReasonCode: 'booking_already_cancelled' },
          canEdit: { allowed: false, reason: 'Cancelled' },
        }),
      );

      renderPage();

      expect(await screen.findByTestId('booking-detail-status', undefined, WAIT)).toBeInTheDocument();
      expect(screen.queryByTestId('edit-booking')).not.toBeInTheDocument();
      expect(screen.queryByTestId('open-cancel-booking')).not.toBeInTheDocument();
      expect(screen.queryByTestId('booking-channel-guidance')).not.toBeInTheDocument();
    });
  });

  it('BookingDetailPage_CancelledBooking_ShowsTheHostReasonAndNoActions', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'Cancelled', cancellationNote: 'Caldaia guasta' }),
    );

    renderPage();

    expect(await screen.findByTestId('booking-cancellation-note', undefined, WAIT)).toHaveTextContent('Caldaia guasta');
    expect(screen.queryByTestId('open-cancel-booking')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-booking')).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-confirm-booking')).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-checkout-wizard')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_CheckedInStay_OffersTheCheckOutWizard', async () => {
    // Before the departure day too: an early departure is checked out like any other (CO-08).
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'CheckedIn', checkInDate: stayDay(-1), checkOutDate: stayDay(3) }),
    );

    renderPage();

    const link = await screen.findByTestId('open-checkout-wizard', undefined, WAIT);
    expect(link).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}/checkout`);
    expect(screen.queryByTestId('open-confirm-booking')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_ConfirmedStayBeforeTheDepartureDay_DoesNotOfferTheCheckOut', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Confirmed' }));

    renderPage();

    expect(await screen.findByTestId('open-cancel-booking', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('open-checkout-wizard')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_ConfirmedStayWithIncompleteGuestData_LeadsTheHostToTheCheckInWizard', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'Confirmed', checkInDate: stayDay(5), checkOutDate: stayDay(8) }),
    );
    vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: false } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);

    renderPage();

    const link = await screen.findByTestId('booking-next-check-in-wizard', undefined, WAIT);
    expect(link).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}/check-in`);
    expect(screen.getByTestId('booking-next-step')).toHaveAttribute('data-next-step', 'completeGuestData');
  });

  it('BookingDetailPage_ConfirmedStayWithCompleteGuestData_DoesNotSendTheHostToTheWizard', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'Confirmed', checkInDate: stayDay(5), checkOutDate: stayDay(8) }),
    );

    renderPage();

    expect(await screen.findByTestId('booking-next-step', undefined, WAIT)).toHaveAttribute('data-next-step', 'allInOrder');
    expect(screen.queryByTestId('booking-next-check-in-wizard')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_ConfirmedStayPastTheDepartureDay_OffersTheCheckOutWizard', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'Confirmed', checkInDate: '2025-03-01T00:00:00Z', checkOutDate: '2025-03-04T00:00:00Z' }),
    );

    renderPage();

    expect(await screen.findByTestId('open-checkout-wizard', undefined, WAIT)).toBeInTheDocument();
  });

  it('BookingDetailPage_ConfirmedStayRegisteredLate_RegistersTheArrivalAndWarnsAboutMissingGuestData', async () => {
    // CO-08: the check-in day was yesterday; the host registers the arrival today, with the guest data incomplete.
    const stay = { checkInDate: stayDay(-1), checkOutDate: stayDay(2) };
    vi.mocked(bookingsApi.getById)
      .mockResolvedValueOnce(booking({ status: 'Confirmed', ...stay }))
      .mockResolvedValue(booking({ status: 'CheckedIn', ...stay }));
    vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: false } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);
    vi.mocked(bookingsApi.checkIn).mockResolvedValue({ ...booking({ status: 'CheckedIn', ...stay }), guestDataComplete: false });

    renderPage();

    fireEvent.click(await screen.findByTestId('open-register-arrival', undefined, WAIT));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('register-arrival-late')).toBeInTheDocument();
    const incomplete = await within(dialog).findByTestId('guest-data-incomplete', undefined, WAIT);
    expect(within(incomplete).getByTestId('guest-data-complete-link')).toHaveAttribute(
      'href',
      `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`,
    );
    // Missing data never block the arrival.
    fireEvent.click(within(dialog).getByTestId('register-arrival-submit'));

    await waitFor(() => expect(bookingsApi.checkIn).toHaveBeenCalledWith(BOOKING_ID));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WAIT);
    expect(toast.warning).toHaveBeenCalledWith(
      i18n.t('booking.arrival.registeredDataIncomplete'),
      expect.objectContaining({ action: expect.objectContaining({ label: i18n.t('booking.arrival.completeGuestData') }) }),
    );
    await waitFor(
      () => expect(screen.getByTestId('booking-detail-status')).toHaveTextContent(getBookingStatusLabel('CheckedIn', i18n.t)),
      WAIT,
    );
    expect(screen.queryByTestId('open-register-arrival')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_RegisterArrivalRejected_ShowsTheApiErrorInTheDialog', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Confirmed', checkInDate: stayDay(0), checkOutDate: stayDay(3) }));
    vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: true } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);
    vi.mocked(bookingsApi.checkIn).mockRejectedValue(
      axiosError(409, { status: 409, code: 'booking_already_checked_in', detail: 'Già registrato.' }),
    );

    renderPage();

    fireEvent.click(await screen.findByTestId('open-register-arrival', undefined, WAIT));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByTestId('guest-data-complete', undefined, WAIT)).toBeInTheDocument();
    expect(within(dialog).queryByTestId('register-arrival-late')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByTestId('register-arrival-submit'));

    expect(await within(dialog).findByRole('alert', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.bookingAlreadyCheckedIn'),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([
    ['a future stay', { status: 'Confirmed' as const, checkInDate: stayDay(1), checkOutDate: stayDay(3) }],
    ['a stay whose departure day has passed', { status: 'Confirmed' as const, checkInDate: stayDay(-3), checkOutDate: stayDay(-1) }],
    ['a checked-in stay', { status: 'CheckedIn' as const, checkInDate: stayDay(-1), checkOutDate: stayDay(1) }],
  ])('BookingDetailPage_RegisterArrival_NotOfferedFor %s', async (_, stay) => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking(stay));

    renderPage();

    expect(await screen.findByTestId('booking-detail-status', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('open-register-arrival')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_AlloggiatiTabInTheUrl_OpensTheDocumentsTab', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage(`/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`);

    expect(await screen.findByTestId('alloggiati-panel-stub', undefined, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('booking-tab-guest')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByTestId('booking-tab-details'));
    expect(await screen.findByTestId('booking-detail-status', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-panel-stub')).not.toBeInTheDocument();
  });

  // UI-07 (Tabs): the tabs are links with the tab in the address, so that the other parameters stay and the address can be shared.
  it('BookingDetailPage_Tabs_AreLinksThatKeepTheRestOfTheAddressAndTheTestIds', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage(`/app/short-rent/bookings/${BOOKING_ID}?from=calendar`);

    expect(await screen.findByTestId('booking-detail-status', undefined, WAIT)).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: i18n.t('booking.detailPage.tabsLabel') })).toBeInTheDocument();
    expect(screen.getByTestId('booking-tab-details')).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}?from=calendar`);
    expect(screen.getByTestId('booking-tab-guest')).toHaveAttribute(
      'href',
      `/app/short-rent/bookings/${BOOKING_ID}?from=calendar&tab=guest`,
    );
    // The fourth tab of the old page is gone: its links (`?tab=alloggiati`) open Documenti.
    expect(screen.queryByTestId('booking-tab-alloggiati')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_PaymentTab_PricePerNightIsLodgingOnlyWithoutTaxAndCleaning', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage();

    fireEvent.click(await screen.findByRole('tab', { name: i18n.t('booking.detailPage.tabs.payment') }, WAIT));

    // (450 base - 50 cleaning) / 4 nights = 100 per night; the total 462 includes cleaning and 12 of tourist tax.
    expect(screen.getByTestId('booking-price-per-night')).toHaveTextContent(
      i18n.t('booking.detailPage.lodgingPerNight', { count: 4, perNight: '100,00 €' }),
    );
    expect(screen.getByTestId('booking-price-total')).toHaveTextContent('462,00 €');
    expect(screen.getByText(i18n.t('booking.detailPage.cleaningFee'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('booking.detailPage.touristTax'))).toBeInTheDocument();
  });

  it('BookingDetailPage_ServerError_ShowsLoadErrorNotNotFound', async () => {
    vi.mocked(bookingsApi.getById).mockRejectedValue(axiosError(500, { status: 500, title: 'Errore' }));

    renderPage();

    expect(await screen.findByTestId('booking-load-error', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('booking.detailPage.notFound'))).not.toBeInTheDocument();
  });

  it('BookingDetailPage_BookingInTheCacheFromAnEarlierVisit_IsReadAgainWhenThePageOpens', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(['bookings', BOOKING_ID], booking({ numberOfGuests: 5 }));
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ numberOfGuests: 2 }));

    renderPage(undefined, client);

    await waitFor(() => expect(bookingsApi.getById).toHaveBeenCalledTimes(1), WAIT);
    expect(await screen.findByText('2 ospiti', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByText('5 ospiti')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_NotFoundWhileTheCacheStillHoldsTheBooking_ShowsNotFound', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(['bookings', BOOKING_ID], booking());
    vi.mocked(bookingsApi.getById).mockRejectedValue(axiosError(404, { status: 404, code: 'not_found' }));

    renderPage(undefined, client);

    expect(await screen.findByText(i18n.t('booking.detailPage.notFound'), undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('booking-detail-status')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_NotFound_ShowsNotFound', async () => {
    vi.mocked(bookingsApi.getById).mockRejectedValue(axiosError(404, { status: 404, code: 'not_found' }));

    renderPage();

    expect(await screen.findByText(i18n.t('booking.detailPage.notFound'), undefined, WAIT)).toBeInTheDocument();
  });

  // ─── SU-07 (D2): a stay's supplier requests, the same ones the app shows ───

  it('BookingDetailPage_ServiceRequests_ListedForThisStayLikeTheApp', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(serviceRequestsApi.fetchServiceRequests).mockResolvedValue({
      items: [
        {
          id: 'sr-stay',
          orgId: 'org-1',
          bookingId: BOOKING_ID,
          rentalContext: 'ShortRent',
          propertyId: 'property-1',
          supplierOrgId: 'sup-1',
          supplierName: 'Pulizie Express Srl',
          category: 'cleaning',
          urgency: 'Normal',
          status: 'Richiesto',
          chargeToGuest: false,
          createdAt: '2026-09-24T08:00:00Z',
          updatedAt: '2026-09-24T08:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    renderPage();

    expect(await screen.findByTestId('service-request-sr-stay', undefined, WAIT)).toHaveTextContent('Pulizie Express Srl');
    // By stay, as the app's booking screen: never the whole property (other stays' requests).
    expect(serviceRequestsApi.fetchServiceRequests).toHaveBeenCalledWith({ bookingId: BOOKING_ID, pageSize: 50 });
    for (const [params] of vi.mocked(serviceRequestsApi.fetchServiceRequests).mock.calls) {
      expect(params).not.toHaveProperty('propertyId');
    }
  });

  it('BookingDetailPage_ServiceRequestsFail_ShowsTheErrorNotAnEmptyList', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(serviceRequestsApi.fetchServiceRequests).mockRejectedValue(axiosError(500, { status: 500 }));

    renderPage();

    expect(await screen.findByTestId('service-requests-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('serviceRequest.listLoadError'),
    );
    expect(screen.queryByTestId('service-requests-empty')).not.toBeInTheDocument();
  });

  it('BookingDetailPage_RequestSupplier_SendsThisStayAndItsProperty', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(serviceRequestsApi.fetchSuppliersByProperty).mockResolvedValue({
      items: [{ orgId: 'sup-1', legalName: 'Pulizie Express Srl', phone: '', email: '', categories: ['cleaning'], comuni: [], photoUrls: [] }],
      totalCount: 1,
      page: 1,
      pageSize: 1,
    });
    vi.mocked(serviceRequestsApi.createServiceRequest).mockResolvedValue({ id: 'sr-new' } as never);

    renderPage();

    expect(await screen.findByTestId('service-requests-empty', undefined, WAIT)).toHaveTextContent(
      i18n.t('serviceRequest.emptyForStay'),
    );
    fireEvent.click(screen.getByTestId('request-supplier-btn'));
    const dialog = await screen.findByTestId('service-request-dialog');
    expect(within(dialog).queryByTestId('service-request-stay')).not.toBeInTheDocument();
    fireEvent.change(await within(dialog).findByTestId('service-request-supplier', undefined, WAIT), {
      target: { value: 'sup-1' },
    });
    fireEvent.change(within(dialog).getByTestId('service-request-start-time'), { target: { value: '10:00' } });
    fireEvent.change(within(dialog).getByTestId('service-request-duration'), { target: { value: '120' } });
    await waitFor(() => expect(within(dialog).getByTestId('submit-service-request')).toBeEnabled());
    fireEvent.click(within(dialog).getByTestId('submit-service-request'));

    await waitFor(() => expect(serviceRequestsApi.createServiceRequest).toHaveBeenCalledTimes(1));
    expect(vi.mocked(serviceRequestsApi.createServiceRequest).mock.calls[0][0]).toMatchObject({
      propertyId: 'property-1',
      bookingId: BOOKING_ID,
      supplierOrgId: 'sup-1',
      category: 'cleaning',
      scheduledStartUtc: romeWallTimeToUtc('2027-10-05', '10:00'),
      durationMinutes: 120,
    });
  });

  it('BookingDetailPage_CancelledStay_DoesNotOfferASupplierRequest', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Cancelled' }));

    renderPage();

    expect(await screen.findByTestId('booking-service-requests', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('request-supplier-btn')).not.toBeInTheDocument();
  });
});
