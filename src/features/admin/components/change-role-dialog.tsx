import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';
import { useUpdateUserRoles, useUserRoles } from '@/queries/use-users';
import { formatUserDisplayName } from '@/lib/user-display';
import { getProblemMessage } from '@/lib/api-errors';
import { ADMIN_MANAGEABLE_ROLES } from '@/types';
import type { UserSummary, UserRole } from '@/types';
import { getRoleLabel } from '@/lib/i18n-labels';

interface ChangeRoleDialogProps {
  user: UserSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Multi-role editor (A1-17): grants/revokes any of ADMIN_MANAGEABLE_ROLES independently, instead of the previous
 * single dropdown that silently dropped every other role (host+supplier, "Both" landlords) the user held.
 */
export function ChangeRoleDialog({ user, open, onOpenChange }: ChangeRoleDialogProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<UserRole>>(new Set());
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useUserRoles(user?.id ?? '', open && !!user);
  const { mutate: updateRoles, isPending } = useUpdateUserRoles();

  // Seed the checkboxes from the fetched roles once per user/open, without fighting further user clicks. Adjusting
  // state while rendering (not in a useEffect) — see https://react.dev/learn/you-might-not-need-an-effect.
  if (!open) {
    if (initializedFor !== null) setInitializedFor(null);
  } else if (data && initializedFor !== user?.id) {
    setSelected(new Set(data.roles));
    setInitializedFor(user?.id ?? null);
  }

  const displayName = user ? formatUserDisplayName(user) : '';

  function toggleRole(role: UserRole) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (!user) return;
    updateRoles(
      { id: user.id, roles: Array.from(selected) },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  const ready = !isLoading && !isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.roleDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.users.roleDialog.description', { name: displayName })}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">{t('admin.users.roleDialog.loading')}</p>
        ) : isError ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-destructive">
              {getProblemMessage(error, t) ?? t('admin.users.roleDialog.loadError')}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('admin.users.roleDialog.retry')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Label>{t('admin.users.roleDialog.label')}</Label>
            <div className="space-y-2">
              {ADMIN_MANAGEABLE_ROLES.map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${role}`}
                    checked={selected.has(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <Label htmlFor={`role-${role}`} className="font-normal">
                    {getRoleLabel(role, t)}
                  </Label>
                </div>
              ))}
            </div>
            {selected.size === 0 && (
              <p className="text-sm text-amber-600">{t('admin.users.roleDialog.noRolesWarning')}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('admin.users.roleDialog.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!ready || isPending}>
            {isPending ? t('admin.users.roleDialog.saving') : t('admin.users.roleDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
