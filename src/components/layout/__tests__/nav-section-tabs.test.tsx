import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { NavSectionTabs } from '../nav-section-tabs';
import { PageHeader } from '../page-header';

interface Options {
  hasPermission?: WorkspaceContextValue['hasPermission'];
  flags?: Partial<FeatureFlags>;
  withWorkspace?: boolean;
  children?: React.ReactNode;
}

function renderAt(path: string, { hasPermission = () => true, flags, withWorkspace = true, children = <NavSectionTabs /> }: Options = {}) {
  const workspace: WorkspaceContextValue = {
    contexts: [],
    activeContext: null,
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission,
    getDefaultRoute: () => '/app',
  };
  let ui = <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  if (flags) {
    ui = (
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false }}>{ui}</FeatureFlagsContext.Provider>
    );
  }
  if (withWorkspace) ui = <WorkspaceContext.Provider value={workspace}>{ui}</WorkspaceContext.Provider>;
  return render(ui);
}

const tabs = (name: string) => within(screen.getByRole('navigation', { name })).getAllByRole('link');
const labelsOf = (name: string) => tabs(name).map((link) => link.textContent);

describe('NavSectionTabs (UI-04a)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('NavSectionTabs_EntryOfTheMenu_ShowsItsOwnPageAndThoseThatHangFromIt', () => {
    renderAt('/app/short-rent/bookings');

    const links = tabs('Sezioni di Prenotazioni');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Prenotazioni', '/app/short-rent/bookings'],
      ['Messaggi', '/app/short-rent/messages'],
      ['Ospiti', '/app/short-rent/guests'],
      ['Recensioni', '/app/short-rent/reviews'],
    ]);
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(links.slice(1).every((link) => !link.hasAttribute('aria-current'))).toBe(true);
  });

  it('NavSectionTabs_MessagesNotReadYet_ShowTheirNumberOnTheTabWithTheWordsOfTheMenu', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(['message-hub', 'unread'], {
      items: [
        { threadKey: 'ota:6f1c9a52-1111-4222-8333-944455556666', unreadCount: 2 },
        { threadKey: 'direct:b-1', bookingId: 'b-1', unreadCount: 1 },
      ],
    });
    renderAt('/app/short-rent/bookings', {
      children: (
        <QueryClientProvider client={client}>
          <NavSectionTabs />
        </QueryClientProvider>
      ),
    });

    const messages = within(screen.getByRole('navigation', { name: 'Sezioni di Prenotazioni' })).getByRole('link', { name: /Messaggi/ });
    // The number is on the screen; a screen reader reads what it counts, once.
    expect(messages).toHaveTextContent('Messaggi3, 3 messaggi da leggere');
    expect(messages).toHaveAttribute('href', '/app/short-rent/messages');
    // Only the tab of the messages has a number: the other tabs have none.
    expect(labelsOf('Sezioni di Prenotazioni')).toEqual(['Prenotazioni', 'Messaggi3, 3 messaggi da leggere', 'Ospiti', 'Recensioni']);
  });

  it('NavSectionTabs_NothingToRead_ShowsNoNumber', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(['message-hub', 'unread'], { items: [] });
    renderAt('/app/short-rent/bookings', {
      children: (
        <QueryClientProvider client={client}>
          <NavSectionTabs />
        </QueryClientProvider>
      ),
    });

    expect(labelsOf('Sezioni di Prenotazioni')).toEqual(['Prenotazioni', 'Messaggi', 'Ospiti', 'Recensioni']);
  });

  it.each([
    ['/app/short-rent/messages', 'Messaggi'],
    ['/app/short-rent/guests', 'Ospiti'],
    ['/app/short-rent/reviews', 'Recensioni'],
  ])('NavSectionTabs_PageOfTheSection_%s_HasTheSameTabsAndMarksItself_%s', (path, current) => {
    renderAt(path);

    expect(labelsOf('Sezioni di Prenotazioni')).toEqual(['Prenotazioni', 'Messaggi', 'Ospiti', 'Recensioni']);
    const open = tabs('Sezioni di Prenotazioni').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(open.map((link) => link.textContent)).toEqual([current]);
  });

  it('NavSectionTabs_SectionOfThePayments_NamesTheSectionAfterItsEntry', () => {
    renderAt('/app/short-rent/fiscal');

    expect(labelsOf('Sezioni di Incassi')).toEqual(['Incassi', 'Ricavi', 'Report', 'Regime fiscale', 'Stripe Connect']);
  });

  it('NavSectionTabs_RentalAreaOfLongTerm_HasItsSectionsToo', () => {
    renderAt('/app/long-rent/tenants');

    expect(labelsOf('Sezioni di Contratti')).toEqual(['Contratti', 'Inquilini', 'Scadenze', 'Report fiscale']);
  });

  it('NavSectionTabs_EnglishUi_UsesTheEnglishNames', async () => {
    await i18n.changeLanguage('en');
    renderAt('/app/short-rent/guests');

    expect(labelsOf('Sections of Bookings')).toEqual(['Bookings', 'Messages', 'Guests', 'Reviews']);
  });

  it('NavSectionTabs_UserWhoMayNotOpenAPage_DoesNotSeeItsTab', () => {
    renderAt('/app/short-rent/payments', { hasPermission: (_ctx, permission) => permission !== 'property.write' });

    expect(labelsOf('Sezioni di Incassi')).toEqual(['Incassi', 'Ricavi', 'Report', 'Regime fiscale']);
  });

  it('NavSectionTabs_OtaChannels_AreATabOnlyWhileTheirFlagIsOn', () => {
    renderAt('/app/short-rent/channels', { flags: { otaPartnerApi: false } });
    expect(labelsOf('Sezioni di Immobili')).toEqual(['Immobili', 'Interventi', 'Canali e calendari']);

    cleanup();
    renderAt('/app/short-rent/channels', { flags: { otaPartnerApi: true } });
    expect(labelsOf('Sezioni di Immobili')).toEqual(['Immobili', 'Interventi', 'Canali e calendari', 'OTA']);
  });

  it('NavSectionTabs_TrustedSuppliers_AreATabOnlyOnTheAgencyPlan', () => {
    renderAt('/app/short-rent/channels', { flags: { agencyTier: false } });
    expect(labelsOf('Sezioni di Immobili')).not.toContain('Fornitori fidati');

    cleanup();
    renderAt('/app/short-rent/channels', { flags: { agencyTier: true } });
    expect(labelsOf('Sezioni di Immobili')).toEqual(['Immobili', 'Interventi', 'Fornitori fidati', 'Canali e calendari']);
  });

  it('NavSectionTabs_UserWhoMayNotOpenTheEntry_SeesNoTabs', () => {
    // Without payment.read the pages of Incassi are entries of "Altro" of their own: the tabs would lead to pages the menu does not group.
    renderAt('/app/short-rent/fiscal', { hasPermission: (_ctx, permission) => permission !== 'payment.read' });

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it.each(['/app/short-rent', '/app/short-rent/bookings/calendar', '/app/short-rent/marketplace', '/app/short-rent/bookings/create'])(
    'NavSectionTabs_PageOutsideAnySection_%s_DrawsNothing',
    (path) => {
      const { container } = renderAt(path);

      expect(container).toBeEmptyDOMElement();
    },
  );

  it('NavSectionTabs_StaffConsoleAndSupplierArea_KeepTheirLinksInTheHeaderOfThePage', () => {
    // `/app/admin/cin` has two pages that hang from it, and `NavChildLinks` shows them: the strip would say it twice.
    const { container } = renderAt('/app/admin/cin');

    expect(container).toBeEmptyDOMElement();
  });

  // An isolated test of a page renders it without the workspace or the router (as the pages' own tests do).
  it('NavSectionTabs_NoWorkspace_ShowsEveryPageOfTheSection', () => {
    renderAt('/app/short-rent/bookings', { withWorkspace: false });

    expect(labelsOf('Sezioni di Prenotazioni')).toEqual(['Prenotazioni', 'Messaggi', 'Ospiti', 'Recensioni']);
  });

  it('NavSectionTabs_NoRouter_ShowsNothingAndDoesNotFail', () => {
    const { container } = render(<NavSectionTabs />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('PageHeader draws the tabs of its section (UI-04a)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('PageHeader_PageOfASection_ShowsTheTabsRightUnderItsHead', () => {
    renderAt('/app/short-rent/guests', { children: <PageHeader title="Ospiti" description="Chi ha soggiornato" /> });

    const heading = screen.getByRole('heading', { level: 1, name: 'Ospiti' });
    const nav = screen.getByRole('navigation', { name: 'Sezioni di Prenotazioni' });
    // The strip follows the head in the page.
    expect(heading.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Ospiti' })).toHaveAttribute('aria-current', 'page');
  });

  it('PageHeader_PageOfASectionWithTheTrail_ShowsTheTabsToo', () => {
    renderAt('/app/short-rent/properties', { children: <PageHeader title="Immobili" crumbs="auto" /> });

    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(labelsOf('Sezioni di Immobili')).toEqual(['Immobili', 'Interventi', 'Canali e calendari']);
  });

  it('PageHeader_PageOutsideAnySection_IsTheHeadItAlwaysWas', () => {
    renderAt('/app/short-rent/bookings/calendar', { children: <PageHeader title="Calendario" /> });

    expect(screen.getByRole('heading', { level: 1, name: 'Calendario' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('PageHeader_NoRouter_StillRendersTheHead', () => {
    render(<PageHeader title="Ospiti" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Ospiti' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

// The tabs are drawn by the head of each page of a section: a page of a section that has no `PageHeader` would leave its tab bar
// off, and the user with no way to the other pages of the section but the menu. The rental areas have no other way in.
describe('every page of a section has the head that draws the tabs', () => {
  const sources = import.meta.glob<string>(['/src/**/*.tsx', '!/src/**/*.test.tsx', '!/src/**/__tests__/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });
  const manifest = Object.values(
    import.meta.glob<string>('/src/config/route-manifest.ts', { query: '?raw', import: 'default', eager: true }),
  )[0];

  /** The sources of the component of a page of the manifest: where the exported name it lazy-loads is defined. */
  function componentSources(path: string): string[] {
    const start = manifest.indexOf(`path: '${path}',`);
    const block = manifest.slice(start, manifest.indexOf('\n  },', start));
    const lazy = block.match(/import\('([^']+)'\)\)\.(\w+)/);
    if (!lazy) return [];
    const [, specifier, name] = lazy;
    if (name === 'default') {
      const file = `/src/${specifier.replace(/^@\//, '')}.tsx`;
      return file in sources ? [sources[file]] : [];
    }
    const definition = new RegExp(`export (?:function|const|class) ${name}\\b`);
    return Object.values(sources).filter((source) => definition.test(source));
  }

  const sectionPages = [
    ...new Set(
      ROUTE_MANIFEST.filter((entry) => entry.navParent && (entry.context === 'short-rent' || entry.context === 'long-rent')).flatMap(
        (entry) => [entry.path, entry.navParent as string],
      ),
    ),
  ];

  it('has pages to look at', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    expect(sectionPages.length).toBeGreaterThanOrEqual(25);
  });

  it.each(sectionPages)('%s renders PageHeader', (path) => {
    const files = componentSources(path);

    expect(files.length, `no component found for ${path}`).toBeGreaterThan(0);
    expect(files.some((source) => source.includes('<PageHeader')), `${path} has no <PageHeader>: its section has no tabs there`).toBe(true);
  });
});
