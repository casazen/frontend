import { useMemo } from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getCountryOptions } from '@/lib/countries';
import { classifyFiscalCode } from '@/lib/fiscal-code';
import { ReadMark } from './reading-marks';
import { WhyAsk } from './why-ask';
import { MAX_PARTIES_PER_ROLE, newPartyRow, type PartyList, type WizardValues } from './wizard-model';

/** The 27 member states of the European Union: they come first in the list, the others follow (the Questura asks for who is not one). */
const EU_MEMBER_STATES: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);

function Countries() {
  const { t, i18n } = useTranslation();
  const { eu, others } = useMemo(() => {
    const all = getCountryOptions(i18n.language);
    return { eu: all.filter((country) => EU_MEMBER_STATES.has(country.code)), others: all.filter((country) => !EU_MEMBER_STATES.has(country.code)) };
  }, [i18n.language]);
  return (
    <>
      <option value="">{t('leaseWizard.parties.citizenshipChoose')}</option>
      <optgroup label={t('leaseWizard.parties.countriesEu')}>
        {eu.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('leaseWizard.parties.countriesOther')}>
        {others.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </optgroup>
    </>
  );
}

/** What the contract can give for a person (NL-DOCS): the names the server gives to what it read. */
const READ_FIELDS = ['firstName', 'lastName', 'fiscalCode', 'citizenship', 'residence'] as const;

/** The landlords or the tenants: one or more (up to ten), each a person or a company with the data a contract needs. */
function PartyGroup({ list }: { list: PartyList }) {
  const { t } = useTranslation();
  const { control, register, formState } = useFormContext<WizardValues>();
  const { fields, append, remove } = useFieldArray({ control, name: list });
  const errors = formState.errors[list];
  const role = list === 'landlords' ? 'landlord' : 'tenant';
  const atMax = fields.length >= MAX_PARTIES_PER_ROLE;

  return (
    <section className="space-y-4" aria-labelledby={`lw-${list}-title`} data-testid={`lease-${list}`}>
      <div className="space-y-1">
        <h3 id={`lw-${list}-title`} className="text-base font-semibold">
          {t(`leaseWizard.parties.${role}.title`)}
        </h3>
        <p className="text-sm text-muted-foreground">{t(`leaseWizard.parties.${role}.description`)}</p>
      </div>

      {fields.map((field, index) => {
        const id = (name: string) => `lw-${list}-${index}-${name}`;
        const rowErrors = errors?.[index];
        return (
          <fieldset key={field.id} className="space-y-4 rounded-md border p-4" data-testid={`lease-${list}-${index}`}>
            <legend className="px-1 text-sm font-medium">{t(`leaseWizard.parties.${role}.item`, { n: index + 1 })}</legend>
            <ReadMark step={2} partyId={field.serverId} fields={READ_FIELDS} name={`${list}.${index}`} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('leaseWizard.parties.firstName')}>
                <Input id={id('firstName')} autoComplete="off" {...register(`${list}.${index}.firstName`)} />
              </Field>
              <Field label={t('leaseWizard.parties.lastName')}>
                <Input id={id('lastName')} autoComplete="off" {...register(`${list}.${index}.lastName`)} />
              </Field>
              <Field
                label={t('leaseWizard.parties.fiscalCode')}
                hint={t('leaseWizard.parties.fiscalCodeHint')}
                example={t('leaseWizardGuide.fields.fiscalCode.example')}
                error={rowErrors?.fiscalCode}
              >
                <Input
                  id={id('fiscalCode')}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="uppercase"
                  {...register(`${list}.${index}.fiscalCode`)}
                />
              </Field>
              <Field
                label={t('leaseWizard.parties.citizenship')}
                hint={role === 'tenant' ? t('leaseWizard.parties.citizenshipHint') : undefined}
                error={rowErrors?.citizenship}
              >
                <Select id={id('citizenship')} {...register(`${list}.${index}.citizenship`)}>
                  <Countries />
                </Select>
              </Field>
              <Field
                label={t('leaseWizard.parties.residence')}
                hint={t('leaseWizard.parties.residenceHint')}
                example={t('leaseWizardGuide.fields.residence.example')}
                className="sm:col-span-2"
              >
                <Input id={id('residence')} autoComplete="off" {...register(`${list}.${index}.residence`)} />
              </Field>
              <Field
                label={t('leaseWizard.parties.contactEmail')}
                optional
                hint={role === 'tenant' ? t('leaseWizard.parties.contactEmailHintTenant') : undefined}
                error={rowErrors?.contactEmail}
                className="sm:col-span-2"
              >
                <Input id={id('contactEmail')} type="email" autoComplete="off" {...register(`${list}.${index}.contactEmail`)} />
              </Field>
            </div>
            {fields.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={t(`leaseWizard.parties.${role}.remove`, { n: index + 1 })}>
                <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                {t('leaseWizard.parties.remove')}
              </Button>
            ) : null}
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => append(newPartyRow())} disabled={atMax}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          {t(`leaseWizard.parties.${role}.add`)}
        </Button>
        {atMax ? (
          <p className="text-sm text-muted-foreground" data-testid={`lease-${list}-max`}>
            {t('leaseWizard.parties.max', { max: MAX_PARTIES_PER_ROLE })}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Step ② «Parti» (LR-06a): who lets and who rents. The landlord starts from the data the server suggests; a tenant can be a person or a
 * company (an 11-digit code), and with a company the cedolare secca is not allowed (LR-D11): the notice is immediate, the stop is in
 * the review. No telephone, no IBAN, no birth date, no identity document, no invitation of the tenant: only what the contract needs.
 */
export function PartiesStep() {
  const { t } = useTranslation();
  const { control } = useFormContext<WizardValues>();
  const tenants = useWatch({ control, name: 'tenants' });
  const hasCompany = tenants.some((tenant) => classifyFiscalCode(tenant.fiscalCode) === 'numeric');

  return (
    <div className="space-y-8">
      <WhyAsk>{t('leaseWizardGuide.why.parties')}</WhyAsk>
      <PartyGroup list="landlords" />
      <PartyGroup list="tenants" />
      {hasCompany ? (
        <Alert variant="warning" data-testid="lease-company-notice">
          {t('leaseWizard.parties.companyNotice')}
        </Alert>
      ) : null}
    </div>
  );
}
