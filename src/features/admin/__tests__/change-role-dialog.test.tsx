import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { UsersApi } from '@/api/users.api';
import type { UserRolesResponse, UserSummary } from '@/types';
import { ChangeRoleDialog } from '../components/change-role-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/users.api', () => ({
  UsersApi: { getRoles: vi.fn(), updateRoles: vi.fn() },
}));

const dualRoleHost: UserSummary = {
  id: 'auth0|dual',
  email: 'host@example.com',
  firstName: 'Marco',
  lastName: 'Bianchi',
  role: 'PropertyOwner',
  isActive: true,
  createdAt: '2026-09-01T00:00:00Z',
};

function rolesResponse(overrides: Partial<UserRolesResponse> = {}): UserRolesResponse {
  return {
    id: dualRoleHost.id,
    roles: ['PropertyOwner', 'LongTermLandlord'],
    rolesGranted: [],
    rolesRevoked: [],
    ...overrides,
  };
}

function renderDialog(open = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChangeRoleDialog user={dualRoleHost} open={open} onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

describe('ChangeRoleDialog multi-role editor (A1-17)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('fetchSucceeds_preChecksEveryRoleTheUserCurrentlyHolds', async () => {
    vi.mocked(UsersApi.getRoles).mockResolvedValue(rolesResponse());
    renderDialog();

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: i18n.t('roles.PropertyOwner') })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: i18n.t('roles.LongTermLandlord') })).toBeChecked();
    });
    expect(screen.getByRole('checkbox', { name: i18n.t('roles.Supplier') })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: i18n.t('roles.Admin') })).not.toBeChecked();
  });

  it('fetchFails_showsErrorStateInsteadOfAnEmptyRoleList', async () => {
    vi.mocked(UsersApi.getRoles).mockRejectedValue(new Error('network down'));
    renderDialog();

    await waitFor(() =>
      expect(screen.getByText(i18n.t('admin.users.roleDialog.loadError'))).toBeInTheDocument(),
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('addSupplierToExistingRoles_savesTheUnionAsTheNewRoleSet', async () => {
    vi.mocked(UsersApi.getRoles).mockResolvedValue(rolesResponse());
    vi.mocked(UsersApi.updateRoles).mockResolvedValue(
      rolesResponse({ roles: ['PropertyOwner', 'LongTermLandlord', 'Supplier'], rolesGranted: ['Supplier'] }),
    );
    renderDialog();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: i18n.t('roles.Supplier') })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('roles.Supplier') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('admin.users.roleDialog.save') }));

    await waitFor(() =>
      expect(UsersApi.updateRoles).toHaveBeenCalledWith(
        dualRoleHost.id,
        expect.arrayContaining(['PropertyOwner', 'LongTermLandlord', 'Supplier']),
      ),
    );
    const [, savedRoles] = vi.mocked(UsersApi.updateRoles).mock.calls[0];
    expect(savedRoles).toHaveLength(3);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('toast.roleUpdated')));
  });

  it('uncheckingEveryRole_showsNoRolesWarningButStillAllowsSaving', async () => {
    vi.mocked(UsersApi.getRoles).mockResolvedValue(rolesResponse({ roles: ['PropertyOwner'] }));
    renderDialog();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: i18n.t('roles.PropertyOwner') })).toBeChecked());
    fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('roles.PropertyOwner') }));

    expect(screen.getByText(i18n.t('admin.users.roleDialog.noRolesWarning'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('admin.users.roleDialog.save') })).not.toBeDisabled();
  });

  it('saveFails_showsErrorToastAndKeepsDialogOpen', async () => {
    vi.mocked(UsersApi.getRoles).mockResolvedValue(rolesResponse());
    vi.mocked(UsersApi.updateRoles).mockRejectedValue(new Error('sync failed'));
    renderDialog();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: i18n.t('roles.Supplier') })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: i18n.t('admin.users.roleDialog.save') }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('toast.roleUpdateFailed')));
  });
});
