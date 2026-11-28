import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { remindAtFor, remindOptions } from '@/features/notifications/alert-model';
import { useNow } from '@/hooks/use-now';

interface AlertRemindDialogProps {
  open: boolean;
  onRemind: (remindAt: Date) => void;
  onClose: () => void;
  deadline?: Date;
}

export function AlertRemindDialog({ open, onRemind, onClose, deadline }: AlertRemindDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <RemindChoices onRemind={onRemind} onClose={onClose} deadline={deadline} />
      </DialogContent>
    </Dialog>
  );
}

/** The inside of the dialog, a component of its own so that it is drawn (and reads the clock) only while the dialog is open. */
function RemindChoices({ onRemind, onClose, deadline }: Omit<AlertRemindDialogProps, 'open'>) {
  const { t } = useTranslation();
  const now = useNow();
  const options = remindOptions(new Date(now), deadline);

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t('alert.remindMeLater.title')}</DialogTitle>
        <DialogDescription>{t('alert.remindMeLater.description')}</DialogDescription>
      </DialogHeader>

      <ul className="grid gap-2" data-testid="alert-remind-choices">
        {options.map(({ choice, disabled }) => (
          <li key={choice}>
            <Button
              type="button"
              variant="outline"
              block
              disabled={disabled}
              data-testid={`alert-remind-${choice}`}
              onClick={() => {
                const remindAt = remindAtFor(choice, new Date());
                if (remindAt) onRemind(remindAt);
              }}
            >
              {t(`alert.remindMeLater.${choice}`)}
            </Button>
          </li>
        ))}
      </ul>

      {options.some((option) => option.disabled) ? (
        <p className="text-sm text-foreground/70">{t('alert.remindMeLater.pastDeadline')}</p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('shared.cancel')}
        </Button>
      </DialogFooter>
    </div>
  );
}
