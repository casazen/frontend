import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fetchComplianceSummary } from '@/api/compliance.api';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { ComplianceHandoff } from '@/types/compliance-handoff.types';
import type { ComplianceSummaryResult } from '@/types/compliance.types';
import type { DashboardTodoItem } from '@/types/dashboard.types';
import { ComplianceSummaryWidget } from '../compliance-summary-widget';

vi.mock('@/api/compliance.api', () => ({
  fetchComplianceSummary: vi.fn(),
  fetchComplianceActivation: vi.fn(),
  completeComplianceActivation: vi.fn(),
  startCheckoutWizard: vi.fn(),
  completeCheckoutWizard: vi.fn(),
}));

vi.mock('@/api/octorate-compliance-handoff.api', () => ({
  octorateComplianceHandoffApi: { start: vi.fn() },
}));

// The property of a stay comes from the Home's «Da fare»: what the summary names is the stay, not the property.
const reads = vi.hoisted(() => ({ todo: undefined as unknown }));
vi.mock('@/queries/use-dashboard', () => ({
  useDashboardToday: () => ({ data: reads.todo === undefined ? undefined : { todo: { items: reads.todo } } }),
}));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: undefined }) }));

const permissions = vi.hoisted(() => ({ granted: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (contextKey: AppContextKey, permission: string) => contextKey === 'short-rent' && permissions.granted.includes(permission),
  }),
}));

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const CHECKIN_BOOKING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MANUAL_BOOKING_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const FAILED_BOOKING_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const empty = { count: 0, items: [] };

const summary: ComplianceSummaryResult = {
  propertiesPending: { count: 1, items: [{ id: PROPERTY_ID, label: 'Villa Test', action: 'ActivateProperty', propertyId: PROPERTY_ID, bookingId: null }] },
  guestCheckInsIncomplete: {
    count: 1,
    items: [{ id: CHECKIN_BOOKING_ID, label: 'Anna Verdi', action: 'CompleteGuestCheckIn', propertyId: null, bookingId: CHECKIN_BOOKING_ID }],
  },
  checkoutsDue: empty,
  alloggiatiManualRequired: {
    count: 1,
    items: [{ id: MANUAL_BOOKING_ID, label: 'Mario Rossi', action: 'SendAlloggiati', propertyId: null, bookingId: MANUAL_BOOKING_ID }],
  },
  alloggiatiFailures: {
    count: 1,
    items: [{ id: FAILED_BOOKING_ID, label: 'Carla Neri', action: 'ResolveAlloggiatiFailure', propertyId: null, bookingId: FAILED_BOOKING_ID }],
  },
  turnoversPending: empty,
};

const todoOf = (action: string, bookingId: string): DashboardTodoItem => ({
  action,
  priority: 1,
  dueAt: null,
  label: 'x',
  propertyId: PROPERTY_ID,
  propertyName: 'Villa Test',
  bookingId,
  serviceRequestId: null,
  missing: [],
});

const HANDOFF: ComplianceHandoff = {
  handoffId: 'hf_5b0e2c9a41d94c63a8d1',
  startedAt: '2026-11-13T10:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  topic: 'Alloggiati',
  destinationUrl: 'https://panel.example.com/home',
  destinationKind: 'Home',
  returnPath: '/app/short-rent',
  context: { propertyId: PROPERTY_ID, propertyName: 'Villa Test', octorateListingName: null, bookingId: MANUAL_BOOKING_ID, bookingCode: 'ABCDE-12345', period: null },
  guide: { code: 'alloggiati_daily', menuPath: 'Strutture, poi Questura', check: 'Controlla che il soggiorno risulti inviato.' },
};

function renderWidget(connector = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false }}>
        <MemoryRouter initialEntries={['/app/short-rent']}>
          <Routes>
            <Route path="/app/short-rent" element={<ComplianceSummaryWidget />} />
          </Routes>
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  permissions.granted = ['property.read', 'property.write', 'booking.read', 'booking.write'];
  reads.todo = [todoOf('SendAlloggiati', MANUAL_BOOKING_ID), todoOf('ResolveAlloggiatiFailure', FAILED_BOOKING_ID)];
  vi.mocked(fetchComplianceSummary).mockResolvedValue(summary);
  vi.mocked(octorateComplianceHandoffApi.start).mockResolvedValue(HANDOFF);
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('ComplianceSummaryWidget: «Verifica nel tuo Cassetto Compliance»', () => {
  it('widget_AlloggiatiRowsOfKnownProperty_OfferTheActionNextToTheirOwnButton', async () => {
    renderWidget();

    expect(await screen.findByTestId('compliance-summary-alloggiati-manual-drawer')).toHaveTextContent('Verifica nel tuo Cassetto Compliance');
    expect(screen.getByTestId('compliance-summary-alloggiati-drawer')).toBeInTheDocument();
    // The button of the row is where it was: the action is one more, not a replacement.
    expect(screen.getByTestId('compliance-summary-alloggiati-manual-link')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-summary-alloggiati-link')).toBeInTheDocument();
    // The others are not an Alloggiati communication: no outcome to go and read.
    expect(screen.getAllByTestId(/-drawer$/)).toHaveLength(2);
  });

  it('widget_ActionPressed_AsksForTheStayOfTheRowAndTheRouteOfThePage', async () => {
    renderWidget();

    fireEvent.click(await screen.findByTestId('compliance-summary-alloggiati-manual-drawer'));

    expect(await screen.findByTestId('compliance-drawer-ready')).toBeInTheDocument();
    expect(octorateComplianceHandoffApi.start).toHaveBeenCalledTimes(1);
    expect(octorateComplianceHandoffApi.start).toHaveBeenCalledWith({
      topic: 'Alloggiati',
      propertyId: PROPERTY_ID,
      bookingId: MANUAL_BOOKING_ID,
      period: null,
      returnPath: '/app/short-rent',
    });
  });

  it('widget_ConnectorOff_ShowsTheRowsAsTheyWereWithNoAction', async () => {
    renderWidget(false);

    expect(await screen.findByTestId('compliance-summary-alloggiati-manual-link')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/-drawer$/)).toHaveLength(0);
  });

  it('widget_WithoutPermissionToReadBookings_ShowsNoAction', async () => {
    permissions.granted = ['property.read', 'property.write'];
    renderWidget();

    await screen.findByTestId('compliance-summary-widget');
    expect(screen.queryAllByTestId(/-drawer$/)).toHaveLength(0);
    expect(octorateComplianceHandoffApi.start).not.toHaveBeenCalled();
  });

  it('widget_PropertyOfTheStayNotKnown_ShowsNoActionForIt_TheServerCouldNotCheckATargetWithoutOne', async () => {
    reads.todo = [todoOf('SendAlloggiati', MANUAL_BOOKING_ID)];
    renderWidget();

    expect(await screen.findByTestId('compliance-summary-alloggiati-manual-drawer')).toBeInTheDocument();
    expect(screen.queryByTestId('compliance-summary-alloggiati-drawer')).not.toBeInTheDocument();
    expect(screen.getByTestId('compliance-summary-alloggiati-link')).toBeInTheDocument();
  });
});
