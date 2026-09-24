import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { publicBookingApi } from '@/api/public-booking.api';
import { OnSiteRequestConfirmPage } from '../onsite-request-confirm-page';
import type { PublicOrgDto } from '@/types';

vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: { confirmOnSiteRequestEmail: vi.fn() },
}));

const org = { slug: 'demo-casazen', displayName: 'Demo Casazen Stays' } as unknown as PublicOrgDto;
const BOOKING_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), public: true };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

function renderPage(search: string) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/book/demo-casazen/requests/${BOOKING_ID}/confirm${search}`]}>
        <Routes>
          <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
            <Route path="requests/:bookingId/confirm" element={<OnSiteRequestConfirmPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnSiteRequestConfirmPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('OnSiteRequestConfirmPage_Click_ConfirmsEmailAndSaysTheHostMustStillAccept', async () => {
    vi.mocked(publicBookingApi.confirmOnSiteRequestEmail).mockResolvedValue({
      bookingId: BOOKING_ID,
      status: 'Pending',
      state: 'AwaitingHostApproval',
      requestExpiresAt: '2026-10-02T08:30:00Z',
    });

    renderPage('?token=tok_123');
    // Nothing is sent on page load (a mail scanner opening the link confirms nothing).
    expect(publicBookingApi.confirmOnSiteRequestEmail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma e invia la richiesta' }));

    const done = await screen.findByTestId('onsite-confirm-done');
    expect(publicBookingApi.confirmOnSiteRequestEmail).toHaveBeenCalledWith(BOOKING_ID, 'tok_123');
    expect(done).toHaveTextContent('Email confermata');
    expect(done).toHaveTextContent('fino a: 2 ottobre alle ore 10:30 (ora italiana)');
    expect(done).toHaveTextContent("la prenotazione è valida solo se l'host la accetta");
  });

  it('OnSiteRequestConfirmPage_ExpiredRequest_ShowsTheReason', async () => {
    vi.mocked(publicBookingApi.confirmOnSiteRequestEmail).mockRejectedValue(
      problemError(409, { code: 'onsite_request_expired', detail: 'x y' }),
    );

    renderPage('?token=tok_123');
    fireEvent.click(screen.getByRole('button', { name: 'Conferma e invia la richiesta' }));

    await waitFor(() =>
      expect(screen.getByTestId('onsite-confirm-error')).toHaveTextContent(
        'La richiesta è scaduta: le date sono tornate disponibili. Puoi inviare una nuova richiesta.',
      ),
    );
    expect(screen.queryByTestId('onsite-confirm-done')).not.toBeInTheDocument();
  });

  it('OnSiteRequestConfirmPage_LinkWithoutToken_ShowsIncompleteLink', () => {
    renderPage('');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Il link di conferma è incompleto: apri di nuovo il link ricevuto via email.',
    );
    expect(screen.queryByRole('button', { name: 'Conferma e invia la richiesta' })).not.toBeInTheDocument();
  });
});
