import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import type { HostInvite, HostInviteQuota } from '@/types/host-invites';
import type { PagedResult } from '@/types/users.types';
import { HostInvitesContent } from '../host-invites-page';

const api = vi.hoisted(() => ({
  createHostInvite: vi.fn(),
  fetchHostInvites: vi.fn(),
  resendHostInvite: vi.fn(),
  revokeHostInvite: vi.fn(),
  fetchHostInviteQuota: vi.fn(),
}));

vi.mock('@/api/host-invites.api', () => api);
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const QUOTA: HostInviteQuota = { limit: 5, used: 2, remaining: 3, resetsAt: '2026-10-14T00:00:00Z' };
const EXHAUSTED: HostInviteQuota = { limit: 5, used: 5, remaining: 0, resetsAt: '2026-10-14T00:00:00Z' };

const PENDING: HostInvite = {
  id: 'h-pending',
  email: 'host@example.com',
  state: 'Pending',
  message: null,
  createdAt: '2026-10-01T10:00:00Z',
  expiresAt: '2026-10-08T10:00:00Z',
  usedAt: null,
  invitedBy: null,
};
const USED: HostInvite = { ...PENDING, id: 'h-used', email: 'usato@example.com', state: 'Used', usedAt: '2026-10-02T10:00:00Z' };

function page<T>(items: T[]): PagedResult<T> {
  return { items, totalCount: items.length, page: 1, pageSize: 20 };
}

function problem(status: number, code: string) {
  return Object.assign(new Error('detail'), { isAxiosError: true, response: { status, data: { code, detail: 'detail' } } });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HostInvitesContent />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function submitInvite(email = 'nuovo@example.com') {
  fireEvent.change(screen.getByTestId('host-invite-email'), { target: { value: email } });
  fireEvent.click(screen.getByTestId('host-invite-submit'));
}

describe('HostInvitesContent', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    api.fetchHostInviteQuota.mockResolvedValue(QUOTA);
    api.fetchHostInvites.mockResolvedValue(page([PENDING, USED]));
    api.createHostInvite.mockResolvedValue({ inviteId: 'h-new', expiresAt: '2026-10-20T10:00:00Z' });
    api.resendHostInvite.mockResolvedValue({ inviteId: 'h-pending', expiresAt: '2026-10-20T10:00:00Z' });
    api.revokeHostInvite.mockResolvedValue(undefined);
  });

  it('HostInvitesContent_Loaded_ShowsQuotaFormAndOwnInvitesWithoutInviterColumn', async () => {
    renderPage();

    expect(await screen.findByTestId('host-invites-table')).toBeInTheDocument();
    expect(await screen.findByTestId('host-invite-quota')).toHaveTextContent('Inviti di oggi: 2 di 5');
    expect(screen.getByTestId('host-invite-quota-remaining')).toHaveTextContent('Te ne restano 3');
    expect(screen.getByTestId('host-invite-submit')).toBeEnabled();
    expect(screen.queryByTestId('host-invite-inviter-h-pending')).not.toBeInTheDocument();
    expect(api.fetchHostInvites).toHaveBeenCalledWith('host', { search: undefined, state: undefined, page: 1, pageSize: 20 });
  });

  it('HostInvitesContent_QuotaExhausted_ShowsTheMessageAndDisablesTheForm', async () => {
    api.fetchHostInviteQuota.mockResolvedValue(EXHAUSTED);
    renderPage();

    expect(await screen.findByTestId('host-invite-quota-exhausted')).toHaveTextContent('Hai usato tutti gli inviti di oggi');
    expect(screen.getByTestId('host-invite-quota-remaining')).toHaveTextContent('Te ne restano 0');
    await waitFor(() => expect(screen.getByTestId('host-invite-submit')).toBeDisabled());
  });

  it('HostInvitesContent_QuotaLoadFails_ShowsAnErrorWithRetryAndKeepsTheFormUsable', async () => {
    api.fetchHostInviteQuota.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(QUOTA);
    renderPage();

    expect(await screen.findByTestId('host-invite-quota-error')).toHaveTextContent('Impossibile caricare la quota');
    expect(screen.getByTestId('host-invite-submit')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId('host-invite-quota')).toBeInTheDocument();
  });

  it('HostInvitesContent_Submit_SendsTheInviteAsHostAndRefreshesTheQuota', async () => {
    renderPage();
    await screen.findByTestId('host-invite-quota');

    api.fetchHostInviteQuota.mockResolvedValue({ ...QUOTA, used: 3, remaining: 2 });
    submitInvite();

    await waitFor(() => expect(api.createHostInvite).toHaveBeenCalledWith('host', { email: 'nuovo@example.com', message: undefined, locale: undefined }));
    await waitFor(() => expect(screen.getByTestId('host-invite-quota')).toHaveTextContent('Inviti di oggi: 3 di 5'));
    expect(toast.success).toHaveBeenCalled();
  });

  it.each([
    ['host_invite_quota_exceeded', 429, 'Hai raggiunto il limite di inviti di oggi. Riprova domani.'],
    ['host_email_taken', 409, 'Questa email ha già un account su CasaZen: non serve invitarla.'],
    ['duplicate_invite', 409, 'Esiste già un invito in attesa per questa email.'],
  ])('HostInvitesContent_SubmitRefusedWith_%s_ShowsItsDedicatedMessage', async (code, status, text) => {
    api.createHostInvite.mockRejectedValue(problem(status, code));
    renderPage();
    await screen.findByTestId('host-invite-quota');

    submitInvite();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(text));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('HostInvitesContent_SubmitFailsWithoutCode_ShowsTheGenericMessage', async () => {
    api.createHostInvite.mockRejectedValue(problem(500, 'boom_internal'));
    renderPage();
    await screen.findByTestId('host-invite-quota');

    submitInvite();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Operazione non riuscita. Riprova.'));
  });

  it('HostInvitesContent_Resend_AsksForConfirmationBeforeCalling', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('host-invite-resend-h-pending'));

    const dialog = await screen.findByRole('dialog');
    expect(api.resendHostInvite).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reinvia' }));

    await waitFor(() => expect(api.resendHostInvite).toHaveBeenCalledWith('host', 'h-pending'));
    expect(toast.success).toHaveBeenCalledWith('Invito reinviato a host@example.com.');
  });

  it('HostInvitesContent_Revoke_AsksForConfirmationAndCancelCallsNothing', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('host-invite-revoke-h-pending'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.revokeHostInvite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('host-invite-revoke-h-pending'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoca' }));

    await waitFor(() => expect(api.revokeHostInvite).toHaveBeenCalledWith('host', 'h-pending'));
    expect(toast.success).toHaveBeenCalledWith('Invito per host@example.com revocato.');
  });

  it('HostInvitesContent_UsedInvite_HasNoActions', async () => {
    renderPage();
    await screen.findByTestId('host-invites-table');

    expect(screen.queryByTestId('host-invite-resend-h-used')).not.toBeInTheDocument();
    expect(screen.queryByTestId('host-invite-revoke-h-used')).not.toBeInTheDocument();
    expect(screen.getByTestId('host-invite-state-h-used')).toHaveTextContent('Usato');
  });

  it('HostInvitesContent_ListLoadFails_ShowsAnErrorAndNotAnEmptyList', async () => {
    api.fetchHostInvites.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('admin-suppliers-error')).toHaveTextContent('Impossibile caricare gli inviti.');
    expect(screen.queryByTestId('host-invites-empty')).not.toBeInTheDocument();
  });
});
