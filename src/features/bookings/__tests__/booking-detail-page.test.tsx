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
import { getBookingStatusLabel } from '@/lib/i18n-labels';
import type { Booking } from '@/types';
import { BookingDetailPage } from '../booking-detail-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getById: vi.fn(), approveRequest: vi.fn(), getCancellationQuote: vi.fn() },
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
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: () => true }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), action),
}));
vi.mock('@/components/shared/breadcrumb', () => ({ Breadcrumb: () => null }));

const WAIT = { timeout: 5000 };
const BOOKING_ID = 'b0c1d2e3-0000-4000-8000-000000000001';

const booking = (overrides: Partial<Booking> = {}): Booking => ({
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
});

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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [`/app/short-rent/bookings/${BOOKING_ID}`] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/bookings/:id', element: createElement(BookingDetailPage) }),
          )))),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(serviceRequestsApi.fetchServiceRequests).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  vi.mocked(fetchServiceCategories).mockResolvedValue(['cleaning', 'maintenance']);
  await i18n.changeLanguage('it');
});

describe('BookingDetailPage', { timeout: 20000 }, () => {
  it.each(['it', 'en'])('BookingDetailPage_Title_IsTranslatedNotBookingHash (%s)', async (lng) => {
    await i18n.changeLanguage(lng);
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage();

    const expected = i18n.t('booking.detailPage.title', { code: BOOKING_ID.slice(0, 8) });
    expect(await screen.findByRole('heading', { name: expected }, WAIT)).toBeInTheDocument();
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

  it('BookingDetailPage_ConfirmedBookingFromTheBookingSite_OffersCancelAndEditButNotConfirm', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));

    renderPage();

    expect(await screen.findByTestId('open-cancel-booking', undefined, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('edit-booking')).toBeInTheDocument();
    expect(screen.queryByTestId('open-confirm-booking')).not.toBeInTheDocument();
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
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'CheckedIn' }));

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

  it('BookingDetailPage_ConfirmedStayPastTheDepartureDay_OffersTheCheckOutWizard', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'Confirmed', checkInDate: '2025-03-01T00:00:00Z', checkOutDate: '2025-03-04T00:00:00Z' }),
    );

    renderPage();

    expect(await screen.findByTestId('open-checkout-wizard', undefined, WAIT)).toBeInTheDocument();
  });

  it('BookingDetailPage_PaymentTab_PricePerNightIsLodgingOnlyWithoutTaxAndCleaning', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: i18n.t('booking.detailPage.tabs.payment') }, WAIT));

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
    await waitFor(() => expect(within(dialog).getByTestId('submit-service-request')).toBeEnabled());
    fireEvent.click(within(dialog).getByTestId('submit-service-request'));

    await waitFor(() => expect(serviceRequestsApi.createServiceRequest).toHaveBeenCalledTimes(1));
    expect(vi.mocked(serviceRequestsApi.createServiceRequest).mock.calls[0][0]).toMatchObject({
      propertyId: 'property-1',
      bookingId: BOOKING_ID,
      supplierOrgId: 'sup-1',
      category: 'cleaning',
    });
  });

  it('BookingDetailPage_CancelledStay_DoesNotOfferASupplierRequest', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'Cancelled' }));

    renderPage();

    expect(await screen.findByTestId('booking-service-requests', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('request-supplier-btn')).not.toBeInTheDocument();
  });
});
