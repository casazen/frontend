import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeactivateUser } from '@/queries/use-users';
import type { UserSummary } from '@/types';

interface DeactivateUserDialogProps {
  user: UserSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeactivateUserDialog({ user, open, onOpenChange }: DeactivateUserDialogProps) {
  const { mutate: deactivate, isPending } = useDeactivateUser();

  function handleConfirm() {
    if (!user) return;
    deactivate(user.id, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disattiva utente</DialogTitle>
          <DialogDescription>
            Sei sicuro di voler disattivare {user?.firstName} {user?.lastName} ({user?.email})?
            L&apos;utente non potrà più accedere al sistema.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Disattivazione...' : 'Disattiva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
