import { useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Receipt, ReceiptText } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getProblemMessage } from '@/lib/api-errors';
import { COMMISSION_BASES, type OwnerMandateTemplate, type OwnerMandateTemplateResult } from '@/types';
import { mandateTemplateOf } from '../billing-wizard-model';
import { BILLING_ERROR_KEYS, mandateTemplateProblems, type BillingWizardValues } from '../billing-wizard-schema';

interface MandateStepProps {
  /** The currency of the issuer, for the flat fees; `null` while the country is not chosen (the fees are then asked with no symbol and the step says so). */
  currency: string | null;
  /** How many owners with an ownership not ended have no mandate in force: the count of the missing item `owners_without_mandate`, 0 when it is not missing. */
  ownersWithoutMandate: number;
  /** The standard mandate for every owner that has none (`POST api/owner-mandates/apply-template`). */
  apply: UseMutationResult<OwnerMandateTemplateResult, unknown, OwnerMandateTemplate>;
}

const FIELD_ERRORS = {
  mandateCommissionPercent: BILLING_ERROR_KEYS.percent,
  mandateValidFrom: BILLING_ERROR_KEYS.date,
  mandateCleaningFlatRate: BILLING_ERROR_KEYS.amount,
  mandateLinenFlatRate: BILLING_ERROR_KEYS.amount,
} as const;

/**
 * Step 6, «Mandato standard» (agencies only; E13/F01/US01/T01, ⚖ R3, R4): the terms the agency gives its owners unless they have their own: the commission and what it is a
 * percentage of, the flat fees of the cleaning and of the linen, whether the fees of the card payments are the owner's, and whether the amounts are «+ IVA» (the default) or
 * VAT included. «Applica ai proprietari senza mandato» creates that mandate for every owner that has none, and says how many they are first and how many it did; nothing
 * changes for an owner that already has a mandate. It is an action of its own, asked to be confirmed, and it is never done by «Continua».
 */
export function MandateStep({ currency, ownersWithoutMandate, apply }: MandateStepProps) {
  const { t } = useTranslation();
  const {
    register,
    control,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useFormContext<BillingWizardValues>();
  const base = useWatch({ control, name: 'mandateCommissionBase' });
  const includesVat = useWatch({ control, name: 'mandateCommissionIncludesVat' });
  const passthrough = useWatch({ control, name: 'mandatePassthroughPaymentFees' });
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<OwnerMandateTemplateResult | null>(null);

  const ask = () => {
    const problems = mandateTemplateProblems(getValues());
    if (problems.length > 0) {
      for (const name of problems) setError(name, { type: 'validate', message: FIELD_ERRORS[name] });
      return;
    }
    setDone(null);
    setConfirming(true);
  };

  const confirm = async () => {
    setConfirming(false);
    try {
      setDone(await apply.mutateAsync(mandateTemplateOf(getValues())));
    } catch {
      // The failure is on the mutation: it is read below, in words, and nothing is claimed as done.
    }
  };

  const failure = apply.isError ? (getProblemMessage(apply.error, t) ?? t('billingWizard.mandate.applyFailed')) : null;

  return (
    <>
      <p className="text-sm text-foreground/80">{t('billingWizard.mandate.intro')}</p>
      {currency === null ? (
        <Alert variant="info" data-testid="billing-mandate-no-currency">
          {t('billingWizard.mandate.noCurrency')}
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2" data-testid="billing-mandate">
        <Field label={t('billingWizard.mandate.percent.label')} hint={t('billingWizard.mandate.percent.hint')} error={errors.mandateCommissionPercent}>
          <Input inputMode="decimal" autoComplete="off" maxLength={6} data-testid="billing-mandate-percent" {...register('mandateCommissionPercent')} />
        </Field>
        <Field label={t('billingWizard.mandate.base.label')} hint={t('billingWizard.mandate.base.hint')}>
          <Select value={base} onChange={(event) => setValue('mandateCommissionBase', event.target.value as BillingWizardValues['mandateCommissionBase'], { shouldDirty: true })} data-testid="billing-mandate-base">
            {COMMISSION_BASES.map((value) => (
              <option key={value} value={value}>
                {t(`billingWizard.mandate.base.${value}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={currency ? t('billingWizard.mandate.cleaning.labelCurrency', { currency }) : t('billingWizard.mandate.cleaning.label')} hint={t('billingWizard.mandate.cleaning.hint')} optional error={errors.mandateCleaningFlatRate}>
          <Input inputMode="decimal" autoComplete="off" maxLength={12} data-testid="billing-mandate-cleaning" {...register('mandateCleaningFlatRate')} />
        </Field>
        <Field label={currency ? t('billingWizard.mandate.linen.labelCurrency', { currency }) : t('billingWizard.mandate.linen.label')} hint={t('billingWizard.mandate.linen.hint')} optional error={errors.mandateLinenFlatRate}>
          <Input inputMode="decimal" autoComplete="off" maxLength={12} data-testid="billing-mandate-linen" {...register('mandateLinenFlatRate')} />
        </Field>
        <Field label={t('billingWizard.mandate.validFrom.label')} hint={t('billingWizard.mandate.validFrom.hint')} error={errors.mandateValidFrom} className="sm:col-span-2">
          <Input type="date" data-testid="billing-mandate-valid-from" {...register('mandateValidFrom')} />
        </Field>
      </div>

      <ChoiceGroup legend={t('billingWizard.mandate.vat.legend')} legendVisible minCardWidth={15}>
        <ChoiceCard
          name="billing-mandate-vat"
          value="plus"
          checked={!includesVat}
          onChange={() => setValue('mandateCommissionIncludesVat', false, { shouldDirty: true })}
          icon={ReceiptText}
          title={t('billingWizard.mandate.vat.plus.title')}
          description={t('billingWizard.mandate.vat.plus.description')}
          data-testid="billing-mandate-vat-plus"
        />
        <ChoiceCard
          name="billing-mandate-vat"
          value="included"
          checked={includesVat}
          onChange={() => setValue('mandateCommissionIncludesVat', true, { shouldDirty: true })}
          icon={Receipt}
          title={t('billingWizard.mandate.vat.included.title')}
          description={t('billingWizard.mandate.vat.included.description')}
          data-testid="billing-mandate-vat-included"
        />
      </ChoiceGroup>
      {/* ⚖ R4: «+ IVA» is the default that an accountant has to confirm; it is changed here, never in the code. */}
      <p className="-mt-3 text-sm text-foreground/70">{t('billingWizard.mandate.vat.hint')}</p>

      <ChoiceGroup legend={t('billingWizard.mandate.fees.legend')} minCardWidth={15}>
        <ChoiceCard
          type="checkbox"
          checked={passthrough}
          onChange={(event) => setValue('mandatePassthroughPaymentFees', event.target.checked, { shouldDirty: true })}
          title={t('billingWizard.mandate.fees.title')}
          description={t('billingWizard.mandate.fees.description')}
          data-testid="billing-mandate-fees"
        />
      </ChoiceGroup>

      <section className="flex min-w-0 flex-col gap-3 rounded-lg border p-4" aria-labelledby="billing-mandate-apply-title" data-testid="billing-mandate-apply">
        <h3 id="billing-mandate-apply-title" className="text-base font-semibold">
          {t('billingWizard.mandate.apply.title')}
        </h3>
        <p className="text-sm" data-testid="billing-mandate-count">
          {ownersWithoutMandate > 0 ? t('billingWizard.mandate.apply.withoutMandate', { count: ownersWithoutMandate }) : t('billingWizard.mandate.apply.allHaveOne')}
        </p>
        {confirming ? (
          <div role="group" aria-label={t('billingWizard.mandate.apply.confirmLabel')} className="flex flex-col gap-3 rounded-md bg-muted p-3" data-testid="billing-mandate-confirm">
            <p className="text-sm">{t('billingWizard.mandate.apply.confirmText', { count: ownersWithoutMandate })}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void confirm()} data-testid="billing-mandate-confirm-yes">
                {t('billingWizard.mandate.apply.confirm', { count: ownersWithoutMandate })}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)} data-testid="billing-mandate-confirm-no">
                {t('billingWizard.mandate.apply.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button type="button" variant="outline" loading={apply.isPending} disabled={ownersWithoutMandate === 0 || apply.isPending} onClick={ask} data-testid="billing-mandate-apply-button">
              {t('billingWizard.mandate.apply.button')}
            </Button>
          </div>
        )}
        {done ? (
          <Alert variant={done.created > 0 ? 'success' : 'info'} data-testid="billing-mandate-result">
            {t('billingWizard.mandate.apply.result', { count: done.created, skipped: done.skipped })}
          </Alert>
        ) : null}
        {failure ? (
          <Alert variant="danger" data-testid="billing-mandate-failure">
            {failure}
          </Alert>
        ) : null}
      </section>
    </>
  );
}
