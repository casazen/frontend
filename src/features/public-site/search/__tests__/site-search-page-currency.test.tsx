import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, configure, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import i18n from '@/i18n/config';
import { freezeClock } from '@/test/clock';
import type { PublicOrgDto } from '@/types';
import type { PublicStayCard, PublicStaysResult } from '@/types/public-stays.types';
import { SiteSearchPage } from '../site-search-page';

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

configure({ asyncUtilTimeout: 5_000 });

/**
 * CHF-MONEY, the results page of a booking site opened on an address that has a price range (`?minPrice=100&maxPrice=300`, a link, a reload, the frame of a
 * widget): the chip of the price is written in the currency of the homes, and the homes the page learns it from (`every home of the site`, a call of its own) can
 * arrive after the list. Until they do the currency is not known, which is not «the homes say no currency»: no chip of the price is drawn and nothing says that the
 * currency is not available. Then the chip is in the currency of the homes (euros, or francs), never a euro nobody said.
 */
const org = { slug: 'demo', displayName: 'Demo Stays', hostName: 'Demo', contactEmail: null, marketingConsentVersion: null } as unknown as PublicOrgDto;

function stay(id: string, currency: string): PublicStayCard {
  return {
    id,
    name: `Casa ${id}`,
    comune: 'Lugano',
    latitude: 46,
    longitude: 8.95,
    photos: [],
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    amenities: [],
    tags: [],
    availability: { available: true },
    price: { currency, perNightCents: 24000 },
  };
}

function found(items: PublicStayCard[]): PublicStaysResult {
  return {
    currency: items[0]?.price.currency ?? 'EUR',
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
    generatedAt: '2026-10-05T08:00:00Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** The list of the page is the call with the price of the address; the homes of the controls are the call with no filters. */
const isTheList = (query: object) => 'minPrice' in query;

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/book/demo/search?minPrice=100&maxPrice=300']}>
        <Routes>
          <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
            <Route path="search" element={<SiteSearchPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('the chip of the price of the results of a site', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Only the clock is frozen; timers stay real.
    freezeClock('2026-10-05T10:00:00Z');
    await i18n.changeLanguage('it');
    vi.mocked(publicSiteSearchApi.getDestinations).mockResolvedValue([]);
    vi.mocked(publicSiteSearchApi.getSiteCalendar).mockResolvedValue({
      from: '2026-10-05',
      to: '2027-10-05',
      today: '2026-10-05',
      currency: 'EUR',
      adults: 2,
      children: 0,
      days: [],
      generatedAt: '2026-10-05T08:00:00Z',
    });
  });

  afterEach(async () => {
    cleanup();
    vi.useRealTimers();
    await i18n.changeLanguage('it');
  });

  it.each([
    ['euros', 'EUR', /da 100 € a 300 €/, 'CHF'],
    ['francs', 'CHF', /da 100 CHF a 300 CHF/, '€'],
  ] as const)('SiteSearchPage_HomesOfTheControlsAfterTheList_%s_NoChipUntilTheyAreInThenTheCurrencyOfTheHomes', async (_name, currency, chip, other) => {
    const homes = deferred<PublicStaysResult>();
    vi.mocked(publicSiteSearchApi.getStays).mockImplementation((_slug, query) => (isTheList(query) ? Promise.resolve(found([stay('a', currency)])) : homes.promise));
    renderPage();

    // The list is in; the homes the controls (and the currency of the chip) are worked out from are not.
    await screen.findAllByTestId('house-card');
    expect(screen.queryByTestId('search-active-filters')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('valuta non disponibile');

    await act(async () => {
      homes.resolve(found([stay('a', currency), stay('b', currency)]));
    });

    const chips = await screen.findByTestId('search-active-filters');
    expect(chips).toHaveTextContent(chip);
    expect(chips).not.toHaveTextContent(other);
    expect(document.body).not.toHaveTextContent('valuta non disponibile');
  });

  it('SiteSearchPage_HomesOfTwoCurrencies_ChipWithTheNumbersAloneAndNoPhrase', async () => {
    vi.mocked(publicSiteSearchApi.getStays).mockImplementation((_slug, query) =>
      Promise.resolve(isTheList(query) ? found([stay('a', 'EUR')]) : found([stay('a', 'EUR'), stay('b', 'CHF')])),
    );
    renderPage();

    const chips = await screen.findByTestId('search-active-filters');
    expect(chips).toHaveTextContent('da 100 a 300');
    expect(chips).not.toHaveTextContent(/€|EUR|CHF|disponibile/);
  });

  it('SiteSearchPage_HomesOfTheControlsThatCouldNotBeRead_EndTheWaitAndTheChipSaysTheCurrencyIsNotAvailable', async () => {
    // The wait ends with the answer, whatever it is: a failed call does not hide the chip of a filter that is on for ever. The data say no currency, and the chip says so.
    vi.mocked(publicSiteSearchApi.getStays).mockImplementation((_slug, query) =>
      isTheList(query) ? Promise.resolve(found([stay('a', 'EUR')])) : Promise.reject(new Error('offline')),
    );
    renderPage();

    await screen.findAllByTestId('house-card');
    const chips = await screen.findByTestId('search-active-filters');
    expect(chips).toHaveTextContent('da 100 (valuta non disponibile) a 300 (valuta non disponibile)');
  });
});
