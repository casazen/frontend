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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Check In Guest</DialogTitle>
            <DialogDescription>
              Check in {booking.guest.firstName} {booking.guest.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="actualCheckInTime">Check-in Time</Label>
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
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Any notes about the check-in..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Checking In...' : 'Confirm Check In'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
