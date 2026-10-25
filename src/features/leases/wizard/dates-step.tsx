import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { formatStayDate, isStayDate, todayInRome } from '@/lib/stay-dates';
import type { LeaseOrigin, LongRentRules } from '@/types';
import { ReadMark } from './reading-marks';
import { addMonths, periodEnd, termMonthsOf, type WizardValues } from './wizard-model';

/**
 * Step ④ «Durata e date» (LR-06a): the day the contract starts, and in plain words what follows from it. Every figure of the summary
 * comes from the server (`rules`: the term of the type, the renewal, the months of notice, the days to register); the end is the
 * term of the type counted from the start, except for a contract already signed, which states its own last day.
 */
export function DatesStep({ rules, origin }: { rules: LongRentRules; origin: LeaseOrigin }) {
  const { t, i18n } = useTranslation();
  const { control, register, formState } = useFormContext<WizardValues>();
  const [startDate, endDate, contractType] = useWatch({ control, name: ['startDate', 'endDate', 'contractType'] });
  const imported = origin === 'Imported';

  const months = termMonthsOf(rules, contractType);
  const renewalMonths = rules.renewalMonths[contractType] ?? null;
  const startValid = isStayDate(startDate);
  const typedEnd = imported && isStayDate(endDate) ? endDate : '';
  const end = typedEnd || (startValid && months !== null ? periodEnd(startDate, months) : '');
  const day = (date: string) => formatStayDate(date, i18n.language);
  // «4 anni» for 48 months, «30 mesi» for 30: the length as people say it.
  const length = (count: number) => (count % 12 === 0 ? t('leaseWizard.dates.years', { count: count / 12 }) : t('leaseWizard.dates.months', { count }));
  const inThePast = startValid && !imported && startDate < todayInRome();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Field label={t('leaseWizard.dates.start')} hint={imported ? undefined : t('leaseWizard.dates.startHint')} error={formState.errors.startDate}>
            <Input id="lw-startDate" type="date" {...register('startDate')} />
          </Field>
          <ReadMark step={4} fields={['startDate']} name="startDate" />
        </div>
        {imported ? (
          <div className="space-y-1.5">
            <Field
              label={t('leaseWizard.dates.end')}
              optional={contractType !== 'Transitorio'}
              hint={
                contractType === 'Transitorio'
                  ? t('leaseWizard.dates.endHintTransitory', { min: rules.transitoryTermMonths.min, max: rules.transitoryTermMonths.max })
                  : t('leaseWizard.dates.endHint')
              }
              error={formState.errors.endDate}
            >
              <Input id="lw-endDate" type="date" {...register('endDate')} />
            </Field>
            <ReadMark step={4} fields={['endDate']} name="endDate" />
          </div>
        ) : null}
      </div>

      {inThePast ? (
        <Alert variant="warning" data-testid="lease-start-in-past">
          {t('leaseWizard.dates.inThePast', { count: rules.registrationDays })}
        </Alert>
      ) : null}

      {startValid && end ? (
        <section className="space-y-2" aria-labelledby="lw-summary-title" data-testid="lease-term-summary">
          <h3 id="lw-summary-title" className="text-sm font-semibold">
            {t('leaseWizard.dates.summaryTitle')}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm" aria-live="polite">
            <li>
              {months !== null && !typedEnd
                ? t('leaseWizard.dates.summary.lasts', { length: length(months), from: day(startDate), to: day(end) })
                : t('leaseWizard.dates.summary.span', { from: day(startDate), to: day(end) })}
            </li>
            {renewalMonths !== null ? <li>{t('leaseWizard.dates.summary.renews', { length: length(renewalMonths) })}</li> : null}
            {renewalMonths !== null ? (
              <li>{t('leaseWizard.dates.summary.notice', { count: rules.noticeMonths, date: day(addMonths(end, -rules.noticeMonths)) })}</li>
            ) : null}
            <li>{t('leaseWizard.dates.summary.register', { count: rules.registrationDays })}</li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}
