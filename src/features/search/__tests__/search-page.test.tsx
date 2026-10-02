import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { propertiesApi } from '@/api/properties.api';
import type { PublicPropertyDto } from '@/types';
import { SearchPage } from '../search-page';

vi.mock('@/api/properties.api', () => ({ propertiesApi: { search: vi.fn() } }));

function property(overrides: Partial<PublicPropertyDto> = {}): PublicPropertyDto {
  return {
    id: 'p-1',
    slug: 'casa-del-faro',
    orgSlug: 'villa-mare',
    name: 'Casa del Faro',
    description: 'Vista mare',
    city: 'Camogli',
    postalCode: '16032',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    nightlyRate: 120,
    cleaningFee: 30,
    amenities: [],
    photoUrls: [],
    cinCode: null,
    cinStatus: 'Missing',
    timezone: 'Europe/Rome',
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
            <Route path="/search" element={<><SearchPage /><LocationProbe /></>} />
            <Route path="/book/:orgSlug/property/:slug" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const input = (id: string) => document.getElementById(id) as HTMLInputElement;

describe('SearchPage (BK-20, A3-27, A8-13)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(propertiesApi.search).mockResolvedValue([property()]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('SearchPage_Loading_ShowsSkeletonCardsNotTheEmptyState', () => {
    vi.mocked(propertiesApi.search).mockReturnValue(new Promise(() => {}));
    renderSearch();

    expect(screen.getByTestId('search-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('search-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-count')).toHaveTextContent(i18n.t('search.page.searching'));
  });

  it('SearchPage_Results_LinkEachCardToThePropertyPageOfItsOrgSite', async () => {
    vi.mocked(propertiesApi.search).mockResolvedValue([
      property(),
      property({ id: 'p-2', slug: null, orgSlug: 'casa-monti', name: 'Baita Verde' }),
    ]);
    renderSearch();

    const cards = await screen.findAllByTestId('public-property-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('link', { name: 'Casa del Faro' })).toHaveAttribute(
      'href',
      '/book/villa-mare/property/casa-del-faro',
    );
    // A property without slug is reached by its id, on its own org's site.
    expect(within(cards[1]).getByRole('link', { name: 'Baita Verde' })).toHaveAttribute('href', '/book/casa-monti/property/p-2');
    expect(screen.getByTestId('search-count')).toHaveTextContent('2 strutture trovate');
  });

  it('SearchPage_ClickOnACard_OpensThePropertyPage', async () => {
    renderSearch();

    fireEvent.click(await screen.findByRole('link', { name: 'Casa del Faro' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/book/villa-mare/property/casa-del-faro'));
  });

  it('SearchPage_ResultWithoutOrgSlug_HasNoDeadLink', async () => {
    vi.mocked(propertiesApi.search).mockResolvedValue([property({ orgSlug: undefined })]);
    renderSearch();

    const card = await screen.findByTestId('public-property-card');
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
    expect(card).toHaveTextContent('Casa del Faro');
  });

  it('SearchPage_GuestsFilter_IsCarriedToThePropertyPage', async () => {
    renderSearch('/search?guests=3');

    const link = await screen.findByRole('link', { name: 'Casa del Faro' });

    expect(link).toHaveAttribute('href', '/book/villa-mare/property/casa-del-faro?guests=3');
  });

  it('SearchPage_FiltersInTheUrl_AreAppliedFilledInAndAllSentToTheApi', async () => {
    renderSearch('/search?city=Como&minPrice=50&maxPrice=200&bedrooms=2&bathrooms=1&guests=4');

    await waitFor(() =>
      expect(propertiesApi.search).toHaveBeenCalledWith({
        city: 'Como',
        minPrice: 50,
        maxPrice: 200,
        minBedrooms: 2,
        minBathrooms: 1,
        guests: 4,
      }),
    );
    expect(input('city')).toHaveValue('Como');
    expect(input('maxPrice')).toHaveValue(200);
    expect(input('guests')).toHaveValue(4);
  });

  it('SearchPage_SearchWithOnlyTheCity_UpdatesTheUrlAndAsksTheApiForThatCity', async () => {
    // The reported scenario (A8-13): write "Como", press "Cerca".
    renderSearch();
    await screen.findByTestId('search-results');

    fireEvent.change(input('city'), { target: { value: 'Como' } });
    fireEvent.click(screen.getByTestId('search-submit'));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/search?city=Como'));
    await waitFor(() => expect(propertiesApi.search).toHaveBeenLastCalledWith(expect.objectContaining({ city: 'Como' })));
    const lastCall = vi.mocked(propertiesApi.search).mock.calls.at(-1)![0];
    expect(Object.values(lastCall).some((value) => typeof value === 'number' && Number.isNaN(value))).toBe(false);
  });

  it('SearchPage_InvalidUrlValues_AreIgnoredNotSentAsNaN', async () => {
    renderSearch('/search?guests=abc&minPrice=-4&bedrooms=1.5');

    await screen.findByTestId('search-results');

    expect(propertiesApi.search).toHaveBeenCalledWith({
      city: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minBedrooms: undefined,
      minBathrooms: undefined,
      guests: undefined,
    });
  });

  it('SearchPage_RequestFails_ShowsErrorWithRetryNotNoResults', async () => {
    vi.mocked(propertiesApi.search).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([property()]);
    renderSearch();

    expect(await screen.findByTestId('search-error')).toHaveTextContent(i18n.t('search.results.errorTitle'));
    expect(screen.queryByTestId('search-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-count')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByTestId('search-retry'));

    expect(await screen.findByTestId('search-results')).toBeInTheDocument();
  });

  it('SearchPage_NoResults_ShowsTheEmptyStateAndResetClearsTheFilters', async () => {
    vi.mocked(propertiesApi.search).mockResolvedValue([]);
    renderSearch('/search?city=Nowhere');

    expect(await screen.findByTestId('search-empty')).toHaveTextContent(i18n.t('search.results.noProperties'));
    expect(screen.queryByTestId('search-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-count')).toHaveTextContent('0 strutture trovate');

    fireEvent.click(screen.getByTestId('search-empty-reset'));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/search$/));
    expect(input('city')).toHaveValue('');
  });

  it('SearchPage_EnglishUi_UsesEnglishTexts', async () => {
    await i18n.changeLanguage('en');
    renderSearch();

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Search properties');
    expect(await screen.findByTestId('search-count')).toHaveTextContent('1 property found');
    await i18n.changeLanguage('it');
  });
});
