import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatUserDisplayName } from '@/lib/user-display';
import { ChangeRoleDialog } from './change-role-dialog';
import { ChangeOrgPlanDialog } from './change-org-plan-dialog';
import { DeactivateUserDialog } from './deactivate-user-dialog';
import type { UserSummary } from '@/types';

interface UserManagementTableProps {
  users: UserSummary[];
  isLoading: boolean;
}

export function UserManagementTable({ users, isLoading }: UserManagementTableProps) {
  const { t } = useTranslation();
  const [roleTarget, setRoleTarget] = useState<UserSummary | null>(null);
  const [planTarget, setPlanTarget] = useState<UserSummary | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserSummary | null>(null);

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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">{t('admin.users.table.name')}</th>
              <th className="pb-2 pr-4 font-medium">{t('admin.users.table.email')}</th>
              <th className="pb-2 pr-4 font-medium">{t('admin.users.table.role')}</th>
              <th className="pb-2 pr-4 font-medium">{t('admin.users.table.plan')}</th>
              <th className="pb-2 pr-4 font-medium">{t('admin.users.table.status')}</th>
              <th className="pb-2 font-medium">{t('admin.users.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="py-3 pr-4 font-medium">
                  {formatUserDisplayName(user)}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{user.email || '—'}</td>
                <td className="py-3 pr-4">
                  <Badge variant="outline">{user.role}</Badge>
                </td>
                <td className="py-3 pr-4">
                  <Badge variant="secondary">{user.planTier ?? '—'}</Badge>
                </td>
                <td className="py-3 pr-4">
                  {user.isActive ? (
                    <Badge variant="default">{t('admin.users.table.active')}</Badge>
                  ) : (
                    <Badge variant="secondary">{t('admin.users.table.inactive')}</Badge>
                  )}
                </td>
                <td className="py-3">
                  <div className="flex gap-2">
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
                    {user.isActive && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeactivateTarget(user)}
                      >
                        {t('admin.users.table.deactivateAction')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
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
    </>
  );
}
