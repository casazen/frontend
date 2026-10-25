import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { holdForUndo } from '@/lib/hold-for-undo';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRentRegisterActions } from '@/queries/use-rent-register';
import type { RentRegisterRow } from '@/types';
import { leaseTenantName } from '../lib/lease-list-format';
import { reminderKey } from '../lib/rent-register';

/** The most the landlord can add to the e-mail (the server refuses a longer note). */
const MAX_NOTE_LENGTH = 300;

interface RentReminderDialogProps {
  /** The installment to remind the tenants of. */
  row: RentRegisterRow;
  /** The org accepts rent online: the e-mail then carries the link to pay. */
  onlinePaymentsAvailable: boolean;
  /** The least time between two reminders of the same installment, as the server says it. */
  intervalHours: number;
  onClose: () => void;
}

/**
 * The reminder of one installment (LR-04b): what the tenant will read, a short note of the landlord and nothing else. It writes
 * to a third party and cannot be called back, so it never goes by itself: the landlord presses «Invia sollecito», and only then
 * does the e-mail wait six seconds with an «Annulla» that is true (`holdForUndo`: nothing has been sent until they pass).
 * The tenants are not named here; after the send the toast says how many received it.
 */
export function RentReminderDialog({ row, onlinePaymentsAvailable, intervalHours, onClose }: RentReminderDialogProps) {
  const { t } = useTranslation();
  const actions = useRentRegisterActions();
  const [note, setNote] = useState('');

  const tenant = leaseTenantName(row, t);
  const amount = formatCurrency(row.amount, row.currency);
  // The dates as the e-mail writes them.
  const dueDate = formatDate(row.dueDate);

  function send() {
    const text = note.trim();
    const started = holdForUndo({
      key: reminderKey(row.id),
      message: t('longRentRents.reminder.held', { tenant }),
      description: t('longRentRents.reminder.heldHint'),
      commit: async () => {
        const result = await actions.sendReminder(row.leaseId, row.id, text === '' ? undefined : text);
        toast.success(t('longRentRents.reminder.sent', { count: result.recipientCount }));
      },
    });
    // The same reminder is already on its way (the row says so too): tell, never a click that seems to do nothing.
    if (!started) toast.info(t('longRentRents.alreadyHeld'));
    onClose();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="rent-reminder-dialog">
        <DialogHeader>
          <DialogTitle>{t('longRentRents.reminder.title')}</DialogTitle>
          <DialogDescription className="break-words">
            {t('longRentRents.reminder.description', { tenant, property: row.propertyName, amount, date: dueDate })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section aria-label={t('longRentRents.reminder.previewLabel')} className="space-y-2 break-words rounded-md bg-muted p-3 text-sm" data-testid="rent-reminder-preview">
            <p className="font-medium">
              {t('longRentRents.reminder.previewSubject', { property: row.propertyName, date: dueDate })}
            </p>
            <p>
              {t(row.isOverdue ? 'longRentRents.reminder.previewBodyOverdue' : 'longRentRents.reminder.previewBodyDue', {
                amount,
                property: row.propertyName,
                from: formatDate(row.periodStart),
                to: formatDate(row.periodEnd),
                date: dueDate,
              })}
            </p>
            <p className="text-foreground/70">
              {onlinePaymentsAvailable ? t('longRentRents.reminder.previewWithLink') : t('longRentRents.reminder.previewWithoutLink')}
            </p>
          </section>

          <Field
            label={t('longRentRents.reminder.noteLabel')}
            optional
            counter={`${note.length}/${MAX_NOTE_LENGTH}`}
            hint={t('longRentRents.reminder.noteHint')}
          >
            <Textarea
              value={note}
              maxLength={MAX_NOTE_LENGTH}
              placeholder={t('longRentRents.reminder.notePlaceholder')}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          <p className="text-sm text-foreground/70">{t('longRentRents.reminder.whoGetsIt')}</p>
          <p className="text-sm text-foreground/70">{t('longRentRents.reminder.interval', { count: intervalHours })}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('longRentRents.cancel')}
          </Button>
          <Button type="button" onClick={send} data-testid="rent-reminder-send">
            {t('longRentRents.reminder.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
