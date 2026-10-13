import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { publicBookingApi } from '@/api/public-booking.api';
import { GuestBookingsPage } from '../guest-bookings-page';
import type { GuestBookingDetails, PublicOrgDto } from '@/types';

vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: { lookupGuestBooking: vi.fn(), sendGuestCheckInLink: vi.fn() },
}));

const org = { slug: 'demo-casazen', displayName: 'Demo Casazen Stays' } as unknown as PublicOrgDto;
const CODE = 'K7M4Q-9XP2H';
const EMAIL = 'giulia@example.com';

function booking(overrides: Partial<GuestBookingDetails> = {}): GuestBookingDetails {
  return {
    bookingCode: CODE,
    status: 'Confirmed',
    paymentOption: 'Immediate',
    propertyId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    propertySlug: 'trastevere-suite',
    propertyName: 'Trastevere Suite',
    propertyCity: 'Roma',
    checkInDate: '2026-10-24',
    checkOutDate: '2026-10-27',
    numberOfAdults: 2,
    numberOfChildren: 1,
    lodging: 300,
    cleaningFee: 50,
    touristTax: 12,
    totalPrice: 362,
    paidAmount: 362,
    refundedAmount: 0,
    currency: 'EUR',
    expiresAt: null,
    deferredChargeDate: null,
    host: { name: 'Villa Rosa Srl', email: 'host@villarosa.example' },
    checkIn: { status: 'NotYetOpen', opensOn: '2026-10-21', linkSentAt: null },
    ...overrides,
  };
}

function problemError(status: number | undefined, data?: unknown, code = 'ERR_BAD_REQUEST'): AxiosError {
  const config = { headers: new AxiosHeaders(), public: true };
  const response =
    status === undefined ? undefined : { status, statusText: '', headers: {}, config, data };
  return new AxiosError('Request failed', code, config, null, response);
}

function renderPage(url = '/book/demo-casazen/my-bookings') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
            <Route path="my-bookings" element={<GuestBookingsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fill(code: string, email: string) {
  fireEvent.change(screen.getByLabelText('Codice prenotazione'), { target: { value: code } });
  fireEvent.change(screen.getByLabelText('Email usata per prenotare'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Trova la prenotazione' }));
}

describe('GuestBookingsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('GuestBookingsPage_LinkOfTheEmail_PrefillsTheCodeAndShowsNothingBeforeTheEmail', () => {
    renderPage('/book/demo-casazen/my-bookings?code=k7m4q9xp2h');

    expect(screen.getByLabelText('Codice prenotazione')).toHaveValue(CODE);
    expect(screen.getByLabelText('Email usata per prenotare')).toHaveValue('');
    expect(screen.queryByTestId('guest-booking-result')).not.toBeInTheDocument();
    expect(publicBookingApi.lookupGuestBooking).not.toHaveBeenCalled();
  });

  it('GuestBookingsPage_InvalidCodeOrEmail_ShowsFieldErrorsWithoutCallingTheApi', async () => {
    renderPage();

    fill('ABC', 'not-an-email');

    expect(await screen.findByText(/Il codice prenotazione è di 10 caratteri/)).toBeInTheDocument();
    expect(screen.getByText('Email non valido')).toBeInTheDocument();
    expect(publicBookingApi.lookupGuestBooking).not.toHaveBeenCalled();
  });

  it('GuestBookingsPage_CodeAndEmail_ShowsStateStayAmountsCheckInAndHost', async () => {
    vi.mocked(publicBookingApi.lookupGuestBooking).mockResolvedValue(booking());
    renderPage();

    fill(' k7m4q 9xp2h ', ` ${EMAIL} `);

    const result = await screen.findByTestId('guest-booking-result');
    // The code as the backend expects it, the site of the page, the trimmed email.
    expect(publicBookingApi.lookupGuestBooking).toHaveBeenCalledWith({
      orgSlug: 'demo-casazen',
      bookingCode: CODE,
      email: EMAIL,
    });
    expect(within(result).getByRole('heading', { name: 'Trastevere Suite' })).toBeInTheDocument();
    expect(within(result).getByTestId('guest-booking-status')).toHaveTextContent('Confermata');
    expect(result).toHaveTextContent(CODE);
    expect(result).toHaveTextContent('24 ottobre 2026');
    expect(result).toHaveTextContent('27 ottobre 2026');
    expect(result).toHaveTextContent('3 ospiti');
    const amounts = within(result).getByTestId('guest-booking-amounts');
    expect(amounts).toHaveTextContent('Soggiorno300,00 €');
    expect(amounts).toHaveTextContent('Tassa di soggiorno12,00 €');
    expect(amounts).toHaveTextContent('Totale362,00 €');
    expect(amounts).toHaveTextContent('Pagato362,00 €');
    expect(within(result).getByTestId('guest-booking-check-in')).toHaveTextContent('21 ottobre 2026');
    expect(within(result).getByRole('link', { name: 'host@villarosa.example' })).toHaveAttribute(
      'href',
      'mailto:host@villarosa.example',
    );
    expect(screen.queryByTestId('guest-bookings-form')).not.toBeInTheDocument();
  });

  it('GuestBookingsPage_NotFound_ShowsTheEmptyStateNotAnError', async () => {
    vi.mocked(publicBookingApi.lookupGuestBooking).mockRejectedValue(
      problemError(404, { code: 'guest_booking_not_found', detail: 'x' }),
    );
    renderPage();

    fill(CODE, EMAIL);

    expect(await screen.findByTestId('guest-bookings-not-found')).toHaveTextContent('Nessuna prenotazione trovata');
    expect(screen.queryByTestId('guest-bookings-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-booking-result')).not.toBeInTheDocument();
    // The form stays, with what the guest typed, to correct it.
    expect(screen.getByLabelText('Codice prenotazione')).toHaveValue(CODE);
  });

  it('GuestBookingsPage_TooManyAttempts_ShowsTheErrorNotTheEmptyState', async () => {
    vi.mocked(publicBookingApi.lookupGuestBooking).mockRejectedValue(
      problemError(429, { code: 'rate_limited', detail: 'Troppe richieste' }),
    );
    renderPage();

    fill(CODE, EMAIL);

    const error = await screen.findByTestId('guest-bookings-error');
    expect(error).toHaveTextContent('Troppe richieste in poco tempo');
    expect(screen.queryByTestId('guest-bookings-not-found')).not.toBeInTheDocument();
    expect(within(error).queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
  });

  it('GuestBookingsPage_NetworkError_OffersToRetryTheSameSearch', async () => {
    vi.mocked(publicBookingApi.lookupGuestBooking)
      .mockRejectedValueOnce(problemError(undefined, undefined, AxiosError.ERR_NETWORK))
      .mockResolvedValueOnce(booking({ status: 'AwaitingHostApproval', expiresAt: '2026-10-02T08:30:00Z', paidAmount: 0, paymentOption: 'OnSite', checkIn: { status: 'NotApplicable', opensOn: null, linkSentAt: null } }));
    renderPage();

    fill(CODE, EMAIL);
    const error = await screen.findByTestId('guest-bookings-error');
    expect(error).toHaveTextContent('Impossibile contattare il server');
    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    const result = await screen.findByTestId('guest-booking-result');
    expect(publicBookingApi.lookupGuestBooking).toHaveBeenCalledTimes(2);
    expect(within(result).getByTestId('guest-booking-status')).toHaveTextContent("In attesa dell'host");
    expect(result).toHaveTextContent('Pagamento in struttura.');
    expect(within(result).queryByTestId('guest-booking-check-in')).not.toBeInTheDocument();
    expect(within(result).queryByTestId('guest-booking-amounts')).not.toHaveTextContent('Pagato');
  });

  it('GuestBookingsPage_CheckInOpen_SendsTheLinkByEmailAndSaysSo', async () => {
    vi.mocked(publicBookingApi.lookupGuestBooking).mockResolvedValue(
      booking({ checkIn: { status: 'Open', opensOn: null, linkSentAt: '2026-10-21T06:00:00Z' } }),
    );
    vi.mocked(publicBookingApi.sendGuestCheckInLink).mockResolvedValue(undefined);
    renderPage();

    fill(CODE, EMAIL);
    const checkIn = await screen.findByTestId('guest-booking-check-in');
    expect(checkIn).toHaveTextContent('Ti abbiamo inviato il link');
    fireEvent.click(within(checkIn).getByRole('button', { name: 'Inviamelo di nuovo' }));

    expect(await screen.findByTestId('guest-booking-check-in-sent')).toHaveTextContent('Link inviato');
    expect(publicBookingApi.sendGuestCheckInLink).toHaveBeenCalledWith({
      orgSlug: 'demo-casazen',
      bookingCode: CODE,
      email: EMAIL,
    });
  });

  it('GuestBookingsPage_CheckInLinkRefused_ShowsTheReason', async () => {
    vi.mocked(publicBookingApi.lookupGuestBooking).mockResolvedValue(
      booking({ checkIn: { status: 'Open', opensOn: null, linkSentAt: null } }),
    );
    vi.mocked(publicBookingApi.sendGuestCheckInLink).mockRejectedValue(
      problemError(409, { code: 'guest_check_in_link_unavailable', detail: 'x' }),
    );
    renderPage();

    fill(CODE, EMAIL);
    fireEvent.click(await screen.findByRole('button', { name: 'Inviami il link' }));

    await waitFor(() =>
      expect(screen.getByTestId('guest-booking-check-in-error')).toHaveTextContent(
        'Il link per il check-in online non può essere inviato ora',
      ),
    );
  });

  it('GuestBookingsPage_SearchAnother_ClearsTheBookingFromTheScreen', async () => {
    vi.mocked(publicBookingApi.lookupGuestBooking).mockResolvedValue(booking());
    renderPage();

    fill(CODE, EMAIL);
    fireEvent.click(await screen.findByTestId('guest-bookings-search-another'));

    expect(screen.queryByTestId('guest-booking-result')).not.toBeInTheDocument();
    expect(screen.getByTestId('guest-bookings-form')).toBeInTheDocument();
  });
});
