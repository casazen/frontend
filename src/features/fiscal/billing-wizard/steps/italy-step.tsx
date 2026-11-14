import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useFiscalDocumentsContext } from '@/queries/use-fiscal-documents';
import type { BillingWizardValues } from '../billing-wizard-schema';

/**
 * Step 8, «Italia» (an Italian issuer only): two reminders, with the box to tick when it is done. The free agreement for the electronic conservation of the documents on the
 * portal of the tax agency, and the stamp duty: the number of the authorization of the virtual stamp, or the reference of the physical one (⚖ I4), or the tick that the virtual
 * stamp is authorized. CasaZen cannot check any of them on the portal of the agency, so they are what the person says, and the step says that. The state of the connection to
 * the SDI is read-only: it is what the server has, and the step that sets it comes with E17.
 */
export function ItalyStep() {
  const { t } = useTranslation();
  // Whether CasaZen has a channel to the SDI in this environment: read as it is, `null` while it is not known (no claim is made then).
  const context = useFiscalDocumentsContext();
  const sdiConfigured = context.data ? context.data.sdiProviderConfigured : null;
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<BillingWizardValues>();
  const conservation = useWatch({ control, name: 'conservationAgreementConfirmed' });
  const virtualStamp = useWatch({ control, name: 'virtualStampConfirmed' });

  return (
    <>
      <p className="text-sm text-foreground/80">{t('billingWizard.italy.intro')}</p>
      <ChoiceGroup legend={t('billingWizard.italy.legend')} legendVisible minCardWidth={16}>
        <ChoiceCard
          type="checkbox"
          checked={conservation}
          onChange={(event) => setValue('conservationAgreementConfirmed', event.target.checked, { shouldDirty: true })}
          title={t('billingWizard.italy.conservation.title')}
          description={t('billingWizard.italy.conservation.description')}
          data-testid="billing-conservation"
        />
        <ChoiceCard
          type="checkbox"
          checked={virtualStamp}
          onChange={(event) => setValue('virtualStampConfirmed', event.target.checked, { shouldDirty: true })}
          title={t('billingWizard.italy.virtualStamp.title')}
          description={t('billingWizard.italy.virtualStamp.description')}
          data-testid="billing-virtual-stamp"
        />
      </ChoiceGroup>
      <Field label={t('billingWizard.italy.stampReference.label')} hint={t('billingWizard.italy.stampReference.hint')} optional error={errors.stampDutyReference}>
        <Input maxLength={60} autoComplete="off" data-testid="billing-stamp-reference" {...register('stampDutyReference')} />
      </Field>
      <p className="text-sm text-foreground/70">{t('billingWizard.italy.note')}</p>

      <Alert variant="info" title={t('billingWizard.italy.sdi.title')} data-testid="billing-sdi-state">
        {sdiConfigured === null ? t('billingWizard.italy.sdi.unknown') : sdiConfigured ? t('billingWizard.italy.sdi.configured') : t('billingWizard.italy.sdi.notConfigured')}
      </Alert>
    </>
  );
}
