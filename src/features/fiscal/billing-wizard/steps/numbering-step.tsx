import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SERIES_MAX, SERIES_YEAR_PLACEHOLDER, seriesOf, type BillingWizardValues } from '../billing-wizard-schema';

interface NumberingStepProps {
  year: number;
}

function previewOf(series: string, year: number): string {
  const resolved = seriesOf(series, year);
  return resolved === '' ? '' : `${resolved}/1`;
}

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
