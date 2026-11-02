import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import type { PublicStayCard, PublicStaysResult } from '@/types/public-stays.types';
import { SearchPage } from '../search-page';

vi.mock('@/api/public-site-search.api', () => ({
  publicSiteSearchApi: {
    getPlatformStays: vi.fn(),
    getPlatformDestinations: vi.fn(),
    getPlatformCalendar: vi.fn(),
    getStays: vi.fn(),
    getDestinations: vi.fn(),
    getSiteCalendar: vi.fn(),
  },
}));

function card(overrides: Partial<PublicStayCard> = {}): PublicStayCard {
  return {
    id: 'p-1',
    slug: 'casa-del-faro',
    name: 'Casa del Faro',
    comune: 'Camogli',
    latitude: 44.35,
    longitude: 9.15,
    photos: [],
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    amenities: [],
    tags: [],
    availability: { available: true },
    price: { currency: 'EUR', perNightCents: 12000 },
    orgSlug: 'villa-mare',
    hostName: 'Villa Mare',
    country: 'IT',
    ...overrides,
  };
}

function result(items: PublicStayCard[], overrides: Partial<PublicStaysResult> = {}): PublicStaysResult {
  return {
    currency: 'EUR',
    adults: 2,
    children: 0,
    pets: false,
    totalCount: items.length,
    availableCount: items.length,
    page: 1,
    pageSize: 24,
    items,
    alternatives: [],
    unsupportedFilters: [],
    generatedAt: '2030-06-01T08:00:00Z',
    facets: { maxGuests: 6, petsAllowed: true, tags: [], currency: 'EUR' },
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderSearch(entry = '/search') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route
              path="/search"
              element={
                <>
                  <SearchPage />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('SearchPage (SEARCH-GLOBAL): the public search across all the booking sites', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(publicSiteSearchApi.getPlatformStays).mockResolvedValue(result([card()]));
    vi.mocked(publicSiteSearchApi.getPlatformDestinations).mockResolvedValue([]);
    vi.mocked(publicSiteSearchApi.getPlatformCalendar).mockResolvedValue({
      from: '2030-01-01',
      to: '2031-01-01',
      today: '2030-01-01',
      currency: 'EUR',
      adults: 2,
      children: 0,
      days: [],
      generatedAt: '2030-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('SearchPage_Results_LinkEachHomeToTheSiteOfItsHostAndNameTheHost', async () => {
    vi.mocked(publicSiteSearchApi.getPlatformStays).mockResolvedValue(
      result([card(), card({ id: 'p-2', slug: null, name: 'Baita Verde', orgSlug: 'casa-monti', hostName: 'Casa Monti' })]),
    );
    renderSearch();

    const homes = await screen.findAllByTestId('house-card');
    expect(homes).toHaveLength(2);
    expect(within(homes[0]).getByRole('link', { name: 'Casa del Faro' })).toHaveAttribute('href', '/book/villa-mare/property/casa-del-faro');
    // A home without slug is reached by its id, on the site of its own host.
    expect(within(homes[1]).getByRole('link', { name: 'Baita Verde' })).toHaveAttribute('href', '/book/casa-monti/property/p-2');
    expect(within(homes[0]).getByTestId('house-card-host')).toHaveTextContent('Villa Mare');
    expect(within(homes[1]).getByTestId('house-card-host')).toHaveTextContent('Casa Monti');
    // The hearts belong to a booking site: across all of them there are none.
    expect(screen.queryByTestId('favorite-button')).not.toBeInTheDocument();
  });

  it('SearchPage_PlaceAndDatesInTheAddress_AreAskedOfTheServerAndCarriedToTheHome', async () => {
    renderSearch('/search?where=Como&checkin=2030-07-01&checkout=2030-07-05&guests=3&children=1');

    const link = await screen.findByRole('link', { name: 'Casa del Faro' });

    expect(publicSiteSearchApi.getPlatformStays).toHaveBeenCalledWith(
      expect.objectContaining({ where: 'Como', checkIn: '2030-07-01', checkOut: '2030-07-05', adults: 2, children: 1 }),
    );
    // The guest never chooses the dates twice: the page of the home opens with them.
    expect(link).toHaveAttribute('href', '/book/villa-mare/property/casa-del-faro?checkin=2030-07-01&checkout=2030-07-05&guests=3&children=1');
  });

  it('SearchPage_TheOldCityParameter_StillOpensTheSameSearch', async () => {
    renderSearch('/search?city=Como&guests=2');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('where=Como'));
    expect(screen.getByTestId('location')).not.toHaveTextContent('city=');
    await waitFor(() => expect(publicSiteSearchApi.getPlatformStays).toHaveBeenCalledWith(expect.objectContaining({ where: 'Como' })));
  });

  it('SearchPage_AHomeInSwitzerland_IsPricedInFrancsAndNamesItsCountry', async () => {
    vi.mocked(publicSiteSearchApi.getPlatformStays).mockResolvedValue(
      result([card({ id: 'p-3', slug: 'chalet', name: 'Chalet Ticino', comune: 'Lugano', country: 'CH', price: { currency: 'CHF', perNightCents: 20000 } })], {
        facets: { maxGuests: 6, petsAllowed: true, tags: [], currency: 'CHF' },
      }),
    );
    renderSearch();

    const home = await screen.findByTestId('house-card');

    expect(within(home).getByTestId('house-card-price')).toHaveTextContent('CHF');
    expect(within(home).getByTestId('house-card-price')).not.toHaveTextContent('€');
    expect(home).toHaveTextContent('Lugano, Svizzera');
  });

  it('SearchPage_MoreFreeHomesThanAPage_OffersTheNextPageAndSaysHowFarItIs', async () => {
    vi.mocked(publicSiteSearchApi.getPlatformStays).mockResolvedValue(result([card()], { availableCount: 40, totalCount: 40 }));
    renderSearch();

    expect(await screen.findByTestId('search-more-button')).toBeInTheDocument();
    expect(screen.getByTestId('search-more')).toHaveTextContent('Stai vedendo 1 case su 40');
  });

  it('SearchPage_ASearchIsNotIndexedButItsLinksAreFollowed_TheBasePageIsLeftToTheCrawlers', async () => {
    renderSearch('/search?where=Como');
    await screen.findAllByTestId('house-card');
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');

    cleanup();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();

    renderSearch('/search');
    await screen.findAllByTestId('house-card');
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('SearchPage_NoFreeHome_SaysSoWithoutTalkingOfOneHostAndOffersTheNearbyDates', async () => {
    vi.mocked(publicSiteSearchApi.getPlatformStays).mockResolvedValue(
      result([], {
        totalCount: 3,
        availableCount: 0,
        alternatives: [{ checkIn: '2030-07-03', checkOut: '2030-07-07', availableCount: 2, fromPerNightCents: 11000 }],
      }),
    );
    renderSearch('/search?checkin=2030-07-01&checkout=2030-07-05&guests=2');

    const nothing = await screen.findByTestId('search-no-results');

    expect(nothing).toHaveAttribute('data-reason', 'dates');
    expect(within(nothing).getByTestId('search-alternative')).toBeInTheDocument();
    // There is no one host to write to across all the sites.
    expect(screen.queryByTestId('search-write')).not.toBeInTheDocument();
  });
});
