import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { remindAtFor, remindOptions } from '@/features/notifications/alert-model';
import { useNow } from '@/hooks/use-now';

interface AlertRemindDialogProps {
  open: boolean;
  /** The person chose a moment: `remindAt` is that moment, counted from the click. The caller sends it to the server. */
  onRemind: (remindAt: Date) => void;
  onClose: () => void;
  /** The deadline of the alert, when it has one (a legal term): the choices that fall after it cannot be chosen. */
  deadline?: Date;
}

/**
 * «Ricordamelo più tardi» (ADR-025): four ways to put an alert off. In 15 minutes, in 1 hour, in 4 hours, and tomorrow at 9:00 on the
 * clock of Rome. The dialog only asks; sending the choice to the server is up to the caller (`onRemind`).
 */
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
  // The clock moves every minute: a choice that falls after the deadline while the dialog is open goes off.
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
                // The moment is counted from the click, not from when the dialog was drawn.
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
