import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { publicBookingApi } from '@/api/public-booking.api';
import { freezeClock } from '@/test/clock';
import { addDays } from '@/lib/stay-dates';
import { PublicPropertyPage } from '../public-property-page';
import type { PublicCalendarDto, PublicOrgDto, PublicPropertyDetailDto } from '@/types';

vi.mock('@/api/public-org.api', () => ({
  publicOrgApi: { getOrgProperty: vi.fn(), getOrgProperties: vi.fn(), getOrgPropertyCalendar: vi.fn() },
}));
vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: { quoteDirectBooking: vi.fn() },
}));

// The page lazy-loads the amenity list: explicit conditions only, with a generous ceiling.
configure({ asyncUtilTimeout: 5_000 });

const TODAY = '2026-10-05';
const org = { slug: 'demo-casazen', displayName: 'Demo Casazen Stays', contactEmail: null } as unknown as PublicOrgDto;
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

const calendar: PublicCalendarDto = {
  propertyId: PROPERTY_ID,
  startDate: TODAY,
  endDate: addDays(TODAY, 60),
  today: TODAY,
  currency: 'EUR',
  generatedAt: `${TODAY}T08:00:00Z`,
  days: Array.from({ length: 60 }, (_, offset) => ({ date: addDays(TODAY, offset), available: true, nightlyPriceCents: 10000, minNights: 1 })),
};

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

describe('PublicPropertyPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Only the clock: "today" in Europe/Rome is 5 October 2026, timers stay real.
    freezeClock(`${TODAY}T10:00:00Z`);
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue(property);
    vi.mocked(publicOrgApi.getOrgProperties).mockResolvedValue([]);
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('PublicPropertyPage_SlugUrl_LoadsTheHomeAndItsCalendarWithoutAskingAQuote', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Villa Mare' });
    await waitFor(() => expect(publicOrgApi.getOrgPropertyCalendar).toHaveBeenCalledTimes(1));
    expect(publicOrgApi.getOrgProperty).toHaveBeenCalledWith('demo-casazen', PROPERTY_SLUG);
    // The route of the calendar takes the slug of the page as well as the id (DB-03b).
    expect(vi.mocked(publicOrgApi.getOrgPropertyCalendar).mock.calls[0][1]).toBe(PROPERTY_SLUG);
    // With no dates chosen there is nothing to price: the server is not asked.
    expect(publicBookingApi.quoteDirectBooking).not.toHaveBeenCalled();
  });

  it('PublicPropertyPage_HomeWithoutRichData_ShowsNoEmptyBlocks', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Villa Mare' });
    // A home with nothing but the basics has no energy scale, plan, zone or rules block: nothing is shown that the host did not say.
    expect(screen.queryByTestId('property-energy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-floor-plan')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-zone')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-rules')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-host')).not.toBeInTheDocument();
  });
});
