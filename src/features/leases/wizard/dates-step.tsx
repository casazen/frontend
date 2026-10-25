import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatStayDate, isStayDate, todayInRome } from '@/lib/stay-dates';
import type { LeaseOrigin, LeasePeriodConflict, LongRentRules } from '@/types';
import { PeriodConflictNotice } from './period-conflict-notice';
import { ReadMark } from './reading-marks';
import { TRANSITORY_DOCUMENTATION_MAX_LENGTH, addMonths, makesItsNeed, periodEnd, termDays, termMonthsOf, type WizardValues } from './wizard-model';

/**
 * Step ④ «Durata e date» (LR-06a): the day the contract starts, and in plain words what follows from it. Every figure of the summary
 * comes from the server (`rules`: the term of the type, the renewal, the months of notice, the days to register); the end is the
 * term of the type counted from the start, except for a contract already signed and for a transitory one, which state their own last day.
 *
 * A transitory contract made in CasaZen (TR) is from 1 to 18 months, typed here, and does not renew; when it lasts more days than the
 * server says (`rules.transitoryDocumentationAfterDays`) the need it states at step ③ is proved with documents attached to the contract,
 * and this is where they are asked, because the term that decides it is typed here.
 *
 * Another lease of the same property that covers some of the same days (LR-OVERLAP, `flow.periodConflict`) is told here, with the link to
 * it, as soon as the dates are there: two leases cannot cover the same days, and the review will not let this one through.
 */
export function DatesStep({
  rules,
  origin,
  periodConflict = null,
}: {
  rules: LongRentRules;
  origin: LeaseOrigin;
  periodConflict?: LeasePeriodConflict | null;
}) {
  const { t, i18n } = useTranslation();
  const { control, register, formState } = useFormContext<WizardValues>();
  const [startDate, endDate, contractType, documentation] = useWatch({
    control,
    name: ['startDate', 'endDate', 'contractType', 'transitoryDocumentation'],
  });
  const imported = origin === 'Imported';
  const transitory = contractType === 'Transitorio';
  const statesEnd = imported || transitory;

  const months = termMonthsOf(rules, contractType);
  const renewalMonths = rules.renewalMonths[contractType] ?? null;
  const startValid = isStayDate(startDate);
  const typedEnd = statesEnd && isStayDate(endDate) ? endDate : '';
  const needsDocumentation = makesItsNeed({ contractType }, origin) && termDays(startDate, endDate) > rules.transitoryDocumentationAfterDays;
  const end = typedEnd || (startValid && months !== null ? periodEnd(startDate, months) : '');
  const day = (date: string) => formatStayDate(date, i18n.language);
  // «4 anni» for 48 months, «30 mesi» for 30: the length as people say it.
  const length = (count: number) => (count % 12 === 0 ? t('leaseWizard.dates.years', { count: count / 12 }) : t('leaseWizard.dates.months', { count }));
  const inThePast = startValid && !imported && startDate < todayInRome();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Field label={t('leaseWizard.dates.start')} hint={imported ? undefined : t('leaseWizardGuide.fields.start.hint')} error={formState.errors.startDate}>
            <Input id="lw-startDate" type="date" {...register('startDate')} />
          </Field>
          <ReadMark step={4} fields={['startDate']} name="startDate" />
        </div>
        {statesEnd ? (
          <div className="space-y-1.5">
            <Field
              label={imported ? t('leaseWizard.dates.end') : t('leaseWizard.transitory.endLabel')}
              optional={!transitory}
              hint={
                transitory
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

      {needsDocumentation ? (
        <Field
          label={t('leaseWizard.transitory.documentation.label')}
          hint={t('leaseWizard.transitory.documentation.hint', { count: rules.transitoryDocumentationAfterDays })}
          counter={`${documentation.length}/${TRANSITORY_DOCUMENTATION_MAX_LENGTH}`}
        >
          <Textarea id="lw-transitoryDocumentation" rows={2} maxLength={TRANSITORY_DOCUMENTATION_MAX_LENGTH} {...register('transitoryDocumentation')} />
        </Field>
      ) : null}

      {periodConflict ? <PeriodConflictNotice conflict={periodConflict} /> : null}

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
            {transitory ? <li>{t('leaseWizard.transitory.summaryEnds')}</li> : null}
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
