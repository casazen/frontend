import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import type { AdminInvite, AdminInvitesParams } from '@/types/admin-suppliers';
import type { HostInvite, HostInvitesParams } from '@/types/host-invites';
import type { PagedResult } from '@/types/users.types';
import { AdminInvitesPage } from '../admin-invites-page';

const supplierApi = vi.hoisted(() => ({
  fetchAdminInvites: vi.fn(),
  resendSupplierInvite: vi.fn(),
  revokeSupplierInvite: vi.fn(),
}));
const hostApi = vi.hoisted(() => ({
  createHostInvite: vi.fn(),
  fetchHostInvites: vi.fn(),
  resendHostInvite: vi.fn(),
  revokeHostInvite: vi.fn(),
}));
const comuni = vi.hoisted(() => ({ getStatus: vi.fn(), search: vi.fn(), getByIstatCode: vi.fn() }));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...supplierApi,
}));
vi.mock('@/api/host-invites.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/host-invites.api')>()),
  ...hostApi,
}));
vi.mock('@/api/comuni.api', () => ({ COMUNE_SEARCH_MIN_LENGTH: 2, ComuniApi: comuni }));
vi.mock('@/queries/use-service-categories', () => ({ useServiceCategories: () => ({ data: undefined }) }));
vi.mock('@/features/service-requests/components/service-category-picker', () => ({
  ServiceCategoryPicker: () => null,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PENDING_INVITE: AdminInvite = {
  id: 'i-pending',
  email: 'nuovo@example.it',
  comuneCode: 'H501',
  categories: ['cleaning'],
  message: null,
  state: 'Pending',
  createdAt: '2026-09-25T10:00:00Z',
  expiresAt: '2026-10-02T10:00:00Z',
  revokedAt: null,
};
const EXPIRED_INVITE: AdminInvite = { ...PENDING_INVITE, id: 'i-expired', email: 'scaduto@example.it', state: 'Expired' };
const USED_INVITE: AdminInvite = { ...PENDING_INVITE, id: 'i-used', email: 'usato@example.it', state: 'Used' };
const REVOKED_INVITE: AdminInvite = { ...PENDING_INVITE, id: 'i-revoked', email: 'revocato@example.it', state: 'Revoked' };

const HOST_PENDING: HostInvite = {
  id: 'h-pending',
  email: 'host@example.com',
  state: 'Pending',
  message: null,
  createdAt: '2026-10-01T10:00:00Z',
  expiresAt: '2026-10-08T10:00:00Z',
  usedAt: null,
  invitedBy: { name: 'Maria Rossi', orgName: 'Casa Rossi' },
};
const HOST_EXPIRED: HostInvite = { ...HOST_PENDING, id: 'h-expired', email: 'scaduto@example.com', state: 'Expired', invitedBy: null };
const HOST_USED: HostInvite = { ...HOST_PENDING, id: 'h-used', email: 'usato@example.com', state: 'Used', usedAt: '2026-10-02T10:00:00Z' };
const HOST_REVOKED: HostInvite = { ...HOST_PENDING, id: 'h-revoked', email: 'revocato@example.com', state: 'Revoked' };

function page<T>(items: T[], totalCount = items.length, pageNumber = 1): PagedResult<T> {
  return { items, totalCount, page: pageNumber, pageSize: 20 };
}

function problem(status: number, code: string, detail: string) {
  return Object.assign(new Error(detail), { isAxiosError: true, response: { status, data: { code, detail } } });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminInvitesPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const lastSupplierParams = () => supplierApi.fetchAdminInvites.mock.calls.at(-1)?.[0] as AdminInvitesParams;
const lastHostParams = () => hostApi.fetchHostInvites.mock.calls.at(-1)?.[1] as HostInvitesParams;

async function openHostType() {
  renderPage();
  await screen.findByTestId('admin-invites-table');
  fireEvent.click(screen.getByTestId('admin-invites-type-host'));
  await screen.findByTestId('host-invites-table');
}

describe('AdminInvitesPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    comuni.getStatus.mockResolvedValue({ datasetAvailable: false });
    supplierApi.fetchAdminInvites.mockResolvedValue(page([PENDING_INVITE, EXPIRED_INVITE, USED_INVITE, REVOKED_INVITE]));
    supplierApi.resendSupplierInvite.mockResolvedValue({ inviteId: 'i-pending', expiresAt: '2026-10-08T10:00:00Z' });
    supplierApi.revokeSupplierInvite.mockResolvedValue(undefined);
    hostApi.fetchHostInvites.mockResolvedValue(page([HOST_PENDING, HOST_EXPIRED, HOST_USED, HOST_REVOKED]));
    hostApi.createHostInvite.mockResolvedValue({ inviteId: 'h-new', expiresAt: '2026-10-20T10:00:00Z' });
    hostApi.resendHostInvite.mockResolvedValue({ inviteId: 'h-pending', expiresAt: '2026-10-20T10:00:00Z' });
    hostApi.revokeHostInvite.mockResolvedValue(undefined);
  });

  // ─── Selector ───

  it('AdminInvitesPage_Default_ShowsTheSupplierFormAndItsInvites', async () => {
    renderPage();

    expect(await screen.findByTestId('admin-invites-table')).toBeInTheDocument();
    expect(screen.getByTestId('invite-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('admin-invites-type-supplier')).toHaveAttribute('aria-selected', 'true');
    expect(hostApi.fetchHostInvites).not.toHaveBeenCalled();
  });

  it('AdminInvitesPage_SwitchToHost_ShowsTheHostFormAndTheHostInvites', async () => {
    await openHostType();

    expect(screen.getByTestId('host-invite-email')).toBeInTheDocument();
    expect(screen.queryByTestId('invite-email-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-invites-table')).not.toBeInTheDocument();
    expect(lastHostParams()).toEqual({ search: undefined, state: undefined, page: 1, pageSize: 20 });
    expect(hostApi.fetchHostInvites.mock.calls.at(-1)?.[0]).toBe('admin');
  });

  // ─── Supplier invites (moved here from the suppliers page) ───

  it('AdminInvitesPage_SupplierInvites_ShowStateAndOnlyTheActionsTheStateAllows', async () => {
    renderPage();
    await screen.findByTestId('admin-invites-table');

    expect(lastSupplierParams()).toEqual({ search: undefined, state: undefined, page: 1, pageSize: 20 });
    expect(screen.getByTestId('admin-invite-state-i-pending')).toHaveTextContent('In attesa');
    expect(screen.getByTestId('admin-invite-resend-i-pending')).toBeInTheDocument();
    expect(screen.getByTestId('admin-invite-revoke-i-pending')).toBeInTheDocument();
    expect(screen.getByTestId('admin-invite-resend-i-expired')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-invite-revoke-i-expired')).not.toBeInTheDocument();
    for (const id of ['i-used', 'i-revoked']) {
      expect(screen.queryByTestId(`admin-invite-resend-${id}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`admin-invite-revoke-${id}`)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('admin-invite-state-i-revoked')).toHaveTextContent('Revocato');
  });

  it('AdminInvitesPage_SupplierStateFilter_IsSentToTheServer', async () => {
    renderPage();
    await screen.findByTestId('admin-invites-table');

    fireEvent.change(screen.getByTestId('admin-invites-state'), { target: { value: 'Expired' } });

    await waitFor(() => expect(lastSupplierParams()).toMatchObject({ state: 'Expired', page: 1 }));
  });

  it('AdminInvitesPage_SupplierResend_AsksForConfirmationAndCallsTheApi', async () => {
    renderPage();
    await screen.findByTestId('admin-invites-table');
    fireEvent.click(screen.getByTestId('admin-invite-resend-i-pending'));

    const dialog = await screen.findByTestId('admin-confirm-dialog');
    expect(supplierApi.resendSupplierInvite).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent('nuovo@example.it');
    fireEvent.click(within(dialog).getByTestId('admin-confirm-submit'));

    await waitFor(() => expect(supplierApi.resendSupplierInvite).toHaveBeenCalledWith('i-pending'));
    expect(toast.success).toHaveBeenCalledWith('Invito reinviato a nuovo@example.it.');
  });

  it('AdminInvitesPage_SupplierResendRefused_ShowsTheTranslatedCodeMessage', async () => {
    supplierApi.resendSupplierInvite.mockRejectedValue(problem(409, 'duplicate_invite', 'Esiste già un altro invito.'));
    renderPage();
    await screen.findByTestId('admin-invites-table');
    fireEvent.click(screen.getByTestId('admin-invite-resend-i-expired'));
    fireEvent.click(within(await screen.findByTestId('admin-confirm-dialog')).getByTestId('admin-confirm-submit'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esiste già un invito in attesa per questa email.'));
  });

  it('AdminInvitesPage_SupplierRevoke_AsksForConfirmationAndCallsTheApi', async () => {
    renderPage();
    await screen.findByTestId('admin-invites-table');
    fireEvent.click(screen.getByTestId('admin-invite-revoke-i-pending'));

    const dialog = await screen.findByTestId('admin-confirm-dialog');
    expect(supplierApi.revokeSupplierInvite).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByTestId('admin-confirm-submit'));

    await waitFor(() => expect(supplierApi.revokeSupplierInvite).toHaveBeenCalledWith('i-pending'));
    expect(toast.success).toHaveBeenCalledWith('Invito per nuovo@example.it revocato.');
  });

  it('AdminInvitesPage_SupplierInvitesLoadFails_ShowsAnErrorAndNotAnEmptyList', async () => {
    supplierApi.fetchAdminInvites.mockRejectedValue(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('admin-suppliers-error')).toHaveTextContent('Impossibile caricare gli inviti.');
    expect(screen.queryByTestId('admin-invites-empty')).not.toBeInTheDocument();
  });

  it('AdminInvitesPage_NoSupplierInvites_ShowsTheEmptyState', async () => {
    supplierApi.fetchAdminInvites.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByTestId('admin-invites-empty')).toHaveTextContent('Non ci sono ancora inviti.');
  });

  // ─── Host invites ───

  it('AdminInvitesPage_HostInvites_ShowStateInviterAndOnlyTheActionsTheStateAllows', async () => {
    await openHostType();

    expect(screen.getByTestId('host-invite-state-h-pending')).toHaveTextContent('In attesa');
    expect(screen.getByTestId('host-invite-inviter-h-pending')).toHaveTextContent('Maria Rossi (Casa Rossi)');
    expect(screen.getByTestId('host-invite-inviter-h-expired')).toHaveTextContent('—');
    expect(screen.getByTestId('host-invite-resend-h-pending')).toBeInTheDocument();
    expect(screen.getByTestId('host-invite-revoke-h-pending')).toBeInTheDocument();
    expect(screen.getByTestId('host-invite-resend-h-expired')).toBeInTheDocument();
    expect(screen.queryByTestId('host-invite-revoke-h-expired')).not.toBeInTheDocument();
    for (const id of ['h-used', 'h-revoked']) {
      expect(screen.queryByTestId(`host-invite-resend-${id}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`host-invite-revoke-${id}`)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('host-invite-state-h-used')).toHaveTextContent('Usato');
    expect(screen.getByTestId('host-invite-state-h-revoked')).toHaveTextContent('Revocato');
    expect(screen.getByTestId('host-invite-state-h-expired')).toHaveTextContent('Scaduto');
  });

  it('AdminInvitesPage_HostFilters_AreSentToTheServerAndPaginationAsksForTheNextPage', async () => {
    hostApi.fetchHostInvites.mockResolvedValue(page([HOST_PENDING], 45));
    await openHostType();

    fireEvent.change(screen.getByTestId('host-invites-state'), { target: { value: 'Used' } });
    await waitFor(() => expect(lastHostParams()).toMatchObject({ state: 'Used', page: 1 }));

    fireEvent.click(await screen.findByTestId('admin-suppliers-next'));
    await waitFor(() => expect(lastHostParams()).toMatchObject({ state: 'Used', page: 2 }));
  });

  it('AdminInvitesPage_HostForm_SendsEmailMessageAndLocaleTrimmedAndClearsTheForm', async () => {
    await openHostType();

    fireEvent.change(screen.getByTestId('host-invite-email'), { target: { value: '  nuovo.host@example.com ' } });
    fireEvent.change(screen.getByTestId('host-invite-message'), { target: { value: 'Ciao, provalo!' } });
    fireEvent.change(screen.getByTestId('host-invite-locale'), { target: { value: 'en' } });
    fireEvent.click(screen.getByTestId('host-invite-submit'));

    await waitFor(() => expect(hostApi.createHostInvite).toHaveBeenCalledTimes(1));
    expect(hostApi.createHostInvite).toHaveBeenCalledWith('admin', {
      email: 'nuovo.host@example.com',
      message: 'Ciao, provalo!',
      locale: 'en',
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.getByTestId('host-invite-email')).toHaveValue('');
  });

  it('AdminInvitesPage_HostFormWithoutOptionalFields_OmitsThem', async () => {
    await openHostType();

    fireEvent.change(screen.getByTestId('host-invite-email'), { target: { value: 'nuovo.host@example.com' } });
    fireEvent.click(screen.getByTestId('host-invite-submit'));

    await waitFor(() => expect(hostApi.createHostInvite).toHaveBeenCalledTimes(1));
    expect(hostApi.createHostInvite.mock.calls[0][1]).toEqual({
      email: 'nuovo.host@example.com',
      message: undefined,
      locale: undefined,
    });
  });

  it('AdminInvitesPage_HostFormInvalidEmail_ShowsAFieldErrorAndCallsNothing', async () => {
    await openHostType();

    fireEvent.click(screen.getByTestId('host-invite-submit'));
    expect(await screen.findByText('Inserisci l\'email dell\'host.')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('host-invite-email'), { target: { value: 'non-una-email' } });
    fireEvent.click(screen.getByTestId('host-invite-submit'));

    expect(await screen.findByText('Inserisci un\'email valida.')).toBeInTheDocument();
    expect(hostApi.createHostInvite).not.toHaveBeenCalled();
  });

  it.each([
    ['host_email_taken', 409, 'Questa email ha già un account su CasaZen: non serve invitarla.'],
    ['duplicate_invite', 409, 'Esiste già un invito in attesa per questa email.'],
  ])('AdminInvitesPage_HostFormRefusedWith_%s_ShowsItsOwnMessage', async (code, status, text) => {
    hostApi.createHostInvite.mockRejectedValue(problem(status, code, 'detail'));
    await openHostType();

    fireEvent.change(screen.getByTestId('host-invite-email'), { target: { value: 'nuovo.host@example.com' } });
    fireEvent.click(screen.getByTestId('host-invite-submit'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(text));
    // The email stays so it can be corrected.
    expect(screen.getByTestId('host-invite-email')).toHaveValue('nuovo.host@example.com');
  });

  it('AdminInvitesPage_HostResend_AsksForConfirmationAndCallsTheApi', async () => {
    await openHostType();
    fireEvent.click(screen.getByTestId('host-invite-resend-h-pending'));

    const dialog = await screen.findByRole('dialog');
    expect(hostApi.resendHostInvite).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent('host@example.com');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reinvia' }));

    await waitFor(() => expect(hostApi.resendHostInvite).toHaveBeenCalledWith('admin', 'h-pending'));
    expect(toast.success).toHaveBeenCalledWith('Invito reinviato a host@example.com.');
  });

  it('AdminInvitesPage_HostResendCancelled_CallsNothing', async () => {
    await openHostType();
    fireEvent.click(screen.getByTestId('host-invite-resend-h-pending'));

    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annulla' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(hostApi.resendHostInvite).not.toHaveBeenCalled();
  });

  it('AdminInvitesPage_HostRevoke_AsksForConfirmationAndCallsTheApi', async () => {
    await openHostType();
    fireEvent.click(screen.getByTestId('host-invite-revoke-h-pending'));

    const dialog = await screen.findByRole('dialog');
    expect(hostApi.revokeHostInvite).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoca' }));

    await waitFor(() => expect(hostApi.revokeHostInvite).toHaveBeenCalledWith('admin', 'h-pending'));
    expect(toast.success).toHaveBeenCalledWith('Invito per host@example.com revocato.');
  });

  it('AdminInvitesPage_HostRevokeFails_ShowsTheError', async () => {
    hostApi.revokeHostInvite.mockRejectedValue(problem(409, 'duplicate_invite', 'x'));
    await openHostType();
    fireEvent.click(screen.getByTestId('host-invite-revoke-h-pending'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoca' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esiste già un invito in attesa per questa email.'));
  });

  it('AdminInvitesPage_NoHostInvites_ShowsTheEmptyState', async () => {
    hostApi.fetchHostInvites.mockResolvedValue(page([]));
    renderPage();
    await screen.findByTestId('admin-invites-table');
    fireEvent.click(screen.getByTestId('admin-invites-type-host'));

    expect(await screen.findByTestId('host-invites-empty')).toHaveTextContent('Non ci sono ancora inviti.');
  });

  it('AdminInvitesPage_English_ShowsTranslatedLabels', async () => {
    await i18n.changeLanguage('en');
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Invitations' })).toBeInTheDocument();
    expect(screen.getByTestId('admin-invites-type-host')).toHaveTextContent('Host');
    expect(screen.getByTestId('admin-invites-type-supplier')).toHaveTextContent('Supplier');
  });
});
