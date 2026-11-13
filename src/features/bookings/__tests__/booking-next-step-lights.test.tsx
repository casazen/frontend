import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { fetchComplianceSummary } from '@/api/compliance.api';
import type { AppContextKey } from '@/config/route-manifest';
import i18n from '@/i18n/config';
import { useAlloggiatiStatus } from '@/queries/use-alloggiati';
import { expectNoAxeViolations } from '@/test/axe';
import { freezeClock, NOON_UTC } from '@/test/clock';
import type { Booking } from '@/types';
import type { ComplianceCockpitAction, ComplianceSummaryItem, ComplianceSummaryResult } from '@/types/compliance.types';
import { BookingNextStep } from '../components/booking-next-step';

vi.mock('@/api/compliance.api', () => ({ fetchComplianceSummary: vi.fn() }));
vi.mock('@/queries/use-alloggiati', () => ({ useAlloggiatiStatus: vi.fn() }));
vi.mock('@/queries/use-checkin', () => ({
  useBookingCheckInSession: () => ({ data: undefined, isLoading: false }),
  useSendCheckInLink: () => ({ mutate: vi.fn(), isPending: false }),
}));
const workspace = vi.hoisted(() => ({ granted: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (contextKey: AppContextKey, permission: string) => contextKey === 'short-rent' && workspace.granted.includes(permission),
  }),
}));

const BOOKING_ID = 'b0c1d2e3-0000-4000-8000-000000000001';
const HOST = ['booking.read', 'booking.write', 'property.read'];

const stay = (status: Booking['status']): Booking =>
  ({
    id: BOOKING_ID,
    status,
    source: 'Direct',
    onSiteRequestState: null,
    checkInDate: '2026-09-10T00:00:00Z',
    checkOutDate: '2026-09-12T00:00:00Z',
    guest: { firstName: 'Mario', lastName: 'Rossi' },
  }) as unknown as Booking;

const empty = { count: 0, items: [] };
const summaryOf = (parts: Partial<ComplianceSummaryResult>): ComplianceSummaryResult => ({
  propertiesPending: empty,
  guestCheckInsIncomplete: empty,
  checkoutsDue: empty,
  alloggiatiFailures: empty,
  alloggiatiManualRequired: empty,
  turnoversPending: empty,
  ...parts,
});
const item = (action: ComplianceCockpitAction, light: ComplianceSummaryItem['light'], reason: string, extra: Partial<ComplianceSummaryItem> = {}): ComplianceSummaryItem => ({
  id: BOOKING_ID,
  label: 'Mario Rossi',
  action,
  propertyId: null,
  bookingId: BOOKING_ID,
  light,
  reason,
  ...extra,
});
const section = (...items: ComplianceSummaryItem[]) => ({ count: items.length, items });

function renderStep(booking = stay('CheckedOut'), canWrite = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(BookingNextStep, { booking, canWrite, onConfirm: vi.fn(), onDecline: vi.fn(), onArrival: vi.fn() })),
    ),
  );
}

beforeEach(async () => {
  freezeClock(NOON_UTC);
  workspace.granted = HOST;
  await i18n.changeLanguage('it');
  // A stay that is over, whose communication was sent: the step it gives is «concluso» until a light says otherwise.
  vi.mocked(useAlloggiatiStatus).mockReturnValue({
    data: { status: 'Inviato', isOverdue: false, deadlineAt: '2026-09-11T10:00:00Z', dataComplete: true },
    isLoading: false,
  } as unknown as ReturnType<typeof useAlloggiatiStatus>);
  vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({}));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  cleanup();
});

// E03/F03/US01/T02 (NF-52, AC-NF52-9): the booking card shows the light of its compliance items, with the same component and words as the page.
describe('BookingNextStep and the compliance lights of the stay', () => {
  it('BookingNextStep_RedReceipt_IsTheNextStepWithTheButtonOfTheRightTab', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({ receiptsToUpload: section(item('UploadAlloggiatiReceipt', 'Red', 'receipt_missing')), identityPending: section(item('VerifyIdentity', 'Green', 'identity_verified')) }),
    );
    renderStep();

    const block = await screen.findByTestId('booking-next-step');
    await waitFor(() => expect(block).toHaveAttribute('data-next-step', 'compliance'));
    expect(block).toHaveTextContent('Carica la ricevuta di Alloggiati Web: Mario Rossi');
    expect(block).toHaveTextContent('È stato inviato, ma la ricevuta non è archiviata: caricala.');
    expect(block).toHaveTextContent('Tocca a te');
    expect(block).toHaveAttribute('data-tone', 'warning');
    // The existing route of the action: the tab of the booking where the communication is followed.
    expect(screen.getByTestId('booking-next-compliance')).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`);
    expect(screen.getByTestId('booking-next-compliance')).toHaveTextContent('Carica la ricevuta');
    // The red one is the block itself: a green one is not listed next to it.
    expect(screen.queryByTestId('compliance-lines')).not.toBeInTheDocument();
  });

  it('BookingNextStep_ItemInHandWithTheChannelManager_IsYellowAndTheBlockSaysItIsInProgress', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ receiptsToUpload: section(item('UploadAlloggiatiReceipt', 'Yellow', 'entrusted_to_channel_manager')) }));
    renderStep();

    const block = await screen.findByTestId('booking-next-step');
    await waitFor(() => expect(block).toHaveAttribute('data-next-step', 'compliance'));
    expect(block).toHaveTextContent('Un adempimento è in corso');
    expect(block).toHaveTextContent('Se ne occupa il tuo channel manager: aspettiamo la ricevuta.');
    expect(block).toHaveAttribute('data-tone', 'info');
    expect(block).not.toHaveTextContent('Tocca a te');
  });

  it('BookingNextStep_TwoItems_ListsTheOtherOneWithTheSameLightAndItsOwnButton', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({ receiptsToUpload: section(item('UploadAlloggiatiReceipt', 'Red', 'receipt_missing')), identityPending: section(item('VerifyIdentity', 'Yellow', 'selfie_awaited')) }),
    );
    renderStep();

    const lines = await screen.findByTestId('compliance-lines');
    const [line] = within(lines).getAllByTestId('compliance-line');
    expect(within(lines).getAllByTestId('compliance-line')).toHaveLength(1);
    expect(line).toHaveAttribute('data-action', 'VerifyIdentity');
    expect(within(line).getByRole('img', { name: "In corso: Aspettiamo il selfie dell'ospite prima dell'arrivo." })).toHaveTextContent('In corso');
    expect(line).toHaveTextContent("Identità dell'ospite");
    // The tab that shows the check-in link and what the guest sent.
    expect(within(line).getByTestId('compliance-line-action')).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}?tab=guest`);
    expect(within(line).getByTestId('compliance-line-action')).toHaveTextContent("Controlla l'identità");
  });

  it('BookingNextStep_EverythingInOrder_ListsEachLightInOrderAndKeepsTheStep', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({ receiptsToUpload: section(item('UploadAlloggiatiReceipt', 'Green', 'receipt_archived')), identityPending: section(item('VerifyIdentity', 'Green', 'identity_verified')) }),
    );
    renderStep();

    const lines = await screen.findByTestId('compliance-lines');
    expect(screen.getByTestId('booking-next-step')).toHaveAttribute('data-next-step', 'completed');
    const rows = within(lines).getAllByTestId('compliance-line');
    expect(rows.map((row) => row.getAttribute('data-light'))).toEqual(['green', 'green']);
    // Nothing is asked here: no button. And a line says only what the API told, never «tutto a posto».
    expect(within(lines).queryByRole('link')).not.toBeInTheDocument();
    expect(lines).toHaveTextContent('La ricevuta è archiviata.');
  });

  it('BookingNextStep_NoItemsOrNoLight_IsTheCardOfAlways', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({
        // An older API, or the traffic light off: items with no light (and one of another stay) say nothing on a card.
        alloggiatiManualRequired: section(item('SendAlloggiati', undefined, '')),
        receiptsToUpload: section(item('UploadAlloggiatiReceipt', 'Red', 'receipt_missing', { id: 'other', bookingId: 'other' })),
      }),
    );
    renderStep();

    await waitFor(() => expect(fetchComplianceSummary).toHaveBeenCalled());
    const block = await screen.findByTestId('booking-next-step');
    expect(block).toHaveAttribute('data-next-step', 'completed');
    expect(screen.queryByTestId('compliance-lines')).not.toBeInTheDocument();
  });

  it('BookingNextStep_WithoutTheRightToReadTheBookings_NeverAsksTheSummary', async () => {
    workspace.granted = ['property.read'];
    renderStep();

    // A bare 403 on a GET takes the user to «nessun accesso»: the card does not ask what it may not read.
    expect(await screen.findByTestId('booking-next-step')).toHaveAttribute('data-next-step', 'completed');
    expect(fetchComplianceSummary).not.toHaveBeenCalled();
  });

  it.each(['Pending', 'Cancelled'] as const)('BookingNextStep_%sStay_NeverAsksTheSummary', async (status) => {
    renderStep(stay(status));

    await screen.findByTestId('booking-next-step');
    expect(fetchComplianceSummary).not.toHaveBeenCalled();
  });

  it('BookingNextStep_LightsStillLoading_DoesNotSayConcludedAndTakeItBack', async () => {
    let answer: (summary: ComplianceSummaryResult) => void = () => {};
    vi.mocked(fetchComplianceSummary).mockReturnValue(new Promise<ComplianceSummaryResult>((resolve) => (answer = resolve)));
    renderStep();

    // «Concluso» would be said and taken back a moment later: the block keeps its place and waits.
    expect(await screen.findByTestId('booking-next-step-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-next-step')).not.toBeInTheDocument();

    answer(summaryOf({ receiptsToUpload: section(item('UploadAlloggiatiReceipt', 'Red', 'receipt_missing')) }));

    await waitFor(() => expect(screen.getByTestId('booking-next-step')).toHaveAttribute('data-next-step', 'compliance'));
    expect(screen.queryByTestId('booking-next-step-loading')).not.toBeInTheDocument();
  });

  it('BookingNextStep_LightsStillLoading_AStepThatAsksSomethingIsSaidAtOnce', async () => {
    vi.mocked(fetchComplianceSummary).mockReturnValue(new Promise<ComplianceSummaryResult>(() => {}));
    vi.mocked(useAlloggiatiStatus).mockReturnValue({
      data: { status: 'DaInviareManualmente', isOverdue: false, deadlineAt: '2026-09-11T10:00:00Z', dataComplete: true },
      isLoading: false,
    } as unknown as ReturnType<typeof useAlloggiatiStatus>);
    renderStep();

    expect(await screen.findByTestId('booking-next-step')).toHaveAttribute('data-next-step', 'sendAlloggiati');
  });

  it('BookingNextStep_SummaryFails_SaysWhatItAlwaysSaidAndNothingAsInOrderOrAsAnError', async () => {
    vi.mocked(fetchComplianceSummary).mockRejectedValue(new Error('boom'));
    renderStep();

    const block = await screen.findByTestId('booking-next-step');
    expect(block).toHaveAttribute('data-next-step', 'completed');
    expect(screen.queryByTestId('compliance-lines')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('BookingNextStep_WhoMayNotWrite_IsLedToThePageNotToldToDoIt', async () => {
    workspace.granted = ['booking.read', 'property.read'];
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({ receiptsToUpload: section(item('UploadAlloggiatiReceipt', 'Red', 'receipt_missing')) }));
    renderStep(stay('CheckedOut'), false);

    const action = await screen.findByTestId('booking-next-compliance');
    expect(action).toHaveTextContent('Apri');
    expect(action).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}?tab=alloggiati`);
    expect(screen.getByTestId('booking-next-step')).not.toHaveTextContent('Tocca a te');
  });

  it('BookingNextStep_WithLights_HasNoAccessibilityViolation', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({ receiptsToUpload: section(item('UploadAlloggiatiReceipt', 'Red', 'receipt_missing')), identityPending: section(item('VerifyIdentity', 'Yellow', 'selfie_awaited')) }),
    );
    const { container } = renderStep();

    await screen.findByTestId('compliance-lines');
    await expectNoAxeViolations(container);
  });
});
