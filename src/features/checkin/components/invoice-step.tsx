import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { InvoiceDataFields } from '@/components/shared/invoice-data-fields';
import { INVOICE_FIELDS_COPY } from '@/lib/invoice-data-copy';
import { invoiceFieldErrorsOfForm } from '@/lib/invoice-data-schema';
import type { InvoiceDataField } from '@/types';
import { emptyInvoiceStep, type InvoiceAnswer, type PublicCheckInFormValues } from '../schemas/checkin.schema';

interface InvoiceStepProps {
  /** The booking already has the data of an invoice recipient (the context says so, never what it is): the guest is told and may send others. */
  hasInvoiceData: boolean;
}

/**
 * Invoice step of the check-in flow (FIS-01, NF-81): «Ti serve la fattura?». One step, one topic, and optional: a guest who goes on without
 * answering, or who says no, sends nothing and the check-in is never blocked by it. Only on «yes» the fields of the invoice data appear (the
 * shared ones of the host's sub-step, with the words of the guest page), checked with the shared schema; what the guest writes stays in the form
 * of the page while the guest moves between steps, and after a refusal of the server.
 *
 * The page never receives the data the booking holds: only that it has some (`hasInvoiceData`), in which case the step says so and offers to send
 * others, with the fields empty. The invoice data is write-only here, because the link is anonymous.
 */
export function InvoiceStep({ hasInvoiceData }: InvoiceStepProps) {
  const { t } = useTranslation();
  const { control, setValue, clearErrors, formState } = useFormContext<PublicCheckInFormValues>();
  const step = useWatch({ control, name: 'invoice' }) ?? emptyInvoiceStep();
  const asking = step.answer === 'yes';

  const answer = (next: InvoiceAnswer) => setValue('invoice.answer', next, { shouldDirty: true });
  const change = (field: InvoiceDataField, value: string) => {
    if (field === 'recipientKind') setValue('invoice.recipientKind', value === 'Company' ? 'Company' : 'Guest', { shouldDirty: true });
    else setValue(`invoice.${field}`, value, { shouldDirty: true });
    clearErrors(`invoice.${field}`);
  };

  return (
    <div className="space-y-4" data-testid="checkin-invoice-step">
      <p className="text-sm text-muted-foreground">{t('checkin.invoice.intro')}</p>

      {hasInvoiceData ? (
        <section
          className="space-y-3 rounded-md border p-4"
          aria-labelledby="checkin-invoice-on-file-title"
          data-testid="checkin-invoice-on-file"
        >
          <h2 id="checkin-invoice-on-file-title" className="text-sm font-medium">
            {t('checkin.invoice.onFile.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('checkin.invoice.onFile.body')}</p>
          <Button
            type="button"
            variant="outline"
            aria-expanded={asking}
            onClick={() => answer(asking ? '' : 'yes')}
            data-testid="checkin-invoice-replace"
          >
            {asking ? t('checkin.invoice.onFile.keep') : t('checkin.invoice.onFile.replace')}
          </Button>
        </section>
      ) : (
        <ChoiceGroup legend={t('checkin.invoice.question')} minCardWidth={12}>
          <ChoiceCard
            name="checkin-invoice-answer"
            value="yes"
            checked={step.answer === 'yes'}
            onChange={() => answer('yes')}
            title={t('checkin.invoice.yes.title')}
            description={t('checkin.invoice.yes.description')}
            data-testid="checkin-invoice-yes"
          />
          <ChoiceCard
            name="checkin-invoice-answer"
            value="no"
            checked={step.answer === 'no'}
            onChange={() => answer('no')}
            title={t('checkin.invoice.no.title')}
            description={t('checkin.invoice.no.description')}
            data-testid="checkin-invoice-no"
          />
        </ChoiceGroup>
      )}

      {asking ? (
        <div className="space-y-4" data-testid="checkin-invoice-data">
          <p className="text-sm text-muted-foreground">{t('checkin.invoice.fieldsHint')}</p>
          <InvoiceDataFields
            copy={INVOICE_FIELDS_COPY.guest}
            idPrefix="checkin-invoice"
            values={step}
            errors={invoiceFieldErrorsOfForm(formState.errors.invoice)}
            onChange={change}
          />
        </div>
      ) : null}
    </div>
  );
}
