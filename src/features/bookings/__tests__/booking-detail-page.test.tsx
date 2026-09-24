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
import { getBookingStatusLabel } from '@/lib/i18n-labels';
import type { Booking } from '@/types';
import { BookingDetailPage } from '../booking-detail-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getById: vi.fn(), approveRequest: vi.fn(), getCancellationQuote: vi.fn() },
}));
vi.mock('@/features/service-requests/components/service-request-timeline', () => ({
  ServiceRequestTimeline: () => null,
}));
vi.mock('@/queries/use-service-requests', () => ({
  useServiceRequests: () => ({ data: { items: [] } }),
}));
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
});
