import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ComplianceSummaryWidget } from '../compliance-summary-widget';
import { fetchComplianceSummary } from '@/api/compliance.api';
import type { AppContextKey } from '@/config/route-manifest';
import { freezeClock, NOON_UTC } from '@/test/clock';
import type { ComplianceSummaryItem, ComplianceSummaryResult } from '@/types/compliance.types';

vi.mock('@/api/compliance.api', () => ({
  fetchComplianceSummary: vi.fn(),
  fetchComplianceActivation: vi.fn(),
  completeComplianceActivation: vi.fn(),
  startCheckoutWizard: vi.fn(),
  completeCheckoutWizard: vi.fn(),
}));

// The property, the deadline and the state of a row come from these two reads: the tests of the cockpit do without them, but for the
// list of the properties (the ones in order are behind one line), which a test can hand in.
const reads = vi.hoisted(() => ({ properties: undefined as unknown }));
vi.mock('@/queries/use-dashboard', () => ({ useDashboardToday: () => ({ data: undefined }) }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: reads.properties }) }));

const permissions = vi.hoisted(() => ({ granted: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (contextKey: AppContextKey, permission: string) =>
      contextKey === 'short-rent' && permissions.granted.includes(permission),
  }),
}));

const HOST_PERMISSIONS = ['property.read', 'property.write', 'booking.read', 'booking.write'];
const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const CHECKIN_BOOKING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CHECKOUT_BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MANUAL_BOOKING_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const FAILED_BOOKING_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const TURNOVER_BOOKING_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const empty = { count: 0, items: [] };

/** The cockpit as `GET /api/compliance/summary` returns it (CO-04): action and target, no path. */
const cockpit: ComplianceSummaryResult = {
  propertiesPending: {
    count: 1,
    items: [{ id: PROPERTY_ID, label: 'Villa Test', action: 'ActivateProperty', propertyId: PROPERTY_ID, bookingId: null }],
  },
  guestCheckInsIncomplete: {
    count: 1,
    items: [
      { id: CHECKIN_BOOKING_ID, label: 'Anna Verdi', action: 'CompleteGuestCheckIn', propertyId: null, bookingId: CHECKIN_BOOKING_ID },
    ],
  },
  checkoutsDue: {
    count: 1,
    items: [{ id: CHECKOUT_BOOKING_ID, label: 'Luigi Bianchi', action: 'CheckOut', propertyId: null, bookingId: CHECKOUT_BOOKING_ID }],
  },
  alloggiatiManualRequired: {
    count: 1,
    items: [{ id: MANUAL_BOOKING_ID, label: 'Mario Rossi', action: 'SendAlloggiati', propertyId: null, bookingId: MANUAL_BOOKING_ID }],
  },
  alloggiatiFailures: {
    count: 1,
    items: [
      { id: FAILED_BOOKING_ID, label: 'Carla Neri', action: 'ResolveAlloggiatiFailure', propertyId: null, bookingId: FAILED_BOOKING_ID },
    ],
  },
  turnoversPending: {
    count: 1,
    items: [
      {
        id: TURNOVER_BOOKING_ID,
        label: 'Villa Test · Paolo Gialli',
        action: 'ConfirmPropertyReady',
        propertyId: null,
        bookingId: TURNOVER_BOOKING_ID,
      },
    ],
  },
};

/** Stands for every page of the app: shows where the router went. */
function CurrentLocation() {
  const location = useLocation();
  return createElement('output', { 'data-testid': 'current-location' }, `${location.pathname}${location.search}`);
}

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: ['/app/short-rent'] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/app/short-rent', element: createElement(ComplianceSummaryWidget) }),
          createElement(Route, { path: '*', element: createElement(CurrentLocation) }),
        ),
      ),
    ),
  );
}

beforeEach(() => {
  permissions.granted = HOST_PERMISSIONS;
  reads.properties = undefined;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  cleanup();
});

describe('ComplianceSummaryWidget (CO-11)', () => {
  it('widget_PartialSummaryPayload_FallsBackMissingSectionsToZeroInsteadOfCrashing', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue({
      propertiesPending: cockpit.propertiesPending,
      guestCheckInsIncomplete: empty,
      checkoutsDue: empty,
      alloggiatiManualRequired: cockpit.alloggiatiManualRequired,
    } as ComplianceSummaryResult);

    renderWidget();

    expect(await screen.findByTestId('compliance-summary-properties-link')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-summary-alloggiati-manual-link')).toBeInTheDocument();
    expect(screen.queryByTestId('compliance-summary-alloggiati-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compliance-summary-all-clear')).not.toBeInTheDocument();
  });

  it('widget_AlloggiatiToSendManually_IsAThingToDoNeverAllClear', async () => {
    const summary: ComplianceSummaryResult = {
      propertiesPending: empty,
      guestCheckInsIncomplete: empty,
      checkoutsDue: empty,
      alloggiatiFailures: empty,
      alloggiatiManualRequired: { ...cockpit.alloggiatiManualRequired, count: 12 },
      turnoversPending: empty,
    };
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summary);

    renderWidget();

    // The most pressing thing is the highlighted block, with the button that leads to it; the server lists one of the twelve.
    expect(await screen.findByTestId('compliance-summary-focus')).toHaveTextContent('Alloggiati Web da inviare: Mario Rossi');
    expect(screen.getByTestId('compliance-summary-more')).toHaveTextContent('e altri 11');
    expect(screen.queryByTestId('compliance-summary-all-clear')).not.toBeInTheDocument();
  });

  it('widget_CheckedOutStayWithPropertyNotReady_IsAThingToDoNeverAllClear', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue({
      propertiesPending: empty,
      guestCheckInsIncomplete: empty,
      checkoutsDue: empty,
      alloggiatiFailures: empty,
      alloggiatiManualRequired: empty,
      turnoversPending: cockpit.turnoversPending,
    });

    renderWidget();

    // CO-17: "check-out completato ma property non pronta" is a pending task, never "all clear".
    expect(await screen.findByTestId('compliance-summary-turnovers-link')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-summary-focus')).toHaveTextContent('Villa Test · Paolo Gialli');
    expect(screen.queryByTestId('compliance-summary-all-clear')).not.toBeInTheDocument();
  });
});

describe('ComplianceSummaryWidget links (CO-04, A5-09)', () => {
  it.each([
    ['compliance-summary-properties', `/app/short-rent/properties/${PROPERTY_ID}/activation`],
    ['compliance-summary-checkins', `/app/short-rent/bookings/${CHECKIN_BOOKING_ID}?tab=alloggiati`],
    ['compliance-summary-checkouts', `/app/short-rent/bookings/${CHECKOUT_BOOKING_ID}/checkout`],
    ['compliance-summary-alloggiati-manual', `/app/short-rent/bookings/${MANUAL_BOOKING_ID}?tab=alloggiati`],
    ['compliance-summary-alloggiati', `/app/short-rent/bookings/${FAILED_BOOKING_ID}?tab=alloggiati`],
    ['compliance-summary-turnovers', `/app/short-rent/bookings/${TURNOVER_BOOKING_ID}/checkout`],
  ])('widget_ClickOn_%s_NavigatesTo_%s', async (testId, expected) => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(cockpit);
    renderWidget();

    fireEvent.click(await screen.findByTestId(`${testId}-link`));

    expect(await screen.findByTestId('current-location')).toHaveTextContent(expected);
  });

  it('widget_ReadOnlyUser_OpensTheReadOnlyPageNotTheDashboard', async () => {
    permissions.granted = ['property.read', 'booking.read'];
    vi.mocked(fetchComplianceSummary).mockResolvedValue(cockpit);
    renderWidget();

    fireEvent.click(await screen.findByTestId('compliance-summary-properties-link'));

    expect(await screen.findByTestId('current-location')).toHaveTextContent(`/app/short-rent/properties/${PROPERTY_ID}`);
    expect(screen.getByTestId('current-location').textContent).toBe(`/app/short-rent/properties/${PROPERTY_ID}`);
  });

  it('widget_ActionUnknownToThisVersion_ShowsTheItemWithoutALink', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue({
      ...cockpit,
      checkoutsDue: {
        count: 1,
        items: [{ ...cockpit.checkoutsDue.items[0], action: 'SomethingNew' as never }],
      },
    });
    renderWidget();

    expect(await screen.findByTestId('compliance-summary-checkouts-item')).toHaveTextContent('Luigi Bianchi');
    expect(screen.queryByTestId('compliance-summary-checkouts-link')).not.toBeInTheDocument();
  });
});

describe('ComplianceSummaryWidget levels', () => {
  const manyStays = (count: number, action: 'SendAlloggiati' | 'CheckOut', dueAt?: string): ComplianceSummaryItem[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `stay-${action}-${index}`,
      label: `Ospite ${index + 1}`,
      action,
      propertyId: null,
      bookingId: `stay-${action}-${index}`,
      dueAt,
    }));
  const manyProperties = (count: number): ComplianceSummaryItem[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `property-${index}`,
      label: `Casa ${index + 1}`,
      action: 'ActivateProperty',
      propertyId: `property-${index}`,
      bookingId: null,
    }));

  it('widget_AllLevels_ShowsWhatTheLawDatesFirstThenTheStartOfTheProperties', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(cockpit);
    renderWidget();

    const fine = await screen.findByTestId('compliance-tier-fine');
    const start = screen.getByTestId('compliance-tier-start');
    const chore = screen.getByTestId('compliance-tier-chore');
    // In the page: the law, then the properties that cannot start, then the upkeep.
    expect(fine.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(start.compareDocumentPosition(chore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(fine).toHaveTextContent('Carla Neri');
    expect(fine).toHaveTextContent('Mario Rossi');
    expect(fine).toHaveTextContent('Anna Verdi');
    expect(fine).not.toHaveTextContent('Villa Test');
    expect(start).toHaveTextContent('Villa Test');
    expect(chore).toHaveTextContent('Luigi Bianchi');
    // The block on top is about the law, and says so.
    expect(screen.getByTestId('compliance-summary-focus')).toHaveTextContent('Rischi una sanzione');
    expect(screen.getByTestId('compliance-summary-focus')).toHaveTextContent('Alloggiati Web non accettato: Carla Neri');
  });

  it('widget_ThingsTheLawDates_AreNeverCutBehindSeeAll', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue({ ...cockpit, alloggiatiManualRequired: { count: 6, items: manyStays(6, 'SendAlloggiati') } });
    renderWidget();

    const fine = await screen.findByTestId('compliance-tier-fine');
    // Six to send, one failed, one of the guest data: all there, with no "Vedi tutte" or "Mostra" button.
    expect(fine.querySelectorAll('[data-testid="compliance-summary-row"]')).toHaveLength(8);
    expect(screen.queryByRole('button', { name: /mostra/i })).not.toBeInTheDocument();
  });

  it('widget_ServerListsLessThanItCounts_SaysSoAndLeadsToTheAlloggiatiPage', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue({ ...cockpit, alloggiatiManualRequired: { count: 15, items: manyStays(4, 'SendAlloggiati') } });
    renderWidget();

    const more = await screen.findByTestId('compliance-summary-more');
    expect(more).toHaveTextContent('e altri 11');
    expect(screen.getByRole('link', { name: 'Vedile tutte in Alloggiati' })).toHaveAttribute('href', '/app/short-rent/alloggiati');
  });

  it('widget_DeadlineOfARow_IsInWordsAndTheNearestIsFirst', async () => {
    freezeClock(NOON_UTC);
    const [late, soon] = [manyStays(1, 'SendAlloggiati', '2026-09-21T10:00:00Z')[0], { ...manyStays(2, 'SendAlloggiati')[1], dueAt: '2026-09-24T14:30:00Z' }];
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryWith({ alloggiatiManualRequired: { count: 2, items: [soon, late] } }));
    renderWidget();

    const rows = (await screen.findByTestId('compliance-tier-fine')).querySelectorAll('[data-testid="compliance-summary-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Scaduto da 3 giorni');
    expect(rows[1]).toHaveTextContent('Entro oggi alle 16:30');
    expect(screen.getByTestId('compliance-summary-focus')).toHaveTextContent('Scaduto da 3 giorni');
  });

  it('widget_ManyPropertiesToActivate_ShowThreeAndTheRestOnRequest', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryWith({ propertiesPending: { count: 5, items: manyProperties(5) } }));
    renderWidget();

    const start = await screen.findByTestId('compliance-tier-start');
    expect(start.querySelectorAll('[data-testid="compliance-summary-row"]')).toHaveLength(3);
    // A calm tone: no deadline and no red on what only keeps a property from starting.
    expect(start).not.toHaveTextContent(/scadut|entro/i);
    // The explanation of the level: what happens until they are in order.
    expect(start).toHaveTextContent('non si possono prenotare dal tuo sito');

    fireEvent.click(screen.getByRole('button', { name: 'Mostra le altre 2' }));
    expect(start.querySelectorAll('[data-testid="compliance-summary-row"]')).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: 'Mostra meno' }));
    expect(start.querySelectorAll('[data-testid="compliance-summary-row"]')).toHaveLength(3);
  });

  it('widget_OnlyTheStartOfAProperty_TheBlockIsCalmAndNoLevelOfTheLawIsShown', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryWith({ propertiesPending: { count: 1, items: manyProperties(1) } }));
    renderWidget();

    const focus = await screen.findByTestId('compliance-summary-focus');
    expect(focus).toHaveTextContent('Per iniziare a lavorare');
    expect(focus).toHaveTextContent('Completa l\'attivazione di Casa 1');
    expect(focus).toHaveAttribute('data-tone', 'neutral');
    expect(screen.queryByTestId('compliance-tier-fine')).not.toBeInTheDocument();
  });

  it('widget_TheLawIsLate_TheBlockIsRed', async () => {
    freezeClock(NOON_UTC);
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryWith({ alloggiatiManualRequired: { count: 1, items: manyStays(1, 'SendAlloggiati', '2026-09-21T10:00:00Z') } }),
    );
    renderWidget();

    expect(await screen.findByTestId('compliance-summary-focus')).toHaveAttribute('data-tone', 'danger');
  });

  it('widget_PropertiesInOrder_AreBehindOneLineAndNeverCountedAsToDo', async () => {
    reads.properties = [{ id: 'ok-1', name: 'Casa in regola', city: 'Como', complianceStatus: 'Active' }];
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryWith({ checkoutsDue: cockpit.checkoutsDue }));
    renderWidget();

    const toggle = await screen.findByRole('button', { name: '1 casa in regola' });
    expect(screen.queryByTestId('compliance-summary-properties-section')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('compliance-summary-properties-section')).toHaveTextContent('Casa in regola');
  });

  it('widget_NothingPending_SaysAllClear', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryWith({}));
    renderWidget();

    expect(await screen.findByTestId('compliance-summary-all-clear')).toBeInTheDocument();
    expect(screen.queryByTestId('compliance-tier-fine')).not.toBeInTheDocument();
  });
});

function summaryWith(parts: Partial<ComplianceSummaryResult>): ComplianceSummaryResult {
  return {
    propertiesPending: empty,
    guestCheckInsIncomplete: empty,
    checkoutsDue: empty,
    alloggiatiFailures: empty,
    alloggiatiManualRequired: empty,
    turnoversPending: empty,
    ...parts,
  };
}
