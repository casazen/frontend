import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { useCreatePayment } from '@/queries/use-payments';
import { newIdempotencyKey, RECORDABLE_METHODS } from '../lib/record-payment';
import { paymentFormSchema, type PaymentFormValues } from '../schemas/payment.schema';

/** A booking the host can record a receipt on: how it is named in the list and what is left to collect (`null` when not known). */
export interface RecordPaymentOption {
  id: string;
  label: string;
  balance: number | null;
}

interface RecordPaymentFormProps {
  /** The bookings to choose from. */
  options: readonly RecordPaymentOption[];
  /** The booking the receipt is for when it is already known (the sheet of a booking): there is no choice to make. */
  fixedBookingId?: string;
  /** The booking selected when the form opens (a link from a row that waits for the host). */
  initialBookingId?: string;
  onRecorded: () => void;
  onCancel: () => void;
}

/**
 * The form that records a payment the host received outside CasaZen (SR-06b): how much, how (cash or bank transfer) and on which day.
 * The server decides whether it can be recorded (never more than is left to collect, never on a cancelled booking or one from a
 * portal) and says why when it cannot: that reason is shown under the form. The key that makes the record happen once is kept until
 * the record goes through, so sending the same form twice (a double click, a retry after a lost answer) is not recording it twice.
 */
export function RecordPaymentForm({ options, fixedBookingId, initialBookingId, onRecorded, onCancel }: RecordPaymentFormProps) {
  const { t } = useTranslation();
  const createPayment = useCreatePayment();
  const keyRef = useRef(newIdempotencyKey());
  const today = todayInRome();

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { bookingId: fixedBookingId ?? initialBookingId ?? '', receivedOn: today },
  });

  const selected = options.find((option) => option.id === watch('bookingId'));
  const balance = selected?.balance ?? null;

  // The usual receipt is what is left: offered when the amount is still empty, never over what the host typed.
  const offerTheBalance = (bookingId: string) => {
    const left = options.find((option) => option.id === bookingId)?.balance ?? null;
    const typed = getValues('amount');
    if (left !== null && left > 0 && (typed === undefined || Number.isNaN(typed))) setValue('amount', left);
  };

  const onSubmit = async (values: PaymentFormValues) => {
    try {
      await createPayment.mutateAsync({
        bookingId: values.bookingId,
        amount: values.amount,
        method: values.method,
        receivedOn: values.receivedOn,
        description: values.description?.trim() || undefined,
        idempotencyKey: keyRef.current,
      });
    } catch {
      return; // the reason is shown under the form
    }
    keyRef.current = newIdempotencyKey();
    onRecorded();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {fixedBookingId ? (
        <input type="hidden" {...register('bookingId')} />
      ) : (
        <Field id="bookingId" label={t('payment.create.booking')} error={errors.bookingId}>
          <Select {...register('bookingId', { onChange: (event) => offerTheBalance(event.target.value) })}>
            <option value="">{t('payment.create.selectBooking')}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {balance !== null ? (
        <p className="text-sm text-foreground/70" data-testid="record-payment-balance">
          {t('payment.create.balance', { amount: formatCurrency(balance) })}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="amount" label={t('payment.create.amount')} error={errors.amount}>
          <Input type="number" step="0.01" inputMode="decimal" {...register('amount', { valueAsNumber: true })} placeholder={t('payment.create.amountPlaceholder')} />
        </Field>

        <Field id="receivedOn" label={t('payment.create.receivedOn')} error={errors.receivedOn}>
          <Input type="date" max={today} {...register('receivedOn')} />
        </Field>
      </div>

      <Field id="method" label={t('payment.create.paymentMethod')} error={errors.method}>
        <Select {...register('method')}>
          <option value="">{t('payment.create.selectMethod')}</option>
          {RECORDABLE_METHODS.map((value) => (
            <option key={value} value={value}>
              {t(`payment.create.methods.${value}`)}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="description" label={t('payment.create.note')} optional>
        <Textarea {...register('description')} placeholder={t('payment.create.descriptionPlaceholder')} rows={3} maxLength={1000} />
      </Field>

      {createPayment.isError ? (
        <Alert variant="danger" data-testid="record-payment-error">
          {getProblemMessage(createPayment.error, t) ?? t('payment.create.failed')}
        </Alert>
      ) : null}

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('payment.create.cancel')}
        </Button>
        <Button type="submit" loading={createPayment.isPending}>
          {createPayment.isPending ? t('payment.create.creating') : t('payment.create.create')}
        </Button>
      </div>
    </form>
  );
}
