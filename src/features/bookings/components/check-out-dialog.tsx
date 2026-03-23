import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Check Out Guest</DialogTitle>
            <DialogDescription>
              Check out {booking.guest.firstName} {booking.guest.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="actualCheckOutTime">Check-out Time</Label>
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
              <Label htmlFor="damages">Damages (if any)</Label>
              <Textarea
                id="damages"
                {...register('damages')}
                placeholder="Describe any damages found..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Any notes about the check-out..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Checking Out...' : 'Confirm Check Out'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
