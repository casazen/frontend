import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useDeleteUser } from '@/queries/use-users';
import { formatUserDisplayName } from '@/lib/user-display';
import type { UserSummary } from '@/types';

interface DeleteUserDialogProps {
  user: UserSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteUserDialog({ user, open, onOpenChange }: DeleteUserDialogProps) {
  const { t } = useTranslation();
  const { mutate: removeUser, isPending } = useDeleteUser();

  function handleConfirm() {
    if (!user) return;
    removeUser(user.id, { onSuccess: () => onOpenChange(false) });
  }

  const label = user ? formatUserDisplayName(user) : '';
  const email = user?.email?.trim() ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.deleteDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.users.deleteDialog.description', {
              label: email && email !== label ? `${label} (${email})` : label,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('admin.users.deleteDialog.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending || !user}>
            {isPending ? t('admin.users.deleteDialog.removing') : t('admin.users.deleteDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
