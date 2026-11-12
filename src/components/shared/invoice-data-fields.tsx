import { useMemo, useState, type ReactNode } from 'react';
import { Building2, User, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getCountryOptions } from '@/lib/countries';
import { INVOICE_FIELDS_COPY_SUFFIXES, type InvoiceFieldsCopy, type InvoiceFieldsCopySuffix } from '@/lib/invoice-data-copy';
import { INVOICE_DATA_LIMITS, invoiceErrorMessageOf, type InvoiceDataFieldErrors, type InvoiceDataFormValues } from '@/lib/invoice-data-schema';
import { INVOICE_RECIPIENT_KINDS, type InvoiceDataField, type InvoiceRecipientKind } from '@/types';

/** Examples under the fields that are hard to fill: values that are valid, so that the person sees the shape. They are not words, so not texts. */
const EXAMPLES = {
  fiscalCode: 'RSSMRA80A01H501U',
  vatNumber: 'IT12345678903',
  sdiRecipientCode: 'ABC1234',
  pec: 'nome@pec.it',
  province: 'RM',
} as const;

const KIND_ICONS: Record<InvoiceRecipientKind, LucideIcon> = { Guest: User, Company: Building2 };

/** The longest a fiscal code or a VAT number may be typed: the server's limit is on the normalized value, and a pasted one has spaces. */
const IDENTIFIER_INPUT_MAX_LENGTH = 40;

/** What goes under a field that is hard to fill: why it is asked and, after it, an example. */
function Explanation({ why, exampleLabel, example }: { why: string; exampleLabel: string; example?: string }) {
  return (
    <>
      {why}
      {example ? (
        <>
          {' '}
          {exampleLabel} <code className="rounded-sm bg-muted px-1 py-px font-mono text-[0.85em]">{example}</code>
        </>
      ) : null}
    </>
  );
}

export interface InvoiceDataFieldsProps {
  /** The set of texts to read (`INVOICE_FIELDS_COPY`): the words follow the person who reads them. */
  copy: InvoiceFieldsCopy;
  /** Start of the `id` and of the `data-testid` of every control: two sets of fields on one page never share an id. */
  idPrefix: string;
  values: InvoiceDataFormValues;
  /** The failure of each field by its code, from the schema or from a 422 of the server: the words are the ones of `copy`. */
  errors?: InvoiceDataFieldErrors;
  onChange: (field: InvoiceDataField, value: string) => void;
  /** While something is saved: nothing can be typed. */
  disabled?: boolean;
}

/**
 * The fields of the invoice data (FIS-01, NF-81, NF-04): who the invoice is for (a private person or a company), the name, the fiscal code, the
 * VAT number of a company and the address. About five things are on the screen at a time; the rare ones (the country, the code of the recipient
 * on the SDI, the PEC, and the VAT number of a private person) are under «More options», open when they hold something or a problem. Under each
 * field that is hard to fill there is why it is asked and an example.
 *
 * It holds nothing of its own: the values and the failures come from the caller (the form of the host, the form of the guest page), which checks
 * them with `@/lib/invoice-data-schema` and shows what the server answers. It is made of plain controls and no `<form>`, so it sits inside a wizard.
 */
export function InvoiceDataFields({ copy, idPrefix, values, errors = {}, onChange, disabled }: InvoiceDataFieldsProps) {
  const { t, i18n } = useTranslation();
  // The texts of this set of fields, by the end of their key: `text['fiscalCode.label']`.
  const text = useMemo(
    () =>
      Object.fromEntries(INVOICE_FIELDS_COPY_SUFFIXES.map((suffix) => [suffix, t(`${copy}.${suffix}`)])) as Record<InvoiceFieldsCopySuffix, string>,
    [t, copy],
  );

  const company = values.recipientKind === 'Company';
  const nameLabel = text[`name.${values.recipientKind}`];
  const optionProblem = Boolean(errors.countryCode ?? errors.sdiRecipientCode ?? errors.pec ?? (company ? undefined : errors.vatNumber));
  // The options are open when they hold something (a draft, saved data) or a problem, and stay as the person leaves them: they do not close under
  // the cursor of whoever empties a field.
  const [opened, setOpened] = useState(() =>
    [values.countryCode === 'IT' ? '' : values.countryCode, values.sdiRecipientCode, values.pec, company ? '' : values.vatNumber].some(
      (value) => value.trim() !== '',
    ),
  );

  const countries = useMemo(() => getCountryOptions(i18n.language), [i18n.language]);
  const countryKnown = countries.some((country) => country.code === values.countryCode);

  const idOf = (field: InvoiceDataField) => `${idPrefix}-${field}`;
  const errorOf = (field: InvoiceDataField): string | undefined => {
    const code = errors[field];
    return code ? `${copy}.errors.${invoiceErrorMessageOf({ field, code })}` : undefined;
  };
  const explain = (why: InvoiceFieldsCopySuffix, example?: string): ReactNode => (
    <Explanation why={text[why]} exampleLabel={text.example} example={example} />
  );
  // The props of a plain text control, as `register` of a form library gives them: spread on the `Input` of the field.
  const register = (field: Exclude<InvoiceDataField, 'recipientKind' | 'countryCode'>) => ({
    id: idOf(field),
    value: values[field],
    onChange: (event: { target: { value: string } }) => onChange(field, event.target.value),
    maxLength: field === 'fiscalCode' || field === 'vatNumber' ? IDENTIFIER_INPUT_MAX_LENGTH : INVOICE_DATA_LIMITS[field],
    autoComplete: 'off',
    disabled,
    'data-testid': idOf(field),
  });

  const vatNumberField = (
    <Field label={text['vatNumber.label']} hint={explain('vatNumber.why', EXAMPLES.vatNumber)} error={errorOf('vatNumber')}>
      <Input {...register('vatNumber')} autoCapitalize="characters" spellCheck={false} />
    </Field>
  );

  return (
    <div className="flex flex-col gap-5" data-testid={`${idPrefix}-fields`}>
      <ChoiceGroup legend={text['kind.legend']} legendVisible minCardWidth={10}>
        {INVOICE_RECIPIENT_KINDS.map((kind) => (
          <ChoiceCard
            key={kind}
            name={`${idPrefix}-recipientKind`}
            value={kind}
            checked={values.recipientKind === kind}
            onChange={() => onChange('recipientKind', kind)}
            icon={KIND_ICONS[kind]}
            title={text[`kind.${kind}.title`]}
            description={text[`kind.${kind}.description`]}
            disabled={disabled}
            data-testid={`${idPrefix}-kind-${kind}`}
          />
        ))}
      </ChoiceGroup>

      <Field label={nameLabel} error={errorOf('name')}>
        <Input {...register('name')} />
      </Field>

      {company ? vatNumberField : null}

      <Field label={text['fiscalCode.label']} hint={explain('fiscalCode.why', EXAMPLES.fiscalCode)} error={errorOf('fiscalCode')}>
        <Input {...register('fiscalCode')} autoCapitalize="characters" spellCheck={false} />
      </Field>

      <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">{text['address.legend']}</legend>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
          <Field label={text['address.street']} error={errorOf('addressStreet')}>
            <Input {...register('addressStreet')} />
          </Field>
          <Field label={text['address.civic']} error={errorOf('addressCivic')}>
            <Input {...register('addressCivic')} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)_6rem]">
          <Field label={text['address.postalCode']} error={errorOf('postalCode')}>
            <Input {...register('postalCode')} inputMode={values.countryCode === 'IT' ? 'numeric' : 'text'} />
          </Field>
          <Field label={text['address.city']} error={errorOf('city')}>
            <Input {...register('city')} />
          </Field>
          <Field label={text['address.province']} error={errorOf('province')}>
            <Input {...register('province')} autoCapitalize="characters" placeholder={EXAMPLES.province} />
          </Field>
        </div>
      </fieldset>

      <details
        open={opened || optionProblem}
        onToggle={(event) => setOpened(event.currentTarget.open)}
        className="min-w-0 text-sm"
        data-testid={`${idPrefix}-more`}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-foreground/70">{text['more.label']}</summary>
        <div className="flex flex-col gap-5 pb-2 pt-2">
          <p className="text-foreground/70">{text['more.hint']}</p>
          {company ? null : vatNumberField}
          <Field label={text['country.label']} hint={explain('country.why')} error={errorOf('countryCode')}>
            <Select
              id={idOf('countryCode')}
              value={values.countryCode}
              onChange={(event) => onChange('countryCode', event.target.value)}
              disabled={disabled}
              data-testid={idOf('countryCode')}
            >
              {countryKnown ? null : <option value={values.countryCode}>{values.countryCode}</option>}
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={text['sdiRecipientCode.label']}
            hint={explain('sdiRecipientCode.why', EXAMPLES.sdiRecipientCode)}
            error={errorOf('sdiRecipientCode')}
          >
            <Input {...register('sdiRecipientCode')} autoCapitalize="characters" spellCheck={false} />
          </Field>
          <Field label={text['pec.label']} hint={explain('pec.why', EXAMPLES.pec)} error={errorOf('pec')}>
            <Input {...register('pec')} type="email" inputMode="email" spellCheck={false} />
          </Field>
        </div>
      </details>
    </div>
  );
}
