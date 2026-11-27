import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { complianceArchiveApi } from '@/api/compliance-archive.api';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { COMPLIANCE_ARCHIVE_KEY } from '@/queries/compliance-archive';
import type { AlloggiatiStatusDto, AlloggiatiWebStatus } from '@/types/alloggiati.types';
import type { ComplianceHandoff } from '@/types/compliance-handoff.types';
import type { ComplianceArchiveEntry, ComplianceBookingArchive, ComplianceSendLogLine } from '@/types/compliance-archive.types';
import { BookingComplianceSection } from '../booking-compliance-section';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/octorate-compliance-handoff.api', () => ({
  octorateComplianceHandoffApi: { start: vi.fn() },
}));
// What CasaZen holds for the stay (E20/F01/US02): the proofs and the send log, read from the archive of the proofs.
vi.mock('@/api/compliance-archive.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/compliance-archive.api')>()),
  complianceArchiveApi: { getBookingCompliance: vi.fn(), downloadProof: vi.fn() },
}));
vi.mock('@/lib/file-download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/file-download')>()),
  saveBlobAs: vi.fn(),
}));

// The status of the stay is the one the Alloggiati panel reads (the same hook): a no-show owes no communication.
const alloggiati = vi.hoisted(() => ({ status: undefined as AlloggiatiStatusDto | undefined, loading: false, read: vi.fn() }));
vi.mock('@/queries/use-alloggiati', () => ({
  useAlloggiatiStatus: (...args: unknown[]) => {
    alloggiati.read(...args);
    return { data: alloggiati.status, isLoading: alloggiati.loading };
  },
}));

const permissions = vi.hoisted(() => ({ granted: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (contextKey: AppContextKey, permission: string) => contextKey === 'short-rent' && permissions.granted.includes(permission),
  }),
}));

const BOOKING_ID = '11111111-1111-1111-1111-111111111111';
const PROPERTY_ID = '22222222-2222-2222-2222-222222222222';
const ROUTE = '/app/short-rent/bookings/11111111-1111-1111-1111-111111111111?tab=guest';

const HANDOFF: ComplianceHandoff = {
  handoffId: 'hf_5b0e2c9a41d94c63a8d1',
  startedAt: '2026-11-13T10:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  topic: 'Alloggiati',
  destinationUrl: 'https://panel.example.com/home',
  destinationKind: 'Home',
  returnPath: ROUTE,
  context: { propertyId: PROPERTY_ID, propertyName: 'Casa Rossi', octorateListingName: null, bookingId: BOOKING_ID, bookingCode: 'ABCDE-12345', period: null },
  guide: { code: 'alloggiati_short_stay', menuPath: 'Strutture, poi Questura', check: 'Controlla l\'invio manuale del soggiorno.' },
};

function statusOf(status: AlloggiatiWebStatus): AlloggiatiStatusDto {
  return {
    bookingId: BOOKING_ID,
    status,
    confirmationNumber: null,
    errorCode: null,
    reportedAt: null,
    deadlineAt: '2026-11-14T08:00:00Z',
    isShortStay: false,
    hoursUntilDeadline: 5,
    isOverdue: false,
    dataComplete: true,
  };
}

function renderSection({
  status = 'DaInviareManualmente',
  connector = true,
  loading = false,
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
}: { status?: AlloggiatiWebStatus | null; connector?: boolean; loading?: boolean; client?: QueryClient } = {}) {
  alloggiati.status = status === null ? undefined : statusOf(status);
  alloggiati.loading = loading;
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false }}>
        <MemoryRouter initialEntries={[ROUTE]}>
          <BookingComplianceSection booking={{ id: BOOKING_ID, propertyId: PROPERTY_ID }} />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

function proof(id: string, receivedAt: string, overrides: Partial<ComplianceArchiveEntry> = {}): ComplianceArchiveEntry {
  return {
    id,
    kind: 'AlloggiatiReceipt',
    propertyId: PROPERTY_ID,
    propertyName: 'Casa Rossi',
    day: '2026-11-14',
    period: null,
    source: 'manual_upload',
    receivedAt,
    retainUntil: '2031-11-15T09:00:00Z',
    contentType: 'application/pdf',
    downloadPath: `/api/compliance/archive/${id}/download`,
    ...overrides,
  };
}

function logLine(id: string, sentAt: string, overrides: Partial<ComplianceSendLogLine> = {}): ComplianceSendLogLine {
  return { id, kind: 'AlloggiatiGuests', sender: 'ChannelManager', sentAt, reference: null, sentBy: null, ...overrides };
}

function archiveOf(change: Partial<ComplianceBookingArchive> = {}): ComplianceBookingArchive {
  return { bookingId: BOOKING_ID, propertyId: PROPERTY_ID, proofs: [], sendLog: [], ...change };
}

function problem(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data: {}, statusText: '', headers: {}, config });
}

beforeEach(() => {
  permissions.granted = ['booking.read'];
  vi.mocked(octorateComplianceHandoffApi.start).mockResolvedValue(HANDOFF);
  vi.mocked(complianceArchiveApi.getBookingCompliance).mockResolvedValue(archiveOf());
  vi.mocked(complianceArchiveApi.downloadProof).mockResolvedValue({ blob: new Blob(['%PDF'], { type: 'application/pdf' }), contentDisposition: null });
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('BookingComplianceSection', () => {
  it.each(['DaInviare', 'DaInviareManualmente', 'SentReceiptPending', 'Inviato', 'InviatoManualmente', 'Errore'] as const)(
    'section_StayWhoseCommunicationIs%s_OffersTheActionWithItsGuide',
    (status) => {
      renderSection({ status });

      const section = screen.getByRole('region', { name: 'Cassetto Compliance' });
      expect(section).toHaveTextContent("esito dell'invio di questo soggiorno");
      expect(screen.getByRole('button', { name: 'Verifica nel tuo Cassetto Compliance' })).toBeInTheDocument();
    },
  );

  it('section_ActionPressed_AsksForTheAlloggiatiOfThisStayAndComesBackToThisPage', async () => {
    renderSection();

    fireEvent.click(screen.getByTestId('booking-compliance-drawer-trigger'));

    expect(await screen.findByTestId('compliance-drawer-ready')).toBeInTheDocument();
    expect(octorateComplianceHandoffApi.start).toHaveBeenCalledWith({
      topic: 'Alloggiati',
      propertyId: PROPERTY_ID,
      bookingId: BOOKING_ID,
      period: null,
      returnPath: ROUTE,
    });
  });

  it('section_NoShow_IsNotOfferedTheGuestsNeverCameAndNoCommunicationIsDue', () => {
    renderSection({ status: 'NotDue' });

    expect(screen.queryByTestId('booking-compliance-section')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verifica nel tuo Cassetto Compliance' })).not.toBeInTheDocument();
    expect(octorateComplianceHandoffApi.start).not.toHaveBeenCalled();
  });

  it('section_StatusBeingRead_WaitsAndDoesNotAppearAndGo', () => {
    renderSection({ status: null, loading: true });

    expect(screen.queryByTestId('booking-compliance-section')).not.toBeInTheDocument();
  });

  it('section_StatusThatCannotBeRead_StillOffersTheActionTheHandoffDoesNotDependOnIt', () => {
    renderSection({ status: null });

    expect(screen.getByTestId('booking-compliance-section')).toBeInTheDocument();
  });

  it('section_ReadsTheStatusOfThisStayWithTheHookOfThePanelAndOnlyWhenTheActionIsOffered', () => {
    renderSection();
    expect(alloggiati.read).toHaveBeenCalledWith(BOOKING_ID, true);

    cleanup();
    alloggiati.read.mockClear();
    renderSection({ connector: false });
    // Not offered: nothing more is read for it.
    expect(alloggiati.read).toHaveBeenCalledWith(BOOKING_ID, false);
  });

  it('section_ConnectorOff_IsNotOnThePage', () => {
    renderSection({ connector: false });

    expect(screen.queryByTestId('booking-compliance-section')).not.toBeInTheDocument();
  });

  it('section_WithoutPermissionToReadBookings_IsNotOnThePageAndAsksNothing', () => {
    permissions.granted = [];
    renderSection();

    expect(screen.queryByTestId('booking-compliance-section')).not.toBeInTheDocument();
    expect(octorateComplianceHandoffApi.start).not.toHaveBeenCalled();
    expect(complianceArchiveApi.getBookingCompliance).not.toHaveBeenCalled();
  });

  it.each([
    ['a stay that owes nothing', { status: 'NotDue' as const }],
    ['a connector that is off', { connector: false }],
  ])('section_%s_AsksTheArchiveForNothing', (_name, options) => {
    renderSection(options);

    expect(complianceArchiveApi.getBookingCompliance).not.toHaveBeenCalled();
  });
});

// E20/F01/US02 (NF-47): what CasaZen holds for the stay, in the same section, newest first, with the download.
describe('BookingComplianceSection: the proofs and the send log of the stay', () => {
  const records = () => screen.findByTestId('booking-compliance-records', undefined, { timeout: 5000 });

  it('section_Proofs_AreListedNewestFirstWhateverOrderTheServerSentAndEachCanBeDownloaded', async () => {
    vi.mocked(complianceArchiveApi.getBookingCompliance).mockResolvedValue(
      archiveOf({ proofs: [proof('older', '2026-11-14T09:00:00Z'), proof('newest', '2026-11-15T08:30:00Z'), proof('middle', '2026-11-14T18:00:00Z')] }),
    );
    renderSection();

    const list = within(await records()).getByTestId('proof-archive-table');
    const order = within(list)
      .getAllByTestId(/^proof-row-/)
      .map((row) => row.getAttribute('data-testid'));
    expect(order).toEqual(['proof-row-newest', 'proof-row-middle', 'proof-row-older']);
    expect(complianceArchiveApi.getBookingCompliance).toHaveBeenCalledWith(BOOKING_ID);

    fireEvent.click(screen.getByTestId('proof-download-newest'));
    await waitFor(() => expect(complianceArchiveApi.downloadProof).toHaveBeenCalledTimes(1));
    expect(complianceArchiveApi.downloadProof).toHaveBeenCalledWith(expect.objectContaining({ id: 'newest' }));
  });

  it('section_SendLog_IsListedNewestFirstAndALineOfTheChannelManagerSaysEntrustedNeverSent', async () => {
    vi.mocked(complianceArchiveApi.getBookingCompliance).mockResolvedValue(
      archiveOf({
        sendLog: [
          logLine('first', '2026-11-14T08:00:00Z', { sender: 'Manual', sentBy: 'Giulia Bianchi', reference: 'RIC-7', sentAt: '2026-11-14T00:00:00Z' }),
          logLine('last', '2026-11-15T09:30:00Z'),
          // A kind and a sender that a later version of the server may send: this version has no words for them.
          logLine('odd', '2026-11-14T12:00:00Z', { kind: 'SomethingNew' as ComplianceSendLogLine['kind'], sender: 'SomeoneNew' as ComplianceSendLogLine['sender'] }),
        ],
      }),
    );
    renderSection();

    const rows = within(await screen.findByTestId('booking-send-log', undefined, { timeout: 5000 })).getAllByTestId(/^send-log-row-/);
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual(['send-log-row-last', 'send-log-row-odd', 'send-log-row-first']);
    expect(rows[0]).toHaveTextContent('Ospiti alla Questura');
    expect(rows[0]).toHaveTextContent('Affidato al tuo channel manager');
    expect(rows[0].textContent ?? '').not.toMatch(/inviato/i);
    // A kind or a sender of a later version gets the generic words, never its raw name.
    expect(rows[1].textContent ?? '').not.toMatch(/SomethingNew|SomeoneNew/);
    expect(rows[2]).toHaveTextContent('Dichiarato inviato a mano da Giulia Bianchi');
    expect(rows[2]).toHaveTextContent('rif. RIC-7');
  });

  it('section_NothingHeldForTheStay_SaysSoAndInventsNoProof', async () => {
    renderSection();

    await records();
    expect(screen.getByTestId('booking-proofs-empty')).toBeInTheDocument();
    expect(screen.getByTestId('booking-log-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('proof-archive-table')).not.toBeInTheDocument();
    // The action that hands the host to the connected area is still there, as it was.
    expect(screen.getByTestId('booking-compliance-drawer-trigger')).toBeInTheDocument();
  });

  it('section_ArchiveReadThatFails_IsAnErrorWithAWayToTryAgainNeverAnEmptyList', async () => {
    vi.mocked(complianceArchiveApi.getBookingCompliance).mockRejectedValueOnce(problem(500));
    renderSection();

    const failure = await screen.findByTestId('booking-records-error', undefined, { timeout: 5000 });
    expect(screen.queryByTestId('booking-proofs-empty')).not.toBeInTheDocument();

    fireEvent.click(within(failure).getByRole('button', { name: 'Riprova' }));
    await records();
    expect(complianceArchiveApi.getBookingCompliance).toHaveBeenCalledTimes(2);
  });

  it('section_StayNotFound404_IsNotFoundWhateverTheCacheStillHolds', async () => {
    // The proofs of an older read are in the cache; the new read answers 404: the section must not show them.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData([COMPLIANCE_ARCHIVE_KEY, 'booking', BOOKING_ID], archiveOf({ proofs: [proof('cached', '2026-11-14T09:00:00Z')] }));
    vi.mocked(complianceArchiveApi.getBookingCompliance).mockRejectedValue(problem(404));
    renderSection({ client });

    expect(await screen.findByTestId('booking-records-not-found', undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByTestId('proof-row-cached')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-compliance-records')).not.toBeInTheDocument();
  });
});
