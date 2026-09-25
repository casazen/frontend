import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useCheckIn } from '@/queries/use-bookings';
import type { Booking } from '@/types';
import { stayDateOf } from '../lib/booking-price';
import { guestDataCompletionPath } from '../lib/stay-actions';
import { GuestDataNotice } from './guest-data-notice';

interface CheckInDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Registra arrivo" (CO-08, A5-08): the host confirms that the guest arrived and the booking becomes checked in. The
 * dialog says beforehand whether the guest data for Alloggiati Web are complete, with the link to complete them: they
 * never block the arrival. A registration after the check-in day is normal. The API error stays in the dialog.
 */
export function CheckInDialog({ booking, open, onOpenChange }: CheckInDialogProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const checkIn = useCheckIn();

  if (!booking) return null;

  const guestName =
    `${booking.guest?.firstName ?? ''} ${booking.guest?.lastName ?? ''}`.trim() || t('compliance.checkout.guestFallback');
  const checkInDay = stayDateOf(booking.checkInDate);
  const late = checkInDay < todayInRome();

  const handleOpenChange = (next: boolean) => {
    if (!next) checkIn.reset();
    onOpenChange(next);
  };

  const submit = () =>
    checkIn.mutate(booking.id, {
      onSuccess: (arrived) => {
        handleOpenChange(false);
        if (arrived.guestDataComplete) {
          toast.success(t('booking.arrival.registered'));
          return;
        }
        toast.warning(t('booking.arrival.registeredDataIncomplete'), {
          action: {
            label: t('booking.arrival.completeGuestData'),
            onClick: () => navigate(guestDataCompletionPath(booking.id)),
          },
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="register-arrival-dialog">
        <DialogHeader>
          <DialogTitle>{t('booking.arrival.title')}</DialogTitle>
          <DialogDescription>{t('booking.arrival.description', { guest: guestName })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {late && (
            <p className="text-sm text-muted-foreground" data-testid="register-arrival-late">
              {t('booking.arrival.lateNotice', { date: formatStayDate(checkInDay, i18n.language) })}
            </p>
          )}
          <GuestDataNotice bookingId={booking.id} enabled={open} onNavigate={() => handleOpenChange(false)} />
        </div>

        {checkIn.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getProblemMessage(checkIn.error, t) ?? t('booking.arrival.failed')}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={checkIn.isPending}>
            {t('booking.arrival.keep')}
          </Button>
          <Button type="button" onClick={submit} disabled={checkIn.isPending} data-testid="register-arrival-submit">
            {checkIn.isPending ? t('booking.arrival.submitting') : t('booking.arrival.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
