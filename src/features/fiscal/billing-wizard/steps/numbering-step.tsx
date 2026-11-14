import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SERIES_MAX, SERIES_YEAR_PLACEHOLDER, seriesOf, type BillingWizardValues } from '../billing-wizard-schema';

interface NumberingStepProps {
  /** The year of the preview: the year of today in Rome, as the server numbers the documents. */
  year: number;
}

/** The number of the first document of a series, as the document will carry it: the series and the progressive, `2026/1`. */
function previewOf(series: string, year: number): string {
  const resolved = seriesOf(series, year);
  return resolved === '' ? '' : `${resolved}/1`;
}

/**
 * Step 3, «Numerazione»: the series of the documents to the guests and of the invoices to the owners, each with the number the first document of the year will carry. The
 * server numbers consecutively and without gaps, so the preview says the form of the number and not the one a document will get: the progressive goes on from the last one
 * issued. The year is written `{year}`. A series is saved explicitly with this step, even when it is the one the server proposed.
 */
export function NumberingStep({ year }: NumberingStepProps) {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<BillingWizardValues>();
  const guest = previewOf(useWatch({ control, name: 'guestDocumentSeries' }), year);
  const owner = previewOf(useWatch({ control, name: 'ownerInvoiceSeries' }), year);

  return (
    <>
      <p className="text-sm text-foreground/80">{t('billingWizard.numbering.intro')}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Field
            label={t('billingWizard.numbering.guest.label')}
            hint={t('billingWizard.numbering.guest.hint', { max: SERIES_MAX, token: SERIES_YEAR_PLACEHOLDER })}
            example={SERIES_YEAR_PLACEHOLDER}
            error={errors.guestDocumentSeries}
          >
            <Input maxLength={20} autoComplete="off" data-testid="billing-guest-series" {...register('guestDocumentSeries')} />
          </Field>
          <p className="text-sm" data-testid="billing-guest-series-preview">
            {guest ? t('billingWizard.numbering.preview', { number: guest }) : ''}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Field
            label={t('billingWizard.numbering.owner.label')}
            hint={t('billingWizard.numbering.owner.hint', { max: SERIES_MAX, token: SERIES_YEAR_PLACEHOLDER })}
            example={`PM${SERIES_YEAR_PLACEHOLDER}`}
            error={errors.ownerInvoiceSeries}
          >
            <Input maxLength={20} autoComplete="off" data-testid="billing-owner-series" {...register('ownerInvoiceSeries')} />
          </Field>
          <p className="text-sm" data-testid="billing-owner-series-preview">
            {owner ? t('billingWizard.numbering.preview', { number: owner }) : ''}
          </p>
        </div>
      </div>
      <p className="text-sm text-foreground/70">{t('billingWizard.numbering.note')}</p>
    </>
  );
}
