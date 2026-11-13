import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
  /** The profile in force, in full: the form starts from it (a new version of the same owner). `null` for the first profile. */
  from: OwnerFiscalProfile | null;
  /** The rule sets of the agency: the profile picks one. */
  policies: readonly OwnerAccountingPolicy[];
  /** The day the FIRST profile of the owner starts by default: the first day of the month to close (a profile never covers the days before its start). */
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

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const JURISDICTION = /^[A-Za-z]{2}(-[A-Za-z0-9]{1,5})?$/;

/** A field that is a code: the values the accounting knows, and the one stored when it is none of them. */
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

/** The text of a field, or nothing: the server stores an empty field as none. */
const text = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim());

/**
 * A new version of the fiscal profile of an owner (E06/F05/US02/T01, T04): who the owner is for the statements, the payouts and the tax evidence,
 * how they are paid, the mandate, how revenue and costs are recognized and which jurisdiction and approved rule set apply. It takes effect from the
 * day given; the one in force ends the day before, and nothing already posted changes. The country does not choose the rule: the person does, and
 * the server blocks a rule that is not approved, not in force or of another jurisdiction.
 */
export function ProfileDialog({ open, onOpenChange, ownerId, from, policies, suggestedFrom, latestStart }: ProfileDialogProps) {
  const { t, i18n } = useTranslation();
  const { date } = useOwnerFormat();
  const save = useSaveFiscalProfile(ownerId);
  const [form, setForm] = useState<FormState>(() => initial(from, suggestedFrom));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const countryOk = form.taxResidenceCountry.trim() === '' || /^[A-Za-z]{2}$/.test(form.taxResidenceCountry.trim());
  const currencyOk = form.settlementCurrency.trim() === '' || /^[A-Za-z]{3}$/.test(form.settlementCurrency.trim());
  const jurisdictionOk = form.taxJurisdiction.trim() === '' || JURISDICTION.test(form.taxJurisdiction.trim());
  const mandateOk = form.mandateFrom === '' || form.mandateTo === '' || form.mandateTo >= form.mandateFrom;
  // The server refuses a profile that does not start after the newest one (409 `owner_fiscal_profile_overlap`): the form says so before it is sent.
  const startsAfterTheLast = latestStart === null || !DAY.test(form.validFrom) || form.validFrom > latestStart;
  const valid = DAY.test(form.validFrom) && startsAfterTheLast && countryOk && currencyOk && jurisdictionOk && mandateOk;

  const onSubmit = async () => {
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
      description={t('ownerProfile.dialog.description')}
      submitLabel={t('ownerProfile.dialog.submit')}
      pending={save.isPending}
      submitDisabled={!valid}
      error={error}
      onSubmit={onSubmit}
      testId="profile-dialog"
    >
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ownerProfile.fields.taxResidenceCountry')} hint={t('ownerProfile.dialog.countryHint')} error={countryOk ? undefined : 'ownerProfile.dialog.countryInvalid'}>
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
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{t('ownerProfile.dialog.payment')}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ownerProfile.fields.settlementCurrency')} hint={t('ownerProfile.dialog.currencyHint')} error={currencyOk ? undefined : 'ownerProfile.dialog.currencyInvalid'}>
            <Input value={form.settlementCurrency} maxLength={3} autoCapitalize="characters" autoComplete="off" onChange={(event) => set({ settlementCurrency: event.target.value })} data-testid="profile-currency" />
          </Field>
          <Field label={t('ownerProfile.fields.bankAccountReference')} optional>
            <Input value={form.bankAccountReference} maxLength={40} autoComplete="off" onChange={(event) => set({ bankAccountReference: event.target.value })} data-testid="profile-iban" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{t('ownerProfile.dialog.mandate')}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceField field="mandateRole" value={form.mandateRole} onChange={set} />
          <Field label={t('ownerProfile.fields.mandateFrom')} optional>
            <Input type="date" value={form.mandateFrom} onChange={(event) => set({ mandateFrom: event.target.value })} data-testid="profile-mandate-from" />
          </Field>
          <Field label={t('ownerProfile.fields.mandateTo')} optional error={mandateOk ? undefined : 'ownerProfile.dialog.mandateInvalid'}>
            <Input type="date" value={form.mandateTo} onChange={(event) => set({ mandateTo: event.target.value })} data-testid="profile-mandate-to" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{t('ownerProfile.dialog.model')}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceField field="revenueRecognitionRule" value={form.revenueRecognitionRule} onChange={set} />
          <ChoiceField field="expenseCommissionModel" value={form.expenseCommissionModel} onChange={set} />
          <ChoiceField field="workingCapitalRule" value={form.workingCapitalRule} onChange={set} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{t('ownerProfile.dialog.rule')}</legend>
        <p className="text-sm text-foreground/70">{t('ownerProfile.dialog.ruleHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ownerProfile.fields.taxJurisdiction')} hint={t('ownerProfile.dialog.jurisdictionHint')} error={jurisdictionOk ? undefined : 'ownerProfile.dialog.jurisdictionInvalid'}>
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
      </fieldset>
    </FormDialog>
  );
}
