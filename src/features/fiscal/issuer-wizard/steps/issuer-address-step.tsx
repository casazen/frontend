import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { IssuerWizardValues } from '../issuer-wizard-schema';

/**
 * Step 4 (only when CasaZen issues), «L'indirizzo che compare sui documenti»: the address of the issuer in the parts the electronic invoice
 * wants, five fields and nothing else. The country is not asked: it stays as the server has it (Italy).
 */
export function IssuerAddressStep() {
  const { t } = useTranslation();
  const {
    register,
    formState: { errors },
  } = useFormContext<IssuerWizardValues>();

  return (
    <div className="grid gap-5 sm:grid-cols-2" data-testid="fiscal-issuer-address-step">
      <Field
        label={t('fiscalDocuments.issuer.address.street.label')}
        example={t('fiscalDocuments.issuer.address.street.example')}
        error={errors.addressStreet}
        className="sm:col-span-2"
      >
        <Input autoComplete="address-line1" data-testid="fiscal-issuer-street" {...register('addressStreet')} />
      </Field>
      <Field label={t('fiscalDocuments.issuer.address.civic.label')} example="12" error={errors.addressCivic}>
        <Input autoComplete="off" data-testid="fiscal-issuer-civic" {...register('addressCivic')} />
      </Field>
      <Field
        label={t('fiscalDocuments.issuer.address.postalCode.label')}
        hint={t('fiscalDocuments.issuer.address.postalCode.hint')}
        example="20121"
        error={errors.postalCode}
      >
        <Input inputMode="numeric" maxLength={10} autoComplete="postal-code" data-testid="fiscal-issuer-postal-code" {...register('postalCode')} />
      </Field>
      <Field label={t('fiscalDocuments.issuer.address.city.label')} example={t('fiscalDocuments.issuer.address.city.example')} error={errors.city}>
        <Input autoComplete="address-level2" data-testid="fiscal-issuer-city" {...register('city')} />
      </Field>
      <Field
        label={t('fiscalDocuments.issuer.address.province.label')}
        hint={t('fiscalDocuments.issuer.address.province.hint')}
        example="MI"
        error={errors.province}
      >
        <Input maxLength={2} autoCapitalize="characters" autoComplete="address-level1" data-testid="fiscal-issuer-province" {...register('province')} />
      </Field>
    </div>
  );
}
