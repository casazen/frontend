import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getProblemMessage } from '@/lib/api-errors';
import { useCancellationPolicies } from '@/queries/use-properties';
import type { PropertyWizardValues } from '../property-wizard-model';
import { cancellationPolicyLine } from '../rules/policy-line';

const hours = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => `${String(from + index).padStart(2, '0')}:00`);

/** The hours offered for arrival, departure and quiet time (whole hours: what a host says on the phone). */
const CHECK_IN_TIMES = hours(14, 20);
const CHECK_OUT_TIMES = hours(8, 12);
const QUIET_FROM_TIMES = hours(21, 23);
const QUIET_TO_TIMES = hours(6, 9);

const SMOKING_OPTIONS = ['No', 'OutdoorsOnly', 'Yes'] as const;
const PETS_OPTIONS = ['No', 'OnRequest', 'Yes'] as const;
const PARTIES_OPTIONS = ['No', 'OnRequest'] as const;

/** The hours of the list plus the one the property has, if it is another (an API client may have stored 15:30): never hidden. */
function withCurrent(list: readonly string[], current: string): string[] {
  return current !== '' && !list.includes(current) ? [...list, current].sort() : [...list];
}

interface TimeSelectProps {
  form: UseFormReturn<PropertyWizardValues>;
  name: 'checkInFrom' | 'checkOutBy' | 'quietHoursFrom' | 'quietHoursTo';
  label: string;
  list: readonly string[];
  /** Offers «Nessuno»: for what may be left unsaid. */
  blank?: string;
}

function TimeSelect({ form, name, label, list, blank }: TimeSelectProps) {
  const options = withCurrent(list, form.getValues(name));

  return (
    <Field label={label} error={form.formState.errors[name]}>
      <Select {...form.register(name)}>
        {blank ? <option value="">{blank}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </Field>
  );
}

interface PolicySelectProps<T extends string> {
  form: UseFormReturn<PropertyWizardValues>;
  name: 'smokingPolicy' | 'petsPolicy' | 'partiesPolicy';
  label: string;
  options: readonly T[];
  optionLabel: (option: T) => string;
}

function PolicySelect<T extends string>({ form, name, label, options, optionLabel }: PolicySelectProps<T>) {
  return (
    <Field label={label} error={form.formState.errors[name]}>
      <Select {...form.register(name)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

interface RulesStepProps {
  form: UseFormReturn<PropertyWizardValues>;
}

/**
 * Step 4 · «Quali regole valgono in casa?» (SR-07c): arrival and departure, smoking, pets, parties, quiet hours, what extra guests pay,
 * and **which of the five cancellation policies of the catalog** the host offers. Every answer is the host's: nothing is preselected for
 * the policy, and the line under each one is made of its own numbers (`cancellationPolicyLine`), not of the catalog's description.
 */
export function RulesStep({ form }: RulesStepProps) {
  const { t } = useTranslation();
  const policies = useCancellationPolicies();
  const { register, watch, formState } = form;
  const houseRulesLength = watch('houseRules').length;
  const chosenPolicy = watch('cancellationPolicyId');

  return (
    <>
      <section aria-labelledby="property-wizard-rules-times" className="min-w-0 space-y-4">
        <h3 id="property-wizard-rules-times" className="text-base font-semibold">
          {t('propertyWizard.rules.times.title')}
        </h3>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <TimeSelect form={form} name="checkInFrom" label={t('propertyWizard.rules.times.checkIn')} list={CHECK_IN_TIMES} />
          <TimeSelect form={form} name="checkOutBy" label={t('propertyWizard.rules.times.checkOut')} list={CHECK_OUT_TIMES} />
        </div>
      </section>

      <section aria-labelledby="property-wizard-rules-house" className="min-w-0 space-y-4">
        <h3 id="property-wizard-rules-house" className="text-base font-semibold">
          {t('propertyWizard.rules.house.title')}
        </h3>
        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
          <PolicySelect
            form={form}
            name="smokingPolicy"
            label={t('propertyWizard.rules.house.smoking')}
            options={SMOKING_OPTIONS}
            optionLabel={(option) => t(`propertyWizard.rules.smokingOptions.${option}`)}
          />
          <PolicySelect
            form={form}
            name="petsPolicy"
            label={t('propertyWizard.rules.house.pets')}
            options={PETS_OPTIONS}
            optionLabel={(option) => t(`propertyWizard.rules.petsOptions.${option}`)}
          />
          <PolicySelect
            form={form}
            name="partiesPolicy"
            label={t('propertyWizard.rules.house.parties')}
            options={PARTIES_OPTIONS}
            optionLabel={(option) => t(`propertyWizard.rules.partiesOptions.${option}`)}
          />
        </div>

        <div role="group" aria-labelledby="property-wizard-rules-quiet" className="min-w-0 space-y-2">
          <p id="property-wizard-rules-quiet" className="text-sm font-medium">
            {t('propertyWizard.rules.quiet.title')}
          </p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <TimeSelect form={form} name="quietHoursFrom" label={t('propertyWizard.rules.quiet.from')} list={QUIET_FROM_TIMES} blank={t('propertyWizard.rules.quiet.none')} />
            <TimeSelect form={form} name="quietHoursTo" label={t('propertyWizard.rules.quiet.to')} list={QUIET_TO_TIMES} blank={t('propertyWizard.rules.quiet.none')} />
          </div>
          <p className="text-sm text-foreground/70">{t('propertyWizard.rules.quiet.hint')}</p>
        </div>

        <Field
          label={t('propertyWizard.rules.extraGuest.label')}
          optional
          hint={t('propertyWizard.rules.extraGuest.hint')}
          error={formState.errors.extraGuestFee}
          className="max-w-lg"
        >
          <Input inputMode="decimal" autoComplete="off" {...register('extraGuestFee')} />
        </Field>
      </section>

      <section aria-labelledby="property-wizard-rules-policy" className="min-w-0 space-y-4">
        <div className="space-y-1">
          <h3 id="property-wizard-rules-policy" className="text-base font-semibold">
            {t('propertyWizard.rules.policy.title')}
          </h3>
          <p className="text-sm text-foreground/70">{t('propertyWizard.rules.policy.intro')}</p>
        </div>

        {policies.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2" role="status" aria-busy="true" aria-label={t('propertyWizard.rules.policy.loading')}>
            {[0, 1, 2, 3].map((slot) => (
              <Skeleton key={slot} className="h-24 w-full" />
            ))}
          </div>
        ) : policies.isError ? (
          <Alert
            variant="danger"
            data-testid="property-wizard-policies-error"
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => void policies.refetch()}>
                {t('propertyWizard.page.retry')}
              </Button>
            }
          >
            {getProblemMessage(policies.error, t) ?? t('propertyWizard.rules.policy.loadFailed')}
          </Alert>
        ) : (
          <ChoiceGroup legend={t('propertyWizard.rules.policy.legend')} minCardWidth={16}>
            {(policies.data ?? []).map((policy) => (
              <ChoiceCard
                key={policy.id}
                type="radio"
                value={policy.id}
                title={policy.name}
                description={cancellationPolicyLine(policy, t)}
                {...register('cancellationPolicyId')}
              />
            ))}
          </ChoiceGroup>
        )}

        {chosenPolicy === '' ? (
          <p className="flex items-start gap-2 pt-1 text-sm text-foreground/70" data-testid="property-wizard-policy-default">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t('propertyWizard.rules.policy.noneChosen')}
          </p>
        ) : null}
      </section>

      <p className="flex items-start gap-2 rounded-lg bg-muted p-4 text-sm text-foreground/80" data-testid="property-wizard-on-site-note">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t('propertyWizard.rules.onSite')}
      </p>

      <Field
        label={t('propertyWizard.rules.other.label')}
        optional
        hint={t('propertyWizard.rules.other.hint')}
        counter={`${houseRulesLength}/1000`}
        error={formState.errors.houseRules}
      >
        <Textarea rows={4} {...register('houseRules')} />
      </Field>
    </>
  );
}
