import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Landmark, Mountain } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { BillingCountry, BillingWizardValues } from '../billing-wizard-schema';

const COUNTRY_ICONS = { IT: Landmark, CH: Mountain } as const;

/**
 * Step 1, «Chi emette»: one sentence that says CasaZen issues every document in the name of the organization (there is no choice of another issuer), the country it
 * issues from, the name on the documents and the structured address, as the documents want them. The country decides the regimes and the VAT of the next step, the stamp and
 * the postal code, so it is asked first and never preselected for an issuer that has not said it.
 */
export function IssuerStep() {
  const { t } = useTranslation();
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<BillingWizardValues>();
  const country = useWatch({ control, name: 'countryCode' });
  const swiss = country === 'CH';

  const choose = (code: BillingCountry) => setValue('countryCode', code, { shouldDirty: true, shouldValidate: errors.countryCode !== undefined });

  return (
    <>
      <p className="text-sm text-foreground/80" data-testid="billing-issuer-intro">
        {t('billingWizard.issuer.intro')}
      </p>

      <div className="flex flex-col gap-3">
        <ChoiceGroup legend={t('billingWizard.issuer.country.legend')} legendVisible minCardWidth={15}>
          {(['IT', 'CH'] as const).map((code) => (
            <ChoiceCard
              key={code}
              name="billing-country"
              value={code}
              checked={country === code}
              onChange={() => choose(code)}
              icon={COUNTRY_ICONS[code]}
              title={t(`billingWizard.issuer.country.${code}.title`)}
              description={t(`billingWizard.issuer.country.${code}.description`)}
              data-testid={`billing-country-${code}`}
            />
          ))}
        </ChoiceGroup>
        <FormFieldError error={errors.countryCode} />
      </div>

      <Field label={t('billingWizard.issuer.legalName.label')} hint={t('billingWizard.issuer.legalName.hint')} error={errors.legalName}>
        <Input autoComplete="organization" data-testid="billing-legal-name" {...register('legalName')} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2" data-testid="billing-address">
        <Field label={t('billingWizard.issuer.address.street.label')} example={t('billingWizard.issuer.address.street.example')} error={errors.addressStreet} className="sm:col-span-2">
          <Input autoComplete="address-line1" data-testid="billing-street" {...register('addressStreet')} />
        </Field>
        <Field label={t('billingWizard.issuer.address.civic.label')} example="12" optional error={errors.addressCivic}>
          <Input autoComplete="off" data-testid="billing-civic" {...register('addressCivic')} />
        </Field>
        <Field
          label={t('billingWizard.issuer.address.postalCode.label')}
          hint={t(swiss ? 'billingWizard.issuer.address.postalCode.hintCh' : 'billingWizard.issuer.address.postalCode.hintIt')}
          example={swiss ? '6900' : '20121'}
          error={errors.postalCode}
        >
          <Input inputMode="numeric" maxLength={swiss ? 4 : 5} autoComplete="postal-code" data-testid="billing-postal-code" {...register('postalCode')} />
        </Field>
        <Field label={t('billingWizard.issuer.address.city.label')} example={t(swiss ? 'billingWizard.issuer.address.city.exampleCh' : 'billingWizard.issuer.address.city.exampleIt')} error={errors.city}>
          <Input autoComplete="address-level2" data-testid="billing-city" {...register('city')} />
        </Field>
        <Field
          label={t(swiss ? 'billingWizard.issuer.address.province.labelCh' : 'billingWizard.issuer.address.province.labelIt')}
          hint={t(swiss ? 'billingWizard.issuer.address.province.hintCh' : 'billingWizard.issuer.address.province.hintIt')}
          example={swiss ? 'TI' : 'MI'}
          optional={swiss}
          error={errors.province}
        >
          <Input maxLength={2} autoCapitalize="characters" autoComplete="address-level1" data-testid="billing-province" {...register('province')} />
        </Field>
      </div>
    </>
  );
}
