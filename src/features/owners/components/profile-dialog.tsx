import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { todayInRome } from '@/lib/stay-dates';
import { useSaveFiscalProfile } from '@/queries/use-owner-accounting';
import type { OwnerAccountingPolicy, OwnerEntityKind, OwnerFiscalProfile, OwnerFiscalProfileCommand } from '@/types';
import { FormDialog } from '@/features/owner-accounting/components/form-dialog';
import { PROFILE_OPTIONS, failureText, type ProfileOptionField } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  from: OwnerFiscalProfile | null;
  policies: readonly OwnerAccountingPolicy[];
  suggestedFrom: string;
  /** The start of the newest profile of the owner: a new one must start after it, since the server refuses a day that is not later (409). `null` for the first profile. */
  latestStart: string | null;
}

interface FormState {
  validFrom: string;
  entityKind: OwnerEntityKind;
  legalName: string;
  taxResidenceCountry: string;
  legalAddress: string;
  fiscalCode: string;
  vatNumber: string;
  foreignTaxId: string;
  settlementCurrency: string;
  bankAccountReference: string;
  mandateRole: string;
  mandateFrom: string;
  mandateTo: string;
  revenueRecognitionRule: string;
  expenseCommissionModel: string;
  workingCapitalRule: string;
  taxJurisdiction: string;
  accountingPolicyId: string;
}

/** A new version starts today; the first profile starts on the first day of the month to close, so that month is covered and not left without a profile. */
const initial = (from: OwnerFiscalProfile | null, suggestedFrom: string): FormState => ({
  validFrom: from === null ? suggestedFrom : todayInRome(),
  entityKind: from?.entityKind ?? 'NaturalPerson',
  legalName: from?.legalName ?? '',
  taxResidenceCountry: from?.taxResidenceCountry ?? '',
  legalAddress: from?.legalAddress ?? '',
  fiscalCode: from?.fiscalCode ?? '',
  vatNumber: from?.vatNumber ?? '',
  foreignTaxId: from?.foreignTaxId ?? '',
  settlementCurrency: from?.settlementCurrency ?? '',
  bankAccountReference: from?.bankAccountReference ?? '',
  mandateRole: from?.mandateRole ?? '',
  mandateFrom: from?.mandateFrom ?? '',
  mandateTo: from?.mandateTo ?? '',
  revenueRecognitionRule: from?.revenueRecognitionRule ?? '',
  expenseCommissionModel: from?.expenseCommissionModel ?? '',
  workingCapitalRule: from?.workingCapitalRule ?? '',
  taxJurisdiction: from?.taxJurisdiction ?? '',
  accountingPolicyId: from?.accountingPolicyId ?? '',
});

const REVIEW_FIELDS = ['legalName', 'entityKind', 'taxResidenceCountry', 'fiscalCode', 'vatNumber', 'foreignTaxId', 'legalAddress', 'settlementCurrency', 'bankAccountReference', 'mandateRole', 'mandateFrom', 'mandateTo', 'revenueRecognitionRule', 'expenseCommissionModel', 'workingCapitalRule', 'taxJurisdiction'] as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const JURISDICTION = /^[A-Za-z]{2}(-[A-Za-z0-9]{1,5})?$/;

function ChoiceField({ field, value, onChange }: { field: ProfileOptionField; value: string; onChange: (patch: Partial<Record<ProfileOptionField, string>>) => void }) {
  const { t } = useTranslation();
  const known: readonly string[] = PROFILE_OPTIONS[field];
  const options = value !== '' && !known.includes(value) ? [...known, value] : [...known];
  return (
    <Field label={t(`ownerProfile.fields.${field}`)} optional={field !== 'revenueRecognitionRule'}>
      <Select value={value} onChange={(event) => onChange({ [field]: event.target.value })} data-testid={`profile-${field}`}>
        <option value="">{t('ownerProfile.dialog.choose')}</option>
        {options.map((code) => (
          <option key={code} value={code}>
            {known.includes(code) ? t(`ownerProfile.options.${field}.${code}`) : code}
          </option>
        ))}
      </Select>
    </Field>
  );
}

const text = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim());

export function ProfileDialog({ open, onOpenChange, ownerId, from, policies, suggestedFrom, latestStart }: ProfileDialogProps) {
  const { t, i18n } = useTranslation();
  const { date } = useOwnerFormat();
  const save = useSaveFiscalProfile(ownerId);
  const [form, setForm] = useState<FormState>(() => initial(from, suggestedFrom));
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const countryOk = form.taxResidenceCountry.trim() === '' || /^[A-Za-z]{2}$/.test(form.taxResidenceCountry.trim());
  const currencyOk = form.settlementCurrency.trim() === '' || /^[A-Za-z]{3}$/.test(form.settlementCurrency.trim());
  const jurisdictionOk = form.taxJurisdiction.trim() === '' || JURISDICTION.test(form.taxJurisdiction.trim());
  const mandateOk = form.mandateFrom === '' || form.mandateTo === '' || form.mandateTo >= form.mandateFrom;
  const startsAfterTheLast = latestStart === null || !DAY.test(form.validFrom) || form.validFrom > latestStart;
  const valid = DAY.test(form.validFrom) && startsAfterTheLast && countryOk && currencyOk && jurisdictionOk && mandateOk;

  const steps = ['identity', 'tax', 'payment', 'mandate', 'model', 'rule', 'review'] as const;
  const stepValid = [DAY.test(form.validFrom) && startsAfterTheLast, countryOk, currencyOk, mandateOk, true, jurisdictionOk, valid][step];

  const reviewValue = (field: keyof FormState): string => {
    const value = form[field];
    if (!value) return t('ownerProfile.facts.empty');
    if (field === 'entityKind') return t(`ownerProfile.options.entityKind.${value}`);
    if (field === 'mandateFrom' || field === 'mandateTo') return date(value);
    if (field in PROFILE_OPTIONS && (PROFILE_OPTIONS[field as ProfileOptionField] as readonly string[]).includes(value)) return t(`ownerProfile.options.${field}.${value}`);
    return value;
  };
  const selectedPolicy = policies.find((policy) => policy.id === form.accountingPolicyId);

  const onSubmit = async () => {
    if (!stepValid) return;
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    if (!valid) return;
    setError(null);
    const command: OwnerFiscalProfileCommand = {
      validFrom: form.validFrom,
      entityKind: form.entityKind,
      legalName: text(form.legalName),
      taxResidenceCountry: text(form.taxResidenceCountry)?.toUpperCase(),
      legalAddress: text(form.legalAddress),
      fiscalCode: text(form.fiscalCode),
      vatNumber: text(form.vatNumber),
      foreignTaxId: text(form.foreignTaxId),
      settlementCurrency: text(form.settlementCurrency)?.toUpperCase(),
      bankAccountReference: text(form.bankAccountReference),
      mandateRole: text(form.mandateRole),
      mandateFrom: text(form.mandateFrom),
      mandateTo: text(form.mandateTo),
      revenueRecognitionRule: text(form.revenueRecognitionRule),
      expenseCommissionModel: text(form.expenseCommissionModel),
      workingCapitalRule: text(form.workingCapitalRule),
      taxJurisdiction: text(form.taxJurisdiction)?.toUpperCase(),
      accountingPolicyId: text(form.accountingPolicyId),
    };
    try {
      await save.mutateAsync(command);
      toast.success(t('ownerProfile.dialog.done'));
      onOpenChange(false);
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('ownerProfile.dialog.title')}
      description={t('ownerProfile.wizard.description')}
      submitLabel={t(step === steps.length - 1 ? 'ownerProfile.dialog.submit' : 'ownerProfile.wizard.next')}
      pending={save.isPending}
      submitDisabled={!stepValid}
      error={error}
      onSubmit={onSubmit}
      testId="profile-dialog"
    >
      <div className="space-y-3">
        <p className="text-sm text-foreground/60" role="status">{t('ownerProfile.wizard.progress', { current: step + 1, total: steps.length })}</p>
        <div className="flex gap-1" aria-hidden="true">
          {steps.map((name, index) => <span key={name} className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-primary' : 'bg-muted'}`} />)}
        </div>
        <h3 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{t(`ownerProfile.wizard.steps.${steps[step]}`)}</h3>
        <p className="text-sm text-foreground/70">{t(`ownerProfile.wizard.hints.${steps[step]}`)}</p>
      </div>
      {step === 0 ? <>
      <Field
        label={t('ownerProfile.dialog.validFrom')}
        hint={from === null ? t('ownerProfile.dialog.validFromFirst') : t('ownerProfile.dialog.validFromHint')}
        error={startsAfterTheLast || latestStart === null ? undefined : t('ownerProfile.dialog.validFromTooEarly', { date: date(latestStart) })}
      >
        <Input type="date" value={form.validFrom} onChange={(event) => set({ validFrom: event.target.value })} data-testid="profile-valid-from" />
      </Field>

      <fieldset className="grid gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{t('ownerProfile.dialog.identity')}</legend>
        <Field label={t('ownerProfile.fields.entityKind')}>
          <Select value={form.entityKind} onChange={(event) => set({ entityKind: event.target.value as OwnerEntityKind })} data-testid="profile-entity-kind">
            <option value="NaturalPerson">{t('ownerProfile.options.entityKind.NaturalPerson')}</option>
            <option value="LegalEntity">{t('ownerProfile.options.entityKind.LegalEntity')}</option>
          </Select>
        </Field>
        <Field label={t('ownerProfile.fields.legalName')}>
          <Input value={form.legalName} maxLength={200} autoComplete="off" onChange={(event) => set({ legalName: event.target.value })} data-testid="profile-legal-name" />
        </Field>
      </fieldset>
      </> : null}
      {step === 1 ? <fieldset className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ownerProfile.fields.taxResidenceCountry')} hint={t('ownerProfile.dialog.countryHint')} error={countryOk ? undefined : t('ownerProfile.dialog.countryInvalid')}>
            <Input value={form.taxResidenceCountry} maxLength={2} autoCapitalize="characters" autoComplete="off" onChange={(event) => set({ taxResidenceCountry: event.target.value })} data-testid="profile-country" />
          </Field>
          <Field label={t('ownerProfile.fields.fiscalCode')} optional>
            <Input value={form.fiscalCode} maxLength={40} autoComplete="off" onChange={(event) => set({ fiscalCode: event.target.value })} data-testid="profile-fiscal-code" />
          </Field>
          <Field label={t('ownerProfile.fields.vatNumber')} optional>
            <Input value={form.vatNumber} maxLength={40} autoComplete="off" onChange={(event) => set({ vatNumber: event.target.value })} data-testid="profile-vat" />
          </Field>
          <Field label={t('ownerProfile.fields.foreignTaxId')} optional>
            <Input value={form.foreignTaxId} maxLength={40} autoComplete="off" onChange={(event) => set({ foreignTaxId: event.target.value })} data-testid="profile-foreign-tax-id" />
          </Field>
        </div>
        <Field label={t('ownerProfile.fields.legalAddress')} optional>
          <Textarea value={form.legalAddress} maxLength={500} rows={2} onChange={(event) => set({ legalAddress: event.target.value })} data-testid="profile-address" />
        </Field>
      </fieldset> : null}

      {step === 2 ? <fieldset className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ownerProfile.fields.settlementCurrency')} hint={t('ownerProfile.dialog.currencyHint')} error={currencyOk ? undefined : t('ownerProfile.dialog.currencyInvalid')}>
            <Input value={form.settlementCurrency} maxLength={3} autoCapitalize="characters" autoComplete="off" onChange={(event) => set({ settlementCurrency: event.target.value })} data-testid="profile-currency" />
          </Field>
          <Field label={t('ownerProfile.fields.bankAccountReference')} optional>
            <Input value={form.bankAccountReference} maxLength={40} autoComplete="off" onChange={(event) => set({ bankAccountReference: event.target.value })} data-testid="profile-iban" />
          </Field>
        </div>
      </fieldset> : null}

      {step === 3 ? <fieldset className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceField field="mandateRole" value={form.mandateRole} onChange={set} />
          <Field label={t('ownerProfile.fields.mandateFrom')} optional>
            <Input type="date" value={form.mandateFrom} onChange={(event) => set({ mandateFrom: event.target.value })} data-testid="profile-mandate-from" />
          </Field>
          <Field label={t('ownerProfile.fields.mandateTo')} optional error={mandateOk ? undefined : t('ownerProfile.dialog.mandateInvalid')}>
            <Input type="date" value={form.mandateTo} onChange={(event) => set({ mandateTo: event.target.value })} data-testid="profile-mandate-to" />
          </Field>
        </div>
      </fieldset> : null}

      {step === 4 ? <fieldset className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceField field="revenueRecognitionRule" value={form.revenueRecognitionRule} onChange={set} />
          <ChoiceField field="expenseCommissionModel" value={form.expenseCommissionModel} onChange={set} />
          <ChoiceField field="workingCapitalRule" value={form.workingCapitalRule} onChange={set} />
        </div>
      </fieldset> : null}

      {step === 5 ? <fieldset className="grid gap-4">
        <p className="text-sm text-foreground/70">{t('ownerProfile.dialog.ruleHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ownerProfile.fields.taxJurisdiction')} hint={t('ownerProfile.dialog.jurisdictionHint')} error={jurisdictionOk ? undefined : t('ownerProfile.dialog.jurisdictionInvalid')}>
            <Input value={form.taxJurisdiction} maxLength={8} autoCapitalize="characters" autoComplete="off" onChange={(event) => set({ taxJurisdiction: event.target.value })} data-testid="profile-jurisdiction" />
          </Field>
          <Field label={t('ownerProfile.fields.accountingPolicyId')}>
            <Select value={form.accountingPolicyId} onChange={(event) => set({ accountingPolicyId: event.target.value })} data-testid="profile-policy">
              <option value="">{t('ownerProfile.dialog.noPolicy')}</option>
              {policies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {t('ownerProfile.dialog.policyOption', {
                    rule: policy.ruleCode,
                    version: policy.version,
                    jurisdiction: policy.jurisdiction,
                    state: policy.approved ? t('ownerProfile.policy.approvedShort') : t('ownerProfile.policy.pendingShort'),
                  })}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset> : null}
      {step === 6 ? (
        <div className="space-y-5" data-testid="profile-review">
          <dl className="grid gap-4 sm:grid-cols-2">
            {REVIEW_FIELDS.map((field) => (
              <div key={field} className="min-w-0 border-b border-border pb-3">
                <dt className="text-sm text-foreground/60">{t(`ownerProfile.fields.${field}`)}</dt>
                <dd className="break-words text-sm font-medium">{reviewValue(field)}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-1">
            <p className="text-sm text-foreground/60">{t('ownerProfile.fields.accountingPolicyId')}</p>
            <p className="text-sm font-medium">{selectedPolicy ? t('ownerProfile.dialog.policyOption', { rule: selectedPolicy.ruleCode, version: selectedPolicy.version, jurisdiction: selectedPolicy.jurisdiction, state: t(selectedPolicy.approved ? 'ownerProfile.policy.approvedShort' : 'ownerProfile.policy.pendingShort') }) : t('ownerProfile.dialog.noPolicy')}</p>
          </div>
          <p className="text-sm text-foreground/70">{t('ownerProfile.facts.validFrom', { from: date(form.validFrom) })}</p>
        </div>
      ) : null}
      {step > 0 ? <Button type="button" variant="ghost" className="justify-self-start" disabled={save.isPending} onClick={() => setStep((current) => current - 1)} data-testid="profile-back">{t('ownerProfile.wizard.back')}</Button> : null}
    </FormDialog>
  );
}
