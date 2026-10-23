import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDeclineBookingRequest } from '@/queries/use-bookings';
import type { Booking } from '@/types';

const MESSAGE_MAX_LENGTH = 500;

interface DeclineBookingDialogProps {
  /** The request to decline; nothing is drawn without one. */
  booking: Pick<Booking, 'id' | 'guest'> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Declines a "pay at the property" request (BK-06): it is cancelled, its dates are free again and the guest is emailed, with
 * the message of the host if there is one (optional, at most 500 characters). An error is told by the toast of the mutation
 * and leaves the dialog open.
 */
export function DeclineBookingDialog({ booking, open, onOpenChange }: DeclineBookingDialogProps) {
  const { t } = useTranslation();
  const decline = useDeclineBookingRequest();
  const [message, setMessage] = useState('');

  if (!booking) return null;

  const guestName = `${booking.guest?.firstName ?? ''} ${booking.guest?.lastName ?? ''}`.trim() || t('compliance.checkout.guestFallback');

  const handleOpenChange = (next: boolean) => {
    if (!next) setMessage('');
    onOpenChange(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    decline.mutate({ id: booking.id, data: text ? { message: text } : {} }, { onSuccess: () => handleOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('booking.list.decline.title')}</DialogTitle>
            <DialogDescription>{t('booking.list.decline.description', { guest: guestName })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-booking-message">{t('booking.requests.declineMessageLabel')}</Label>
            <Textarea
              id="decline-booking-message"
              value={message}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder={t('booking.requests.declineMessagePlaceholder')}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={decline.isPending} onClick={() => handleOpenChange(false)}>
              {t('booking.requests.cancelDecline')}
            </Button>
            <Button type="submit" variant="destructive" disabled={decline.isPending}>
              {decline.isPending ? t('booking.requests.declining') : t('booking.requests.confirmDecline')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
