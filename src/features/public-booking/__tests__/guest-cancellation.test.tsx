import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { guestCancellationApi } from '@/api/guest-cancellation.api';
import { GuestCancelLinkPage } from '../guest-cancel-link-page';
import { GuestCancellationSection } from '../guest-cancellation-section';
import type { GuestBookingDetails, GuestCancellationPreview, GuestSession, PublicOrgDto } from '@/types';

vi.mock('@/api/guest-cancellation.api', () => ({
  guestCancellationApi: { getPreview: vi.fn(), cancel: vi.fn(), getLinkPreview: vi.fn(), cancelWithLink: vi.fn() },
}));

/**
 * DB-08b. Money and privacy rules of the cancellation of the guest: the amount the guest confirms is the amount they were shown (and when
 * it changed meanwhile nothing is cancelled and they are asked again), and the secret of the link of the host leaves the address bar.
 */
const org = { slug: 'demo-casazen', displayName: 'Demo Casazen Stays' } as unknown as PublicOrgDto;
const CODE = 'K7M4Q-9XP2H';
const BOOKING_ID = '0f6c1b2a-0000-4000-8000-000000000001';
const SESSION: GuestSession = {
  accessToken: 'gs1.token-of-the-session',
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  bookingCode: CODE,
};
const BOOKING = { status: 'Confirmed', host: { name: 'Villa Rosa Srl', email: 'host@villarosa.example' } } as unknown as GuestBookingDetails;

/** 362 paid, half of the stay comes back (190.50) the day of the figures, between the end of the full window and of the partial one. */
function preview(overrides: Partial<GuestCancellationPreview> = {}): GuestCancellationPreview {
  return {
    cancellable: true,
    reason: null,
    kind: 'cancel',
    currency: 'EUR',
    paidAmount: 362,
    alreadyRefundedAmount: 0,
    refundPercent: 50,
    refundAmount: 190.5,
    retainedAmount: 171.5,
    retainedBecause: 'policy',
    policy: { slug: 'moderate', name: 'Moderata', description: null },
    fullRefundUntil: '2026-10-17',
    partialRefundPercent: 50,
    partialRefundUntil: '2026-10-22',
    stay: { propertyName: 'Trastevere Suite', checkInDate: '2026-10-24', checkOutDate: '2026-10-27' },
    outcome: null,
    generatedAt: '2026-10-18T10:00:00Z',
    ...overrides,
  };
}

/** The same booking once it is cancelled: what became of the refund. */
function cancelledPreview(refundAmount: number): GuestCancellationPreview {
  return preview({
    cancellable: false,
    reason: 'already_cancelled',
    refundPercent: 0,
    refundAmount: 0,
    retainedAmount: 0,
    retainedBecause: null,
    fullRefundUntil: null,
    partialRefundPercent: null,
    partialRefundUntil: null,
    outcome: { refundAmount, refundStatus: 'pending' },
  });
}

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), public: true };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data });
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function renderSection() {
  return render(
    <QueryClientProvider client={newClient()}>
      <GuestCancellationSection session={SESSION} booking={BOOKING} />
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderLinkPage(url: string) {
  return render(
    <QueryClientProvider client={newClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
            <Route
              path="bookings/:bookingId/cancel"
              element={
                <>
                  <GuestCancelLinkPage />
                  <LocationProbe />
                </>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Opens the confirmation and confirms it. */
async function confirmTheCancellation() {
  fireEvent.click(await screen.findByTestId('guest-cancellation-open'));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Sì, annulla' }));
}

describe('Cancellation of the guest (DB-08b)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('GuestCancellationSection_GuestConfirms_SendsTheAmountItShowedAndThenSaysTheRefundIsPending', async () => {
    let cancelled = false;
    vi.mocked(guestCancellationApi.getPreview).mockImplementation(() => Promise.resolve(cancelled ? cancelledPreview(190.5) : preview()));
    vi.mocked(guestCancellationApi.cancel).mockImplementation(() => {
      cancelled = true;
      return Promise.resolve({ status: 'Cancelled', refundAmount: 190.5, refundStatus: 'pending' });
    });
    renderSection();

    // The figure on screen is the backend's, and the confirmation shows the same one again.
    expect(await screen.findByTestId('guest-cancellation-headline')).toHaveTextContent(/190,50/);
    fireEvent.click(screen.getByTestId('guest-cancellation-open'));
    const dialog = await screen.findByRole('dialog', { name: 'Annullare la prenotazione?' });
    expect(within(dialog).getByTestId('guest-cancellation-headline')).toHaveTextContent(/190,50/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sì, annulla' }));

    // What is sent is that amount, with the key of this confirmation.
    await waitFor(() => expect(guestCancellationApi.cancel).toHaveBeenCalledTimes(1));
    expect(guestCancellationApi.cancel).toHaveBeenCalledWith(SESSION.accessToken, CODE, 190.5, expect.stringMatching(/\S/));
    // The refund is «in corso» until the bank confirms it; there is nothing left to click.
    const outcome = await screen.findByTestId('guest-cancellation-outcome');
    expect(outcome).toHaveTextContent('Prenotazione annullata');
    expect(outcome).toHaveTextContent(/Ti stiamo rimborsando/);
    expect(screen.queryByTestId('guest-cancellation-open')).not.toBeInTheDocument();
  });

  it('GuestCancellationSection_RefundChangedWhileConfirming_ShowsTheNewAmountAndCancelsNothing', async () => {
    vi.mocked(guestCancellationApi.getPreview).mockResolvedValue(preview());
    vi.mocked(guestCancellationApi.cancel)
      .mockRejectedValueOnce(
        problemError(409, { code: 'refund_changed', preview: preview({ refundPercent: 0, refundAmount: 12, retainedAmount: 350 }) }),
      )
      .mockResolvedValue({ status: 'Cancelled', refundAmount: 12, refundStatus: 'pending' });
    renderSection();

    await confirmTheCancellation();

    // Nothing was cancelled: the new amount replaces the old one and the guest decides again.
    const notice = await screen.findByTestId('guest-cancellation-changed');
    expect(notice).toHaveTextContent(/190,50/);
    expect(notice).toHaveTextContent(/12,00/);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('guest-cancellation-headline')).toHaveTextContent(/12,00/);
    expect(screen.queryByTestId('guest-cancellation-outcome')).not.toBeInTheDocument();

    await confirmTheCancellation();

    await waitFor(() => expect(guestCancellationApi.cancel).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(guestCancellationApi.cancel).mock.calls;
    expect(first[2]).toBe(190.5);
    // The second confirmation is for the amount of the new preview, with a key of its own.
    expect(second[2]).toBe(12);
    expect(second[3]).not.toBe(first[3]);
  });

  it('GuestCancelLinkPage_OpenedWithTheLinkOfTheHost_TakesTheTokenOutOfTheAddressAndCancelsWithIt', async () => {
    vi.mocked(guestCancellationApi.getLinkPreview).mockResolvedValue(preview());
    vi.mocked(guestCancellationApi.cancelWithLink).mockResolvedValue({
      bookingId: BOOKING_ID,
      status: 'Cancelled',
      refundAmount: 190.5,
      refundStatus: 'pending',
    });
    renderLinkPage(`/book/demo-casazen/bookings/${BOOKING_ID}/cancel?token=secret-token`);

    expect(await screen.findByTestId('guest-cancellation-headline')).toHaveTextContent(/190,50/);
    // The secret is kept in memory only: the address bar (and so the history, a bookmark, a shared address) no longer has it.
    expect(guestCancellationApi.getLinkPreview).toHaveBeenCalledWith(BOOKING_ID, 'secret-token');
    expect(screen.getByTestId('location')).toHaveTextContent(`/book/demo-casazen/bookings/${BOOKING_ID}/cancel`);
    expect(screen.getByTestId('location')).not.toHaveTextContent('secret-token');

    await confirmTheCancellation();

    await waitFor(() => expect(guestCancellationApi.cancelWithLink).toHaveBeenCalledWith(BOOKING_ID, 'secret-token', 190.5));
    expect(await screen.findByTestId('guest-cancellation-outcome')).toHaveTextContent('Prenotazione annullata');
  });
});
