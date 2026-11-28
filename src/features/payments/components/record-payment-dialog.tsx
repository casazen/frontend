import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RecordPaymentForm } from './record-payment-form';

interface RecordPaymentDialogProps {
  bookingId: string;
  balance: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordPaymentDialog({ bookingId, balance, open, onOpenChange }: RecordPaymentDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('payment.record.title')}</DialogTitle>
          <DialogDescription>{t('payment.record.description')}</DialogDescription>
        </DialogHeader>
        <RecordPaymentForm options={[{ id: bookingId, label: '', balance }]} fixedBookingId={bookingId} onRecorded={close} onCancel={close} />
      </DialogContent>
    </Dialog>
  );
}
