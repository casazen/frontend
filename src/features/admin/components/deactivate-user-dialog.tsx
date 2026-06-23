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
import { useDeactivateUser } from '@/queries/use-users';
import type { UserSummary } from '@/types';

interface DeactivateUserDialogProps {
  user: UserSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeactivateUserDialog({ user, open, onOpenChange }: DeactivateUserDialogProps) {
  const { t } = useTranslation();
  const { mutate: deactivate, isPending } = useDeactivateUser();

  function handleConfirm() {
    if (!user) return;
    deactivate(user.id, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.deactivateDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.users.deactivateDialog.description', {
              firstName: user?.firstName ?? '',
              lastName: user?.lastName ?? '',
              email: user?.email ?? '',
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('admin.users.deactivateDialog.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? t('admin.users.deactivateDialog.deactivating') : t('admin.users.deactivateDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
