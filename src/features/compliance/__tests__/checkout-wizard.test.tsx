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
import { alloggiatiApi } from '@/api/alloggiati.api';
import { completeCheckoutWizard, startCheckoutWizard } from '@/api/compliance.api';
import { addDays, todayInRome } from '@/lib/stay-dates';
import type { Booking } from '@/types';
import { CheckoutWizardPage } from '../checkout-wizard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getById: vi.fn() } }));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getStatus: vi.fn() } }));
vi.mock('@/api/compliance.api', () => ({
  startCheckoutWizard: vi.fn(),
  completeCheckoutWizard: vi.fn(),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('@/components/shared/breadcrumb', () => ({ Breadcrumb: () => null }));

const WAIT = { timeout: 5000 };
const BOOKING_ID = 'c0c1d2e3-0000-4000-8000-000000000008';
const STEPS = { steps: [{ id: 'confirm-departure', label: 'Conferma partenza ospite', status: 'complete' }] };

/** Stay dates (ISO, midnight UTC) relative to today in Europe/Rome. */
const stayDay = (days: number) => `${addDays(todayInRome(), days)}T00:00:00Z`;

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: BOOKING_ID,
  propertyId: 'property-1',
  userId: 'auth0|host',
  checkInDate: stayDay(-2),
  checkOutDate: stayDay(0),
  numberOfGuests: 2,
  totalPrice: 300,
  currency: 'EUR',
  status: 'CheckedIn',
  source: 'Manual',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '', country: 'IT' },
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
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
        createElement(MemoryRouter, { initialEntries: [`/app/short-rent/bookings/${BOOKING_ID}/checkout`] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/bookings/:id/checkout', element: createElement(CheckoutWizardPage) }),
            createElement(Route, {
              path: '/app/short-rent/bookings/:id',
              element: createElement('div', { 'data-testid': 'booking-detail-stub' }),
            }),
          )))),
  );
}

async function completeTheCheckOut() {
  fireEvent.click(await screen.findByTestId('checkout-confirm-departure', undefined, WAIT));
  fireEvent.click(screen.getByTestId('checkout-complete-button'));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: true } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);
  vi.mocked(startCheckoutWizard).mockResolvedValue(STEPS as Awaited<ReturnType<typeof startCheckoutWizard>>);
  vi.mocked(completeCheckoutWizard).mockResolvedValue({ propertyReady: true, bookingStatus: 'CheckedOut' });
});

describe('CheckoutWizardPage', { timeout: 20000 }, () => {
  it('CheckoutWizardPage_CheckedInStay_StartsThenCompletesTheCheckOut', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());

    renderPage();
    await completeTheCheckOut();

    await waitFor(() => expect(completeCheckoutWizard).toHaveBeenCalledWith(BOOKING_ID, expect.objectContaining({ confirmDeparture: true })));
    // Same path as the app and POST /check-out: start first, then complete.
    expect(startCheckoutWizard).toHaveBeenCalledTimes(1);
    expect(startCheckoutWizard).toHaveBeenCalledWith(BOOKING_ID);
    expect(vi.mocked(startCheckoutWizard).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(completeCheckoutWizard).mock.invocationCallOrder[0],
    );
    expect(await screen.findByTestId('booking-detail-stub', undefined, WAIT)).toBeInTheDocument();
  });

  it('CheckoutWizardPage_ConfirmedWithoutArrival_RegistersTheArrivalAndProceeds', async () => {
    vi.mocked(bookingsApi.getById)
      .mockResolvedValueOnce(booking({ status: 'Confirmed' }))
      .mockResolvedValue(booking({ status: 'CheckedIn' }));
    vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: false } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);

    renderPage();

    // Not a dead end: the arrival can be confirmed here, with the missing guest data flagged but not blocking.
    expect(await screen.findByTestId('checkout-arrival-missing', undefined, WAIT)).toBeInTheDocument();
    expect(await screen.findByTestId('guest-data-incomplete', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-complete-button')).not.toBeInTheDocument();
    expect(startCheckoutWizard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('checkout-register-arrival'));
    await completeTheCheckOut();

    await waitFor(() => expect(completeCheckoutWizard).toHaveBeenCalledTimes(1));
    expect(startCheckoutWizard).toHaveBeenCalledTimes(1);
    expect(startCheckoutWizard).toHaveBeenCalledWith(BOOKING_ID, { registerArrival: true });
  });

  it('CheckoutWizardPage_StartRejected_ShowsTheApiErrorAndNoForm', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking());
    vi.mocked(startCheckoutWizard).mockRejectedValue(
      axiosError(422, { status: 422, code: 'booking_checkout_too_early', detail: 'Troppo presto.' }),
    );

    renderPage();

    expect(await screen.findByRole('alert', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.bookingCheckoutTooEarly'),
    );
    expect(screen.queryByTestId('checkout-complete-button')).not.toBeInTheDocument();
    expect(completeCheckoutWizard).not.toHaveBeenCalled();
  });

  it('CheckoutWizardPage_ConfirmedBookingBeforeItsCheckInDay_IsUnavailable', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(
      booking({ status: 'Confirmed', checkInDate: stayDay(2), checkOutDate: stayDay(4) }),
    );

    renderPage();

    expect(await screen.findByTestId('checkout-unavailable', undefined, WAIT)).toBeInTheDocument();
    expect(startCheckoutWizard).not.toHaveBeenCalled();
  });

  it('CheckoutWizardPage_StayAlreadyCheckedOut_SaysItIsDone', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(booking({ status: 'CheckedOut' }));

    renderPage();

    expect(await screen.findByTestId('checkout-already-done', undefined, WAIT)).toBeInTheDocument();
    expect(startCheckoutWizard).not.toHaveBeenCalled();
  });
});
