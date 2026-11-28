import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Briefcase, Building, Percent, Receipt, UserRound, UserRoundX } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { CleaningFeeTreatment, StayVatTreatment } from '@/types';
import type { BillingIdentityOnRecord, BillingWizardValues, ItalianRegime } from '../billing-wizard-schema';

interface VatStepProps {
  onRecord: BillingIdentityOnRecord;
  /** The VAT number and the fiscal code the server read from the tax profile, to show what is on record. */
  vatNumber: string;
  fiscalCode: string;
}

const REGIMES: ReadonlyArray<{ value: ItalianRegime; icon: typeof Briefcase }> = [
  { value: 'PrivatePerson', icon: UserRound },
  { value: 'VatOrdinary', icon: Percent },
  { value: 'VatFlatRate', icon: Receipt },
];

const STAY_TREATMENTS: readonly StayVatTreatment[] = ['Standard', 'ExemptArt10'];
const CLEANING_TREATMENTS: readonly CleaningFeeTreatment[] = ['FollowsStay', 'Service'];

function proposedRegimeCode(regime: BillingWizardValues['regime']): string {
  return regime === 'VatFlatRate' ? 'RF19' : 'RF01';
}

/**
 * Step 2, «IVA». Switzerland: registered for the VAT yes or no, and the UID of whoever is (`CHE-123.456.789`). Italy: the regime (a private person, a VAT number in the
 * ordinary regime, in the flat-rate regime), the VAT number or the fiscal code the regime needs when the tax profile does not have it yet (it is added to the tax profile,
 * where it lives), the regime code of the electronic invoice, and the VAT of the stay: 10% or exempt under art. 10 n. 8, which an accountant has to confirm (⚖ I1). For both,
 * the cleaning fee as part of the stay or as a service (⚖ C2).
 */
export function VatStep({ onRecord, vatNumber, fiscalCode }: VatStepProps) {
  const { t } = useTranslation();
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<BillingWizardValues>();
  const country = useWatch({ control, name: 'countryCode' });
  const regime = useWatch({ control, name: 'regime' });
  const swissRegistered = useWatch({ control, name: 'swissVatRegistered' });
  const stay = useWatch({ control, name: 'stayVatTreatment' });
  const cleaning = useWatch({ control, name: 'cleaningFeeTreatment' });
  const swiss = country === 'CH';

  const chooseRegime = (value: ItalianRegime) => {
    if (value !== regime) setValue('fatturaPaRegimeCode', '', { shouldDirty: true });
    setValue('regime', value, { shouldDirty: true, shouldValidate: errors.regime !== undefined });
  };

  return (
    <>
      {swiss ? (
        <div className="flex flex-col gap-3" data-testid="billing-vat-swiss">
          <ChoiceGroup legend={t('billingWizard.vat.swiss.legend')} legendVisible minCardWidth={15}>
            <ChoiceCard
              name="billing-swiss-vat"
              value="yes"
              checked={swissRegistered === 'yes'}
              onChange={() => setValue('swissVatRegistered', 'yes', { shouldDirty: true, shouldValidate: errors.swissVatRegistered !== undefined })}
              icon={Building}
              title={t('billingWizard.vat.swiss.yes.title')}
              description={t('billingWizard.vat.swiss.yes.description')}
              data-testid="billing-swiss-vat-yes"
            />
            <ChoiceCard
              name="billing-swiss-vat"
              value="no"
              checked={swissRegistered === 'no'}
              onChange={() => setValue('swissVatRegistered', 'no', { shouldDirty: true, shouldValidate: errors.swissVatRegistered !== undefined })}
              icon={UserRoundX}
              title={t('billingWizard.vat.swiss.no.title')}
              description={t('billingWizard.vat.swiss.no.description')}
              data-testid="billing-swiss-vat-no"
            />
          </ChoiceGroup>
          <FormFieldError error={errors.swissVatRegistered} />
          {swissRegistered === 'yes' ? (
            <Field label={t('billingWizard.vat.swiss.uid.label')} hint={t('billingWizard.vat.swiss.uid.hint')} example="CHE-123.456.789" error={errors.swissVatNumber}>
              <Input autoComplete="off" maxLength={24} data-testid="billing-swiss-uid" {...register('swissVatNumber')} />
            </Field>
          ) : null}
          {swissRegistered === 'no' ? <p className="text-sm text-foreground/70">{t('billingWizard.vat.swiss.notRegisteredNote')}</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-5" data-testid="billing-vat-italy">
          <div className="flex flex-col gap-3">
            <ChoiceGroup legend={t('billingWizard.vat.italy.legend')} legendVisible minCardWidth={14}>
              {REGIMES.map(({ value, icon }) => (
                <ChoiceCard
                  key={value}
                  name="billing-regime"
                  value={value}
                  checked={regime === value}
                  onChange={() => chooseRegime(value)}
                  icon={icon}
                  title={t(`billingWizard.vat.italy.regimes.${value}.title`)}
                  description={t(`billingWizard.vat.italy.regimes.${value}.description`)}
                  data-testid={`billing-regime-${value}`}
                />
              ))}
            </ChoiceGroup>
            <FormFieldError error={errors.regime} />
          </div>

          {regime === 'VatOrdinary' || regime === 'VatFlatRate' ? (
            onRecord.vatNumber ? (
              <p className="break-words text-sm" data-testid="billing-on-record">
                {t('billingWizard.vat.italy.onRecord.vatNumber', { value: vatNumber })}
              </p>
            ) : (
              <Field label={t('billingWizard.vat.italy.vatNumber.label')} hint={t('billingWizard.vat.italy.vatNumber.hint')} example="12345678901" error={errors.vatNumber}>
                <Input inputMode="numeric" maxLength={13} autoComplete="off" data-testid="billing-vat-number" {...register('vatNumber')} />
              </Field>
            )
          ) : null}

          {regime === 'PrivatePerson' ? (
            onRecord.fiscalCode ? (
              <p className="break-words text-sm" data-testid="billing-on-record">
                {t('billingWizard.vat.italy.onRecord.fiscalCode', { value: fiscalCode })}
              </p>
            ) : (
              <Field label={t('billingWizard.vat.italy.fiscalCode.label')} hint={t('billingWizard.vat.italy.fiscalCode.hint')} error={errors.fiscalCode}>
                <Input maxLength={20} autoComplete="off" data-testid="billing-fiscal-code" {...register('fiscalCode')} />
              </Field>
            )
          ) : null}

          {regime ? (
            <Field
              label={t('billingWizard.vat.italy.regimeCode.label')}
              hint={t('billingWizard.vat.italy.regimeCode.hint')}
              example={proposedRegimeCode(regime)}
              optional
              error={errors.fatturaPaRegimeCode}
            >
              <Input maxLength={4} autoComplete="off" data-testid="billing-regime-code" {...register('fatturaPaRegimeCode')} />
            </Field>
          ) : null}

          <div className="flex flex-col gap-3" data-testid="billing-stay-vat">
            <ChoiceGroup legend={t('billingWizard.vat.stay.legend')} legendVisible minCardWidth={15}>
              {STAY_TREATMENTS.map((value) => (
                <ChoiceCard
                  key={value}
                  name="billing-stay-vat"
                  value={value}
                  checked={stay === value}
                  onChange={() => setValue('stayVatTreatment', value, { shouldDirty: true })}
                  title={t(`billingWizard.vat.stay.${value}.title`)}
                  description={t(`billingWizard.vat.stay.${value}.description`)}
                  data-testid={`billing-stay-vat-${value}`}
                />
              ))}
            </ChoiceGroup>
            <p className="text-sm text-foreground/70" data-testid="billing-stay-vat-hint">
              {t('billingWizard.vat.stay.hint')}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3" data-testid="billing-cleaning">
        <ChoiceGroup legend={t('billingWizard.vat.cleaning.legend')} legendVisible minCardWidth={15}>
          {CLEANING_TREATMENTS.map((value) => (
            <ChoiceCard
              key={value}
              name="billing-cleaning"
              value={value}
              checked={cleaning === value}
              onChange={() => setValue('cleaningFeeTreatment', value, { shouldDirty: true })}
              title={t(`billingWizard.vat.cleaning.${value}.title`)}
              description={t(`billingWizard.vat.cleaning.${value}.description`)}
              data-testid={`billing-cleaning-${value}`}
            />
          ))}
        </ChoiceGroup>
        <p className="text-sm text-foreground/70">{t('billingWizard.vat.cleaning.hint')}</p>
      </div>
    </>
  );
}
