import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { settleDrawer } from '@/test/drawer';
import type { MarketplaceCatalogEntry, MarketplaceCatalogResponse, Property } from '@/types';
import type { CalendarOverview } from '@/types/property-ical';
import type { SupplierPicker } from '@/types/service-request';
import { MarketplaceCategoriesRedirect } from '../categories-redirect';
import { MarketplacePage } from '../marketplace-page';
import { MarketplaceMinePage } from '../mine-page';

const api = vi.hoisted(() => ({
  fetchMarketplaceSuppliers: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
  fetchServiceCategories: vi.fn(),
  getProperties: vi.fn(),
  getCalendarOverview: vi.fn(),
  getConnectStatus: vi.fn(),
}));
const workspace = vi.hoisted(() => ({ permissions: new Set<string>() }));
// The page reads the catalog through its hook: the test gives the answer of the hook (what the server said, loading, or failed).
const hooks = vi.hoisted(() => ({ catalog: vi.fn(), entry: vi.fn() }));

vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: api.fetchServiceCategories }));
vi.mock('@/api/service-requests.api', () => ({
  fetchMarketplaceSuppliers: api.fetchMarketplaceSuppliers,
  fetchSuppliersByProperty: api.fetchSuppliersByProperty,
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: api.getProperties } }));
vi.mock('@/api/property-ical.api', () => ({ propertyIcalApi: { getCalendarOverview: api.getCalendarOverview } }));
vi.mock('@/api/connect.api', () => ({ ConnectApi: { getStatus: api.getConnectStatus } }));
vi.mock('@/queries/use-marketplace', () => ({
  useMarketplaceCatalog: (propertyId?: string) => hooks.catalog(propertyId),
  useMarketplaceEntry: (kind?: string, code?: string, propertyId?: string) => hooks.entry(kind, code, propertyId),
}));
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

// The cards of the catalog: made-up names, as the real ones are entered by the administrator and written nowhere in the page.
const BASE = {
  logoUrl: null,
  cost: { text: null, invoicedBy: 'Unknown' },
  status: 'NotActive',
  statusScope: 'Property',
  canActivate: true,
  reason: null,
} as const;

const PORTAL: MarketplaceCatalogEntry = {
  ...BASE,
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  logoUrl: 'https://example.com/portal.png',
  benefit: 'Sell on the test portal.',
  cost: { text: '2% per booking', invoicedBy: 'ChannelManager' },
};
const INVOICER: MarketplaceCatalogEntry = { ...BASE, kind: 'Tool', code: 'TOOL1', name: 'TEST Invoicer', benefit: 'Issues the invoices.', status: 'Active' };
const BROKEN: MarketplaceCatalogEntry = { ...BASE, kind: 'Tool', code: 'TOOL2', name: 'TEST Broken', benefit: 'Needs some care.', status: 'ToFix' };
const CHAT: MarketplaceCatalogEntry = { ...BASE, kind: 'LicensedFunction', code: 'chat', name: 'TEST Chat', benefit: 'Talk to the guests.', status: 'Pending' };
const PRICING: MarketplaceCatalogEntry = { ...BASE, kind: 'LicensedFunction', code: 'rms', name: 'TEST Pricing', benefit: 'Sets the prices.' };
const LOCKED: MarketplaceCatalogEntry = {
  ...BASE,
  kind: 'LicensedFunction',
  code: 'rateChecker',
  name: 'TEST Checker',
  benefit: 'Checks the rates.',
  canActivate: false,
  reason: 'not_in_your_plan',
};
const CLEANERS: MarketplaceCatalogEntry = {
  ...BASE,
  kind: 'Partner',
  code: 'test-cleaners',
  name: 'TEST Cleaners',
  benefit: 'Cleaning done by someone else.',
  statusScope: 'Org',
  cost: { text: 'from 10 EUR', invoicedBy: 'Partner' },
  job: 'Cleaning',
  websiteUrl: 'https://example.com/',
  serviceCategories: ['cleaning'],
};
const CHECKIN: MarketplaceCatalogEntry = {
  ...BASE,
  kind: 'Partner',
  code: 'test-checkin',
  name: 'TEST Check-in',
  benefit: 'Welcomes the guests.',
  statusScope: 'Org',
  job: 'AccessProperty',
  websiteUrl: 'https://example.com/',
  serviceCategories: ['check-in'],
};

function catalog(options: { enabled?: boolean; connected?: boolean; partners?: MarketplaceCatalogEntry[] } = {}): MarketplaceCatalogResponse {
  return {
    octorate: { enabled: options.enabled ?? true, connected: options.connected ?? true },
    groups: [
      { id: 'salesChannels', unchangedFlow: false, entries: [PORTAL] },
      { id: 'connectedTools', unchangedFlow: false, entries: [INVOICER, BROKEN] },
      { id: 'channelManagerFunctions', unchangedFlow: false, entries: [CHAT, PRICING, LOCKED] },
      { id: 'homeServices', unchangedFlow: true, entries: [] },
      { id: 'partners', unchangedFlow: false, entries: options.partners ?? [CLEANERS, CHECKIN] },
    ],
  };
}

/** What `useMarketplaceCatalog` answers. */
function catalogAnswer(data: MarketplaceCatalogResponse | undefined, extra: { isPending?: boolean; isError?: boolean; refetch?: () => void } = {}) {
  return { data, isPending: false, isError: false, error: null, refetch: vi.fn(), ...extra };
}

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

function Where() {
  return <output data-testid="where">{useLocation().search}</output>;
}

/** Where a link leads: its path and its parameters. */
function target(testId: string) {
  const url = new URL(screen.getByTestId(testId).getAttribute('href') ?? '', 'http://localhost');
  return { path: url.pathname, params: url.searchParams };
}

beforeEach(async () => {
  vi.clearAllMocks();
  workspace.permissions = new Set(['short-rent:booking.read', 'short-rent:property.read', 'short-rent:property.write']);
  hooks.catalog.mockReturnValue(catalogAnswer(catalog()));
  hooks.entry.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() });
  api.getProperties.mockResolvedValue([PROPERTY]);
  api.fetchServiceCategories.mockResolvedValue(CATEGORIES);
  api.fetchMarketplaceSuppliers.mockResolvedValue({ items: [CLEANER], totalCount: 1, page: 1, pageSize: 1 });
  api.fetchSuppliersByProperty.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 0 });
  api.getCalendarOverview.mockResolvedValue(feeds(2));
  api.getConnectStatus.mockResolvedValue(NO_STRIPE);
  await i18n.changeLanguage('it');
});

// A card that opened its detail card leaves who opened it to the drawer: forgotten after the test, as the tests of the drawer of the app do.
afterEach(async () => {
  cleanup();
  await settleDrawer();
});

describe('MarketplacePage · Scopri', () => {
  it('MarketplacePage_Scopri_ShowsTheFiveGroupsInTheOrderOfTheBrief', async () => {
    renderAt(<MarketplacePage />);

    expect(await screen.findByTestId('marketplace-category-cleaning')).toBeInTheDocument();
    await screen.findByTestId('marketplace-partners-section');
    const groups = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(groups).toEqual(['Canali di vendita', 'Strumenti collegati', 'Funzioni del channel manager', 'Servizi per la casa', 'Partner']);
    // Each group says in one line what it holds.
    expect(screen.getByTestId('marketplace-group-salesChannels')).toHaveTextContent('I portali dove vendi i tuoi alloggi');
    expect(screen.getByTestId('marketplace-partners-section')).toHaveTextContent('non fornitori CasaZen');
    // The catalog is asked for the property the page is about.
    expect(hooks.catalog).toHaveBeenCalledWith('prop-1');
  });

  it('MarketplacePage_Scopri_EveryCardHasNameLogoBenefitCostAndWhereItStands', async () => {
    renderAt(<MarketplacePage />);

    const portal = await screen.findByTestId('marketplace-entry-Channel-PORTAL1');
    expect(within(portal).getByRole('heading', { level: 3 })).toHaveTextContent('TEST Portal');
    expect(within(portal).getByRole('img', { name: 'Logo di TEST Portal' })).toHaveAttribute('src', 'https://example.com/portal.png');
    expect(portal).toHaveTextContent('Sell on the test portal.');
    expect(within(portal).getByTestId('marketplace-entry-Channel-PORTAL1-cost')).toHaveTextContent('Costo: 2% per booking (fatturato dal channel manager)');
    expect(within(portal).getByTestId('marketplace-entry-Channel-PORTAL1-status')).toHaveTextContent('Non attivo');
    // It sits in its group.
    expect(within(screen.getByTestId('marketplace-group-salesChannels')).getByTestId('marketplace-entry-Channel-PORTAL1')).toBe(portal);
  });

  it('MarketplacePage_Scopri_UnknownCost_SaysItIsNotSpecifiedAndShowsNoPrice', async () => {
    renderAt(<MarketplacePage />);

    const cost = await screen.findByTestId('marketplace-entry-Tool-TOOL1-cost');
    expect(cost).toHaveTextContent('Costo non specificato');
    expect(cost.textContent).not.toMatch(/\d/);
  });

  it('MarketplacePage_Scopri_NoLogo_ShowsTheInitialsOfTheName', async () => {
    renderAt(<MarketplacePage />);

    const tool = await screen.findByTestId('marketplace-entry-Tool-TOOL1');
    expect(within(tool).queryByRole('img')).not.toBeInTheDocument();
    expect(tool).toHaveTextContent('TI');
  });

  it('MarketplacePage_Scopri_LogoThatIsNotAnHttpsAddress_IsNotDrawn', async () => {
    const odd = { ...PORTAL, logoUrl: 'javascript:alert(1)' };
    hooks.catalog.mockReturnValue(catalogAnswer({ ...catalog(), groups: [{ id: 'salesChannels', unchangedFlow: false, entries: [odd] }] }));
    renderAt(<MarketplacePage />);

    const portal = await screen.findByTestId('marketplace-entry-Channel-PORTAL1');
    expect(within(portal).queryByRole('img')).not.toBeInTheDocument();
  });

  it('MarketplacePage_Scopri_StatusesAndActions_ActivateOpensTheWizard_ManageGoesToActive_FixOpensTheWizard', async () => {
    renderAt(<MarketplacePage />);
    await screen.findByTestId('marketplace-entry-Channel-PORTAL1');

    // Not active: the wizard of a channel, on the property, and it brings the person back to the page they were on.
    const activate = target('marketplace-entry-Channel-PORTAL1-action');
    expect(screen.getByTestId('marketplace-entry-Channel-PORTAL1-action')).toHaveTextContent('Attiva');
    expect(activate.path).toBe('/app/short-rent/marketplace/activate/channel/PORTAL1');
    expect(activate.params.get('propertyId')).toBe('prop-1');
    expect(activate.params.get('returnTo')).toBe('/app/short-rent/marketplace');

    // Active: managed in the Active tab, the property kept.
    expect(screen.getByTestId('marketplace-entry-Tool-TOOL1-status')).toHaveTextContent('Attivo');
    expect(screen.getByTestId('marketplace-entry-Tool-TOOL1-action')).toHaveTextContent('Gestisci');
    expect(target('marketplace-entry-Tool-TOOL1-action').path).toBe('/app/short-rent/marketplace/mine');
    expect(target('marketplace-entry-Tool-TOOL1-action').params.get('propertyId')).toBe('prop-1');

    // To fix: the same wizard, with the word «Correggi».
    expect(screen.getByTestId('marketplace-entry-Tool-TOOL2-status')).toHaveTextContent('Da correggere');
    expect(screen.getByTestId('marketplace-entry-Tool-TOOL2-action')).toHaveTextContent('Correggi');
    expect(target('marketplace-entry-Tool-TOOL2-action').path).toBe('/app/short-rent/marketplace/activate/tool/TOOL2');

    // Pending: it is already asked for, so it is managed and not asked for again.
    expect(screen.getByTestId('marketplace-entry-LicensedFunction-chat-status')).toHaveTextContent('In attesa');
    expect(screen.getByTestId('marketplace-entry-LicensedFunction-chat-action')).toHaveTextContent('Gestisci');

    // A function of the license has its own request; a partner its own hand-off.
    expect(target('marketplace-entry-LicensedFunction-rms-action').path).toBe('/app/short-rent/marketplace/request/rms');
    expect(target('marketplace-entry-Partner-test-cleaners-action').path).toBe('/app/short-rent/marketplace/partners/test-cleaners/activate');
  });

  it('MarketplacePage_Scopri_CannotBeActivated_HasNoButtonAndSaysWhy', async () => {
    renderAt(<MarketplacePage />);

    const locked = await screen.findByTestId('marketplace-entry-LicensedFunction-rateChecker');
    expect(within(locked).queryByTestId('marketplace-entry-LicensedFunction-rateChecker-action')).not.toBeInTheDocument();
    // A reason the page has no text for is said in general words.
    expect(within(locked).getByTestId('marketplace-entry-LicensedFunction-rateChecker-reason')).toHaveTextContent('Al momento non si può attivare da qui.');
    // The details are still there to read.
    expect(within(locked).getByRole('button', { name: 'Dettagli di TEST Checker' })).toBeInTheDocument();
  });

  it('MarketplacePage_Scopri_Details_SetsTheEntryParameterAndKeepsTheOtherOnes', async () => {
    renderAt(
      <>
        <MarketplacePage />
        <Where />
      </>,
      '/app/short-rent/marketplace?propertyId=prop-1&q=abc',
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Dettagli di TEST Portal' }));

    const params = new URLSearchParams(screen.getByTestId('where').textContent ?? '');
    expect(params.get('entry')).toBe('Channel:PORTAL1');
    expect(params.get('propertyId')).toBe('prop-1');
    expect(params.get('q')).toBe('abc');
  });

  it('MarketplacePage_Scopri_PartnersComeFromTheCatalogOnly', async () => {
    renderAt(<MarketplacePage />);

    const section = await screen.findByTestId('marketplace-partners-section');
    expect(within(section).getByTestId('marketplace-entry-Partner-test-cleaners')).toHaveTextContent('TEST Cleaners');
    expect(within(section).getByTestId('marketplace-entry-Partner-test-cleaners-cost')).toHaveTextContent('Costo: from 10 EUR (fatturato dal partner)');
    expect(within(section).getByTestId('marketplace-entry-Partner-test-checkin')).toHaveTextContent('TEST Check-in');
    expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(2);
  });

  it('MarketplacePage_Scopri_NoPartnerInTheCatalog_SaysSo', async () => {
    hooks.catalog.mockReturnValue(catalogAnswer(catalog({ partners: [] })));
    renderAt(<MarketplacePage />);

    expect(await screen.findByTestId('marketplace-partners-empty')).toHaveTextContent('Per ora non ci sono partner da mostrare.');
    expect(within(screen.getByTestId('marketplace-partners-section')).queryAllByRole('heading', { level: 3 })).toHaveLength(0);
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
    // The tiles are the group of Home services.
    expect(within(screen.getByTestId('marketplace-suppliers-section')).getByTestId('marketplace-categories')).toBeInTheDocument();
  });

  it('MarketplacePage_Scopri_NoSupplierAround_SaysSoAndPointsToThePartners', async () => {
    api.fetchMarketplaceSuppliers.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 0 });
    renderAt(<MarketplacePage />);

    const note = await screen.findByTestId('marketplace-no-network');
    expect(note).toHaveTextContent("In questo territorio non c'è ancora una rete CasaZen per questa categoria.");
    expect(note).toHaveTextContent('Qui sotto trovi i partner esterni.');
    expect(screen.getByTestId('marketplace-partners-section')).toBeInTheDocument();
  });

  it('MarketplacePage_Scopri_OwnIntegrations_SayWhetherTheyAreOnAndLeadToTheirPage', async () => {
    api.getConnectStatus.mockResolvedValue(ACTIVE_STRIPE);
    renderAt(<MarketplacePage />);

    // The calendars are a sales channel, the card payments a tool.
    const calendars = await within(await screen.findByTestId('marketplace-group-salesChannels')).findByTestId('marketplace-integration-calendars');
    await waitFor(() => expect(within(calendars).getByTestId('marketplace-integration-calendars-status')).toHaveTextContent('Attivo'));
    expect(calendars).toHaveTextContent('2 calendari collegati');
    expect(within(calendars).getByTestId('marketplace-integration-calendars-action')).toHaveTextContent('Gestisci');
    expect(target('marketplace-integration-calendars-action').path).toBe('/app/short-rent/channels');
    const payments = within(screen.getByTestId('marketplace-group-connectedTools')).getByTestId('marketplace-integration-payments');
    await waitFor(() => expect(within(payments).getByTestId('marketplace-integration-payments-status')).toHaveTextContent('Attivo'));
    expect(target('marketplace-integration-payments-action').path).toBe('/app/short-rent/settings/payments');
    // They are not in the catalog: no detail card to open, and no price invented.
    expect(within(calendars).queryByRole('button', { name: /Dettagli/ })).not.toBeInTheDocument();
    expect(within(calendars).getByTestId('marketplace-integration-calendars-cost')).toHaveTextContent('Costo non specificato');
  });

  it('MarketplacePage_Scopri_OwnIntegrationNotConnected_OffersToSetItUp', async () => {
    api.getCalendarOverview.mockResolvedValue(feeds(0));
    renderAt(<MarketplacePage />);

    const payments = await screen.findByTestId('marketplace-integration-payments');
    await waitFor(() => expect(within(payments).getByTestId('marketplace-integration-payments-status')).toHaveTextContent('Non attivo'));
    expect(within(payments).getByTestId('marketplace-integration-payments-action')).toHaveTextContent('Attiva');
    await waitFor(() =>
      expect(within(screen.getByTestId('marketplace-integration-calendars')).getByTestId('marketplace-integration-calendars-status')).toHaveTextContent('Non attivo'),
    );
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

  it('MarketplacePage_Scopri_WithoutAnyIntegrationPermission_ShowsNoOwnCardAndReadsNothing', async () => {
    workspace.permissions = new Set(['short-rent:booking.read']);
    renderAt(<MarketplacePage />);

    // The catalog is there; CasaZen's own integrations are not, and nothing was read for them.
    await screen.findByTestId('marketplace-entry-Channel-PORTAL1');
    expect(screen.queryByTestId('marketplace-integration-calendars')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-integration-payments')).not.toBeInTheDocument();
    expect(api.getCalendarOverview).not.toHaveBeenCalled();
    expect(api.getConnectStatus).not.toHaveBeenCalled();
  });

  it.each([
    ['not connected', { connected: false }],
    ['not available', { enabled: false }],
  ])('MarketplacePage_Scopri_ChannelManager_%s_TheFirstThreeGroupsSaySoAndLeadToTheChannels', async (_name, state) => {
    hooks.catalog.mockReturnValue(catalogAnswer(catalog(state)));
    renderAt(<MarketplacePage />);

    await screen.findByTestId('marketplace-partners-section');
    for (const id of ['salesChannels', 'connectedTools', 'channelManagerFunctions']) {
      const note = await screen.findByTestId(`marketplace-octorate-off-${id}`);
      expect(note).toHaveTextContent('Per vedere queste schede devi prima collegare il tuo channel manager a CasaZen.');
      expect(within(note).getByRole('link', { name: 'Collega i tuoi canali' })).toHaveAttribute('href', '/app/short-rent/channels');
    }
    // No card of the catalog in them, whatever the catalog held; the rest of the page does not wait for the channel manager.
    expect(screen.queryByTestId('marketplace-entry-Channel-PORTAL1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-entry-Tool-TOOL1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-entry-LicensedFunction-chat')).not.toBeInTheDocument();
    expect(await screen.findByTestId('marketplace-category-cleaning')).toBeInTheDocument();
    expect(within(screen.getByTestId('marketplace-partners-section')).getByTestId('marketplace-entry-Partner-test-cleaners')).toBeInTheDocument();
    // CasaZen's own integrations stay where they were.
    expect(await screen.findByTestId('marketplace-integration-calendars')).toBeInTheDocument();
  });

  it('MarketplacePage_Scopri_CatalogLoading_ShowsWhatIsKnownAndWaitsForTheRest', async () => {
    hooks.catalog.mockReturnValue(catalogAnswer(undefined, { isPending: true }));
    renderAt(<MarketplacePage />);

    const channels = await screen.findByTestId('marketplace-group-salesChannels');
    expect(within(channels).getByText('Carico…')).toBeInTheDocument();
    // CasaZen's own integrations do not wait for the catalog; the cards of the catalog and the note about the channel manager do.
    expect(await within(channels).findByTestId('marketplace-integration-calendars')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-entry-Channel-PORTAL1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-octorate-off-salesChannels')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('marketplace-partners-section')).getByText('Carico…')).toBeInTheDocument();
  });

  it('MarketplacePage_Scopri_CatalogCannotBeRead_SaysSoWithARetry_NeverAnEmptyMarketplace', async () => {
    const refetch = vi.fn();
    hooks.catalog.mockReturnValue(catalogAnswer(undefined, { isError: true, refetch }));
    renderAt(<MarketplacePage />);

    await screen.findByTestId('marketplace-partners-section');
    expect(await screen.findAllByText('Non riesco a caricare questa parte del Marketplace.')).toHaveLength(4);
    expect(screen.queryByTestId('marketplace-partners-empty')).not.toBeInTheDocument();
    expect(await screen.findByTestId('marketplace-integration-calendars')).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('marketplace-partners-section')).getByRole('button', { name: 'Riprova' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('MarketplacePage_Scopri_PropertyWithoutComune_AsksForItButStillShowsTheOtherGroups', async () => {
    api.getProperties.mockResolvedValue([{ ...PROPERTY, comuneIstatCode: undefined }]);
    renderAt(<MarketplacePage />);

    expect(await screen.findByText('Aggiungi il comune per vedere i fornitori della tua zona')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-partners-section')).toBeInTheDocument();
    expect(await screen.findByTestId('marketplace-entry-Channel-PORTAL1')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-suppliers-section')).not.toBeInTheDocument();
  });

  it('MarketplacePage_Tabs_AreScopriAndAttiviOnly', async () => {
    renderAt(<MarketplacePage />);

    await screen.findByTestId('marketplace-category-cleaning');
    expect(screen.getAllByTestId('marketplace-section-discover').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('marketplace-section-mine')[0]).toHaveTextContent('Attivi');
    expect(screen.queryByTestId('marketplace-section-categories')).not.toBeInTheDocument();
    expect(screen.queryByText('Categorie')).not.toBeInTheDocument();
  });
});

describe('MarketplaceMinePage · Attivi', () => {
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
