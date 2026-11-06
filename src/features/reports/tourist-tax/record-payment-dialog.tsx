import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { ReportPeriod } from '@/api/reports.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { todayInRome } from '@/lib/stay-dates';
import { getTouristTaxFieldErrors, type TouristTaxField } from '@/lib/tourist-tax-summary-errors';
import { useRecordTouristTaxRemittance } from '@/queries/use-tourist-tax-summary';
import type { TouristTaxComuneSummary } from '@/types';
import {
  NOTES_MAX_LENGTH,
  RECEIPT_ACCEPT,
  REFERENCE_MAX_LENGTH,
  defaultPaymentValues,
  formatCents,
  recordPaymentSchema,
  remittanceAmountCents,
  toRemittanceInput,
  type RecordPaymentFormValues,
} from './tourist-tax-model';

interface RecordPaymentDialogProps {
  /** The comune the payment is for (the row the person chose), or null while the dialog is closed. */
  comune: TouristTaxComuneSummary | null;
  /** The days of the summary the person is looking at: the payment starts from them, so that it shows in that summary. */
  period: ReportPeriod;
  onClose: () => void;
}

/**
 * Records a payment of the tourist tax to a comune, with the receipt when the host has it (NF-100). The comune is the one of the row
 * and cannot be changed here; the days of the period start from the ones of the summary. The amount is typed the way an Italian
 * writes it and the dialog says how it read it before it goes to the server as text with a dot (`1250.00`). A rule the server
 * applies and the form could not (the comune, a day, the receipt) is shown next to the field it is about, with everything typed
 * kept; a failure that no field explains is told by the toast of the mutation.
 */
export function RecordPaymentDialog({ comune, period, onClose }: RecordPaymentDialogProps) {
  return (
    <Dialog
      open={comune !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {comune ? <RecordPaymentForm key={comune.comune} comune={comune} period={period} onClose={onClose} /> : null}
    </Dialog>
  );
}

function RecordPaymentForm({ comune, period, onClose }: { comune: TouristTaxComuneSummary; period: ReportPeriod; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const record = useRecordTouristTaxRemittance();
  const today = todayInRome();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: defaultPaymentValues(comune.comune, period),
  });

  // How the amount typed was read: the host sees `1.250,00 €` before it is recorded, so a point that means thousands is never a surprise.
  const typedAmount = useWatch({ control, name: 'amount' });
  const amountCents = remittanceAmountCents(typedAmount);
  const toPay = comune.balanceCents !== null && comune.balanceCents > 0 ? comune.balanceCents : null;

  const onSubmit = handleSubmit(async (values) => {
    const input = toRemittanceInput(values);
    if (input === null) return;

    try {
      await record.mutateAsync(input);
    } catch (error) {
      // The toast of the mutation tells the failures that no field explains; the others go next to their field.
      let first = true;
      for (const [field, message] of Object.entries(getTouristTaxFieldErrors(error))) {
        setError(field as TouristTaxField, { type: 'server', message }, { shouldFocus: first });
        first = false;
      }
      return;
    }
    onClose();
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="record-payment-dialog">
      <DialogHeader>
        <DialogTitle>{t('reports.touristTax.record.title', { comune: comune.comune })}</DialogTitle>
        <DialogDescription>{t('reports.touristTax.record.description')}</DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="record-payment-form">
        {toPay !== null ? (
          <p className="text-sm text-foreground/70" data-testid="record-payment-balance">
            {t('reports.touristTax.record.balance', { amount: formatCents(toPay, i18n.language) })}
          </p>
        ) : null}

        <Field label={t('reports.touristTax.record.fields.comune')} error={errors.comune}>
          <Input readOnly {...register('comune')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('reports.touristTax.record.fields.periodFrom')} error={errors.periodFrom}>
            <Input type="date" min="2000-01-01" max="2100-12-31" {...register('periodFrom')} data-testid="record-payment-from" />
          </Field>
          <Field label={t('reports.touristTax.record.fields.periodTo')} error={errors.periodTo}>
            <Input type="date" min="2000-01-01" max="2100-12-31" {...register('periodTo')} data-testid="record-payment-to" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('reports.touristTax.record.fields.amount')}
            error={errors.amount}
            hint={
              amountCents !== null
                ? t('reports.touristTax.record.amountRead', { amount: formatCents(amountCents, i18n.language) })
                : t('reports.touristTax.record.amountHint')
            }
          >
            <Input inputMode="decimal" autoComplete="off" {...register('amount')} data-testid="record-payment-amount" />
          </Field>
          <Field label={t('reports.touristTax.record.fields.paidOn')} error={errors.paidOn}>
            <Input type="date" min="2000-01-01" max={today} {...register('paidOn')} data-testid="record-payment-paid-on" />
          </Field>
        </div>

        <Field label={t('reports.touristTax.record.fields.reference')} error={errors.reference} optional>
          <Input maxLength={REFERENCE_MAX_LENGTH} autoComplete="off" {...register('reference')} data-testid="record-payment-reference" />
        </Field>

        <Field label={t('reports.touristTax.record.fields.notes')} error={errors.notes} optional>
          <Textarea rows={2} maxLength={NOTES_MAX_LENGTH} {...register('notes')} data-testid="record-payment-notes" />
        </Field>

        <Controller
          control={control}
          name="receipt"
          render={({ field, fieldState }) => (
            <Field
              label={t('reports.touristTax.record.fields.receipt')}
              error={fieldState.error}
              hint={t('reports.touristTax.record.receiptHint')}
              optional
            >
              <Input
                type="file"
                accept={RECEIPT_ACCEPT}
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.files?.[0] ?? null)}
                data-testid="record-payment-receipt"
              />
            </Field>
          )}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('shared.cancel')}
          </Button>
          <Button type="submit" loading={record.isPending} data-testid="record-payment-submit">
            {t('reports.touristTax.record.submit')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
