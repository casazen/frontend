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
          <DialogTitle>Cambia ruolo</DialogTitle>
          <DialogDescription>
            Seleziona il nuovo ruolo per {displayName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="role-select">Ruolo</Label>
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
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Salvataggio...' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
