import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { useOrgProperties } from '@/queries/use-public-org';
import type { PublicOrgDto, PublicPropertyDto } from '@/types';
import { OrgLandingPage } from '../org-landing-page';

vi.mock('@/queries/use-public-org', () => ({ useOrgProperties: vi.fn() }));

type PropertiesResult = ReturnType<typeof useOrgProperties>;

const org: PublicOrgDto = {
  slug: 'villa-mare',
  displayName: 'Villa Mare',
  logoUrl: null,
  themeColor: null,
  contactEmail: null,
  tagline: 'Case vacanza sul mare',
};

function property(overrides: Partial<PublicPropertyDto> = {}): PublicPropertyDto {
  return {
    id: 'p-1',
    slug: 'casa-del-faro',
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

function mockProperties(result: Partial<PropertiesResult>) {
  vi.mocked(useOrgProperties).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...result,
  } as unknown as PropertiesResult);
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderLanding(orgOverrides: Partial<PublicOrgDto> = {}, search = '') {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[`/book/villa-mare${search}`]}>
        <Routes>
          <Route path="/book/:orgSlug" element={<Outlet context={{ org: { ...org, ...orgOverrides } }} />}>
            <Route index element={<OrgLandingPage />} />
            <Route path="property/:propertySlug" element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('OrgLandingPage states (BK-13, A3-35)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('OrgLandingPage_Loading_ShowsSkeletonCardsNotTheEmptyMessage', () => {
    mockProperties({ isLoading: true });
    renderLanding();

    expect(screen.getByTestId('landing-properties-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-properties-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-properties-error')).not.toBeInTheDocument();
  });

  it('OrgLandingPage_PropertiesRequestFails_ShowsErrorWithRetryNotNoPropertyPublished', () => {
    const refetch = vi.fn();
    mockProperties({ isError: true, refetch });
    renderLanding();

    const error = screen.getByTestId('landing-properties-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent(i18n.t('publicSite.propertiesError.title'));
    expect(screen.queryByText(i18n.t('publicBooking.noPropertiesPublished'))).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-properties-empty')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('landing-properties-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('OrgLandingPage_RetryInFlight_DisablesTheRetryButton', () => {
    mockProperties({ isError: true, isFetching: true });
    renderLanding();

    expect(screen.getByTestId('landing-properties-retry')).toBeDisabled();
  });

  it('OrgLandingPage_NoProperties_ShowsHonestEmptyStateWithoutContactWhenNotPublic', () => {
    mockProperties({ data: [] });
    renderLanding();

    const empty = screen.getByTestId('landing-properties-empty');
    expect(empty).toHaveTextContent(i18n.t('publicBooking.noPropertiesPublished'));
    expect(screen.queryByTestId('landing-empty-contact')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-properties-error')).not.toBeInTheDocument();
    // No call to action towards a list that does not exist.
    expect(screen.queryByRole('button', { name: i18n.t('publicSite.viewProperties') })).not.toBeInTheDocument();
  });

  it('OrgLandingPage_NoPropertiesAndPublicContactEmail_OffersTheEmail', () => {
    mockProperties({ data: [] });
    renderLanding({ contactEmail: 'info@villamare.test' });

    expect(screen.getByTestId('landing-empty-contact')).toHaveAttribute('href', 'mailto:info@villamare.test');
  });

  it('OrgLandingPage_TwoProperties_ListsCardsLinkedToTheirPagesKeepingTheSearch', () => {
    mockProperties({
      data: [property(), property({ id: 'p-2', slug: null, name: 'Villetta Verde', nightlyRate: 90 })],
    });
    renderLanding({}, '?checkin=2027-07-01&checkout=2027-07-05&guests=2');

    const cards = screen.getAllByTestId('public-property-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('link', { name: 'Casa del Faro' })).toHaveAttribute(
      'href',
      '/book/villa-mare/property/casa-del-faro?checkin=2027-07-01&checkout=2027-07-05&guests=2',
    );
    // A property without slug is reachable by its id.
    expect(within(cards[1]).getByRole('link', { name: 'Villetta Verde' })).toHaveAttribute(
      'href',
      expect.stringContaining('/book/villa-mare/property/p-2'),
    );
    expect(screen.getByRole('button', { name: i18n.t('publicSite.viewProperties') })).toBeInTheDocument();
  });

  it('OrgLandingPage_SingleProperty_OpensItsPageDirectlyKeepingTheSearch', () => {
    mockProperties({ data: [property()] });
    renderLanding({}, '?guests=3');

    expect(screen.getByTestId('location')).toHaveTextContent('/book/villa-mare/property/casa-del-faro?guests=3');
  });

  it('OrgLandingPage_PropertiesRequestFailsWithStaleSingleProperty_DoesNotRedirect', () => {
    mockProperties({ data: [property()], isError: true });
    renderLanding();

    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-properties-error')).toBeInTheDocument();
  });

  it('OrgLandingPage_Hero_IsRenderedWithTheFirstPaintNotInALazyChunk', () => {
    mockProperties({ isLoading: true });
    renderLanding({ heroImageUrl: 'https://cdn.test/hero.jpg' });

    // Synchronous query: a lazy Hero would still be a Suspense fallback here.
    expect(screen.getByTestId('public-hero')).toHaveAttribute('data-hero-variant', 'image');
    expect(screen.getByRole('heading', { level: 1, name: 'Villa Mare' })).toBeInTheDocument();
    expect(screen.getByText('Case vacanza sul mare')).toBeInTheDocument();
  });
});
