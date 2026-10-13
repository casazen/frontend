import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { BookingRequestsPanel } from '../booking-requests-panel';
import type { Booking, BookingApprovalRequest } from '@/types';

vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getApprovalRequests: vi.fn(), approveRequest: vi.fn(), declineRequest: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const request = (overrides: Partial<BookingApprovalRequest> = {}): BookingApprovalRequest => ({
  id: 'req-1',
  propertyId: 'property-1',
  propertyName: 'Villa Rosa',
  checkInDate: '2027-10-01T00:00:00Z',
  checkOutDate: '2027-10-05T00:00:00Z',
  nights: 4,
  numberOfGuests: 2,
  numberOfAdults: 2,
  numberOfChildren: 0,
  totalPrice: 450,
  currency: 'EUR',
  specialRequests: '',
  guest: { firstName: 'Giulia', lastName: 'Bianchi', email: 'giulia@example.com', phone: '+39333', country: 'IT' },
  emailConfirmedAt: '2027-09-20T08:00:00Z',
  respondBy: '2027-09-21T08:00:00Z',
  ...overrides,
});

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(BookingRequestsPanel)));
}

describe('BookingRequestsPanel', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('BookingRequestsPanel_PendingRequest_ShowsStayDeadlineAndAcceptsIt', async () => {
    vi.mocked(bookingsApi.getApprovalRequests).mockResolvedValue([request()]);
    vi.mocked(bookingsApi.approveRequest).mockResolvedValue({ id: 'req-1', status: 'Confirmed' } as Booking);

    renderPanel();

    const row = await screen.findByTestId('booking-request');
    expect(row).toHaveTextContent('Giulia Bianchi');
    expect(row).toHaveTextContent('Villa Rosa: dal 1 ott 2027 al 5 ott 2027 (4 notti)');
    expect(row).toHaveTextContent('Rispondi entro: 21 settembre alle ore 10:00 (ora italiana)');
    expect(screen.getByTestId('booking-requests-count')).toHaveTextContent('1');

    fireEvent.click(within(row).getByRole('button', { name: 'Accetta' }));

    await waitFor(() => expect(bookingsApi.approveRequest).toHaveBeenCalledWith('req-1'));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Richiesta accettata: la prenotazione è confermata.'),
    );
    expect(bookingsApi.declineRequest).not.toHaveBeenCalled();
  });

  it('BookingRequestsPanel_DeclineWithMessage_SendsTheMessageToTheGuest', async () => {
    vi.mocked(bookingsApi.getApprovalRequests).mockResolvedValue([request()]);
    vi.mocked(bookingsApi.declineRequest).mockResolvedValue({ id: 'req-1', status: 'Cancelled' } as Booking);

    renderPanel();
    const row = await screen.findByTestId('booking-request');
    fireEvent.click(within(row).getByRole('button', { name: 'Rifiuta' }));
    fireEvent.change(within(row).getByLabelText("Messaggio all'ospite (facoltativo)"), {
      target: { value: '  Casa in manutenzione  ' },
    });
    fireEvent.click(within(row).getByRole('button', { name: 'Conferma rifiuto' }));

    await waitFor(() =>
      expect(bookingsApi.declineRequest).toHaveBeenCalledWith('req-1', { message: 'Casa in manutenzione' }),
    );
    expect(bookingsApi.approveRequest).not.toHaveBeenCalled();
  });

  it('BookingRequestsPanel_AnsweredElsewhere_ShowsTheConflictReason', async () => {
    vi.mocked(bookingsApi.getApprovalRequests).mockResolvedValue([request()]);
    vi.mocked(bookingsApi.approveRequest).mockRejectedValue(
      problemError(409, { code: 'onsite_request_not_pending', detail: 'x y' }),
    );

    renderPanel();
    const row = await screen.findByTestId('booking-request');
    fireEvent.click(within(row).getByRole('button', { name: 'Accetta' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'La richiesta non è più in attesa: è già stata accettata, rifiutata o annullata.',
      ),
    );
    // The list is read again to show the current state.
    await waitFor(() => expect(bookingsApi.getApprovalRequests).toHaveBeenCalledTimes(2));
  });

  it('BookingRequestsPanel_NoRequests_ShowsEmptyState', async () => {
    vi.mocked(bookingsApi.getApprovalRequests).mockResolvedValue([]);

    renderPanel();

    expect(await screen.findByText('Nessuna richiesta in attesa di approvazione.')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-request')).not.toBeInTheDocument();
  });

  it('BookingRequestsPanel_ApiFails_ShowsErrorNotEmptyList', async () => {
    vi.mocked(bookingsApi.getApprovalRequests).mockRejectedValue(new Error('boom'));

    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossibile caricare le richieste da approvare.');
    expect(screen.queryByText('Nessuna richiesta in attesa di approvazione.')).not.toBeInTheDocument();
  });
});
