import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChangeRoleDialog } from './change-role-dialog';
import { ChangeOrgPlanDialog } from './change-org-plan-dialog';
import { DeactivateUserDialog } from './deactivate-user-dialog';
import type { UserSummary } from '@/types';

function formatUserName(user: UserSummary): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.id;
}

interface UserManagementTableProps {
  users: UserSummary[];
  isLoading: boolean;
}

export function UserManagementTable({ users, isLoading }: UserManagementTableProps) {
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
              <th className="pb-2 pr-4 font-medium">Nome</th>
              <th className="pb-2 pr-4 font-medium">Email</th>
              <th className="pb-2 pr-4 font-medium">Ruolo</th>
              <th className="pb-2 pr-4 font-medium">Piano</th>
              <th className="pb-2 pr-4 font-medium">Stato</th>
              <th className="pb-2 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="py-3 pr-4 font-medium">
                  {formatUserName(user)}
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
                    <Badge variant="default">Attivo</Badge>
                  ) : (
                    <Badge variant="secondary">Inattivo</Badge>
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
                      Piano
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRoleTarget(user)}
                    >
                      Ruolo
                    </Button>
                    {user.isActive && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeactivateTarget(user)}
                      >
                        Disattiva
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nessun utente trovato.
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
