import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import type {
  AdminSupplier,
  AdminSupplierAuditEntry,
  AdminSuppliersParams,
} from '@/types/admin-suppliers';
import type { PagedResult } from '@/types/users.types';
import { AdminSuppliersPage } from '../admin-suppliers-page';

const api = vi.hoisted(() => ({
  fetchAdminSuppliers: vi.fn(),
  suspendSupplier: vi.fn(),
  reactivateSupplier: vi.fn(),
  fetchSupplierAudit: vi.fn(),
}));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...api,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ACTIVE: AdminSupplier = {
  orgId: 's-active',
  legalName: 'Pulizie Rossi Srl',
  email: 'rossi@example.it',
  phone: '+39 06 111111',
  status: 'Active',
  categories: ['cleaning'],
  comuni: ['H501'],
  createdAt: '2026-08-01T10:00:00Z',
  suspendedAt: null,
  suspensionReason: null,
  openRequests: 2,
};

const SUSPENDED: AdminSupplier = {
  ...ACTIVE,
  orgId: 's-suspended',
  legalName: 'Idraulica Bianchi',
  email: 'bianchi@example.it',
  status: 'Suspended',
  categories: ['plumbing'],
  suspendedAt: '2026-09-20T09:30:00Z',
  suspensionReason: 'Due segnalazioni di lavori non eseguiti',
  openRequests: 0,
};

function page<T>(items: T[], totalCount = items.length, pageNumber = 1): PagedResult<T> {
  return { items, totalCount, page: pageNumber, pageSize: 20 };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminSuppliersPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const lastSupplierParams = () => api.fetchAdminSuppliers.mock.calls.at(-1)?.[0] as AdminSuppliersParams;

function problem(status: number, code: string, detail: string) {
  return Object.assign(new Error(detail), { isAxiosError: true, response: { status, data: { code, detail } } });
}

describe('AdminSuppliersPage (SU-12, A4-29)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.fetchAdminSuppliers.mockResolvedValue(page([ACTIVE, SUSPENDED]));
    api.suspendSupplier.mockResolvedValue({ ...ACTIVE, status: 'Suspended' });
    api.reactivateSupplier.mockResolvedValue({ ...SUSPENDED, status: 'Active' });
    api.fetchSupplierAudit.mockResolvedValue([]);
    await i18n.changeLanguage('it');
  });

  // ─── Suppliers list ───

  it('AdminSuppliersPage_Suppliers_ShowsStatusOpenRequestsAndSuspensionNote', async () => {
    renderPage();

    const active = await screen.findByTestId('admin-supplier-s-active');
    expect(lastSupplierParams()).toEqual({ search: undefined, status: undefined, page: 1, pageSize: 20 });
    expect(within(active).getByText('Pulizie Rossi Srl')).toBeInTheDocument();
    expect(within(active).getByTestId('admin-supplier-status-s-active')).toHaveTextContent('Attivo');
    expect(within(active).getByText('Pulizie')).toBeInTheDocument();
    expect(within(active).getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(within(active).getByTestId('admin-supplier-suspend-s-active')).toBeEnabled();
    expect(within(active).queryByTestId('admin-supplier-reactivate-s-active')).not.toBeInTheDocument();

    const suspended = screen.getByTestId('admin-supplier-s-suspended');
    expect(within(suspended).getByTestId('admin-supplier-status-s-suspended')).toHaveTextContent('Sospeso');
    expect(within(suspended).getByTestId('admin-supplier-suspension-s-suspended')).toHaveTextContent(
      'Due segnalazioni di lavori non eseguiti',
    );
    expect(within(suspended).getByTestId('admin-supplier-reactivate-s-suspended')).toBeInTheDocument();
    expect(within(suspended).queryByTestId('admin-supplier-suspend-s-suspended')).not.toBeInTheDocument();
  });

  it('AdminSuppliersPage_Loading_ShowsSkeletonBeforeTheData', async () => {
    api.fetchAdminSuppliers.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(await screen.findByTestId('admin-suppliers-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-suppliers-empty')).not.toBeInTheDocument();
  });

  it('AdminSuppliersPage_LoadFails_ShowsAnErrorWithRetryAndNotAnEmptyList', async () => {
    api.fetchAdminSuppliers.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(page([ACTIVE]));
    renderPage();

    expect(await screen.findByTestId('admin-suppliers-error')).toHaveTextContent('Impossibile caricare i fornitori.');
    expect(screen.queryByTestId('admin-suppliers-empty')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('admin-supplier-s-active')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-suppliers-error')).not.toBeInTheDocument();
  });

  it('AdminSuppliersPage_NoSuppliers_ShowsTheEmptyStateAndAFilteredOneWhenFiltering', async () => {
    api.fetchAdminSuppliers.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByTestId('admin-suppliers-empty')).toHaveTextContent('Non ci sono ancora fornitori.');

    fireEvent.change(screen.getByTestId('admin-suppliers-status'), { target: { value: 'Suspended' } });

    await waitFor(() => expect(screen.getByTestId('admin-suppliers-empty')).toHaveTextContent('Nessun fornitore corrisponde ai filtri.'));
  });

  it('AdminSuppliersPage_SearchAndStatus_AreSentToTheServerAndSearchIsDebounced', async () => {
    renderPage();
    await screen.findByTestId('admin-supplier-s-active');
    const calls = api.fetchAdminSuppliers.mock.calls.length;

    fireEvent.change(screen.getByTestId('admin-suppliers-search'), { target: { value: 'r' } });
    fireEvent.change(screen.getByTestId('admin-suppliers-search'), { target: { value: 'ro' } });
    fireEvent.change(screen.getByTestId('admin-suppliers-search'), { target: { value: 'rossi' } });
    // Not one request per keystroke.
    expect(api.fetchAdminSuppliers.mock.calls.length).toBe(calls);
    await waitFor(() => expect(lastSupplierParams()).toMatchObject({ search: 'rossi', page: 1 }));
    expect(api.fetchAdminSuppliers.mock.calls.length).toBeLessThanOrEqual(calls + 1);

    fireEvent.change(screen.getByTestId('admin-suppliers-status'), { target: { value: 'Suspended' } });

    await waitFor(() => expect(lastSupplierParams()).toMatchObject({ search: 'rossi', status: 'Suspended', page: 1 }));
  });

  it('AdminSuppliersPage_Pagination_AsksTheServerForTheNextPage', async () => {
    api.fetchAdminSuppliers.mockImplementation(async (params: AdminSuppliersParams) =>
      page([ACTIVE], 45, params.page ?? 1),
    );
    renderPage();

    expect(await screen.findByTestId('admin-suppliers-pagination')).toHaveTextContent('Pagina 1 di 3 · 45 risultati');
    fireEvent.click(screen.getByTestId('admin-suppliers-next'));

    await waitFor(() => expect(lastSupplierParams()).toMatchObject({ page: 2 }));
    expect(await screen.findByText(/Pagina 2 di 3/)).toBeInTheDocument();
  });

  // ─── Suspend / reactivate ───

  it('AdminSuppliersPage_Suspend_RequiresAReasonAndSendsItTrimmed', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('admin-supplier-suspend-s-active'));

    const dialog = await screen.findByTestId('suspend-supplier-dialog');
    expect(within(dialog).getByTestId('suspend-open-requests')).toHaveTextContent('2 richieste ancora aperte');
    expect(within(dialog).getByTestId('suspend-confirm')).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('suspend-reason'), { target: { value: '   ' } });
    expect(within(dialog).getByTestId('suspend-confirm')).toBeDisabled();

    fireEvent.change(within(dialog).getByTestId('suspend-reason'), { target: { value: '  Segnalato da due host  ' } });
    fireEvent.click(within(dialog).getByTestId('suspend-confirm'));

    await waitFor(() => expect(api.suspendSupplier).toHaveBeenCalledWith('s-active', 'Segnalato da due host'));
    await waitFor(() => expect(screen.queryByTestId('suspend-supplier-dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Pulizie Rossi Srl è stato sospeso.');
    // The list is reloaded to show the new status.
    await waitFor(() => expect(api.fetchAdminSuppliers.mock.calls.length).toBeGreaterThan(1));
  });

  it('AdminSuppliersPage_SuspendRefused_ShowsTheServerMessageAndKeepsTheDialogOpen', async () => {
    api.suspendSupplier.mockRejectedValue(problem(409, 'supplier_already_suspended', 'Il fornitore è già sospeso.'));
    renderPage();
    fireEvent.click(await screen.findByTestId('admin-supplier-suspend-s-active'));
    const dialog = await screen.findByTestId('suspend-supplier-dialog');
    fireEvent.change(within(dialog).getByTestId('suspend-reason'), { target: { value: 'Motivo' } });

    fireEvent.click(within(dialog).getByTestId('suspend-confirm'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Il fornitore è già sospeso.'));
    expect(screen.getByTestId('suspend-supplier-dialog')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('AdminSuppliersPage_SuspendWithoutOpenRequests_ShowsNoWarning', async () => {
    api.fetchAdminSuppliers.mockResolvedValue(page([{ ...ACTIVE, openRequests: 0 }]));
    renderPage();
    fireEvent.click(await screen.findByTestId('admin-supplier-suspend-s-active'));

    await screen.findByTestId('suspend-supplier-dialog');
    expect(screen.queryByTestId('suspend-open-requests')).not.toBeInTheDocument();
  });

  it('AdminSuppliersPage_Reactivate_AsksForConfirmationBeforeCalling', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('admin-supplier-reactivate-s-suspended'));

    const dialog = await screen.findByTestId('admin-confirm-dialog');
    expect(api.reactivateSupplier).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent('Riattiva Idraulica Bianchi');
    fireEvent.click(within(dialog).getByTestId('admin-confirm-submit'));

    await waitFor(() => expect(api.reactivateSupplier).toHaveBeenCalledWith('s-suspended'));
    expect(toast.success).toHaveBeenCalledWith('Idraulica Bianchi è stato riattivato.');
  });

  it('AdminSuppliersPage_ReactivateCancelled_CallsNothing', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('admin-supplier-reactivate-s-suspended'));
    const dialog = await screen.findByTestId('admin-confirm-dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));

    await waitFor(() => expect(screen.queryByTestId('admin-confirm-dialog')).not.toBeInTheDocument());
    expect(api.reactivateSupplier).not.toHaveBeenCalled();
  });

  // ─── Audit ───

  it('AdminSuppliersPage_History_ShowsWhoSuspendedWhenAndWhy', async () => {
    const entries: AdminSupplierAuditEntry[] = [
      {
        id: 'a-2',
        action: 'Reactivated',
        actorUserId: 'auth0|admin',
        actorName: 'Anna Admin',
        occurredAt: '2026-09-28T10:00:00Z',
        previousStatus: 'Suspended',
        newStatus: 'Active',
      },
      {
        id: 'a-1',
        action: 'Suspended',
        actorUserId: 'auth0|admin',
        actorName: null,
        occurredAt: '2026-09-20T09:30:00Z',
        reason: 'Due segnalazioni',
        previousStatus: 'Active',
        newStatus: 'Suspended',
      },
    ];
    api.fetchSupplierAudit.mockResolvedValue(entries);
    renderPage();
    fireEvent.click(await screen.findByTestId('admin-supplier-history-s-suspended'));

    const list = await screen.findByTestId('supplier-audit-list');
    expect(api.fetchSupplierAudit).toHaveBeenCalledWith('s-suspended');
    const [reactivated, suspended] = within(list).getAllByRole('listitem');
    expect(reactivated).toHaveTextContent('Riattivato');
    expect(reactivated).toHaveTextContent('da Anna Admin');
    expect(reactivated).toHaveTextContent('Sospeso → Attivo');
    expect(suspended).toHaveTextContent('Sospeso');
    expect(suspended).toHaveTextContent('da auth0|admin');
    expect(suspended).toHaveTextContent('Motivo: Due segnalazioni');
  });

  it('AdminSuppliersPage_HistoryFails_ShowsAnErrorAndNotAnEmptyHistory', async () => {
    api.fetchSupplierAudit.mockRejectedValue(new Error('boom'));
    renderPage();
    fireEvent.click(await screen.findByTestId('admin-supplier-history-s-active'));

    expect(await screen.findByTestId('supplier-audit-error')).toHaveTextContent('Impossibile caricare lo storico.');
    expect(screen.queryByTestId('supplier-audit-empty')).not.toBeInTheDocument();
  });

  it('AdminSuppliersPage_HistoryEmpty_ShowsTheEmptyMessage', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('admin-supplier-history-s-active'));

    expect(await screen.findByTestId('supplier-audit-empty')).toHaveTextContent('Nessuna azione registrata');
  });

  it('AdminSuppliersPage_InviteButton_LinksToTheInvitePage', async () => {
    renderPage();
    await screen.findByTestId('admin-supplier-s-active');

    expect(screen.getByTestId('admin-suppliers-invite')).toHaveAttribute('href', '/app/admin/suppliers/invite');
  });

  it('AdminSuppliersPage_English_ShowsTranslatedLabelsWithoutItalianLeftovers', async () => {
    await i18n.changeLanguage('en');
    renderPage();

    const suspended = await screen.findByTestId('admin-supplier-s-suspended');
    expect(within(suspended).getByTestId('admin-supplier-status-s-suspended')).toHaveTextContent('Suspended');
    expect(within(suspended).getByTestId('admin-supplier-reactivate-s-suspended')).toHaveTextContent('Reactivate');
    expect(screen.getByRole('heading', { name: 'Suppliers' })).toBeInTheDocument();
    expect(screen.getByTestId('admin-suppliers-invite')).toHaveTextContent('Invite supplier');
  });
});
