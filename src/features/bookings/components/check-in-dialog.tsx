import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { checkInFormSchema } from '../schemas/booking.schema';
import type { CheckInFormValues } from '../schemas/booking.schema';
import type { Booking } from '@/types';

interface CheckInDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: CheckInFormValues) => void | Promise<void>;
  isLoading?: boolean;
}

export function CheckInDialog({
  booking,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: CheckInDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CheckInFormValues>({
    resolver: zodResolver(checkInFormSchema),
    defaultValues: {
      actualCheckInTime: new Date().toISOString().slice(0, 16),
      notes: '',
    },
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: CheckInFormValues) => {
    await onConfirm(data);
    handleClose();
  };

  if (!booking) return null;

  const guestName = `${booking.guest.firstName} ${booking.guest.lastName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{t('booking.checkInDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('booking.checkInDialog.description', { name: guestName })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="actualCheckInTime">{t('booking.checkInDialog.checkInTime')}</Label>
              <Input
                id="actualCheckInTime"
                type="datetime-local"
                {...register('actualCheckInTime')}
              />
              {errors.actualCheckInTime && (
                <p className="text-sm text-destructive">{errors.actualCheckInTime.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('booking.checkInDialog.notes')}</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder={t('booking.checkInDialog.notesPlaceholder')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('booking.checkInDialog.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('booking.checkInDialog.checkingIn') : t('booking.checkInDialog.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
