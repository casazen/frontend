import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatUserDisplayName } from '@/lib/user-display';
import { ChangeRoleDialog } from './change-role-dialog';
import { ChangeOrgPlanDialog } from './change-org-plan-dialog';
import { DeactivateUserDialog } from './deactivate-user-dialog';
import { DeleteUserDialog } from './delete-user-dialog';
import type { UserSummary } from '@/types';
import { getPlanTierLabel, getRoleLabel } from '@/lib/i18n-labels';
import { formatDate } from '@/lib/utils';
import { useReactivateUser } from '@/queries/use-users';

interface UserManagementTableProps {
  users: UserSummary[];
  isLoading: boolean;
}

export function UserManagementTable({ users, isLoading }: UserManagementTableProps) {
  const { t } = useTranslation();
  const [roleTarget, setRoleTarget] = useState<UserSummary | null>(null);
  const [planTarget, setPlanTarget] = useState<UserSummary | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserSummary | null>(null);
  const { mutate: reactivate, isPending: isReactivating, variables: reactivatingId } = useReactivateUser();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="min-w-0 xl:overflow-x-auto">
        <table aria-label={t('admin.users.title')} className="block w-full text-sm xl:table">
          <thead className="max-xl:sr-only">
            <tr className="border-b bg-surface-2 text-left text-xs text-foreground/80">
              <th scope="col" className="px-2 py-3 pr-4 font-medium">{t('admin.users.table.name')}</th>
              <th scope="col" className="px-2 py-3 pr-4 font-medium">{t('admin.users.table.email')}</th>
              <th scope="col" className="px-2 py-3 pr-4 font-medium">{t('admin.users.table.role')}</th>
              <th scope="col" className="px-2 py-3 pr-4 font-medium">{t('admin.users.table.plan')}</th>
              <th scope="col" className="px-2 py-3 pr-4 font-medium">{t('admin.users.table.status')}</th>
              <th scope="col" className="px-2 py-3 pr-4 font-medium">{t('admin.users.table.createdAt')}</th>
              <th scope="col" className="px-2 py-3 font-medium">{t('admin.users.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="grid gap-3 md:grid-cols-2 xl:table-row-group">
            {users.map((user) => (
              <tr key={user.id} className="grid min-w-0 grid-cols-2 items-start gap-3 rounded-xl border p-4 xl:table-row xl:border-x-0 xl:border-t-0 xl:p-0">
                <th scope="row" className="col-span-2 text-left text-base font-semibold xl:px-2 xl:py-3 xl:text-sm">
                  {formatUserDisplayName(user)}
                </th>
                <td className="col-span-2 min-w-0 break-all text-foreground/75 xl:px-2 xl:py-3">{user.email || '—'}</td>
                <td className="xl:px-2 xl:py-3">
                  <span aria-hidden="true" className="mb-1 block text-xs text-foreground/70 xl:hidden">{t('admin.users.table.role')}</span>
                  <Badge variant="outline">{getRoleLabel(user.role, t)}</Badge>
                </td>
                <td className="xl:px-2 xl:py-3">
                  <span aria-hidden="true" className="mb-1 block text-xs text-foreground/70 xl:hidden">{t('admin.users.table.plan')}</span>
                  <Badge variant="secondary">{user.planTier ? getPlanTierLabel(user.planTier, t) : '—'}</Badge>
                </td>
                <td className="xl:px-2 xl:py-3">
                  <span aria-hidden="true" className="mb-1 block text-xs text-foreground/70 xl:hidden">{t('admin.users.table.status')}</span>
                  <Badge variant={user.isActive ? 'success' : 'secondary'}>{t(user.isActive ? 'admin.users.table.active' : 'admin.users.table.inactive')}</Badge>
                </td>
                <td className="text-foreground/75 xl:px-2 xl:py-3">
                  <span aria-hidden="true" className="mb-1 block text-xs xl:hidden">{t('admin.users.table.createdAt')}</span>
                  {formatDate(user.createdAt)}
                </td>
                <td className="col-span-2 border-t pt-3 xl:border-0 xl:px-2 xl:py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPlanTarget(user)}
                      disabled={!user.orgId}
                    >
                      {t('admin.users.table.planAction')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRoleTarget(user)}
                    >
                      {t('admin.users.table.roleAction')}
                    </Button>
                    {user.isActive ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeactivateTarget(user)}
                      >
                        {t('admin.users.table.deactivateAction')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reactivate(user.id)}
                        disabled={isReactivating && reactivatingId === user.id}
                      >
                        {t('admin.users.table.reactivateAction')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(user)}
                    >
                      {t('admin.users.table.removeAction')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  {t('admin.users.table.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ChangeOrgPlanDialog
        user={planTarget}
        open={planTarget !== null}
        onOpenChange={(open) => { if (!open) setPlanTarget(null); }}
      />

      <ChangeRoleDialog
        user={roleTarget}
        open={roleTarget !== null}
        onOpenChange={(open) => { if (!open) setRoleTarget(null); }}
      />
      <DeactivateUserDialog
        user={deactivateTarget}
        open={deactivateTarget !== null}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}
      />
      <DeleteUserDialog
        user={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      />
    </>
  );
}
