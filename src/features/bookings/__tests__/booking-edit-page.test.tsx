import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { propertiesApi } from '@/api/properties.api';
import type { Booking, Property } from '@/types';
import type { DirectBookingQuote } from '@/types/direct-booking.types';
import { BookingEditPage } from '../booking-edit-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getById: vi.fn(), update: vi.fn(), quote: vi.fn() },
}));
vi.mock('@/api/properties.api', () => ({
  propertiesApi: { getAll: vi.fn() },
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const WAIT = { timeout: 5000 };
const BOOKING_ID = 'booking-1';

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
});

function conflict(data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status: 409,
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
        createElement(MemoryRouter, { initialEntries: [`/app/short-rent/bookings/${BOOKING_ID}/edit`] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/bookings/:id/edit', element: createElement(BookingEditPage) }),
            createElement(Route, { path: '/app/short-rent/bookings/:id', element: createElement('p', null, 'booking-detail') }),
          )))),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
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
    vi.mocked(bookingsApi.update).mockResolvedValue(booking({ checkOutDate: '2027-10-06T00:00:00Z' }));
    renderPage();

    fireEvent.change(await screen.findByLabelText(i18n.t('booking.form.checkOutDate'), undefined, WAIT), {
      target: { value: '2027-10-06' },
    });
    fireEvent.change(screen.getByLabelText(i18n.t('booking.form.specialRequests')), { target: { value: 'Culla' } });
    expect(await screen.findByTestId('booking-price-total', undefined, WAIT)).toHaveTextContent('550,00');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('booking.form.update') }));

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
    expect(await screen.findByText('booking-detail', undefined, WAIT)).toBeInTheDocument();
  });

  it('BookingEditPage_OverlappingDates_ShowsThe409NextToTheForm', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(bookingsApi.update).mockRejectedValue(
      conflict({ status: 409, code: 'booking_dates_unavailable', detail: "L'immobile non è disponibile." }),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText(i18n.t('booking.form.checkOutDate'), undefined, WAIT), {
      target: { value: '2027-10-06' },
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('booking.form.update') }));

    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.bookingDatesUnavailable'),
    );
    expect(screen.queryByText('booking-detail')).not.toBeInTheDocument();
  });

  it('BookingEditPage_BookingFromTheBookingSite_LocksDatesAndGuestsButKeepsTheNotes', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ source: 'Direct' }));
    renderPage();

    expect(await screen.findByTestId('booking-stay-locked', undefined, WAIT)).toHaveTextContent(
      i18n.t('booking.form.stayLockedSource'),
    );
    expect(screen.getByLabelText(i18n.t('booking.form.checkInDate'))).toBeDisabled();
    expect(screen.getByLabelText(i18n.t('booking.form.numberOfGuests'))).toBeDisabled();
    expect(screen.getByLabelText(i18n.t('booking.form.specialRequests'))).toBeEnabled();
    expect(bookingsApi.quote).not.toHaveBeenCalled();
  });

  it('BookingEditPage_CancelButton_GoesBackToTheDetailWithoutSaving', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: i18n.t('booking.form.cancel') }, WAIT));

    expect(await screen.findByText('booking-detail', undefined, WAIT)).toBeInTheDocument();
    expect(bookingsApi.update).not.toHaveBeenCalled();
  });
});
