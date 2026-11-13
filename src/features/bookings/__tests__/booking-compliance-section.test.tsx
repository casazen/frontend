import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { Booking } from '@/types';
import type { ComplianceHandoff } from '@/types/compliance-handoff.types';
import { BookingComplianceSection } from '../booking-compliance-section';

vi.mock('@/api/octorate-compliance-handoff.api', () => ({
  octorateComplianceHandoffApi: { start: vi.fn() },
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

function renderSection(status: Booking['status'] = 'Confirmed', connector = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false }}>
        <MemoryRouter initialEntries={[ROUTE]}>
          <BookingComplianceSection booking={{ id: BOOKING_ID, propertyId: PROPERTY_ID, status }} />
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
  it.each(['Confirmed', 'CheckedIn', 'CheckedOut'] as const)('section_%sBooking_OffersTheActionWithItsGuide', (status) => {
    renderSection(status);

    const section = screen.getByRole('region', { name: 'Cassetto Compliance' });
    expect(section).toHaveTextContent('esito dell\'invio di questo soggiorno');
    expect(screen.getByRole('button', { name: 'Verifica nel tuo Cassetto Compliance' })).toBeInTheDocument();
  });

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

  it.each(['Pending', 'Cancelled'] as const)('section_%sBooking_IsNotShown_ThereIsNoStayToCheck', (status) => {
    renderSection(status);

    expect(screen.queryByTestId('booking-compliance-section')).not.toBeInTheDocument();
  });

  it('section_ConnectorOff_IsNotOnThePage', () => {
    renderSection('Confirmed', false);

    expect(screen.queryByTestId('booking-compliance-section')).not.toBeInTheDocument();
  });

  it('section_WithoutPermissionToReadBookings_IsNotOnThePageAndAsksNothing', () => {
    permissions.granted = [];
    renderSection();

    expect(screen.queryByTestId('booking-compliance-section')).not.toBeInTheDocument();
    expect(octorateComplianceHandoffApi.start).not.toHaveBeenCalled();
  });
});
