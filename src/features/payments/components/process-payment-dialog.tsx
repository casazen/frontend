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
  const { t } = useTranslation();
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

  const formattedAmount = formatCurrency(payment.amount, payment.currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{t('payment.process.title')}</DialogTitle>
            <DialogDescription>
              {t('payment.process.description', { amount: formattedAmount })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('payment.process.amount')}</span>
                <span className="font-semibold">
                  {formattedAmount}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('payment.process.method')}</span>
                <span className="font-medium">{payment.method}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethodId">{t('payment.process.paymentMethodId')}</Label>
              <Input
                id="paymentMethodId"
                {...register('paymentMethodId')}
                placeholder={t('payment.process.paymentMethodIdPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('payment.process.paymentMethodIdHint')}
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
                {t('payment.process.saveCard')}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('payment.process.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('payment.process.processing') : t('payment.process.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
