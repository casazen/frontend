import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { ChannelCommissionRuleSet } from '@/types';
import { commissionPercentText } from '../billing-wizard-model';
import type { BillingWizardValues } from '../billing-wizard-schema';

interface CommissionPercentsProps {
  /** The rules of the portals and what applies today to each. */
  set: ChannelCommissionRuleSet;
}

/**
 * The percent each portal keeps when its reservation carries no commission (E13/F01/US01/T01, ⚖ R2), for the portals the server lists: the rule in force, or the default of
 * the configuration, which is said (`isDefault`) because nobody confirmed it yet. Accepting the percent that is shown is what confirms the step: «Continua» saves each percent
 * as the agency's own rule. A portal that has no rule and is left empty keeps none, and the stays of the portal without a commission are held back until it has one. A portal that
 * has a rule in force and is emptied keeps that rule (a rule is closed or changed by writing the new percent, never removed from here), and the field says so: an empty box is never
 * read as «no rule» while the server goes on applying one.
 */
export function CommissionPercents({ set }: CommissionPercentsProps) {
  const { t, i18n } = useTranslation();
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<BillingWizardValues>();
  const typed = useWatch({ control, name: 'commissionPercents' });

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="billing-commissions-title" data-testid="billing-commissions">
      <div className="space-y-1">
        <h3 id="billing-commissions-title" className="text-base font-semibold">
          {t('billingWizard.channels.commissions.title')}
        </h3>
        <p className="text-sm text-foreground/70">{t('billingWizard.channels.commissions.hint')}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {set.channels.map((row) => {
          const sourceKey = `booking.source.${row.channel}`;
          const own = typed[row.channel];
          // The rule in force of the portal, if there is one: emptying the box does not remove it.
          const percentInForce = row.ruleId && typeof row.percent === 'number' ? row.percent : null;
          const kept = own !== undefined && own.trim() === '' ? percentInForce : null;
          return (
            <Field
              key={row.channel}
              label={i18n.exists(sourceKey) ? t(sourceKey) : row.channel}
              hint={
                kept !== null
                  ? t('billingWizard.channels.commissions.keepsInForce', { percent: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(kept) })
                  : own !== undefined
                  ? undefined
                  : row.percent === null || row.percent === undefined
                    ? t('billingWizard.channels.commissions.none')
                    : row.isDefault
                      ? t('billingWizard.channels.commissions.default')
                      : t('billingWizard.channels.commissions.inForce')
              }
              error={errors.commissionPercents?.[row.channel]}
            >
              <Input
                inputMode="decimal"
                autoComplete="off"
                maxLength={6}
                placeholder="%"
                value={commissionPercentText(row, typed)}
                onChange={(event) => setValue('commissionPercents', { ...getValues('commissionPercents'), [row.channel]: event.target.value }, { shouldDirty: true })}
                data-testid={`billing-commission-${row.channel}`}
              />
            </Field>
          );
        })}
      </div>
    </section>
  );
}
