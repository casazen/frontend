import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
import { BookingCreatePage } from '../booking-create-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { create: vi.fn(), quote: vi.fn() },
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

const property = { id: 'property-1', name: 'Casa Mare', city: 'Rimini' } as Property;
// Rendering the whole form with the zod resolver can be slow on a loaded CI runner.
const WAIT = { timeout: 5000 };

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

/** Quote of the backend (BK-03): Firenze-like rates exempt minors by age when `ageRules` is true. */
function hostQuote(ageRules: boolean, status: DirectBookingQuote['touristTax']['status'] = 'Calculated'): DirectBookingQuote {
  return {
    propertyId: property.id,
    checkInDate: '2027-10-01',
    checkOutDate: '2027-10-05',
    nights: 4,
    nightlyRate: 100,
    lodgingTotal: 400,
    cleaningFee: 50,
    basePrice: 450,
    touristTax: {
      status,
      amount: status === 'Calculated' ? 24 : null,
      taxableNights: 4,
      ageRulesApply: ageRules,
      categories: [],
    },
    totalPrice: status === 'Calculated' ? 474 : 450,
    currency: 'EUR',
  } as DirectBookingQuote;
}

function renderPage(url = '/app/short-rent/bookings/new') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [url] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/bookings/new', element: createElement(BookingCreatePage) }),
            createElement(Route, { path: '/app/short-rent/bookings', element: createElement('p', null, 'bookings-list') }),
            createElement(Route, { path: '/app/short-rent/properties/:id', element: createElement('p', null, 'property-page') }),
          )))),
  );
}

async function fillAndSubmit() {
  await fillForm();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('booking.form.create') }));
}

async function fillForm() {
  const select = await screen.findByLabelText(i18n.t('booking.form.property'), undefined, WAIT);
  await screen.findByRole('option', { name: 'Casa Mare - Rimini' }, WAIT);
  fireEvent.change(select, { target: { value: property.id } });
  const fields: [string, string][] = [
    ['booking.form.checkInDate', '2027-10-01'],
    ['booking.form.checkOutDate', '2027-10-05'],
    ['booking.form.numberOfGuests', '2'],
    ['booking.form.firstName', 'Mario'],
    ['booking.form.lastName', 'Rossi'],
    ['booking.form.email', 'mario.rossi@example.com'],
    ['booking.form.phone', '+393331234567'],
    ['booking.form.country', 'Italia'],
  ];
  for (const [label, value] of fields)
    fireEvent.change(screen.getByLabelText(i18n.t(label)), { target: { value } });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property]);
  vi.mocked(bookingsApi.quote).mockResolvedValue(hostQuote(false, 'RateUnavailable'));
});

describe('BookingCreatePage', { timeout: 20000 }, () => {
  it('tells the host that the booking is saved as confirmed with the manual source', async () => {
    renderPage();

    expect(await screen.findByTestId('booking-manual-notice', undefined, WAIT)).toHaveTextContent(i18n.t('booking.form.manualNotice'));
  });

  it('shows the 409 on overlapping dates next to the form and stays on the page', async () => {
    vi.mocked(bookingsApi.create).mockRejectedValue(
      conflict({ status: 409, code: 'booking_dates_unavailable', detail: "L'immobile non è disponibile." }),
    );
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.bookingDatesUnavailable'),
    );
    expect(bookingsApi.create).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: property.id,
      checkInDate: '2027-10-01',
      checkOutDate: '2027-10-05',
    }));
    expect(screen.queryByText('bookings-list')).not.toBeInTheDocument();
  });

  it('goes back to the list once the booking is created', async () => {
    vi.mocked(bookingsApi.create).mockResolvedValue({ id: 'booking-1', status: 'Confirmed', source: 'Manual' } as Booking);
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByText('bookings-list', undefined, WAIT)).toBeInTheDocument();
  });

  it('BookingCreatePage_RatesExemptMinorsByAge_AsksMinorsAndAgesAndSendsThem', async () => {
    vi.mocked(bookingsApi.quote).mockResolvedValue(hostQuote(true));
    vi.mocked(bookingsApi.create).mockResolvedValue({ id: 'booking-1', status: 'Confirmed', source: 'Manual' } as Booking);
    renderPage();

    await fillForm();
    const children = await screen.findByLabelText(i18n.t('booking.form.numberOfChildren'), undefined, WAIT);
    expect(await screen.findByTestId('booking-price-total', undefined, WAIT)).toHaveTextContent('474,00');
    fireEvent.change(children, { target: { value: '1' } });
    const age = await screen.findByLabelText(i18n.t('touristTaxRules.childAgeLabel', { index: 1 }), undefined, WAIT);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('booking.form.create') }));
    expect(await screen.findByTestId('booking-ages-missing', undefined, WAIT)).toBeInTheDocument();
    expect(bookingsApi.create).not.toHaveBeenCalled();

    fireEvent.change(age, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('booking.form.create') }));

    await waitFor(() => expect(bookingsApi.create).toHaveBeenCalledWith(expect.objectContaining({
      numberOfGuests: 2,
      numberOfChildren: 1,
      childrenAges: [8],
    })), WAIT);
    expect(bookingsApi.quote).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: property.id,
      numberOfGuests: 2,
      numberOfChildren: 1,
      childrenAges: [8],
    }));
  });

  it('BookingCreatePage_OpenedFromAProperty_PreselectsItAndCancelGoesBackToIt', async () => {
    renderPage(`/app/short-rent/bookings/new?propertyId=${property.id}`);

    await screen.findByRole('option', { name: 'Casa Mare - Rimini' }, WAIT);
    await waitFor(() => expect(screen.getByLabelText(i18n.t('booking.form.property'))).toHaveValue(property.id), WAIT);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('booking.form.cancel') }));

    expect(await screen.findByText('property-page', undefined, WAIT)).toBeInTheDocument();
    expect(bookingsApi.create).not.toHaveBeenCalled();
  });

  it('shows the properties load error instead of an empty select', async () => {
    vi.mocked(propertiesApi.getAll).mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('booking-properties-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('booking.form.propertiesLoadError'),
    );
    expect(screen.queryByTestId('booking-properties-empty')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(i18n.t('booking.form.property'))).toBeDisabled(), WAIT);
  });
});
