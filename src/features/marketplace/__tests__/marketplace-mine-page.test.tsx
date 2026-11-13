import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { settleDrawer } from '@/test/drawer';
import type { MarketplaceActiveIntegration, MarketplaceActiveProvider, MarketplaceHealthItem, MarketplaceHealthRead, Property } from '@/types';
import type { CalendarOverview } from '@/types/property-ical';
import { MarketplaceMinePage } from '../mine-page';

const api = vi.hoisted(() => ({
  getMarketplaceActive: vi.fn(),
  getMarketplaceHealth: vi.fn(),
  getMarketplaceEntry: vi.fn(),
  fetchMarketplaceSuppliers: vi.fn(),
  getProperties: vi.fn(),
  getCalendarOverview: vi.fn(),
  getConnectStatus: vi.fn(),
}));
const workspace = vi.hoisted(() => ({ permissions: new Set<string>() }));
const flags = vi.hoisted(() => ({ connector: true }));

vi.mock('@/api/marketplace.api', () => ({
  getMarketplaceActive: api.getMarketplaceActive,
  getMarketplaceHealth: api.getMarketplaceHealth,
  getMarketplaceEntry: api.getMarketplaceEntry,
}));
vi.mock('@/api/service-requests.api', () => ({ fetchMarketplaceSuppliers: api.fetchMarketplaceSuppliers }));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: api.getProperties } }));
vi.mock('@/api/property-ical.api', () => ({ propertyIcalApi: { getCalendarOverview: api.getCalendarOverview } }));
vi.mock('@/api/connect.api', () => ({ ConnectApi: { getStatus: api.getConnectStatus } }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    contexts: [{ contextKey: 'short-rent' }],
    hasPermission: (context: string, permission: string) => workspace.permissions.has(`${context}:${permission}`),
  }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { octorateConnector: flags.connector }, isLoading: false }) }));

const PROPERTY = { id: 'prop-1', name: 'Villa Rosa', comuneIstatCode: '058091', complianceStatus: 'Active', isPaused: false } as Property;
const ROSA = { id: 'prop-1', name: 'Villa Rosa' };
const BLU = { id: 'prop-2', name: 'Casa Blu' };

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

const NO_STRIPE = { connectedAccountId: null, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, requirementsDue: [] };

/** The rows of the active list and of the health, written as the server writes them: made-up names, as the real ones are entered by the administrator. */
const row = (over: Partial<MarketplaceActiveIntegration> = {}): MarketplaceActiveIntegration => ({
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  property: ROSA,
  status: 'Active',
  isDeclared: false,
  lastSyncedAt: '2026-11-12T14:05:00Z',
  declaredAt: null,
  verifiedAt: null,
  ...over,
});

const item = (over: Partial<MarketplaceHealthItem> = {}): MarketplaceHealthItem => ({
  activationId: 'act-1',
  propertyId: 'prop-1',
  propertyName: 'Villa Rosa',
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  status: 'Active',
  isDeclared: false,
  lastSyncedAt: '2026-11-12T14:05:00Z',
  error: null,
  quota: null,
  changeRequestedAt: null,
  ...over,
});

const PROVIDER: MarketplaceActiveProvider = {
  supplierOrgId: 'sup-1',
  supplierName: 'Pulizie Express Srl',
  requestsCount: 4,
  openCount: 2,
  lastRequestAt: '2026-11-10T09:00:00Z',
  lastCategory: 'cleaning',
};

const items = (...rows: MarketplaceHealthItem[]): MarketplaceHealthRead => ({ outcome: 'items', items: rows });

function renderPage(route = '/app/short-rent/marketplace/mine') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <MarketplaceMinePage />
          <Where />
        </MemoryRouter>
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
  workspace.permissions = new Set(['short-rent:booking.read', 'short-rent:property.read', 'short-rent:ota.read', 'short-rent:ota.write']);
  flags.connector = true;
  api.getMarketplaceActive.mockResolvedValue({ integrations: [row()], providers: [] });
  api.getMarketplaceHealth.mockResolvedValue(items(item()));
  api.getMarketplaceEntry.mockResolvedValue({
    kind: 'Channel',
    code: 'PORTAL1',
    name: 'TEST Portal',
    logoUrl: null,
    status: 'Active',
    whatItDoes: 'It sells.',
    audience: 'Hosts.',
    activation: { type: 'api', requirements: [], needsOctoratePanel: false },
    cost: { text: null, invoicedBy: 'Unknown' },
    dataShared: [],
    deactivation: { text: '', guided: false },
    faq: [],
    actions: { canActivate: false, reason: null },
  });
  api.getProperties.mockResolvedValue([PROPERTY]);
  api.getCalendarOverview.mockResolvedValue(feeds(0));
  api.getConnectStatus.mockResolvedValue(NO_STRIPE);
  await i18n.changeLanguage('it');
});

// A card that opened its detail card leaves who opened it to the drawer: forgotten after the test, as the tests of the drawer of the app do.
afterEach(async () => {
  cleanup();
  await settleDrawer();
});

describe('MarketplaceMinePage · Attivi', () => {
  it('MarketplaceMinePage_IntegrationsAndProviders_AreInTheSameTab', async () => {
    api.getCalendarOverview.mockResolvedValue(feeds(2));
    api.getMarketplaceActive.mockResolvedValue({ integrations: [row()], providers: [PROVIDER] });
    renderPage();

    const list = await screen.findByTestId('marketplace-active-integrations');
    // CasaZen's own calendars, and what the server lists.
    expect(within(list).getByTestId('marketplace-integration-calendars')).toHaveTextContent('2 calendari collegati');
    expect(within(list).getByTestId('marketplace-active-Channel-PORTAL1-prop-1')).toHaveTextContent('TEST Portal');
    // The suppliers already used are in the same tab, with the way to the page of each.
    const providers = await screen.findByTestId('marketplace-providers-section');
    expect(within(providers).getByText('Pulizie Express Srl')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-provider-sup-1-open')).toHaveTextContent('2 richieste aperte');
    expect(providers).toHaveTextContent('Pulizie');
    const link = target('marketplace-provider-sup-1-link');
    expect(link.path).toBe('/app/short-rent/marketplace/suppliers/sup-1');
    expect(link.params.get('propertyId')).toBe('prop-1');
    // The tab is read for the whole scope of the caller, not for one property, and nothing is asked of the suppliers' search.
    expect(api.getMarketplaceActive).toHaveBeenCalledWith(undefined, 'it');
    expect(api.getMarketplaceHealth).toHaveBeenCalledWith(undefined, 'it');
    expect(api.fetchMarketplaceSuppliers).not.toHaveBeenCalled();
  });

  it('MarketplaceMinePage_NothingOn_SaysSoAndLeadsToScopri', async () => {
    api.getMarketplaceActive.mockResolvedValue({ integrations: [], providers: [] });
    renderPage();

    expect(await screen.findByText('Nessuna integrazione attiva')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Scopri le integrazioni' })).toHaveAttribute('href', expect.stringContaining('/app/short-rent/marketplace'));
    expect(screen.queryByTestId('marketplace-health-panel')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_PendingPayments_IsNotListedAsActive', async () => {
    api.getMarketplaceActive.mockResolvedValue({ integrations: [row()], providers: [] });
    api.getConnectStatus.mockResolvedValue({ ...NO_STRIPE, connectedAccountId: 'acct_1' });
    renderPage();

    await screen.findByTestId('marketplace-active-integrations');
    expect(screen.queryByTestId('marketplace-integration-payments')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_EachIntegration_ShowsStatusLastSyncInRomeTheErrorAsSentTheQuotaWarningAndTheRequestedChange', async () => {
    api.getMarketplaceActive.mockResolvedValue({
      integrations: [
        row({ status: 'ToFix' }),
        row({ kind: 'LicensedFunction', code: 'chat', name: 'TEST Chat', status: 'Pending', lastSyncedAt: null }),
      ],
      providers: [],
    });
    api.getMarketplaceHealth.mockResolvedValue(
      items(
        item({
          status: 'ToFix',
          error: { code: 'connection_disabled', message: 'Il collegamento è spento sul channel manager.' },
          quota: { used: 410, limit: 500, warn: true, readAt: '2026-11-12T14:00:00Z' },
        }),
        item({
          activationId: 'act-2',
          kind: 'LicensedFunction',
          code: 'chat',
          name: 'TEST Chat',
          status: 'Requested',
          lastSyncedAt: null,
          changeRequestedAt: '2026-11-11T10:00:00Z',
        }),
      ),
    );
    renderPage();

    const portal = await screen.findByTestId('marketplace-active-Channel-PORTAL1-prop-1');
    expect(within(portal).getByTestId('marketplace-active-Channel-PORTAL1-prop-1-status')).toHaveTextContent('Da correggere');
    // 14:05 UTC is 15:05 in Rome (Europe/Rome, the fallback when the property has no time zone of its own).
    const sync = within(portal).getByTestId('marketplace-active-Channel-PORTAL1-prop-1-sync');
    expect(sync).toHaveTextContent('12 novembre 2026');
    expect(sync).toHaveTextContent('15:05');
    expect(sync).not.toHaveTextContent('14:05');
    // The problem is in the words the server sent; the quota warning is one sentence.
    expect(within(portal).getByTestId('marketplace-active-Channel-PORTAL1-prop-1-error')).toHaveTextContent('Il collegamento è spento sul channel manager.');
    expect(within(portal).getByTestId('marketplace-active-Channel-PORTAL1-prop-1-quota')).toHaveTextContent('La quota del canale è quasi esaurita.');

    // A function that waits for the license is «Richiesta» (never «Attivo»), has no sync to tell, and says when the change was asked.
    const chat = screen.getByTestId('marketplace-active-LicensedFunction-chat-prop-1');
    expect(within(chat).getByTestId('marketplace-active-LicensedFunction-chat-prop-1-status')).toHaveTextContent('Richiesta');
    expect(within(chat).getByTestId('marketplace-active-LicensedFunction-chat-prop-1-sync')).toHaveTextContent('non ancora eseguito');
    expect(within(chat).getByTestId('marketplace-active-LicensedFunction-chat-prop-1-change')).toHaveTextContent('Modifica richiesta il 11 novembre 2026');
  });

  it('MarketplaceMinePage_Declared_SaysDeclaredByYouOnTheDay_AndVerifiedOnlyWhenTheServerSaysSo', async () => {
    api.getMarketplaceActive.mockResolvedValue({
      integrations: [
        row({ kind: 'Partner', code: 'beds', name: 'TEST Beds', property: null, isDeclared: true, declaredAt: '2026-11-10T00:00:00Z', lastSyncedAt: null }),
        row({ kind: 'Partner', code: 'sure', name: 'TEST Sure', property: BLU, isDeclared: false, verifiedAt: '2026-11-09T08:00:00Z', lastSyncedAt: null }),
        row({ kind: 'Partner', code: 'plain', name: 'TEST Plain', property: BLU, isDeclared: false, lastSyncedAt: null }),
      ],
      providers: [],
    });
    renderPage();

    const declared = await screen.findByTestId('marketplace-active-Partner-beds-org');
    expect(within(declared).getByTestId('marketplace-active-Partner-beds-org-trust')).toHaveTextContent('Attivazione dichiarata da te il 10 novembre 2026');
    expect(declared).toHaveTextContent("Tutta l'organizzazione");
    expect(declared).not.toHaveTextContent(/verificata/i);
    // A partner is declared by the host and never read: nothing says it was «not checked yet».
    expect(within(declared).queryByTestId('marketplace-active-Partner-beds-org-sync')).not.toBeInTheDocument();

    expect(screen.getByTestId('marketplace-active-Partner-sure-prop-2-trust')).toHaveTextContent('Attivazione verificata il 9 novembre 2026');
    // Neither declared nor verified: nothing is claimed.
    expect(screen.queryByTestId('marketplace-active-Partner-plain-prop-2-trust')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_DeclaredFunction_SaysTheDayOfRome_AndAPartnerTheDayTheHostGave', async () => {
    api.getMarketplaceActive.mockResolvedValue({
      integrations: [
        // A function of the license is declared at the instant the host asks for it: 23:30 UTC of the 12th is the 13th in Rome.
        row({ kind: 'LicensedFunction', code: 'chat', name: 'TEST Chat', status: 'Pending', isDeclared: true, declaredAt: '2026-11-12T23:30:00Z', lastSyncedAt: null }),
        // A partner's is midnight UTC of the day the host gave: that day, whatever the zone.
        row({ kind: 'Partner', code: 'beds', name: 'TEST Beds', property: null, isDeclared: true, declaredAt: '2026-11-10T00:00:00Z', lastSyncedAt: null }),
      ],
      providers: [],
    });
    renderPage();

    expect(await screen.findByTestId('marketplace-active-LicensedFunction-chat-prop-1-trust')).toHaveTextContent('Attivazione dichiarata da te il 13 novembre 2026');
    expect(screen.getByTestId('marketplace-active-Partner-beds-org-trust')).toHaveTextContent('Attivazione dichiarata da te il 10 novembre 2026');
  });

  it('MarketplaceMinePage_Fix_OpensTheWizardOfTheKindForThatPropertyAndComesBack', async () => {
    api.getMarketplaceActive.mockResolvedValue({
      integrations: [row({ status: 'ToFix' }), row({ kind: 'LicensedFunction', code: 'chat', name: 'TEST Chat', status: 'ToFix' })],
      providers: [],
    });
    api.getMarketplaceHealth.mockResolvedValue(
      items(
        item({ status: 'ToFix', error: { code: 'connection_missing', message: 'Il collegamento non c’è più.' } }),
        item({ activationId: 'act-2', kind: 'LicensedFunction', code: 'chat', name: 'TEST Chat', status: 'ToFix', error: { code: 'license_module_off', message: 'La funzione non è più nella licenza.' } }),
      ),
    );
    renderPage('/app/short-rent/marketplace/mine?propertyId=prop-1');

    await screen.findByTestId('marketplace-active-Channel-PORTAL1-prop-1-fix');
    const channel = target('marketplace-active-Channel-PORTAL1-prop-1-fix');
    expect(channel.path).toBe('/app/short-rent/marketplace/activate/channel/PORTAL1');
    expect(channel.params.get('propertyId')).toBe('prop-1');
    expect(channel.params.get('returnTo')).toBe('/app/short-rent/marketplace/mine?propertyId=prop-1');
    const fn = target('marketplace-active-LicensedFunction-chat-prop-1-fix');
    expect(fn.path).toBe('/app/short-rent/marketplace/request/chat');
    expect(fn.params.get('propertyId')).toBe('prop-1');
    // The panel offers the same two ways: Fix goes to the wizard, Details to the card.
    expect(target('marketplace-health-problem-Channel-PORTAL1-prop-1-fix').path).toBe('/app/short-rent/marketplace/activate/channel/PORTAL1');
    expect(target('marketplace-health-problem-LicensedFunction-chat-prop-1-fix').path).toBe('/app/short-rent/marketplace/request/chat');
  });

  it('MarketplaceMinePage_WithoutTheRightToWrite_OffersNoFix', async () => {
    workspace.permissions = new Set(['short-rent:booking.read', 'short-rent:ota.read']);
    api.getMarketplaceActive.mockResolvedValue({ integrations: [row({ status: 'ToFix' })], providers: [] });
    api.getMarketplaceHealth.mockResolvedValue(items(item({ status: 'ToFix', error: { code: 'connection_missing', message: 'Il collegamento non c’è più.' } })));
    renderPage();

    await screen.findByTestId('marketplace-health-problem-Channel-PORTAL1-prop-1');
    expect(screen.queryByTestId('marketplace-health-problem-Channel-PORTAL1-prop-1-fix')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-active-Channel-PORTAL1-prop-1-fix')).not.toBeInTheDocument();
    // What there is to read is still there.
    expect(screen.getByTestId('marketplace-health-problem-Channel-PORTAL1-prop-1-details')).toBeInTheDocument();
  });

  it('MarketplaceMinePage_ConnectorOffOrNoRightToRead_AsksNothingOfTheHealthAndSaysNothingOfIt', async () => {
    flags.connector = false;
    api.getMarketplaceActive.mockResolvedValue({
      integrations: [row(), row({ kind: 'Partner', code: 'beds', name: 'TEST Beds', property: null, isDeclared: true, declaredAt: '2026-11-10T00:00:00Z' })],
      providers: [],
    });
    renderPage();
    await screen.findByTestId('marketplace-active-integrations');
    // What goes through the channel manager does not exist with the connector off (the server says 404 to it): only the partner and what CasaZen has of its own are in the tab.
    expect(await screen.findByTestId('marketplace-active-Partner-beds-org')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-active-Channel-PORTAL1-prop-1')).not.toBeInTheDocument();
    expect(api.getMarketplaceHealth).not.toHaveBeenCalled();
    expect(screen.queryByTestId('marketplace-health-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-health-error')).not.toBeInTheDocument();
    cleanup();

    flags.connector = true;
    workspace.permissions = new Set(['short-rent:booking.read']);
    renderPage();
    await screen.findByTestId('marketplace-active-integrations');
    expect(api.getMarketplaceHealth).not.toHaveBeenCalled();
    expect(screen.queryByTestId('marketplace-health-panel')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_PropertyWithoutProblems_ShowsOneCalmLine_AndTheOnesWithProblemsComeFirst', async () => {
    api.getMarketplaceActive.mockResolvedValue({
      integrations: [row(), row({ code: 'PORTAL2', name: 'TEST Two', property: BLU }), row({ kind: 'Tool', code: 'TOOL1', name: 'TEST Tool', property: BLU })],
      providers: [],
    });
    api.getMarketplaceHealth.mockResolvedValue(
      items(
        item({ activationId: 'a2', code: 'PORTAL2', name: 'TEST Two', propertyId: 'prop-2', propertyName: 'Casa Blu' }),
        item({ activationId: 'a3', kind: 'Tool', code: 'TOOL1', name: 'TEST Tool', propertyId: 'prop-2', propertyName: 'Casa Blu' }),
        item({ status: 'ToFix', error: { code: 'octorate_partner_failed', message: 'Il canale non ha accettato la richiesta.' } }),
      ),
    );
    renderPage();

    const panel = await screen.findByTestId('marketplace-health-panel');
    const groups = within(panel).getByTestId('marketplace-health-properties').children;
    // The property with the problem is first, with the problem listed; the other one is a single calm line, not a list.
    expect(groups[0]).toHaveAttribute('data-testid', 'marketplace-health-property-prop-1');
    expect(within(groups[0] as HTMLElement).getByTestId('marketplace-health-problem-Channel-PORTAL1-prop-1')).toHaveTextContent('Il canale non ha accettato la richiesta.');
    expect(groups[1]).toHaveAttribute('data-testid', 'marketplace-health-property-prop-2');
    expect(within(groups[1] as HTMLElement).queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByTestId('marketplace-health-property-prop-2-calm')).toHaveTextContent('2 integrazioni attive, nessun problema segnalato.');
    // As of when it is said: the last check (Europe/Rome), for the problem and for the calm line.
    expect(screen.getByTestId('marketplace-health-property-prop-2-checked')).toHaveTextContent('Ultimo controllo: 12 novembre 2026');
    expect(screen.getByTestId('marketplace-health-property-prop-2-checked')).toHaveTextContent('15:05');
    expect(screen.getByTestId('marketplace-health-problem-Channel-PORTAL1-prop-1-sync')).toHaveTextContent('15:05');
  });

  it('MarketplaceMinePage_CalmLine_SaysHowManyWereNeverChecked_NotJustThatNothingIsWrong', async () => {
    api.getMarketplaceActive.mockResolvedValue({ integrations: [row(), row({ code: 'PORTAL2', name: 'TEST Two' })], providers: [] });
    api.getMarketplaceHealth.mockResolvedValue(items(item(), item({ activationId: 'a2', code: 'PORTAL2', name: 'TEST Two', lastSyncedAt: null })));
    renderPage();

    const checked = await screen.findByTestId('marketplace-health-property-prop-1-checked');
    expect(checked).toHaveTextContent('Ultimo controllo: 12 novembre 2026');
    expect(checked).toHaveTextContent('1 non è ancora stata controllata.');
    cleanup();

    // None was ever read: no date is made up.
    api.getMarketplaceHealth.mockResolvedValue(items(item({ lastSyncedAt: null }), item({ activationId: 'a2', code: 'PORTAL2', name: 'TEST Two', lastSyncedAt: null })));
    renderPage();
    const never = await screen.findByTestId('marketplace-health-property-prop-1-checked');
    expect(never).toHaveTextContent('2 non sono ancora state controllate.');
    expect(never).not.toHaveTextContent('Ultimo controllo');
  });

  it('MarketplaceMinePage_WaitingIntegration_IsNeverCountedAsWorking', async () => {
    api.getMarketplaceActive.mockResolvedValue({ integrations: [row({ status: 'Pending' })], providers: [] });
    api.getMarketplaceHealth.mockResolvedValue(items(item({ status: 'Pending' })));
    renderPage();

    await screen.findByTestId('marketplace-health-property-prop-1');
    expect(screen.getByTestId('marketplace-health-property-prop-1-waiting')).toHaveTextContent('1 integrazione in attesa di essere completata.');
    expect(screen.queryByTestId('marketplace-health-property-prop-1-calm')).not.toBeInTheDocument();
    expect(screen.getByTestId('marketplace-active-Channel-PORTAL1-prop-1-status')).toHaveTextContent('In attesa');
  });

  it('MarketplaceMinePage_Quota_SaysThePercentOfTheServersNumbers_AndWhenItWasNotRead', async () => {
    api.getMarketplaceHealth.mockResolvedValue(items(item({ quota: { used: 412, limit: 500, warn: false, readAt: '2026-11-12T14:00:00Z' } })));
    renderPage();

    const quota = await screen.findByTestId('marketplace-health-quota');
    expect(quota).toHaveTextContent('Quota del canale usata: 82% (412 su 500 unità).');
    expect(quota).toHaveAttribute('data-warn', 'false');
    expect(screen.queryByTestId('marketplace-health-quota-warn')).not.toBeInTheDocument();
    expect(within(quota).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '82');
    cleanup();

    api.getMarketplaceHealth.mockResolvedValue(items(item({ quota: { used: 450, limit: 500, warn: true, readAt: '2026-11-12T14:00:00Z' } })));
    renderPage();
    expect(await screen.findByTestId('marketplace-health-quota-warn')).toHaveTextContent('quasi esaurita');
    cleanup();

    // No sync has read it: nothing is said of a share.
    api.getMarketplaceHealth.mockResolvedValue(items(item({ quota: null })));
    renderPage();
    expect(await screen.findByTestId('marketplace-health-quota-unknown')).toHaveTextContent('non è ancora stata letta');
    expect(screen.queryByTestId('marketplace-health-quota')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_HealthReadFails_SaysSoWithARetry_NeverNoProblemReported', async () => {
    api.getMarketplaceHealth.mockRejectedValue(new Error('boom'));
    renderPage();

    const error = await screen.findByTestId('marketplace-health-error');
    expect(error).toHaveTextContent('Non riesco a leggere lo stato dei collegamenti.');
    expect(screen.queryByText(/nessun problema segnalato/)).not.toBeInTheDocument();
    // The integrations that the other read gave are still listed, with nothing said of their health.
    expect(screen.getByTestId('marketplace-active-Channel-PORTAL1-prop-1')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-active-Channel-PORTAL1-prop-1-error')).not.toBeInTheDocument();

    api.getMarketplaceHealth.mockResolvedValue(items(item()));
    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId('marketplace-health-property-prop-1-calm')).toBeInTheDocument();
  });

  it('MarketplaceMinePage_Health403And404_AreSaidAsWhatTheyAre_AndLeaveNoRowsOfAnOlderRead', async () => {
    api.getMarketplaceHealth.mockResolvedValueOnce(items(item({ status: 'ToFix', error: { code: 'connection_missing', message: 'Il collegamento non c’è più.' } })));
    renderPage();

    await screen.findByTestId('marketplace-health-problem-Channel-PORTAL1-prop-1');
    // The same read now answers 404: not found, and the problem of the first read is gone from the panel (no cached rows under it).
    api.getMarketplaceHealth.mockResolvedValueOnce({ outcome: 'notFound' });
    fireEvent.click(screen.getByTestId('marketplace-health-refresh'));
    expect(await screen.findByTestId('marketplace-health-not-found')).toHaveTextContent('non è disponibile');
    expect(screen.queryByTestId('marketplace-health-problem-Channel-PORTAL1-prop-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-health-error')).not.toBeInTheDocument();
    cleanup();

    api.getMarketplaceHealth.mockResolvedValue({ outcome: 'forbidden' });
    renderPage();
    expect(await screen.findByTestId('marketplace-health-forbidden')).toHaveTextContent('Non hai il permesso');
    expect(screen.queryByTestId('marketplace-health-error')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_ActiveReadFails_SaysSoAndIsNotTheEmptyTab', async () => {
    api.getMarketplaceActive.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('marketplace-active-error')).toHaveTextContent('Non riesco a caricare le integrazioni attive.');
    expect(screen.queryByText('Nessuna integrazione attiva')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_CalendarsReadFails_IsNotTheEmptyTab_AndSaysSoWithARetry', async () => {
    // The list of the server is empty, but the state of the calendars could not be read: nothing is known of them, so «nothing is on» is not told.
    api.getMarketplaceActive.mockResolvedValue({ integrations: [], providers: [] });
    api.getCalendarOverview.mockRejectedValue(new Error('boom'));
    renderPage();

    const error = await screen.findByTestId('marketplace-builtins-error');
    expect(error).toHaveTextContent('Non riesco a leggere lo stato dei calendari o dei pagamenti con carta.');
    expect(screen.queryByText('Nessuna integrazione attiva')).not.toBeInTheDocument();

    // Reading again brings the answer: nothing is on, and now every read has said so.
    api.getCalendarOverview.mockResolvedValue(feeds(0));
    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByText('Nessuna integrazione attiva')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-builtins-error')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_CalendarsReadFails_OtherIntegrationsAreStillListed_WithTheNotice', async () => {
    api.getCalendarOverview.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('marketplace-builtins-error')).toBeInTheDocument();
    expect(screen.getByTestId('marketplace-active-Channel-PORTAL1-prop-1')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-integration-calendars')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_DetailCard_HasNoManageButtonBackToThePageItIsOn', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('marketplace-active-Channel-PORTAL1-prop-1-details'));

    // The card of an integration that is on is opened from the Active tab: «Gestisci» would lead to the page the person is already on.
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('It sells.')).toBeInTheDocument();
    expect(within(dialog).queryByTestId('marketplace-entry-action')).not.toBeInTheDocument();
  });

  it('MarketplaceMinePage_Details_SetsTheEntryParameterOfTheDetailCardAndTheProperty', async () => {
    api.getMarketplaceActive.mockResolvedValue({ integrations: [row({ property: BLU })], providers: [] });
    api.getMarketplaceHealth.mockResolvedValue(items(item({ propertyId: 'prop-2', propertyName: 'Casa Blu' })));
    renderPage();

    fireEvent.click(await screen.findByTestId('marketplace-active-Channel-PORTAL1-prop-2-details'));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('entry=Channel%3APORTAL1'));
    expect(screen.getByTestId('where')).toHaveTextContent('propertyId=prop-2');
  });
});
