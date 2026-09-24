import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlloggiatiGuestSummary } from '../components/alloggiati-guest-summary';
import { alloggiatiApi } from '@/api/alloggiati.api';
import type { AlloggiatiGuestSummaryDto } from '@/types/alloggiati.types';

vi.mock('@/api/alloggiati.api', () => ({
  alloggiatiApi: { getSummary: vi.fn(), getStatus: vi.fn(), getGuestSummary: vi.fn(), markSentManually: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const summary: AlloggiatiGuestSummaryDto = {
  bookingId: BOOKING_ID,
  status: 'DaInviareManualmente',
  arrivalDate: '2026-10-10T00:00:00Z',
  stayDays: 3,
  stayExceedsMaxDays: false,
  declaredGuests: 3,
  guests: [
    {
      guestId: 'g1',
      kind: 'HeadOfFamilyOrGroup',
      arrivalDate: '2026-10-10T00:00:00Z',
      stayDays: 3,
      lastName: 'Rossi',
      firstName: 'Mario',
      gender: 'Male',
      dateOfBirth: '1980-04-02T00:00:00Z',
      placeOfBirth: 'Milano (MI)',
      citizenship: 'Italiana',
      documentType: 'IdentityCard',
      documentNumber: 'CA12345AB',
      documentIssuePlace: '',
      missingFields: ['documentIssuePlace'],
    },
  ],
};

function renderSummary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(AlloggiatiGuestSummary, { bookingId: BOOKING_ID })));
}

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('AlloggiatiGuestSummary (CO-11)', () => {
  it('guestSummary_Loaded_ShowsTheRecordFieldsInOrderAsText', async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue(summary);
    renderSummary();

    const guest = await screen.findByTestId('alloggiati-guest-0');
    const fields = within(guest)
      .getAllByTestId(/^alloggiati-field-/)
      .map((row) => row.getAttribute('data-testid')!.replace('alloggiati-field-', ''));
    expect(fields).toEqual([
      'kind',
      'arrivalDate',
      'stayDays',
      'lastName',
      'firstName',
      'gender',
      'dateOfBirth',
      'placeOfBirth',
      'citizenship',
      'documentType',
      'documentNumber',
      'documentIssuePlace',
    ]);
    expect(within(guest).getByTestId('alloggiati-field-arrivalDate')).toHaveTextContent('10/10/2026');
    expect(within(guest).getByTestId('alloggiati-field-gender')).toHaveTextContent('Maschio');
    expect(within(guest).getByTestId('alloggiati-field-documentType')).toHaveTextContent("Carta d'identita'");
    expect(within(guest).getByTestId('alloggiati-field-documentNumber')).toHaveTextContent('CA12345AB');
    expect(within(guest).getByTestId('alloggiati-field-documentIssuePlace')).toHaveTextContent('Mancante');
    expect(screen.getByTestId('alloggiati-unregistered-guests')).toHaveTextContent('Altri 2 ospiti dichiarati');
  });

  it('guestSummary_ApiError_ShowsErrorNotEmpty', async () => {
    vi.mocked(alloggiatiApi.getGuestSummary).mockRejectedValue(new Error('boom'));
    renderSummary();

    expect(await screen.findByTestId('alloggiati-guest-summary-error')).toHaveTextContent(
      "Impossibile caricare i dati dell'ospite.",
    );
    expect(screen.queryByText('Nessun ospite registrato per questa prenotazione.')).not.toBeInTheDocument();
  });
});
