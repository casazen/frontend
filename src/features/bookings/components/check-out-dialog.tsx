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
import { checkOutFormSchema } from '../schemas/booking.schema';
import type { CheckOutFormValues } from '../schemas/booking.schema';
import type { Booking } from '@/types';

interface CheckOutDialogProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: CheckOutFormValues) => void | Promise<void>;
  isLoading?: boolean;
}

export function CheckOutDialog({
  booking,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: CheckOutDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CheckOutFormValues>({
    resolver: zodResolver(checkOutFormSchema),
    defaultValues: {
      actualCheckOutTime: new Date().toISOString().slice(0, 16),
      notes: '',
      damages: '',
    },
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: CheckOutFormValues) => {
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
            <DialogTitle>{t('booking.checkOutDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('booking.checkOutDialog.description', { name: guestName })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="actualCheckOutTime">{t('booking.checkOutDialog.checkOutTime')}</Label>
              <Input
                id="actualCheckOutTime"
                type="datetime-local"
                {...register('actualCheckOutTime')}
              />
              {errors.actualCheckOutTime && (
                <p className="text-sm text-destructive">{errors.actualCheckOutTime.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="damages">{t('booking.checkOutDialog.damages')}</Label>
              <Textarea
                id="damages"
                {...register('damages')}
                placeholder={t('booking.checkOutDialog.damagesPlaceholder')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('booking.checkOutDialog.notes')}</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder={t('booking.checkOutDialog.notesPlaceholder')}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('booking.checkOutDialog.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('booking.checkOutDialog.checkingOut') : t('booking.checkOutDialog.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
