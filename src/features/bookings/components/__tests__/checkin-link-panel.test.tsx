import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { ApiClient } from '@/api/client';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { bookingsApi } from '@/api/bookings.api';
import { copyTextToClipboard } from '@/lib/utils';
import { CheckInLinkPanel } from '../checkin-link-panel';
import type { CheckInSessionStatusDto } from '@/types/public-checkin.types';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getStatus: vi.fn().mockResolvedValue({ dataComplete: true }) } }));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getCheckInSession: vi.fn(), resendCheckInLink: vi.fn(), createCheckInLink: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils')>()),
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const LINK = 'https://casazen.test/checkin/abc123';

const noLink: CheckInSessionStatusDto = { canIssueLink: true };

const failedEmail: CheckInSessionStatusDto = {
  sessionId: 's1',
  status: 'Inviato',
  issuedAt: '2026-10-01T08:00:00Z',
  expiresAt: '2026-10-08T08:00:00Z',
  sentAt: null,
  completedAt: null,
  emailStatus: 'Failed',
  emailError: 'rejected',
  canIssueLink: true,
};

function renderPanel(canWrite = true, useGuestPortal = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(CheckInLinkPanel, { bookingId: BOOKING_ID, canWrite, useGuestPortal })));
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('CheckInLinkPanel (CO-09, A5-26)', () => {
  it('panel_NoLinkYet_OffersEmailAndLinkToCopy', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(noLink);
    renderPanel();

    expect(await screen.findByTestId('checkin-session-none')).toHaveTextContent('Nessun link di check-in generato');
    expect(screen.getByTestId('checkin-resend-button')).toHaveTextContent('Invia link via email');
    expect(screen.getByTestId('checkin-generate-button')).toHaveTextContent('Genera link da copiare');
  });

  it('prepares check-in and shares the portal section instead of the check-in token', async () => {
    const url = 'https://casazen.test/s/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
    vi.mocked(ApiClient.get).mockResolvedValue({ eligible: true, url: null });
    vi.mocked(ApiClient.post).mockResolvedValue({ eligible: true, url });
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(noLink);
    vi.mocked(bookingsApi.createCheckInLink).mockImplementation(async () => {
      vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(failedEmail);
      return { checkInLink: LINK, expiresAt: '2026-10-08T08:00:00Z', emailStatus: 'NotRequested' };
    });
    renderPanel(true, true);

    fireEvent.click(await screen.findByRole('button', { name: 'Abilita il check-in nel portale' }));
    const preview = await screen.findByRole('link', { name: 'Apri il portale' });
    expect(preview).toHaveAttribute('href', `${url}?page=checkin`);
    expect(ApiClient.post).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/guest-portal`);
    expect(screen.queryByTestId('checkin-link-issued')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Invia email' }));
    await waitFor(() => expect(ApiClient.post).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/guest-portal/resend`));
    expect(bookingsApi.resendCheckInLink).not.toHaveBeenCalled();
  });

  it('panel_EmailFailed_ShowsTheRealReasonAndStillOffersTheReminder', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(failedEmail);
    renderPanel();

    expect(await screen.findByTestId('checkin-link-email')).toHaveTextContent(
      "Email non inviata: l'indirizzo è stato rifiutato dal servizio email",
    );
    expect(screen.getByTestId('checkin-session-badge')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-resend-button')).toHaveTextContent('Invia sollecito');
    expect(screen.getByTestId('checkin-generate-button')).toBeEnabled();
  });

  it('resend_EmailNotSent_ShowsTheLinkToCopyAndNeverSaysSent', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(failedEmail);
    vi.mocked(bookingsApi.resendCheckInLink).mockResolvedValue({
      checkInLink: LINK,
      expiresAt: '2026-10-08T08:00:00Z',
      emailStatus: 'Failed',
      emailError: 'no_recipient',
    });
    renderPanel();

    fireEvent.click(await screen.findByTestId('checkin-resend-button'));

    const issued = await screen.findByTestId('checkin-link-issued');
    expect(issued.querySelector('input')).toHaveValue(LINK);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("l'ospite non ha un indirizzo email"));
    expect(toast.success).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toMatch(/reinviat/i);

    fireEvent.click(screen.getByTestId('checkin-link-copy'));
    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledWith(LINK));
  });

  it('resend_EmailQueued_SaysQueuedNotSent', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(noLink);
    vi.mocked(bookingsApi.resendCheckInLink).mockResolvedValue({
      checkInLink: LINK,
      expiresAt: '2026-10-08T08:00:00Z',
      emailStatus: 'Queued',
      emailError: null,
    });
    renderPanel();

    fireEvent.click(await screen.findByTestId('checkin-resend-button'));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('checkin.link.toast.emailQueued')));
    expect(await screen.findByTestId('checkin-link-issued')).toBeInTheDocument();
  });

  it('generate_LinkToCopy_UsesTheLinkReturnedByTheApi', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(noLink);
    vi.mocked(bookingsApi.createCheckInLink).mockResolvedValue({
      checkInLink: LINK,
      expiresAt: '2026-10-08T08:00:00Z',
      emailStatus: 'NotRequested',
    });
    renderPanel();

    fireEvent.click(await screen.findByTestId('checkin-generate-button'));

    const issued = await screen.findByTestId('checkin-link-issued');
    expect(issued.querySelector('input')).toHaveValue(LINK);
    expect(bookingsApi.resendCheckInLink).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(i18n.t('checkin.link.toast.generated'));
  });

  it('panel_ExpiredLink_SaysExpiredAndOffersANewOne', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue({ ...failedEmail, status: 'Scaduto', emailStatus: 'Sent' });
    renderPanel();

    expect(await screen.findByText(/Il link è scaduto/)).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-link-email')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-resend-button')).toBeInTheDocument();
  });

  it('panel_CompletedCheckIn_NoLinkActions', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue({
      ...failedEmail,
      status: 'Completo',
      completedAt: '2026-10-02T08:00:00Z',
      canIssueLink: false,
    });
    renderPanel();

    expect(await screen.findByText(i18n.t('checkin.link.completed'))).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-resend-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-generate-button')).not.toBeInTheDocument();
  });

  it('reports a submitted form with missing guest details as incomplete', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue({ status: 'Completo', canIssueLink: false });
    vi.mocked(alloggiatiApi.getStatus).mockResolvedValueOnce({ dataComplete: false } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);
    renderPanel(false);
    expect(await screen.findByText(i18n.t('dashboard.today.note.submittedIncomplete'))).toBeVisible();
    expect(screen.queryByTestId('checkin-resend-button')).toBeNull();
  });

  it('panel_WithoutBookingWrite_ShowsStatusOnly', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(failedEmail);
    renderPanel(false);

    expect(await screen.findByTestId('checkin-link-email')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-resend-button')).not.toBeInTheDocument();
  });

  it('panel_ApiError_ShowsErrorNotNoLink', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockRejectedValue(new Error('boom'));
    renderPanel();

    expect(await screen.findByTestId('checkin-link-error')).toHaveTextContent('Impossibile caricare lo stato del link');
    expect(screen.queryByTestId('checkin-session-none')).not.toBeInTheDocument();
  });
});
