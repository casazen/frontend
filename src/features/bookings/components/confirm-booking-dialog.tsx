import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { useConfirmBooking } from '@/queries/use-bookings';

interface ConfirmBookingDialogProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation of a pending booking entered by the host (PC-07, A2-08): the dates become taken on the booking site
 * and in the iCal export, and the guest check-in link becomes available. The error (e.g. dates taken meanwhile) stays
 * in the dialog.
 */
export function ConfirmBookingDialog({ bookingId, open, onOpenChange }: ConfirmBookingDialogProps) {
  const { t } = useTranslation();
  const confirm = useConfirmBooking();

  const handleOpenChange = (next: boolean) => {
    if (!next) confirm.reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('booking.confirm.title')}</DialogTitle>
          <DialogDescription>{t('booking.confirm.description')}</DialogDescription>
        </DialogHeader>

        {confirm.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getProblemMessage(confirm.error, t) ?? t('booking.confirm.failed')}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={confirm.isPending}>
            {t('booking.confirm.keep')}
          </Button>
          <Button
            type="button"
            onClick={() => confirm.mutate(bookingId, { onSuccess: () => handleOpenChange(false) })}
            disabled={confirm.isPending}
          >
            {confirm.isPending ? t('booking.confirm.submitting') : t('booking.confirm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
