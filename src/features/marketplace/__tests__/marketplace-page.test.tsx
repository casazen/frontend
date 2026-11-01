import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { Property } from '@/types';
import type { CalendarOverview } from '@/types/property-ical';
import type { SupplierPicker } from '@/types/service-request';
import { MarketplaceCategoriesRedirect } from '../categories-redirect';
import { MarketplacePage } from '../marketplace-page';
import { MarketplaceMinePage } from '../mine-page';
import { EXTERNAL_PARTNERS } from '../lib/external-partners';

const api = vi.hoisted(() => ({
  fetchMarketplaceSuppliers: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
  fetchServiceCategories: vi.fn(),
  getProperties: vi.fn(),
  getCalendarOverview: vi.fn(),
  getConnectStatus: vi.fn(),
}));
const workspace = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: api.fetchServiceCategories }));
vi.mock('@/api/service-requests.api', () => ({
  fetchMarketplaceSuppliers: api.fetchMarketplaceSuppliers,
  fetchSuppliersByProperty: api.fetchSuppliersByProperty,
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: api.getProperties } }));
vi.mock('@/api/property-ical.api', () => ({ propertyIcalApi: { getCalendarOverview: api.getCalendarOverview } }));
vi.mock('@/api/connect.api', () => ({ ConnectApi: { getStatus: api.getConnectStatus } }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    contexts: [{ contextKey: 'short-rent' }],
    hasPermission: (context: string, permission: string) => workspace.permissions.has(`${context}:${permission}`),
  }),
}));

const PROPERTY = { id: 'prop-1', name: 'Villa Rosa', comuneIstatCode: '058091', complianceStatus: 'Active', isPaused: false } as Property;

const CLEANER = {
  orgId: 'sup-1',
  legalName: 'Pulizie Express Srl',
  categories: ['cleaning'],
  comuni: ['058091'],
  photoUrls: [],
  services: [],
} as unknown as SupplierPicker;

const CATEGORIES = ['cleaning', 'maintenance', 'plumbing'];

const feeds = (count: number): CalendarOverview => ({
  syncEveryMinutes: 15,
  staleAfterMinutes: 45,
  properties: [
    {
      propertyId: 'prop-1',
      propertyName: 'Villa Rosa',
      feeds: Array.from({ length: count }, (_, index) => ({ feedId: `f${index}`, channel: 'Airbnb', syncing: false })),
    },
  ] as CalendarOverview['properties'],
});

const ACTIVE_STRIPE = { connectedAccountId: 'acct_1', chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, requirementsDue: [] };
const NO_STRIPE = { connectedAccountId: null, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, requirementsDue: [] };

function renderAt(element: React.ReactNode, route = '/app/short-rent/marketplace') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  workspace.permissions = new Set(['short-rent:booking.read', 'short-rent:property.read', 'short-rent:property.write']);
  api.getProperties.mockResolvedValue([PROPERTY]);
  api.fetchServiceCategories.mockResolvedValue(CATEGORIES);
  api.fetchMarketplaceSuppliers.mockResolvedValue({ items: [CLEANER], totalCount: 1, page: 1, pageSize: 1 });
  api.fetchSuppliersByProperty.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 0 });
  api.getCalendarOverview.mockResolvedValue(feeds(2));
  api.getConnectStatus.mockResolvedValue(NO_STRIPE);
  await i18n.changeLanguage('it');
});

describe('MarketplacePage · Scopri', () => {
  it('MarketplacePage_Scopri_ShowsTheThreeGroupsInTheOrderOfTheBrief', async () => {
    renderAt(<MarketplacePage />);

    expect(await screen.findByTestId('marketplace-category-cleaning')).toBeInTheDocument();
    await screen.findByTestId('marketplace-integrations-section');
    const groups = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(groups).toEqual(['Fornitori CasaZen', 'Integrazioni con partner esterni', 'Altre integrazioni']);
  });

  it('MarketplacePage_Scopri_ShowsEveryCategoryAsATileWithItsSuppliers', async () => {
    renderAt(<MarketplacePage />);

    const cleaning = await screen.findByTestId('marketplace-category-cleaning');
    expect(cleaning).toHaveTextContent('Pulizie');
    expect(cleaning).toHaveTextContent('1 fornitore');
    expect(cleaning).toHaveAttribute('href', expect.stringContaining('/app/short-rent/marketplace/categories/cleaning'));
    expect(cleaning).toHaveAttribute('href', expect.stringContaining('propertyId=prop-1'));
    expect(screen.getByTestId('marketplace-category-plumbing')).toHaveTextContent('Ancora nessun fornitore');
    expect(screen.queryByTestId('marketplace-no-network')).not.toBeInTheDocument();
  });

  it('MarketplacePage_Scopri_NoSupplierAround_SaysSoAndPointsToThePartners', async () => {
    api.fetchMarketplaceSuppliers.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 0 });
    renderAt(<MarketplacePage />);

    const note = await screen.findByTestId('marketplace-no-network');
    expect(note).toHaveTextContent("In questo territorio non c'è ancora una rete CasaZen per questa categoria.");
    expect(note).toHaveTextContent('Qui sotto trovi i partner esterni.');
    expect(screen.getByTestId('marketplace-partners-section')).toBeInTheDocument();
  });

  it('MarketplacePage_Scopri_PartnerCards_OpenTheirOwnSiteInANewTabAndClaimNoPartnership', async () => {
    renderAt(<MarketplacePage />);

    const section = await screen.findByTestId('marketplace-partners-section');
    for (const partner of EXTERNAL_PARTNERS) {
      const link = within(section).getByTestId(`marketplace-partner-${partner.code}-link`);
      expect(link).toHaveAttribute('href', partner.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
      expect(link.getAttribute('href')).not.toContain('?');
      expect(link).toHaveAccessibleName(`Scopri ${partner.name} (si apre in una nuova scheda)`);
    }
    expect(EXTERNAL_PARTNERS.every((partner) => partner.url.startsWith('https://'))).toBe(true);
    expect(within(section).getByTestId('marketplace-partner-tidy')).toHaveTextContent('Pulizie');
    expect(within(section).getByTestId('marketplace-partner-tidy')).toHaveTextContent('Manutenzione');
    expect(section).toHaveTextContent('Non sono fornitori CasaZen');
  });

  it('MarketplacePage_Scopri_OtherIntegrations_SayWhetherTheyAreOn', async () => {
    api.getConnectStatus.mockResolvedValue(ACTIVE_STRIPE);
    renderAt(<MarketplacePage />);

    const calendars = await screen.findByTestId('marketplace-integration-calendars');
    await waitFor(() => expect(within(calendars).getByTestId('marketplace-integration-calendars-status')).toHaveTextContent('Attiva'));
    expect(calendars).toHaveTextContent('2 calendari collegati');
    expect(within(calendars).getByRole('link', { name: 'Gestisci' })).toHaveAttribute('href', '/app/short-rent/channels');
    const payments = screen.getByTestId('marketplace-integration-payments');
    await waitFor(() => expect(within(payments).getByTestId('marketplace-integration-payments-status')).toHaveTextContent('Attiva'));
    expect(within(payments).getByRole('link', { name: 'Gestisci' })).toHaveAttribute('href', '/app/short-rent/settings/payments');
  });

  it('MarketplacePage_Scopri_NotConnected_OffersToSetItUp', async () => {
    api.getCalendarOverview.mockResolvedValue(feeds(0));
    renderAt(<MarketplacePage />);

    const payments = await screen.findByTestId('marketplace-integration-payments');
    await waitFor(() => expect(within(payments).getByTestId('marketplace-integration-payments-status')).toHaveTextContent('Da attivare'));
    expect(within(payments).getByRole('link', { name: 'Attiva' })).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByTestId('marketplace-integration-calendars')).getByTestId('marketplace-integration-calendars-status')).toHaveTextContent('Da attivare'));
  });

  it('MarketplacePage_Scopri_UnreadableAnswers_ShowTheCardsWithoutAStateAndDoNotBreak', async () => {
    // An answer that is not what the API sends (a page of HTML from a proxy, say) is as good as none.
    api.getCalendarOverview.mockResolvedValue('<!doctype html>' as never);
    api.getConnectStatus.mockResolvedValue('<!doctype html>' as never);
    renderAt(<MarketplacePage />);

    const calendars = await screen.findByTestId('marketplace-integration-calendars');
    await waitFor(() => expect(api.getConnectStatus).toHaveBeenCalled());
    expect(within(calendars).queryByTestId('marketplace-integration-calendars-status')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('marketplace-integration-payments')).queryByTestId('marketplace-integration-payments-status')).not.toBeInTheDocument();
    expect(screen.getByTestId('marketplace-partners-section')).toBeInTheDocument();
  });

  it('MarketplacePage_Scopri_WithoutPropertyWrite_NeitherShowsNorReadsThePayments', async () => {
    workspace.permissions = new Set(['short-rent:booking.read', 'short-rent:property.read']);
    renderAt(<MarketplacePage />);

    await screen.findByTestId('marketplace-integration-calendars');
    expect(screen.queryByTestId('marketplace-integration-payments')).not.toBeInTheDocument();
    expect(api.getConnectStatus).not.toHaveBeenCalled();
  });

  it('MarketplacePage_Scopri_WithoutAnyIntegrationPermission_HidesTheGroupAndReadsNothing', async () => {
    workspace.permissions = new Set(['short-rent:booking.read']);
    renderAt(<MarketplacePage />);

    await screen.findByTestId('marketplace-partners-section');
    expect(screen.queryByTestId('marketplace-integrations-section')).not.toBeInTheDocument();
    expect(api.getCalendarOverview).not.toHaveBeenCalled();
    expect(api.getConnectStatus).not.toHaveBeenCalled();
  });

  it('MarketplacePage_Scopri_PropertyWithoutComune_AsksForItButStillShowsThePartners', async () => {
    api.getProperties.mockResolvedValue([{ ...PROPERTY, comuneIstatCode: undefined }]);
    renderAt(<MarketplacePage />);

    expect(await screen.findByText('Aggiungi il comune per vedere i fornitori della tua zona')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-partners-section')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-suppliers-section')).not.toBeInTheDocument();
  });

  it('MarketplacePage_Tabs_AreScopriAndLeMieAppOnly', async () => {
    renderAt(<MarketplacePage />);

    await screen.findByTestId('marketplace-category-cleaning');
    expect(screen.getAllByTestId('marketplace-section-discover').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('marketplace-section-mine').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('marketplace-section-categories')).not.toBeInTheDocument();
    expect(screen.queryByText('Categorie')).not.toBeInTheDocument();
  });
});

describe('MarketplaceMinePage · Le mie app', () => {
  it('MarketplaceMinePage_ShowsOnlyTheIntegrationsThatAreOn', async () => {
    renderAt(<MarketplaceMinePage />, '/app/short-rent/marketplace/mine');

    const list = await screen.findByTestId('marketplace-active-integrations');
    expect(within(list).getByTestId('marketplace-integration-calendars')).toHaveTextContent('2 calendari collegati');
    expect(within(list).queryByTestId('marketplace-integration-payments')).not.toBeInTheDocument();
    // What was used (suppliers and requests) is not here: it is in Interventi.
    expect(screen.queryByText('Pulizie Express Srl')).not.toBeInTheDocument();
    expect(api.fetchMarketplaceSuppliers).not.toHaveBeenCalled();
  });

  it('MarketplaceMinePage_NothingOn_SaysSoAndLeadsToScopri', async () => {
    api.getCalendarOverview.mockResolvedValue(feeds(0));
    renderAt(<MarketplaceMinePage />, '/app/short-rent/marketplace/mine');

    expect(await screen.findByText('Nessuna integrazione attiva')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scopri le integrazioni' })).toHaveAttribute('href', expect.stringContaining('/app/short-rent/marketplace'));
  });

  it('MarketplaceMinePage_PendingPayments_IsNotListedAsActive', async () => {
    api.getConnectStatus.mockResolvedValue({ ...NO_STRIPE, connectedAccountId: 'acct_1' });
    renderAt(<MarketplaceMinePage />, '/app/short-rent/marketplace/mine');

    await screen.findByTestId('marketplace-active-integrations');
    expect(screen.queryByTestId('marketplace-integration-payments')).not.toBeInTheDocument();
  });
});

describe('MarketplaceCategoriesRedirect', () => {
  it('MarketplaceCategoriesRedirect_OldAddress_OpensScopriOnTheSameProperty', async () => {
    function Scopri() {
      return <div data-testid="scopri">{useLocation().search}</div>;
    }
    renderAt(
      <Routes>
        <Route path="/app/short-rent/marketplace/categories" element={<MarketplaceCategoriesRedirect />} />
        <Route path="/app/short-rent/marketplace" element={<Scopri />} />
      </Routes>,
      '/app/short-rent/marketplace/categories?propertyId=prop-1',
    );

    expect(await screen.findByTestId('scopri')).toHaveTextContent('?propertyId=prop-1');
  });
});
