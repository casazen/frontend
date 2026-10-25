import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { HelpTip } from '@/components/ui/help-tip';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { classifyFiscalCode } from '@/lib/fiscal-code';
import { getLeaseTaxRegimeLabel } from '@/lib/i18n-labels';
import { formatCurrency } from '@/lib/utils';
import { LEASE_TAX_REGIMES, type LeaseOrigin, type LongRentRules } from '@/types';
import { ContractTypeCards } from './contract-type-cards';
import { ReadMark } from './reading-marks';
import { WhyAsk } from './why-ask';
import { TRANSITORY_NEED_MAX_LENGTH, TRANSITORY_PARTIES, makesItsNeed, type WizardValues } from './wizard-model';

/**
 * Step ③ «Condizioni economiche» (LR-06a): the type, the tax regime, the rent and the deposit. The limit of the deposit is the server's
 * (`rules.depositMaxRents`) and is told live from the rent typed; nothing is written here as a figure of law. The deposit is asked for
 * («0 se non c'è») on a contract made in CasaZen, because its model prints it (LR-DEP), and is optional on one already signed. No
 * frequency and day of payment, no expenses, no ISTAT: the plan of the rents is set up later, once the contract is in force.
 *
 * A transitory contract made in CasaZen also states the need that justifies its short term (TR, D.M. 16/01/2017 art. 2 c. 4): who has it,
 * the landlord or the tenant, and what it is. The documents that prove it are asked at step ④, with the term that decides whether they
 * are needed.
 */
export function TermsStep({ rules, origin }: { rules: LongRentRules; origin: LeaseOrigin }) {
  const { t } = useTranslation();
  const { control, register, setValue, formState } = useFormContext<WizardValues>();
  const [contractType, taxRegime, rentText, depositText, tenants, transitoryParty, transitoryNeed] = useWatch({
    control,
    name: ['contractType', 'taxRegime', 'monthlyRent', 'securityDeposit', 'tenants', 'transitoryParty', 'transitoryNeed'],
  });

  const rent = Number(rentText);
  const deposit = Number(depositText);
  const maxRents = rules.depositMaxRents;
  const maxDeposit = rent > 0 ? rent * maxRents : null;
  const maxText = maxDeposit === null ? '' : formatCurrency(maxDeposit);
  const depositTooHigh = maxDeposit !== null && depositText.trim() !== '' && deposit > maxDeposit;
  // The model of a contract made in CasaZen states the deposit, so it is asked for (0 if there is none); one already signed prints nothing.
  const depositRequired = origin !== 'Imported';
  const depositMaxHint = maxDeposit !== null && !depositTooHigh ? t('leaseWizard.terms.depositMax', { max: maxRents, amount: maxText }) : '';
  const depositHint = [depositRequired ? t('leaseWizard.terms.depositNone') : '', depositMaxHint].filter(Boolean).join(' ');
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
      <ReadMark step={3} fields={['contractType']} name="contractType" />

      {makesItsNeed({ contractType }, origin) ? (
        <section className="space-y-4" aria-labelledby="lw-transitory-title" data-testid="lease-transitory-need">
          <div className="space-y-1">
            <h3 id="lw-transitory-title" className="text-sm font-semibold">
              {t('leaseWizard.transitory.title')}
            </h3>
            <p className="text-sm text-muted-foreground">{t('leaseWizard.transitory.intro')}</p>
          </div>
          <ChoiceGroup legend={t('leaseWizard.transitory.party.legend')} legendVisible minCardWidth={14}>
            {TRANSITORY_PARTIES.map((party, position) => (
              <ChoiceCard
                key={party}
                id={position === 0 ? 'lw-transitoryParty' : undefined}
                name="lease-transitory-party"
                value={party}
                checked={transitoryParty === party}
                onChange={() => setValue('transitoryParty', party, { shouldDirty: true })}
                title={t(`leaseWizard.transitory.party.${party}.title`)}
                description={t(`leaseWizard.transitory.party.${party}.description`)}
                data-testid={`lease-transitory-party-${party}`}
              />
            ))}
          </ChoiceGroup>
          <Field
            label={t('leaseWizard.transitory.need.label')}
            hint={t('leaseWizard.transitory.need.hint')}
            counter={`${transitoryNeed.length}/${TRANSITORY_NEED_MAX_LENGTH}`}
          >
            <Textarea id="lw-transitoryNeed" rows={3} maxLength={TRANSITORY_NEED_MAX_LENGTH} {...register('transitoryNeed')} />
          </Field>
        </section>
      ) : null}

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
          {t('leaseWizardGuide.fields.regime.intro')} {t('leaseWizard.terms.regime.help')}{' '}
          <HelpTip title={t('leaseWizard.terms.regime.helpTitle')}>{t('leaseWizard.terms.regime.helpText')}</HelpTip>
        </p>
        <ReadMark step={3} fields={['taxRegime']} name="taxRegime" />
        {hasCompany && taxRegime === 'CedolareSecca' ? (
          <Alert variant="warning" data-testid="lease-company-cedolare">
            {t('leaseWizard.terms.regime.companyNotAllowed')}
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Field
            label={t('leaseWizard.terms.rent')}
            hint={t('leaseWizardGuide.fields.rent.hint')}
            example={t('leaseWizardGuide.fields.rent.example')}
            error={formState.errors.monthlyRent}
          >
            <Input id="lw-monthlyRent" type="number" inputMode="decimal" step="0.01" min="0" {...register('monthlyRent')} />
          </Field>
          <ReadMark step={3} fields={['monthlyRent']} name="monthlyRent" />
        </div>
        <div className="space-y-1.5">
          <Field
            label={t('leaseWizard.terms.deposit')}
            optional={!depositRequired}
            hint={depositHint || undefined}
            example={t('leaseWizardGuide.fields.deposit.example')}
            error={depositTooHigh ? t('leaseWizard.terms.depositTooHigh', { max: maxRents, amount: maxText }) : formState.errors.securityDeposit}
          >
            <Input id="lw-securityDeposit" type="number" inputMode="decimal" step="0.01" min="0" {...register('securityDeposit')} />
          </Field>
          <ReadMark step={3} fields={['securityDeposit']} name="securityDeposit" />
          <WhyAsk>{t('leaseWizardGuide.fields.deposit.why')}</WhyAsk>
        </div>
      </div>
    </div>
  );
}
