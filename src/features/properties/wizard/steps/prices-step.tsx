import { Controller, type UseFormReturn } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Landmark } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Qty } from '@/components/ui/qty';
import { useProperty } from '@/queries/use-properties';
import { useComplianceActivation } from '@/features/compliance/use-compliance';
import type { PropertyWizardValues } from '../property-wizard-model';
import { AiPriceCard } from './ai-price-card';
import { StayDiscountsEditor } from './stay-discounts-editor';

interface PricesStepProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
}

function TouristTaxNote({ propertyId, city }: { propertyId: string; city: string }) {
  const { t } = useTranslation();
  const activation = useComplianceActivation(propertyId);
  const info = activation.data?.steps.find((step) => step.id === 'tourist-tax')?.touristTax;
  if (!activation.data) return null;

  const comune = info?.city || city;
  const slug = info?.publicPageSlug ?? null;

  return (
    <p className="flex items-start gap-2 text-sm text-foreground/70" data-testid="property-wizard-tourist-tax">
      <Landmark aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        {info?.rate ? t('propertyWizard.prices.touristTax.found', { city: comune }) : t('propertyWizard.prices.touristTax.notYet', { city: comune })}{' '}
        {slug ? (
          <Link to={`/p/tassa-soggiorno/${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
            {t('propertyWizard.prices.touristTax.see')}
          </Link>
        ) : null}
      </span>
    </p>
  );
}

export function PricesStep({ form, propertyId }: PricesStepProps) {
  const { t } = useTranslation();
  const { register, formState } = form;
  const property = useProperty(propertyId);
  const currency = property.data?.currency ?? 'EUR';

  return (
    <>
      <AiPriceCard form={form} propertyId={propertyId} currency={currency} />

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label={t('priceEstimate.rateLabel', { currency })} hint={t('propertyWizard.prices.rate.hint')} error={formState.errors.nightlyRate}>
          <Input inputMode="decimal" autoComplete="off" {...register('nightlyRate')} />
        </Field>
        <Field label={t('priceEstimate.cleaningLabel', { currency })} optional hint={t('propertyWizard.prices.cleaning.hint')} error={formState.errors.cleaningFee}>
          <Input inputMode="decimal" autoComplete="off" {...register('cleaningFee')} />
        </Field>
      </div>

      <Field label={t('propertyWizard.prices.weekend.label')} optional hint={t('propertyWizard.prices.weekend.hint')} error={formState.errors.weekendSurcharge} className="max-w-md">
        <Input inputMode="decimal" autoComplete="off" {...register('weekendSurcharge')} />
      </Field>

      <Controller
        control={form.control}
        name="minNights"
        render={({ field }) => (
          <div className="flex min-w-0 max-w-xl items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium">{t('propertyWizard.prices.minNights.label')}</div>
              <div className="text-sm text-foreground/70">{t('propertyWizard.prices.minNights.hint')}</div>
            </div>
            <Qty label={t('propertyWizard.prices.minNights.label')} value={field.value} onChange={field.onChange} min={1} max={30} testId="property-wizard-minNights" />
          </div>
        )}
      />

      <StayDiscountsEditor form={form} />

      <TouristTaxNote propertyId={propertyId} city={form.getValues('city')} />

      <p className="flex items-start gap-2 text-sm text-foreground/70">
        <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t('propertyWizard.prices.calendar')}
      </p>
    </>
  );
}
