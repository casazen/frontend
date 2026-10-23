import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { NOON_UTC, freezeClock } from '@/test/clock';
import type { ManualBooking, Property, StayAvailability } from '@/types';
import type { DirectBookingQuote } from '@/types/direct-booking.types';
import { BookingCreatePage } from '../booking-create-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { createManual: vi.fn(), quote: vi.fn(), availability: vi.fn() },
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

const property = { id: 'property-1', name: 'Casa Mare', city: 'Rimini', maxGuests: 6 } as Property;
// Rendering the wizard with the zod resolver can be slow on a loaded CI runner.
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

/** The dates are free (SR-06a): the answer of the availability the wizard asks for as soon as the dates are known. */
const freeStay: StayAvailability = {
  propertyId: property.id,
  from: '2027-10-01',
  to: '2027-10-05',
  state: 'ok',
  invalidReason: null,
  nights: 4,
  minNights: null,
  conflicts: [],
  nearestFreeWindow: null,
  linkableBlockId: null,
};

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

const next = () => fireEvent.click(screen.getByTestId('booking-wizard-next'));
const label = (key: string) => screen.getByLabelText(i18n.t(key));

/** Step 1: the property and the dates (the guests stay at the two adults it starts with). */
async function fillStay() {
  const select = await screen.findByLabelText(i18n.t('booking.create.stay.property'), undefined, WAIT);
  await screen.findByRole('option', { name: 'Casa Mare · Rimini' }, WAIT);
  fireEvent.change(select, { target: { value: property.id } });
  fireEvent.change(label('booking.create.stay.checkIn'), { target: { value: '2027-10-01' } });
  fireEvent.change(label('booking.create.stay.checkOut'), { target: { value: '2027-10-05' } });
}

/** Step 2: the name and the email of the guest are all that is asked (SR-06a). */
async function fillGuest() {
  const name = await screen.findByLabelText(i18n.t('booking.create.guest.name'), undefined, WAIT);
  fireEvent.change(name, { target: { value: 'Mario Rossi' } });
  fireEvent.change(label('booking.create.guest.email'), { target: { value: 'mario.rossi@example.com' } });
}

/** Through the two first steps, to the summary with the price. */
async function reachSummary() {
  await fillStay();
  next();
  await fillGuest();
  next();
  await screen.findByTestId('booking-price-total', undefined, WAIT);
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  freezeClock(NOON_UTC);
  await i18n.changeLanguage('it');
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property]);
  vi.mocked(bookingsApi.quote).mockResolvedValue(hostQuote(false));
  vi.mocked(bookingsApi.availability).mockResolvedValue(freeStay);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BookingCreatePage', { timeout: 20000 }, () => {
  it('shows the 409 on overlapping dates above the buttons and stays on the summary', async () => {
    vi.mocked(bookingsApi.createManual).mockRejectedValue(
      conflict({ status: 409, code: 'booking_dates_unavailable', detail: "L'immobile non è disponibile." }),
    );
    renderPage();

    await reachSummary();
    expect(screen.getByTestId('booking-manual-notice')).toHaveTextContent(i18n.t('booking.form.manualNotice'));
    fireEvent.click(screen.getByTestId('booking-create-button'));

    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.bookingDatesUnavailable'),
    );
    expect(bookingsApi.createManual).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: property.id,
      checkInDate: '2027-10-01',
      checkOutDate: '2027-10-05',
      adults: 2,
      children: 0,
      guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario.rossi@example.com' },
    }));
    expect(screen.queryByTestId('wizard-done-primary')).not.toBeInTheDocument();
  });

  it('confirms with what happens now and a link to the booking once it is created', async () => {
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'booking-1', status: 'Confirmed', source: 'Manual' } as ManualBooking);
    renderPage();

    await reachSummary();
    expect(screen.getByTestId('booking-price-total')).toHaveTextContent('474,00');
    fireEvent.click(screen.getByTestId('booking-create-button'));

    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toHaveAttribute('href', '/app/short-rent/bookings/booking-1');
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/short-rent/bookings');
  });

  it('BookingCreatePage_RatesExemptMinorsByAge_AsksMinorsAndAgesAndSendsThem', async () => {
    vi.mocked(bookingsApi.quote).mockResolvedValue(hostQuote(true));
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'booking-1', status: 'Confirmed', source: 'Manual' } as ManualBooking);
    renderPage();

    await fillStay();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('qty.increase', { label: i18n.t('booking.create.stay.minors') }) }));
    const age = await screen.findByLabelText(i18n.t('touristTaxRules.childAgeLabel', { index: 1 }), undefined, WAIT);

    // The step does not move on while the age of the minor is missing.
    next();
    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(i18n.t('booking.form.childrenAgesMissing'));
    expect(screen.queryByLabelText(i18n.t('booking.create.guest.name'))).not.toBeInTheDocument();

    fireEvent.change(age, { target: { value: '8' } });
    next();
    await fillGuest();
    next();
    await screen.findByTestId('booking-price-total', undefined, WAIT);
    fireEvent.click(screen.getByTestId('booking-create-button'));

    await waitFor(() => expect(bookingsApi.createManual).toHaveBeenCalledWith(expect.objectContaining({
      adults: 2,
      children: 1,
      childrenAges: [8],
    })), WAIT);
    expect(bookingsApi.quote).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: property.id,
      numberOfGuests: 3,
      numberOfChildren: 1,
      childrenAges: [8],
    }));
  });

  it('BookingCreatePage_OpenedFromAProperty_PreselectsItAndCancelGoesBackToIt', async () => {
    renderPage(`/app/short-rent/bookings/new?propertyId=${property.id}`);

    await screen.findByRole('option', { name: 'Casa Mare · Rimini' }, WAIT);
    await waitFor(() => expect(label('booking.create.stay.property')).toHaveValue(property.id), WAIT);
    fireEvent.click(screen.getByTestId('wizard-exit'));

    expect(await screen.findByText('property-page', undefined, WAIT)).toBeInTheDocument();
    expect(bookingsApi.createManual).not.toHaveBeenCalled();
  });

  it('shows the properties load error instead of an empty select', async () => {
    vi.mocked(propertiesApi.getAll).mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('booking-properties-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('booking.form.propertiesLoadError'),
    );
    expect(screen.queryByTestId('booking-properties-empty')).not.toBeInTheDocument();
    await waitFor(() => expect(label('booking.create.stay.property')).toBeDisabled(), WAIT);
  });
});
