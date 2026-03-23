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
import { Checkbox } from '@/components/ui/checkbox';
import { processPaymentSchema } from '../schemas/payment.schema';
import { formatCurrency } from '@/lib/utils';
import type { ProcessPaymentFormValues } from '../schemas/payment.schema';
import type { Payment } from '@/types';

interface ProcessPaymentDialogProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: ProcessPaymentFormValues) => void | Promise<void>;
  isLoading?: boolean;
}

export function ProcessPaymentDialog({
  payment,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: ProcessPaymentDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProcessPaymentFormValues>({
    resolver: zodResolver(processPaymentSchema),
    defaultValues: {
      saveCard: false,
    },
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: ProcessPaymentFormValues) => {
    await onConfirm(data);
    handleClose();
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>
              Process payment of {formatCurrency(payment.amount, payment.currency)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold">
                  {formatCurrency(payment.amount, payment.currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium">{payment.method}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethodId">Payment Method ID *</Label>
              <Input
                id="paymentMethodId"
                {...register('paymentMethodId')}
                placeholder="pm_1234567890..."
              />
              <p className="text-xs text-muted-foreground">
                Stripe payment method ID (e.g., from Stripe Elements)
              </p>
              {errors.paymentMethodId && (
                <p className="text-sm text-destructive">{errors.paymentMethodId.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="saveCard"
                checked={watch('saveCard')}
                onCheckedChange={(checked) => setValue('saveCard', !!checked)}
              />
              <Label htmlFor="saveCard" className="cursor-pointer text-sm">
                Save card for future payments
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Process Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
