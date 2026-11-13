import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { AlloggiatiStatusDto, AlloggiatiWebStatus } from '@/types/alloggiati.types';
import type { ComplianceHandoff } from '@/types/compliance-handoff.types';
import { BookingComplianceSection } from '../booking-compliance-section';

vi.mock('@/api/octorate-compliance-handoff.api', () => ({
  octorateComplianceHandoffApi: { start: vi.fn() },
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

function renderSection({ status = 'DaInviareManualmente', connector = true, loading = false }: { status?: AlloggiatiWebStatus | null; connector?: boolean; loading?: boolean } = {}) {
  alloggiati.status = status === null ? undefined : statusOf(status);
  alloggiati.loading = loading;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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

beforeEach(() => {
  permissions.granted = ['booking.read'];
  vi.mocked(octorateComplianceHandoffApi.start).mockResolvedValue(HANDOFF);
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
  });
});
