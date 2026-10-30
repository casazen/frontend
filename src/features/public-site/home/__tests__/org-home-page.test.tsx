import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { useOrgDestinations, useOrgStays } from '@/queries/use-public-stays';
import type { PublicOrgDto } from '@/types';
import type { PublicStayCard, PublicStaysResult } from '@/types/public-stays.types';
import { OrgHomePage } from '../org-home-page';

vi.mock('@/queries/use-public-stays', () => ({ useOrgStays: vi.fn(), useOrgDestinations: vi.fn() }));
vi.mock('@/features/public-site/stay/use-public-site-calendar', () => ({
  usePublicSiteCalendar: () => ({ status: 'ready', days: [], today: '2027-06-01', end: '2028-06-01', currency: 'EUR', onRetry: vi.fn() }),
}));

type StaysResult = ReturnType<typeof useOrgStays>;

const org: PublicOrgDto = {
  slug: 'villa-mare',
  displayName: 'Villa Mare',
  logoUrl: null,
  themeColor: null,
  contactEmail: null,
  tagline: 'Case vacanza sul mare',
};

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
    ...overrides,
  };
}

function result(items: PublicStayCard[]): PublicStaysResult {
  return {
    currency: 'EUR',
    adults: 2,
    children: 0,
    pets: false,
    totalCount: items.length,
    availableCount: items.length,
    page: 1,
    pageSize: 50,
    items,
    alternatives: [],
    unsupportedFilters: [],
    generatedAt: '2027-06-01T08:00:00Z',
  };
}

function mockStays(state: Partial<StaysResult>) {
  vi.mocked(useOrgStays).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...state,
  } as unknown as StaysResult);
  vi.mocked(useOrgDestinations).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useOrgDestinations>);
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderHome(orgOverrides: Partial<PublicOrgDto> = {}, search = '') {
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[`/book/villa-mare${search}`]}>
          <Routes>
            <Route path="/book/:orgSlug" element={<Outlet context={{ org: { ...org, ...orgOverrides } }} />}>
              <Route index element={<OrgHomePage />} />
              <Route path="property/:propertySlug" element={<LocationProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('OrgHomePage states (DB-07b)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('OrgHomePage_Loading_ShowsTheCoverAndSkeletonCardsNotTheEmptyMessage', () => {
    mockStays({ isPending: true });
    renderHome({ heroImageUrl: 'https://cdn.test/hero.jpg' });

    // The cover and the name are the first paint: the org is known before the homes are.
    expect(screen.getByTestId('home-hero')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Case vacanza sul mare');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Villa Mare');
    expect(screen.getByTestId('home-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('home-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-error')).not.toBeInTheDocument();
  });

  it('OrgHomePage_StaysRequestFails_ShowsErrorWithRetryNotNoHomePublished', () => {
    const refetch = vi.fn();
    mockStays({ isError: true, refetch });
    renderHome();

    const error = screen.getByTestId('home-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent(i18n.t('publicSite.propertiesError.title'));
    expect(screen.queryByTestId('home-empty')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('home-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('OrgHomePage_RetryInFlight_DisablesTheRetryButton', () => {
    mockStays({ isError: true, isFetching: true });
    renderHome();

    expect(screen.getByTestId('home-retry')).toBeDisabled();
  });

  it('OrgHomePage_NoHomes_ShowsTheNextSeasonStateWithAWayToAsk', () => {
    mockStays({ data: result([]) });
    renderHome();

    expect(screen.getByTestId('home-empty')).toHaveTextContent(i18n.t('siteHome.empty.title'));
    expect(screen.getByTestId('home-empty-write')).toBeInTheDocument();
    // The phone is the host's choice to publish: without it there is no call.
    expect(screen.queryByTestId('home-empty-call')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-search')).not.toBeInTheDocument();
  });

  it('OrgHomePage_NoHomesAndAPublicPhone_OffersTheCall', () => {
    mockStays({ data: result([]) });
    renderHome({ publicPhone: '+39021234567' });

    expect(screen.getByTestId('home-empty-call')).toHaveAttribute('href', 'tel:+39021234567');
  });

  it('OrgHomePage_TwoHomes_ListsCardsLinkedToTheirPagesKeepingTheStay', () => {
    mockStays({ data: { ...result([card(), card({ id: 'p-2', slug: null, name: 'Villetta Verde' })]), checkIn: '2027-07-01', checkOut: '2027-07-05', nights: 4 } });
    renderHome({}, '?checkin=2027-07-01&checkout=2027-07-05&guests=2');

    const cards = screen.getAllByTestId('house-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('link', { name: 'Casa del Faro' })).toHaveAttribute(
      'href',
      '/book/villa-mare/property/casa-del-faro?checkin=2027-07-01&checkout=2027-07-05&guests=2',
    );
    // A home without a slug is reachable by its id.
    expect(within(cards[1]).getByRole('link', { name: 'Villetta Verde' })).toHaveAttribute('href', expect.stringContaining('/book/villa-mare/property/p-2'));
    expect(screen.getByTestId('home-search')).toBeInTheDocument();
  });

  it('OrgHomePage_SingleHome_OpensItsPageKeepingTheStay', () => {
    mockStays({ data: result([card()]) });
    renderHome({}, '?guests=3');

    expect(screen.getByTestId('location')).toHaveTextContent('/book/villa-mare/property/casa-del-faro?guests=3');
  });

  it('OrgHomePage_StaysRequestFailsWithStaleSingleHome_DoesNotRedirect', () => {
    mockStays({ data: result([card()]), isError: true });
    renderHome();

    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(screen.getByTestId('home-error')).toBeInTheDocument();
  });

  it('OrgHomePage_CategoriesNeedTwoLabels_OneLabelLeavesTheRowOut', () => {
    mockStays({ data: result([card({ tags: ['mare'] }), card({ id: 'p-2', name: 'Villetta Verde', tags: ['mare'] })]) });
    renderHome();

    expect(screen.queryByTestId('home-categories')).not.toBeInTheDocument();
  });
});
