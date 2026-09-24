import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { UsersApi } from '@/api/users.api';
import type { UserActivationResponse, UserSummary } from '@/types';
import { UserManagementTable } from '../components/user-management-table';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/users.api', () => ({
  UsersApi: { deactivateUser: vi.fn(), reactivateUser: vi.fn(), changeRole: vi.fn() },
}));

const active: UserSummary = {
  id: 'auth0|active',
  email: 'attivo@example.com',
  firstName: 'Anna',
  lastName: 'Attiva',
  role: 'PropertyOwner',
  isActive: true,
  createdAt: '2026-09-01T00:00:00Z',
};

const inactive: UserSummary = { ...active, id: 'auth0|inactive', email: 'inattivo@example.com', isActive: false };

function outcome(overrides: Partial<UserActivationResponse> = {}): UserActivationResponse {
  return {
    id: 'auth0|active',
    isActive: false,
    changed: true,
    auth0Synced: true,
    auth0SyncError: null,
    message: 'server message',
    rolesRestored: [],
    ...overrides,
  };
}

function renderTable(users: UserSummary[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UserManagementTable users={users} isLoading={false} />
    </QueryClientProvider>,
  );
}

async function deactivateThroughDialog() {
  fireEvent.click(screen.getByRole('button', { name: i18n.t('admin.users.table.deactivateAction') }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('admin.users.deactivateDialog.confirm') }));
}

describe('UserManagementTable deactivation and reactivation (PL-03)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('deactivate_auth0Synced_showsSuccess', async () => {
    vi.mocked(UsersApi.deactivateUser).mockResolvedValue(outcome());
    renderTable([active]);

    await deactivateThroughDialog();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('toast.userDeactivated')));
    expect(UsersApi.deactivateUser).toHaveBeenCalledWith('auth0|active');
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('deactivate_auth0NotSynced_warnsThatAuth0MustBeRetried', async () => {
    vi.mocked(UsersApi.deactivateUser).mockResolvedValue(
      outcome({ auth0Synced: false, auth0SyncError: 'auth0_management_error' }),
    );
    renderTable([active]);

    await deactivateThroughDialog();

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(i18n.t('toast.userDeactivatedAuth0NotSynced')),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('inactiveUser_reactivateButton_callsReactivationAndReportsIt', async () => {
    vi.mocked(UsersApi.reactivateUser).mockResolvedValue(
      outcome({ id: 'auth0|inactive', isActive: true, rolesRestored: ['PropertyOwner'] }),
    );
    renderTable([inactive]);

    expect(screen.queryByRole('button', { name: i18n.t('admin.users.table.deactivateAction') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('admin.users.table.reactivateAction') }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('toast.userReactivated')));
    expect(UsersApi.reactivateUser).toHaveBeenCalledWith('auth0|inactive');
  });

  it('reactivate_auth0NotSynced_warnsThatTheUserCannotSignInYet', async () => {
    vi.mocked(UsersApi.reactivateUser).mockResolvedValue(
      outcome({ id: 'auth0|inactive', isActive: true, auth0Synced: false, auth0SyncError: 'auth0_rate_limited' }),
    );
    renderTable([inactive]);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('admin.users.table.reactivateAction') }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(i18n.t('toast.userReactivatedAuth0NotSynced')),
    );
  });
});
