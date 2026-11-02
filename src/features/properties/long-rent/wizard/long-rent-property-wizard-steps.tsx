import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { DocumentPages } from '@/components/documents/document-pages';
import { ComunePicker } from '@/components/shared/comune-picker';
import { FormFieldError } from '@/components/shared/form-field-error';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { isDocumentPdf } from '@/lib/document-pdf';
import { formatCurrency } from '@/lib/utils';
import {
  hasApeSelection,
  isCadastralComplete,
  parseIncome,
  type LongRentPropertyWizardValues,
} from './long-rent-property-wizard-model';

/** Step 1: the name and the place of the property, the one thing the API cannot do without. */
export function AddressStep() {
  const { t } = useTranslation();
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<LongRentPropertyWizardValues>();
  const comuneIstatCode = useWatch({ control, name: 'comuneIstatCode' }) || null;

  return (
    <div className="space-y-5">
      <Field label={t('property.form.name')} error={errors.name}>
        <Input autoComplete="off" placeholder={t('property.form.placeholder.name')} data-testid="long-rent-wizard-name" {...register('name')} />
      </Field>

      {/* The comune is chosen from the official list; its name is the city, and the region follows it on the server. */}
      <div data-testid="property-comune-field">
        <Field label={t('property.form.comune.label')} hint={t('property.form.comune.hint')} error={errors.comuneIstatCode ?? errors.city}>
          {(fieldProps) => (
            <ComunePicker
              id={fieldProps.id}
              istatCode={comuneIstatCode}
              describedBy={fieldProps['aria-describedby']}
              invalid={fieldProps['aria-invalid'] === true}
              onChange={(comune) => {
                setValue('comuneIstatCode', comune?.istatCode ?? '', { shouldDirty: true, shouldTouch: true, shouldValidate: true });
                if (comune) setValue('city', comune.name, { shouldDirty: true, shouldValidate: true });
              }}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('property.form.address')} error={errors.address} className="sm:col-span-2">
          <Input autoComplete="street-address" placeholder={t('property.form.placeholder.address')} {...register('address')} />
        </Field>
        <Field label={t('property.form.postalCode')} error={errors.postalCode}>
          <Input inputMode="numeric" autoComplete="postal-code" placeholder={t('property.form.placeholder.postalCode')} {...register('postalCode')} />
        </Field>
      </div>

      <Field label={t('property.form.unit')} optional hint={t('property.form.unitHint')} error={errors.unit}>
        <Input maxLength={30} data-testid="property-unit-input" {...register('unit')} />
      </Field>
    </div>
  );
}

/** Step 2: the cadastral identification of the unit. All of it is optional: the contract prints it, the property does not need it. */
export function CadastralStep() {
  const { t } = useTranslation();
  const {
    register,
    formState: { errors },
  } = useFormContext<LongRentPropertyWizardValues>();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('longRentProperties.wizard.cadastral.hint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('longRentProperties.cadastral.sheet')} optional>
          <Input maxLength={10} autoComplete="off" {...register('cadastralSheet')} />
        </Field>
        <Field label={t('longRentProperties.cadastral.parcel')} optional>
          <Input maxLength={20} autoComplete="off" {...register('cadastralParcel')} />
        </Field>
        <Field label={t('longRentProperties.cadastral.subaltern')} optional>
          <Input maxLength={10} autoComplete="off" {...register('cadastralSubaltern')} />
        </Field>
        <Field label={t('longRentProperties.cadastral.category')} optional>
          <Input maxLength={10} autoComplete="off" placeholder={t('longRentProperties.cadastral.categoryPlaceholder')} {...register('cadastralCategory')} />
        </Field>
        <Field label={t('longRentProperties.cadastral.income')} optional error={errors.cadastralIncome}>
          <Input inputMode="decimal" autoComplete="off" {...register('cadastralIncome')} />
        </Field>
      </div>
    </div>
  );
}

/** Step 3: the pages of the APE, if the landlord has them at hand. Code and class are read from them after the property exists. */
export function ApeStep() {
  const { t } = useTranslation();
  const {
    setValue,
    control,
    formState: { errors },
  } = useFormContext<LongRentPropertyWizardValues>();
  const selection = useWatch({ control, name: 'ape' });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('shared.documentUpload.apeScanNotice')}</p>
      <DocumentPages
        value={selection}
        onChange={(next) => setValue('ape', next, { shouldDirty: true, shouldValidate: true })}
        allowOffice={false}
        maxPdfMb={10}
      />
      <FormFieldError error={errors.ape} />
    </div>
  );
}

/** "Foglio 12 · Particella 345 · Categoria A/2 · Rendita 450,00 €", or nothing when no field was filled in. */
function cadastralSummary(values: LongRentPropertyWizardValues, t: TFunction): string {
  const income = parseIncome(values.cadastralIncome);
  const parts: Array<[string, string]> = [
    [t('longRentProperties.cadastral.sheet'), values.cadastralSheet.trim()],
    [t('longRentProperties.cadastral.parcel'), values.cadastralParcel.trim()],
    [t('longRentProperties.cadastral.subaltern'), values.cadastralSubaltern.trim()],
    [t('longRentProperties.cadastral.category'), values.cadastralCategory.trim()],
    [t('longRentProperties.cadastral.income'), income !== null ? formatCurrency(income) : ''],
  ];
  return parts
    .filter(([, value]) => value !== '')
    .map(([label, value]) => `${label} ${value}`)
    .join(' · ');
}

/** What the APE chosen is, in a few words: the name of its file, or how many photos are made one PDF. */
function apeSummary(values: LongRentPropertyWizardValues, t: TFunction): string {
  const pages = values.ape.pages;
  if (pages.length === 0) return '';
  if (isDocumentPdf(pages[0].file)) return pages[0].file.name;
  return t('longRentProperties.wizard.review.apePages', { count: pages.length });
}

/** Step 4: the answers, each with its "Modifica", and a plain note when something the contract needs is still missing. */
export function ReviewStep() {
  const { t } = useTranslation();
  const { control } = useFormContext<LongRentPropertyWizardValues>();
  const values = useWatch({ control }) as LongRentPropertyWizardValues;

  const place = `${values.postalCode.trim()} ${values.city}`.trim();
  const street = values.unit.trim() ? `${values.address.trim()}, ${values.unit.trim()}` : values.address.trim();
  const items: WizardSummaryItem[] = [
    { id: 'name', label: t('longRentProperties.wizard.review.name'), value: values.name.trim(), stepId: 'address' },
    { id: 'address', label: t('longRentProperties.wizard.review.address'), value: [street, place].filter(Boolean).join(' · '), stepId: 'address' },
    { id: 'cadastral', label: t('longRentProperties.wizard.review.cadastral'), value: cadastralSummary(values, t), stepId: 'cadastral' },
    { id: 'ape', label: t('longRentProperties.wizard.review.ape'), value: apeSummary(values, t), stepId: 'ape' },
  ];
  // The contract needs both; the property does not: said once, calmly, before the last button.
  const missing = !isCadastralComplete(values) || !hasApeSelection(values);

  return (
    <div className="space-y-4">
      <WizardSummary items={items} />
      {missing && (
        <Alert variant="info" data-testid="long-rent-wizard-missing">
          {t('longRentProperties.wizard.review.missingNote')}
        </Alert>
      )}
    </div>
  );
}
