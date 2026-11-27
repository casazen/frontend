import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field, type FieldErrorInput } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { ChannelCommissionRuleSet } from '@/types';
import { commissionPercentText } from '../billing-wizard-model';
import type { BillingWizardValues } from '../billing-wizard-schema';

interface CommissionPercentsEditorProps {
  /** The rules of the portals and what applies today to each. */
  set: ChannelCommissionRuleSet;
  /** What the person typed, by portal: a portal that is not in it shows the percent that applies today. */
  typed: Record<string, string>;
  onChange: (channel: string, value: string) => void;
  /** What is wrong with the percent of a portal (a message or an i18n key), if anything. */
  errorOf?: (channel: string) => FieldErrorInput;
  disabled?: boolean;
}

/**
 * The percent each portal keeps when its reservation carries no commission (E13/F01/US01/T01, ⚖ R2), for the portals the server lists: the rule in force, or the default of
 * the configuration, which is said (`isDefault`) because nobody confirmed it yet. The editor only shows and reports what is typed: the step of the wizard keeps it in its form («Continua» saves
 * each percent as the agency's own rule) and the page of the channel commissions (E13/F02/US03/T01) keeps it in its own state, for the changes made after the setup. A portal that has no rule and
 * is left empty keeps none, and the stays of the portal without a commission are held back until it has one. A portal that has a rule in force and is emptied keeps that rule (a rule is closed or
 * changed by writing the new percent, never removed from here), and the field says so: an empty box is never read as «no rule» while the server goes on applying one.
 */
export function CommissionPercentsEditor({ set, typed, onChange, errorOf, disabled }: CommissionPercentsEditorProps) {
  const { t, i18n } = useTranslation();

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
              error={errorOf?.(row.channel)}
            >
              <Input
                inputMode="decimal"
                autoComplete="off"
                maxLength={6}
                placeholder="%"
                value={commissionPercentText(row, typed)}
                onChange={(event) => onChange(row.channel, event.target.value)}
                disabled={disabled}
                data-testid={`billing-commission-${row.channel}`}
              />
            </Field>
          );
        })}
      </div>
    </section>
  );
}

interface CommissionPercentsProps {
  /** The rules of the portals and what applies today to each. */
  set: ChannelCommissionRuleSet;
}

/** The editor in the form of the wizard: what is typed is a field of the form (`commissionPercents`), saved by «Continua». */
export function CommissionPercents({ set }: CommissionPercentsProps) {
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<BillingWizardValues>();
  const typed = useWatch({ control, name: 'commissionPercents' });

  return (
    <CommissionPercentsEditor
      set={set}
      typed={typed}
      onChange={(channel, value) => setValue('commissionPercents', { ...getValues('commissionPercents'), [channel]: value }, { shouldDirty: true })}
      errorOf={(channel) => errors.commissionPercents?.[channel]}
    />
  );
}
