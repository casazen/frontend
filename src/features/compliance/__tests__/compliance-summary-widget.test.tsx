import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ComplianceSummaryWidget } from '../compliance-summary-widget';
import { fetchComplianceSummary } from '@/api/compliance.api';
import type { AppContextKey } from '@/config/route-manifest';
import type { ComplianceSummaryResult } from '@/types/compliance.types';

vi.mock('@/api/compliance.api', () => ({
  fetchComplianceSummary: vi.fn(),
  fetchComplianceActivation: vi.fn(),
  completeComplianceActivation: vi.fn(),
  startCheckoutWizard: vi.fn(),
  completeCheckoutWizard: vi.fn(),
}));

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
});

afterEach(() => {
  vi.clearAllMocks();
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

    expect(await screen.findByTestId('compliance-summary-properties-count')).toHaveTextContent('1');
    expect(screen.getByTestId('compliance-summary-alloggiati-manual-count')).toHaveTextContent('1');
    expect(screen.getByTestId('compliance-summary-alloggiati-count')).toHaveTextContent('0');
    expect(screen.queryByText('Tutte le attività di compliance sono aggiornate.')).not.toBeInTheDocument();
  });

  it('widget_AlloggiatiToSendManually_IsCountedInOrangeNotAllClear', async () => {
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

    const count = await screen.findByTestId('compliance-summary-alloggiati-manual-count');
    expect(count).toHaveTextContent('12');
    expect(count.className).toContain('bg-orange-500');
    expect(count.className).not.toContain('bg-green');
    expect(screen.getByText('Alloggiati da inviare manualmente')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-summary-alloggiati-manual-more')).toHaveTextContent('e altri 11');
    expect(screen.queryByText('Tutte le attività di compliance sono aggiornate.')).not.toBeInTheDocument();
  });

  it('widget_CheckedOutStayWithPropertyNotReady_IsCountedAsATurnoverToClose', async () => {
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
    const count = await screen.findByTestId('compliance-summary-turnovers-count');
    expect(count).toHaveTextContent('1');
    expect(count.className).toContain('bg-orange-500');
    expect(screen.getByText('Proprietà da dichiarare pronte')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-summary-turnovers-link')).toHaveTextContent('Villa Test · Paolo Gialli');
    expect(screen.queryByText('Tutte le attività di compliance sono aggiornate.')).not.toBeInTheDocument();
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
