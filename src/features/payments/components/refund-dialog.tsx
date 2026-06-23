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
import { refundPaymentSchema } from '../schemas/payment.schema';
import { formatCurrency } from '@/lib/utils';
import type { RefundPaymentFormValues } from '../schemas/payment.schema';
import type { Payment } from '@/types';

interface RefundDialogProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: RefundPaymentFormValues) => void | Promise<void>;
  isLoading?: boolean;
}

export function RefundDialog({
  payment,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: RefundDialogProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RefundPaymentFormValues>({
    resolver: zodResolver(refundPaymentSchema),
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const onSubmit = async (data: RefundPaymentFormValues) => {
    await onConfirm(data);
    handleClose();
  };

  if (!payment) return null;

  const refundableAmount = payment.amount - (payment.refundedAmount || 0);
  const formattedAmount = formatCurrency(payment.amount, payment.currency);
  const formattedRefundable = formatCurrency(refundableAmount, payment.currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{t('payment.refund.title')}</DialogTitle>
            <DialogDescription>
              {t('payment.refund.description', { amount: formattedAmount })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('payment.refund.originalAmount')}</span>
                <span className="font-semibold">
                  {formattedAmount}
                </span>
              </div>
              {payment.refundedAmount && payment.refundedAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('payment.refund.alreadyRefunded')}</span>
                  <span className="font-medium text-destructive">
                    -{formatCurrency(payment.refundedAmount, payment.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">{t('payment.refund.refundableAmount')}</span>
                <span className="font-bold">
                  {formattedRefundable}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                {t('payment.refund.refundAmountLabel')}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...register('amount', { valueAsNumber: true })}
                placeholder={refundableAmount.toString()}
              />
              <p className="text-xs text-muted-foreground">
                {t('payment.refund.refundAmountHint', { amount: formattedRefundable })}
              </p>
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">{t('payment.refund.reason')}</Label>
              <Textarea
                id="reason"
                {...register('reason')}
                placeholder={t('payment.refund.reasonPlaceholder')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('payment.refund.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={isLoading}>
              {isLoading ? t('payment.refund.processingRefund') : t('payment.refund.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
