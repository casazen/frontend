import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { publicBookingApi } from '@/api/public-booking.api';
import { PublicPropertyPage } from '../public-property-page';
import type { PublicOrgDto, PublicPropertyDetailDto } from '@/types';

vi.mock('@/api/public-org.api', () => ({
  publicOrgApi: { getOrgProperty: vi.fn() },
}));
vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: { getPropertyAvailability: vi.fn() },
}));

// The page lazy-loads the gallery and the widget: explicit conditions only, with a generous ceiling.
configure({ asyncUtilTimeout: 5_000 });

const org = { slug: 'demo-casazen', displayName: 'Demo Casazen Stays' } as unknown as PublicOrgDto;
const PROPERTY_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';
const PROPERTY_SLUG = 'villa-mare';

const property: PublicPropertyDetailDto = {
  id: PROPERTY_ID,
  slug: PROPERTY_SLUG,
  name: 'Villa Mare',
  description: 'Vista mare.',
  city: 'Napoli',
  postalCode: '80100',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 100,
  cleaningFee: 40,
  amenities: [],
  photoUrls: [],
  cinCode: 'IT063049C2ABCDEFGH',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
  houseRules: '',
  cancellationPolicySummary: '',
  minNights: null,
  currency: 'EUR',
};

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), public: true };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

function renderPage(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/book/demo-casazen/property/${PROPERTY_SLUG}${search}`]}>
        <Routes>
          <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
            <Route path="property/:propertySlugOrId" element={<PublicPropertyPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PublicPropertyPage availability', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Only the clock: "today" in Europe/Rome is 5 October 2026, timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue(property);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('PublicPropertyPage_SlugUrl_LoadsAvailabilityByPropertyId', async () => {
    vi.mocked(publicBookingApi.getPropertyAvailability).mockResolvedValue({
      propertyId: PROPERTY_ID,
      startDate: '2026-10-05',
      endDate: '2027-10-05',
      bookedDates: [],
    });

    renderPage();

    await screen.findByTestId('availability-days');
    expect(publicOrgApi.getOrgProperty).toHaveBeenCalledWith('demo-casazen', PROPERTY_SLUG);
    // R-03: the route of the API takes the id; the slug of the page URL answered 400 and the calendar never loaded.
    expect(publicBookingApi.getPropertyAvailability).toHaveBeenCalledTimes(1);
    expect(vi.mocked(publicBookingApi.getPropertyAvailability).mock.calls[0][0]).toBe(PROPERTY_ID);
  });

  it('PublicPropertyPage_WithBookedNights_ShowsThemTakenAndBlocksAStayOverThem', async () => {
    vi.mocked(publicBookingApi.getPropertyAvailability).mockResolvedValue({
      propertyId: PROPERTY_ID,
      startDate: '2026-10-05T00:00:00Z',
      endDate: '2026-10-25T00:00:00Z',
      bookedDates: ['2026-10-10', '2026-10-11'],
    });

    renderPage('?checkIn=2026-10-09&checkOut=2026-10-12&guests=2');

    const days = await screen.findByTestId('availability-days');
    const day = (date: string) => days.querySelector(`[data-date="${date}"]`) as HTMLElement;
    expect(day('2026-10-10')).toHaveAttribute('data-booked', 'true');
    expect(day('2026-10-10')).toHaveAttribute('aria-label', '10 ottobre 2026: occupato');
    expect(day('2026-10-11')).toHaveAttribute('data-booked', 'true');
    expect(day('2026-10-12')).toHaveAttribute('data-booked', 'false');
    expect(day('2026-10-12')).toHaveAttribute('aria-label', '12 ottobre 2026: libero');
    expect(within(days).getAllByLabelText(/: occupato$/)).toHaveLength(2);
    // Past days and days after the loaded range have no status: never shown free.
    expect(day('2026-10-04')).not.toHaveAttribute('data-booked');
    expect(day('2026-10-04')).toHaveAttribute('aria-label', '4 ottobre 2026');
    expect(day('2026-10-24')).toHaveAttribute('data-booked', 'false');
    expect(day('2026-10-25')).not.toHaveAttribute('data-booked');
    expect(day('2026-10-25')).toHaveAttribute('aria-label', '25 ottobre 2026');

    expect(screen.getByTestId('booking-widget-dates-taken')).toHaveTextContent('prenotate');
    expect(screen.getByRole('button', { name: 'Procedi al checkout' })).toBeDisabled();
  });

  it('PublicPropertyPage_StayEndingOnBookedNight_CanCheckOutThatDay', async () => {
    vi.mocked(publicBookingApi.getPropertyAvailability).mockResolvedValue({
      propertyId: PROPERTY_ID,
      startDate: '2026-10-05',
      endDate: '2027-10-05',
      bookedDates: ['2026-10-10', '2026-10-11'],
    });

    // Check-out on the 10th, when the next guest arrives: same-day turnover, as the checkout allows.
    renderPage('?checkIn=2026-10-08&checkOut=2026-10-10&guests=2');

    await screen.findByTestId('availability-days');
    expect(screen.queryByTestId('booking-widget-dates-taken')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Procedi al checkout' })).toBeEnabled();
  });

  it('PublicPropertyPage_AvailabilityError_ShowsErrorAndRetryInsteadOfFreeNights', async () => {
    vi.mocked(publicBookingApi.getPropertyAvailability)
      .mockRejectedValueOnce(problemError(429, { code: 'rate_limited', detail: 'x y' }))
      .mockResolvedValueOnce({
        propertyId: PROPERTY_ID,
        startDate: '2026-10-05',
        endDate: '2027-10-05',
        bookedDates: ['2026-10-20'],
      });

    renderPage('?checkIn=2026-10-19&checkOut=2026-10-21&guests=2');

    const error = await screen.findByTestId('availability-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('Le date scelte verranno comunque verificate prima del pagamento.');
    // Never "everything free": no day is shown, taken or free, while the availability is unknown.
    expect(screen.queryByTestId('availability-days')).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText(/: libero$/)).toHaveLength(0);

    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    const days = await screen.findByTestId('availability-days');
    expect(publicBookingApi.getPropertyAvailability).toHaveBeenCalledTimes(2);
    expect(days.querySelector('[data-date="2026-10-20"]')).toHaveAttribute('data-booked', 'true');
    await waitFor(() => expect(screen.queryByTestId('availability-error')).not.toBeInTheDocument());
    expect(screen.getByTestId('booking-widget-dates-taken')).toBeInTheDocument();
  });

  it('PublicPropertyPage_PropertyNoLongerPublished_ShowsTheReasonOfTheCode', async () => {
    vi.mocked(publicBookingApi.getPropertyAvailability).mockRejectedValue(
      problemError(404, { code: 'public_property_not_found', detail: 'x y' }),
    );

    renderPage();

    const error = await screen.findByTestId('availability-error');
    expect(error).toHaveTextContent('Questo alloggio non è disponibile per la prenotazione online.');
    expect(screen.queryByTestId('availability-days')).not.toBeInTheDocument();
  });
});
