import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';
import { Input } from '@/components/ui/input';
import { classifyFiscalCode } from '@/lib/fiscal-code';
import { getLeaseTaxRegimeLabel } from '@/lib/i18n-labels';
import { formatCurrency } from '@/lib/utils';
import { LEASE_TAX_REGIMES, type LeaseOrigin, type LongRentRules } from '@/types';
import { ContractTypeCards } from './contract-type-cards';
import type { WizardValues } from './wizard-model';

/**
 * Step ③ «Condizioni economiche» (LR-06a): the type, the tax regime, the rent and the deposit. The limit of the deposit is the server's
 * (`rules.depositMaxRents`) and is told live from the rent typed; nothing is written here as a figure of law. No frequency and day of
 * payment, no expenses, no ISTAT: the plan of the rents is set up later, once the contract is in force.
 */
export function TermsStep({ rules, origin }: { rules: LongRentRules; origin: LeaseOrigin }) {
  const { t } = useTranslation();
  const { control, register, setValue, formState } = useFormContext<WizardValues>();
  const [contractType, taxRegime, rentText, depositText, tenants] = useWatch({
    control,
    name: ['contractType', 'taxRegime', 'monthlyRent', 'securityDeposit', 'tenants'],
  });

  const rent = Number(rentText);
  const deposit = Number(depositText);
  const maxRents = rules.depositMaxRents;
  const maxDeposit = rent > 0 ? rent * maxRents : null;
  const maxText = maxDeposit === null ? '' : formatCurrency(maxDeposit);
  const depositTooHigh = maxDeposit !== null && depositText.trim() !== '' && deposit > maxDeposit;
  const hasCompany = tenants.some((tenant) => classifyFiscalCode(tenant.fiscalCode) === 'numeric');

  return (
    <div className="space-y-8">
      <ContractTypeCards
        origin={origin}
        rules={rules}
        value={contractType}
        onChange={(type) => setValue('contractType', type, { shouldDirty: true })}
        firstId="lw-type"
      />

      <div className="space-y-2">
        <ChoiceGroup legend={t('leaseWizard.terms.regime.legend')} legendVisible minCardWidth={14}>
          {LEASE_TAX_REGIMES.map((regime, position) => (
            <ChoiceCard
              key={regime}
              id={position === 0 ? 'lw-regime' : undefined}
              name="lease-regime"
              value={regime}
              checked={taxRegime === regime}
              onChange={() => setValue('taxRegime', regime, { shouldDirty: true })}
              title={getLeaseTaxRegimeLabel(regime, t)}
              description={t(`leaseWizard.terms.regime.${regime}`)}
              data-testid={`lease-regime-${regime}`}
            />
          ))}
        </ChoiceGroup>
        <p className="text-sm text-muted-foreground">
          {t('leaseWizard.terms.regime.help')}{' '}
          <HelpTip title={t('leaseWizard.terms.regime.helpTitle')}>{t('leaseWizard.terms.regime.helpText')}</HelpTip>
        </p>
        {hasCompany && taxRegime === 'CedolareSecca' ? (
          <Alert variant="warning" data-testid="lease-company-cedolare">
            {t('leaseWizard.terms.regime.companyNotAllowed')}
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('leaseWizard.terms.rent')} error={formState.errors.monthlyRent}>
          <Input id="lw-monthlyRent" type="number" inputMode="decimal" step="0.01" min="0" {...register('monthlyRent')} />
        </Field>
        <Field
          label={t('leaseWizard.terms.deposit')}
          optional
          hint={maxDeposit !== null && !depositTooHigh ? t('leaseWizard.terms.depositMax', { max: maxRents, amount: maxText }) : undefined}
          error={depositTooHigh ? t('leaseWizard.terms.depositTooHigh', { max: maxRents, amount: maxText }) : formState.errors.securityDeposit}
        >
          <Input id="lw-securityDeposit" type="number" inputMode="decimal" step="0.01" min="0" {...register('securityDeposit')} />
        </Field>
      </div>
    </div>
  );
}
