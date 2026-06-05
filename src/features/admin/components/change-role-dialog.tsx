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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { displayUserName } from '@/api/users.mapper';
import { useChangeUserRoles } from '@/queries/use-users';
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
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const { mutate: changeRoles, isPending } = useChangeUserRoles();

  useEffect(() => {
    if (user) {
      setSelectedRoles(user.roles.length > 0 ? [...user.roles] : [user.role]);
    }
  }, [user]);

  function toggleRole(role: UserRole, checked: boolean) {
    setSelectedRoles((current) => {
      if (checked) {
        return current.includes(role) ? current : [...current, role];
      }
      return current.filter((r) => r !== role);
    });
  }

  function handleConfirm() {
    if (!user || selectedRoles.length === 0) return;
    changeRoles(
      { id: user.id, roles: selectedRoles },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gestisci ruoli</DialogTitle>
          <DialogDescription>
            Seleziona uno o più ruoli per {user ? displayUserName(user) : 'l\'utente'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {ALL_ROLES.map((role) => {
            const checked = selectedRoles.includes(role);
            const checkboxId = `role-${role}`;

            return (
              <div key={role} className="flex items-center gap-3">
                <Checkbox
                  id={checkboxId}
                  checked={checked}
                  onCheckedChange={(value) => toggleRole(role, value === true)}
                />
                <Label htmlFor={checkboxId} className="cursor-pointer font-normal">
                  {role}
                </Label>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || selectedRoles.length === 0}>
            {isPending ? 'Salvataggio...' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
