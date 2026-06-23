import { useEffect, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useChangeUserRole } from '@/queries/use-users';
import { formatUserDisplayName } from '@/lib/user-display';
import type { UserSummary, UserRole } from '@/types';

const ALL_ROLES: UserRole[] = [
  'Admin',
  'PropertyOwner',
  'PropertyManager',
  'Guest',
  'Staff',
  'LongTermLandlord',
];

interface ChangeRoleDialogProps {
  user: UserSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeRoleDialog({ user, open, onOpenChange }: ChangeRoleDialogProps) {
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role ?? 'Guest');
  const { mutate: changeRole, isPending } = useChangeUserRole();

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
    }
  }, [user]);

  const displayName = user ? formatUserDisplayName(user) : '';

  function handleConfirm() {
    if (!user) return;
    changeRole(
      { id: user.id, role: selectedRole },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.roleDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.users.roleDialog.description', { name: displayName })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="role-select">{t('admin.users.roleDialog.label')}</Label>
          <select
            id="role-select"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('admin.users.roleDialog.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? t('admin.users.roleDialog.saving') : t('admin.users.roleDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
