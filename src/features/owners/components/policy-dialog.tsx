import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { todayInRome } from '@/lib/stay-dates';
import { useApprovePolicy, useCreatePolicy } from '@/queries/use-owner-accounting';
import type { OwnerAccountingPolicy, OwnerAccountingPolicyCommand, OwnerAccountingRuleParameters } from '@/types';
import { FormDialog } from '@/features/owner-accounting/components/form-dialog';
import { failureText } from '@/features/owner-accounting/owner-accounting-model';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HEX64 = /^[0-9a-fA-F]{64}$/;
const JURISDICTION = /^[A-Za-z]{2}(-[A-Za-z0-9]{1,5})?$/;

interface PolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A rate typed as `21` or `21,5`: positive, at most 100, at most two decimals; `null` for anything else. */
function parsePercent(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(text)) return null;
  const value = Number(text);
  return value > 0 && value <= 100 ? value : null;
}

/**
 * A new rule set of the owner accounting (E06/F05/US02/T01): jurisdiction, code and version, validity, the official source with its fingerprint, and
 * the parameters that decide a withholding at the payout. CasaZen proposes no rate, no tax code and no jurisdiction: they are the ones the qualified
 * accountant gives, with their source, and the rule set has no effect until the accountant's approval is recorded on it. An approved rule set never changes.
 */
export function PolicyDialog({ open, onOpenChange }: PolicyDialogProps) {
  const { t, i18n } = useTranslation();
  const create = useCreatePolicy();
  const [jurisdiction, setJurisdiction] = useState('');
  const [ruleCode, setRuleCode] = useState('');
  const [version, setVersion] = useState('');
  const [validFrom, setValidFrom] = useState(() => todayInRome());
  const [validTo, setValidTo] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceSha256, setSourceSha256] = useState('');
  const [withholdingApplies, setWithholdingApplies] = useState(false);
  const [rate, setRate] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [requiresCollection, setRequiresCollection] = useState(true);
  const [requiresShortLet, setRequiresShortLet] = useState(true);
  const [components, setComponents] = useState('');
  const [rounding, setRounding] = useState('');
  const [retentionYears, setRetentionYears] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rateValue = parsePercent(rate);
  const componentList = components.split(',').map((item) => item.trim()).filter(Boolean);
  const years = Number(retentionYears);
  const sourceOk = (() => {
    try {
      return new URL(sourceUrl.trim()).protocol === 'https:';
    } catch {
      return false;
    }
  })();
  const parametersOk = rounding !== '' && Number.isInteger(years) && years > 0 && years <= 50 && (!withholdingApplies || (rateValue !== null && taxCode.trim() !== '' && componentList.length > 0));
  const valid =
    JURISDICTION.test(jurisdiction.trim()) && ruleCode.trim() !== '' && version.trim() !== '' && DAY.test(validFrom) && (validTo === '' || validTo >= validFrom) && sourceOk && HEX64.test(sourceSha256.trim()) && parametersOk;

  const onSubmit = async () => {
    if (!valid) return;
    setError(null);
    const parameters: OwnerAccountingRuleParameters = {
      withholdingApplies,
      ...(withholdingApplies ? { withholdingRatePercent: rateValue ?? undefined, withholdingTaxCode: taxCode.trim() } : {}),
      requiresAgencyCollection: requiresCollection,
      requiresQualifyingShortLet: requiresShortLet,
      grossBaseComponents: withholdingApplies ? componentList : [],
      rounding,
      retentionYears: years,
    };
    const command: OwnerAccountingPolicyCommand = {
      jurisdiction: jurisdiction.trim().toUpperCase(),
      ruleCode: ruleCode.trim(),
      version: version.trim(),
      validFrom,
      validTo: validTo || undefined,
      sourceUrl: sourceUrl.trim(),
      sourceSha256: sourceSha256.trim().toLowerCase(),
      parameters,
    };
    try {
      await create.mutateAsync(command);
      toast.success(t('ownerProfile.policyDialog.done'));
      onOpenChange(false);
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('ownerProfile.policyDialog.title')}
      description={t('ownerProfile.policyDialog.description')}
      submitLabel={t('ownerProfile.policyDialog.submit')}
      pending={create.isPending}
      submitDisabled={!valid}
      error={error}
      onSubmit={onSubmit}
      testId="policy-dialog"
    >
      <Alert variant="info">{t('ownerProfile.policyDialog.notice')}</Alert>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('ownerProfile.policyDialog.jurisdiction')} hint={t('ownerProfile.dialog.jurisdictionHint')}>
          <Input value={jurisdiction} maxLength={8} autoCapitalize="characters" autoComplete="off" onChange={(event) => setJurisdiction(event.target.value)} data-testid="policy-jurisdiction" />
        </Field>
        <Field label={t('ownerProfile.policyDialog.ruleCode')}>
          <Input value={ruleCode} maxLength={64} autoComplete="off" onChange={(event) => setRuleCode(event.target.value)} data-testid="policy-rule-code" />
        </Field>
        <Field label={t('ownerProfile.policyDialog.version')}>
          <Input value={version} maxLength={32} autoComplete="off" onChange={(event) => setVersion(event.target.value)} data-testid="policy-version" />
        </Field>
        <Field label={t('ownerProfile.policyDialog.validFrom')}>
          <Input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} data-testid="policy-valid-from" />
        </Field>
        <Field label={t('ownerProfile.policyDialog.validTo')} optional>
          <Input type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} data-testid="policy-valid-to" />
        </Field>
      </div>

      <fieldset className="grid gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{t('ownerProfile.policyDialog.source')}</legend>
        <Field label={t('ownerProfile.policyDialog.sourceUrl')} hint={t('ownerProfile.policyDialog.sourceUrlHint')} error={sourceUrl.trim() === '' || sourceOk ? undefined : 'ownerProfile.policyDialog.sourceUrlInvalid'}>
          <Input value={sourceUrl} maxLength={1000} inputMode="url" autoComplete="off" onChange={(event) => setSourceUrl(event.target.value)} data-testid="policy-source-url" />
        </Field>
        <Field label={t('ownerProfile.policyDialog.sourceSha')} hint={t('ownerProfile.policyDialog.sourceShaHint')} error={sourceSha256.trim() === '' || HEX64.test(sourceSha256.trim()) ? undefined : 'ownerProfile.policyDialog.sourceShaInvalid'}>
          <Input value={sourceSha256} maxLength={64} autoComplete="off" onChange={(event) => setSourceSha256(event.target.value)} data-testid="policy-source-sha" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{t('ownerProfile.policyDialog.parameters')}</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={withholdingApplies} onChange={(event) => setWithholdingApplies(event.target.checked)} data-testid="policy-withholding" />
          {t('ownerProfile.policyDialog.withholdingApplies')}
        </label>
        {withholdingApplies ? (
          <div className="grid gap-4 sm:grid-cols-2" data-testid="policy-withholding-fields">
            <Field label={t('ownerProfile.policyDialog.rate')} hint={t('ownerProfile.policyDialog.rateHint')} error={rate.trim() === '' || rateValue !== null ? undefined : 'ownerProfile.policyDialog.rateInvalid'}>
              <Input inputMode="decimal" value={rate} autoComplete="off" onChange={(event) => setRate(event.target.value)} data-testid="policy-rate" />
            </Field>
            <Field label={t('ownerProfile.policyDialog.taxCode')} hint={t('ownerProfile.policyDialog.taxCodeHint')}>
              <Input value={taxCode} maxLength={32} autoComplete="off" onChange={(event) => setTaxCode(event.target.value)} data-testid="policy-tax-code" />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={requiresCollection} onChange={(event) => setRequiresCollection(event.target.checked)} />
              {t('ownerProfile.policyDialog.requiresCollection')}
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={requiresShortLet} onChange={(event) => setRequiresShortLet(event.target.checked)} />
              {t('ownerProfile.policyDialog.requiresShortLet')}
            </label>
            <div className="sm:col-span-2">
              <Field label={t('ownerProfile.policyDialog.components')} hint={t('ownerProfile.policyDialog.componentsHint')}>
                <Input value={components} autoComplete="off" onChange={(event) => setComponents(event.target.value)} data-testid="policy-components" />
              </Field>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('ownerProfile.policyDialog.rounding')}>
            <Select value={rounding} onChange={(event) => setRounding(event.target.value)} data-testid="policy-rounding">
              <option value="">{t('ownerProfile.dialog.choose')}</option>
              <option value="half_up">{t('ownerProfile.policyDialog.halfUp')}</option>
              <option value="half_even">{t('ownerProfile.policyDialog.halfEven')}</option>
            </Select>
          </Field>
          <Field label={t('ownerProfile.policyDialog.retention')} hint={t('ownerProfile.policyDialog.retentionHint')}>
            <Input inputMode="numeric" value={retentionYears} maxLength={2} autoComplete="off" onChange={(event) => setRetentionYears(event.target.value)} data-testid="policy-retention" />
          </Field>
        </div>
      </fieldset>
    </FormDialog>
  );
}

interface ApprovePolicyDialogProps {
  policy: OwnerAccountingPolicy;
  onClose: () => void;
}

/**
 * Records the approval of the qualified accountant on a rule set: who approved it and when stay with it for good, and an approved rule set never
 * changes. It is a statement of fact, made by a person who may (the server asks the finance permission): CasaZen does not approve a rule.
 */
export function ApprovePolicyDialog({ policy, onClose }: ApprovePolicyDialogProps) {
  const { t, i18n } = useTranslation();
  const approve = useApprovePolicy();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    setError(null);
    try {
      await approve.mutateAsync({ policyId: policy.id, approvedByName: name.trim() });
      toast.success(t('ownerProfile.approveDialog.done'));
    } catch (failure) {
      setError(failureText(failure, t, i18n.exists));
      throw failure;
    }
  };

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('ownerProfile.approveDialog.title', { rule: policy.ruleCode, version: policy.version })}
      description={t('ownerProfile.approveDialog.description')}
      confirmLabel={t('ownerProfile.approveDialog.confirm')}
      consequences={[t('ownerProfile.approveDialog.consequence1'), t('ownerProfile.approveDialog.consequence2')]}
      isLoading={approve.isPending}
      confirmDisabled={name.trim().length === 0}
      onConfirm={onConfirm}
    >
      <div className="space-y-3">
        <Field label={t('ownerProfile.approveDialog.name')} hint={t('ownerProfile.approveDialog.nameHint')}>
          <Input value={name} maxLength={200} autoComplete="off" onChange={(event) => setName(event.target.value)} data-testid="policy-approver" />
        </Field>
        {error ? <Alert variant="danger">{error}</Alert> : null}
      </div>
    </ConfirmationDialog>
  );
}
