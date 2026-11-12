import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { translateValidationMessage } from '@/i18n/validation-message';
import type { PropertyWizardValues } from '../property-wizard-model';
import { MAX_DISCOUNT_NIGHTS, MAX_STAY_DISCOUNTS, MIN_DISCOUNT_NIGHTS, type StayDiscountDraft } from '../stay-discounts-model';

interface StayDiscountsEditorProps {
  form: UseFormReturn<PropertyWizardValues>;
}

/**
 * The length-of-stay discounts (NF-35), in the prices step: up to five tiers, each with the nights it starts from and the percentage taken
 * off the lodging. The stay of enough nights gets the tier with the most nights it reaches; the cleaning fee and the tourist tax are never
 * reduced. A row left empty is not a tier and is not sent.
 */
export function StayDiscountsEditor({ form }: StayDiscountsEditorProps) {
  const { t, i18n } = useTranslation();
  const tiers = form.watch('stayDiscounts');
  const { errors } = form.formState;
  const listProblem = errors.stayDiscounts?.message;

  const update = (next: StayDiscountDraft[]) => form.setValue('stayDiscounts', next, { shouldDirty: true });
  const change = (index: number, patch: Partial<StayDiscountDraft>) => update(tiers.map((tier, position) => (position === index ? { ...tier, ...patch } : tier)));

  return (
    <section aria-labelledby="property-wizard-stay-discounts-title" className="min-w-0 space-y-4" data-testid="property-wizard-stay-discounts">
      <div className="space-y-1">
        <h3 id="property-wizard-stay-discounts-title" className="text-base font-semibold">
          {t('propertyWizard.prices.stayDiscounts.title')}
        </h3>
        <p className="text-sm text-foreground/70">{t('propertyWizard.prices.stayDiscounts.hint', { max: MAX_STAY_DISCOUNTS })}</p>
      </div>

      {tiers.map((tier, index) => {
        const problems = errors.stayDiscounts?.[index];
        return (
          <div key={index} className="flex min-w-0 flex-wrap items-start gap-3" data-testid="property-wizard-stay-discount">
            <Field
              label={t('propertyWizard.prices.stayDiscounts.minNights', { number: index + 1 })}
              hint={t('propertyWizard.prices.stayDiscounts.minNightsHint', { min: MIN_DISCOUNT_NIGHTS, max: MAX_DISCOUNT_NIGHTS })}
              error={problems?.minNights}
              className="min-w-40 flex-1"
            >
              <Input inputMode="numeric" autoComplete="off" maxLength={3} value={tier.minNights} onChange={(event) => change(index, { minNights: event.target.value })} />
            </Field>
            <Field label={t('propertyWizard.prices.stayDiscounts.percentOff', { number: index + 1 })} error={problems?.percentOff} className="min-w-40 flex-1">
              <Input inputMode="decimal" autoComplete="off" value={tier.percentOff} onChange={(event) => change(index, { percentOff: event.target.value })} />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-6 min-h-11"
              aria-label={t('propertyWizard.prices.stayDiscounts.remove', { number: index + 1 })}
              onClick={() => update(tiers.filter((_tier, position) => position !== index))}
            >
              <Trash2 aria-hidden="true" className="size-4 text-destructive" />
              {t('propertyWizard.prices.stayDiscounts.removeShort')}
            </Button>
          </div>
        );
      })}

      {listProblem ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {translateValidationMessage(listProblem, t, i18n)}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        disabled={tiers.length >= MAX_STAY_DISCOUNTS}
        onClick={() => update([...tiers, { minNights: '', percentOff: '' }])}
        data-testid="property-wizard-stay-discount-add"
      >
        <Plus aria-hidden="true" className="size-4" />
        {t('propertyWizard.prices.stayDiscounts.add')}
      </Button>
    </section>
  );
}
