import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { bookingsApi } from '@/api/bookings.api';
import { fetchComplianceSummary } from '@/api/compliance.api';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { Booking } from '@/types';
import type { ComplianceHandoff } from '@/types/compliance-handoff.types';
import type { ComplianceSummaryItem, ComplianceSummaryResult } from '@/types/compliance.types';
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

// The property of a stay is read from its booking when the button is pressed.
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getById: vi.fn() },
}));

// The Home's «Da fare» tells nothing here: the action does not depend on it (the real one never lists the receipts or the sends by hand).
vi.mock('@/queries/use-dashboard', () => ({
  useDashboardToday: () => ({ data: undefined }),
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
const RECEIPT_BOOKING_ID = '99999999-9999-9999-9999-999999999999';
const LATE_BOOKING_ID = '77777777-7777-7777-7777-777777777777';
const SEND_BOOKING_ID = '66666666-6666-6666-6666-666666666666';
const GREEN_BOOKING_ID = '88888888-8888-8888-8888-888888888888';

const empty = { count: 0, items: [] };

// The items as the server sends them: a stay names only its booking (`propertyId` is null on every item of a stay), the property item of an ISTAT
// month is the property's own, and `handoffTopic` is there only where the outcome is held by the connected area and CasaZen has no proof.
const summary: ComplianceSummaryResult = {
  propertiesPending: { count: 1, items: [{ id: PROPERTY_ID, label: 'Villa Test', action: 'ActivateProperty', propertyId: PROPERTY_ID, bookingId: null }] },
  guestCheckInsIncomplete: {
    count: 1,
    items: [{ id: CHECKIN_BOOKING_ID, label: 'Anna Verdi', action: 'CompleteGuestCheckIn', propertyId: null, bookingId: CHECKIN_BOOKING_ID }],
  },
  checkoutsDue: empty,
  // To send and failed: CasaZen knows their outcome, there is nothing to read in the connected area (no topic).
  alloggiatiManualRequired: {
    count: 1,
    items: [{ id: SEND_BOOKING_ID, label: 'Luca Bruni', action: 'SendAlloggiati', propertyId: null, bookingId: SEND_BOOKING_ID, light: 'Red', reason: 'alloggiati_not_sent' }],
  },
  alloggiatiFailures: {
    count: 1,
    items: [{ id: FAILED_BOOKING_ID, label: 'Carla Neri', action: 'ResolveAlloggiatiFailure', propertyId: null, bookingId: FAILED_BOOKING_ID, light: 'Red', reason: 'alloggiati_failed' }],
  },
  turnoversPending: empty,
  receiptsToUpload: {
    count: 2,
    items: [
      // Entrusted to the channel manager: its outcome is only there (yellow), and the same once the term has passed without a receipt (red).
      {
        id: RECEIPT_BOOKING_ID,
        label: 'Giulia Blu',
        action: 'UploadAlloggiatiReceipt',
        propertyId: null,
        bookingId: RECEIPT_BOOKING_ID,
        light: 'Yellow',
        reason: 'external_verification_required',
        handoffTopic: 'Alloggiati',
      },
      {
        id: LATE_BOOKING_ID,
        label: 'Paolo Gialli',
        action: 'UploadAlloggiatiReceipt',
        propertyId: null,
        bookingId: LATE_BOOKING_ID,
        light: 'Red',
        reason: 'receipt_missing',
        handoffTopic: 'Alloggiati',
      },
      // In order: never an action, whatever else the item says.
      {
        id: GREEN_BOOKING_ID,
        label: 'Sara Verde',
        action: 'UploadAlloggiatiReceipt',
        propertyId: null,
        bookingId: GREEN_BOOKING_ID,
        light: 'Green',
        reason: 'receipt_archived',
        handoffTopic: 'Alloggiati',
      },
    ],
  },
  // The host sends by hand: no connected area to read (no topic).
  manualSendsRequired: {
    count: 1,
    items: [
      {
        id: MANUAL_BOOKING_ID,
        label: 'Mario Rossi',
        action: 'SendAlloggiatiManually',
        propertyId: null,
        bookingId: MANUAL_BOOKING_ID,
        light: 'Red',
        reason: 'connection_inactive',
        handoffTopic: null,
      },
    ],
  },
  // Two months of one property: the first is sent by the channel manager (its outcome is there), the second the host sends by hand.
  periodItems: {
    count: 2,
    items: [
      {
        id: PROPERTY_ID,
        label: 'Villa Test',
        action: 'UploadIstatProof',
        propertyId: PROPERTY_ID,
        bookingId: null,
        period: '2026-10',
        light: 'Yellow',
        reason: 'external_verification_required',
        handoffTopic: 'Istat',
      },
      { id: PROPERTY_ID, label: 'Villa Test', action: 'UploadIstatProof', propertyId: PROPERTY_ID, bookingId: null, period: '2026-09', light: 'Red', reason: 'deadline_overdue', handoffTopic: null },
    ],
  },
};

/** The same summary as an older server sends it: no `handoffTopic` on any item. */
function withoutTopics(result: ComplianceSummaryResult): ComplianceSummaryResult {
  const strip = (items: ComplianceSummaryItem[]) => items.map(({ handoffTopic: _topic, ...rest }) => rest);
  const section = (value: { count: number; items: ComplianceSummaryItem[] } | undefined) => (value ? { ...value, items: strip(value.items) } : undefined);
  return {
    ...result,
    receiptsToUpload: section(result.receiptsToUpload),
    manualSendsRequired: section(result.manualSendsRequired),
    periodItems: section(result.periodItems),
  };
}

const HANDOFF: ComplianceHandoff = {
  handoffId: 'hf_5b0e2c9a41d94c63a8d1',
  startedAt: '2026-11-13T10:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  topic: 'Alloggiati',
  destinationUrl: 'https://panel.example.com/home',
  destinationKind: 'Home',
  returnPath: '/app/short-rent',
  context: { propertyId: PROPERTY_ID, propertyName: 'Villa Test', octorateListingName: null, bookingId: RECEIPT_BOOKING_ID, bookingCode: 'ABCDE-12345', period: null },
  guide: { code: 'alloggiati_daily', menuPath: 'Strutture, poi Questura', check: 'Controlla che il soggiorno risulti inviato.' },
};

/** A failed call as axios builds it. */
function answered(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', config, undefined, { status, statusText: '', headers: {}, config, data });
}

// The button of the yellow row (red ones come first in the list): the name of the row is in its label.
const yellowButton = () => screen.findByRole('button', { name: 'Verifica nel tuo Cassetto Compliance: Giulia Blu' });

const readBooking = vi.mocked(bookingsApi.getById);
const startHandoff = vi.mocked(octorateComplianceHandoffApi.start);

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
  vi.mocked(fetchComplianceSummary).mockResolvedValue(summary);
  readBooking.mockResolvedValue({ id: RECEIPT_BOOKING_ID, propertyId: PROPERTY_ID } as Booking);
  startHandoff.mockResolvedValue(HANDOFF);
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('ComplianceSummaryWidget: «Verifica nel tuo Cassetto Compliance»', () => {
  it('widget_RowsTheServerSaysAreHeldByTheConnectedArea_OfferTheActionNextToTheirOwnButton', async () => {
    renderWidget();

    // The communication entrusted to the channel manager, yellow and red, and the ISTAT month it sends.
    const receipts = await screen.findAllByTestId('compliance-summary-receipts-drawer');
    expect(receipts).toHaveLength(2);
    expect(receipts[0]).toHaveTextContent('Verifica nel tuo Cassetto Compliance');
    expect(screen.getAllByTestId('compliance-summary-periods-drawer')).toHaveLength(1);
    // The button of the row is where it was: the action is one more, not a replacement.
    expect(screen.getAllByTestId('compliance-summary-receipts-link')).toHaveLength(2);
    expect(screen.getAllByTestId('compliance-summary-periods-link')).toHaveLength(2);
    expect(screen.getAllByTestId(/-drawer$/)).toHaveLength(3);
  });

  it('widget_RowsWithNoTopicFromTheServer_HaveNoActionWhateverTheirAction', async () => {
    renderWidget();

    await screen.findAllByTestId('compliance-summary-receipts-drawer');
    // To send, failed, sent by hand and the month the host sends: the outcome is not only in the connected area, so there is nothing to go and read.
    expect(screen.queryByTestId('compliance-summary-alloggiati-manual-drawer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compliance-summary-alloggiati-drawer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compliance-summary-manual-sends-drawer')).not.toBeInTheDocument();
    // Their own buttons are where they were.
    expect(screen.getByTestId('compliance-summary-alloggiati-manual-link')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-summary-alloggiati-link')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-summary-manual-sends-link')).toBeInTheDocument();
  });

  it('widget_OlderServerThatSendsNoTopic_ShowsNoActionAtAll', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(withoutTopics(summary));
    renderWidget();

    expect((await screen.findAllByTestId('compliance-summary-receipts-link')).length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId(/-drawer$/)).toHaveLength(0);
  });

  it('widget_StayOfTheSummary_ReadsItsPropertyFromTheBookingWhenPressedThenAsksForTheStayAndTheRouteOfThePage', async () => {
    renderWidget();
    // Nothing is read, and nothing asked, until the button is pressed.
    const yellow = await yellowButton();
    expect(readBooking).not.toHaveBeenCalled();
    expect(startHandoff).not.toHaveBeenCalled();

    fireEvent.click(yellow);

    expect(await screen.findByTestId('compliance-drawer-ready')).toBeInTheDocument();
    expect(readBooking).toHaveBeenCalledTimes(1);
    expect(readBooking).toHaveBeenCalledWith(RECEIPT_BOOKING_ID);
    expect(startHandoff).toHaveBeenCalledTimes(1);
    expect(startHandoff).toHaveBeenCalledWith({
      topic: 'Alloggiati',
      propertyId: PROPERTY_ID,
      bookingId: RECEIPT_BOOKING_ID,
      period: null,
      returnPath: '/app/short-rent',
    });
  });

  it('widget_StayBeingRead_KeepsTheButtonBusyAndReadsNothingAgain', async () => {
    let resolve: (booking: Booking) => void = () => undefined;
    readBooking.mockReturnValueOnce(new Promise<Booking>((done) => (resolve = done)));
    renderWidget();
    const yellow = await yellowButton();

    fireEvent.click(yellow);

    // The dialog says it is preparing, the button is busy and a second press asks for nothing more.
    expect(await screen.findByTestId('compliance-drawer-loading')).toBeInTheDocument();
    expect(yellow).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(yellow);
    expect(readBooking).toHaveBeenCalledTimes(1);
    expect(startHandoff).not.toHaveBeenCalled();
    expect(screen.getByTestId('compliance-drawer-continue')).toBeDisabled();

    resolve({ id: RECEIPT_BOOKING_ID, propertyId: PROPERTY_ID } as Booking);

    await waitFor(() => expect(screen.getByTestId('compliance-drawer-continue')).toBeEnabled());
    expect(startHandoff).toHaveBeenCalledTimes(1);
  });

  it('widget_StayNotFound_IsSaidAsNotFoundWithNoRetryAndNoHandoffIsAsked', async () => {
    readBooking.mockRejectedValueOnce(answered(404));
    renderWidget();

    fireEvent.click(await yellowButton());

    expect(await screen.findByTestId('compliance-drawer-error')).toHaveTextContent('Non troviamo questa prenotazione o questo immobile');
    expect(screen.queryByTestId('compliance-drawer-retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('compliance-drawer-continue')).not.toBeInTheDocument();
    expect(startHandoff).not.toHaveBeenCalled();
  });

  it('widget_StayThatCannotBeReadNow_IsAFailureWithARetryThatReadsItAgain', async () => {
    readBooking.mockRejectedValueOnce(answered(503));
    renderWidget();

    fireEvent.click(await yellowButton());

    const failed = await screen.findByTestId('compliance-drawer-failed');
    expect(within(failed).getByTestId('compliance-drawer-error')).toHaveTextContent('Non riusciamo a preparare la verifica');
    // Not a success, and not silence: the guide of the topic is there, and the one way forward is to ask again.
    expect(within(failed).getByTestId('compliance-drawer-fallback')).toBeInTheDocument();
    expect(startHandoff).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('compliance-drawer-retry'));

    expect(await screen.findByTestId('compliance-drawer-ready')).toBeInTheDocument();
    expect(readBooking).toHaveBeenCalledTimes(2);
    expect(startHandoff).toHaveBeenCalledTimes(1);
  });

  it('widget_IstatMonth_AsksForThePropertyAndTheMonthAndNoStayWithoutReadingAnyBooking', async () => {
    startHandoff.mockResolvedValue({
      ...HANDOFF,
      topic: 'Istat',
      context: { ...HANDOFF.context, bookingId: null, bookingCode: null, period: '2026-10' },
      guide: { code: 'istat_period', menuPath: 'Strutture, poi ISTAT', check: "Controlla l'invio del periodo." },
    });
    renderWidget();

    fireEvent.click(await screen.findByTestId('compliance-summary-periods-drawer'));

    // The month the host reads is the one the server names, written as a month.
    expect(await screen.findByTestId('compliance-drawer-period')).toHaveTextContent(/ottobre 2026/i);
    expect(readBooking).not.toHaveBeenCalled();
    expect(startHandoff).toHaveBeenCalledWith({
      topic: 'Istat',
      propertyId: PROPERTY_ID,
      bookingId: null,
      period: '2026-10',
      returnPath: '/app/short-rent',
    });
  });

  it('widget_ItemTheApiSaysIsInOrder_HasNoActionToGoAndReadItsOutcomeEvenWithATopic', async () => {
    renderWidget();

    fireEvent.click(await screen.findByRole('button', { name: /adempimento in regola/ }));

    const green = await screen.findByTestId('compliance-summary-green-section');
    expect(green).toHaveTextContent('Sara Verde');
    expect(within(green).queryByTestId(/-drawer$/)).not.toBeInTheDocument();
  });

  it('widget_ConnectorOff_ShowsTheRowsAsTheyWereWithNoAction', async () => {
    renderWidget(false);

    expect(await screen.findByTestId('compliance-summary-alloggiati-manual-link')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/-drawer$/)).toHaveLength(0);
  });

  it('widget_WithoutPermissionToReadBookings_ShowsNoActionAndAsksNothing', async () => {
    permissions.granted = ['property.read', 'property.write'];
    renderWidget();

    await screen.findByTestId('compliance-summary-widget');
    expect(screen.queryAllByTestId(/-drawer$/)).toHaveLength(0);
    expect(readBooking).not.toHaveBeenCalled();
    expect(startHandoff).not.toHaveBeenCalled();
  });
});
