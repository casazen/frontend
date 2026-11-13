import { useContext, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormContext, useWatch } from 'react-hook-form';
import type { TFunction } from 'i18next';
import { Plug, PlugZap } from 'lucide-react';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { translateValidationMessage } from '@/i18n/validation-message';
import { getProblemMessage } from '@/lib/api-errors';
import { addDays, formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useProperties } from '@/queries/use-properties';
import { usePreviewCalendarChange } from '@/queries/use-calendar-changes';
import { WEEKDAYS, type CalendarChangePreview, type CalendarChangeValues, type Weekday } from '@/types/calendar-changes.types';
import { formatDayPrice } from '../lib/day-layer';
import { KEEP, type DayRuleField, type DayRulesValues, type FieldAction, type NumberRuleField } from '../lib/day-rules-model';
import { BULK_CHANGE_STEP, BULK_MAX_PROPERTIES, changedFields, firstInvalidStep, periodDays, toChangeRequest, type BulkChangeValues } from '../lib/bulk-change-model';
import { useDayLayer } from '../lib/use-day-layer';

/** A Monday: the weekday names are read from the days that follow it. */
const A_MONDAY = '2026-01-05';

/** The words of each value of a night, by key, written out so that the i18n test finds a missing translation. */
const FIELD_KEYS: Record<DayRuleField, { name: string; what: string }> = {
  price: { name: 'booking.calendar.bulk.fields.price', what: 'booking.calendar.bulk.summary.what.price' },
  minNights: { name: 'booking.calendar.bulk.fields.minNights', what: 'booking.calendar.bulk.summary.what.minNights' },
  maxNights: { name: 'booking.calendar.bulk.fields.maxNights', what: 'booking.calendar.bulk.summary.what.maxNights' },
  closedToArrival: { name: 'booking.calendar.bulk.fields.closedToArrival', what: 'booking.calendar.bulk.summary.what.closedToArrival' },
  closedToDeparture: { name: 'booking.calendar.bulk.fields.closedToDeparture', what: 'booking.calendar.bulk.summary.what.closedToDeparture' },
  minAdvanceDays: { name: 'booking.calendar.bulk.fields.minAdvanceDays', what: 'booking.calendar.bulk.summary.what.minAdvanceDays' },
  maxAdvanceDays: { name: 'booking.calendar.bulk.fields.maxAdvanceDays', what: 'booking.calendar.bulk.summary.what.maxAdvanceDays' },
};

const NUMBER_UNIT: Record<NumberRuleField, 'currency' | 'nights' | 'days'> = {
  price: 'currency',
  minNights: 'nights',
  maxNights: 'nights',
  minAdvanceDays: 'days',
  maxAdvanceDays: 'days',
};

const FLAG_FIELDS: readonly DayRuleField[] = ['closedToArrival', 'closedToDeparture'];
const FIELD_ORDER: readonly DayRuleField[] = ['price', 'minNights', 'maxNights', 'closedToArrival', 'closedToDeparture', 'minAdvanceDays', 'maxAdvanceDays'];

/** The message of a field in error, in words (the schemas of the wizard give i18n keys). */
function useErrorText() {
  const { t, i18n } = useTranslation();
  return (message: string | undefined) => translateValidationMessage(message, t, i18n);
}

/* --------------------------------------------------------------------------------------------------------------------- Properties */

/**
 * Step 1: the short-rent properties the host may write (the page is for who has `property.write`, and the API narrows the list to what the caller reaches), several
 * choosable, each with whether it is connected to the channel manager. Where that is not known (the days could not be read, or the caller may not read them) nothing is said about it.
 */
export function PropertiesStep() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { control, setValue, formState: { errors } } = useFormContext<BulkChangeValues>();
  const values = useWatch({ control }) as BulkChangeValues;
  const properties = useProperties({ mode: 'short' });
  const list = Array.isArray(properties.data) ? properties.data : [];
  const canRead = useContext(WorkspaceContext)?.hasPermission('short-rent', 'property.read') ?? false;
  // With the connector of the channel manager off nothing is sent there: the step says nothing about it.
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const today = todayInRome();
  const { layer } = useDayLayer(canRead ? { from: today, to: today } : undefined, canRead);
  const chosen = values.propertyIds ?? [];

  const choose = (ids: string[]) => setValue('propertyIds', ids, { shouldDirty: true });
  const toggle = (id: string, on: boolean) => choose(on ? [...chosen.filter((other) => other !== id), id] : chosen.filter((other) => other !== id));
  const message = errorText((errors.propertyIds as { message?: string } | undefined)?.message);

  return (
    <div className="min-w-0 space-y-3" data-testid="bulk-properties-step">
      {properties.isError ? (
        <p role="alert" className="text-sm text-destructive" data-testid="bulk-properties-error">
          {t('booking.form.propertiesLoadError')}
        </p>
      ) : null}
      {!properties.isLoading && !properties.isError && list.length === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="bulk-properties-empty">
          {t('booking.form.noProperties')}
        </p>
      ) : null}

      {list.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => choose(list.slice(0, BULK_MAX_PROPERTIES).map((property) => property.id))} data-testid="bulk-select-all">
            {t('booking.calendar.bulk.properties.all')}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => choose([])} data-testid="bulk-select-none">
            {t('booking.calendar.bulk.properties.none')}
          </Button>
        </div>
      ) : null}

      <ul className="space-y-2" role="list">
        {list.map((property) => {
          const mirrored = connectorOn ? layer?.get(property.id)?.mirrored : undefined;
          const Icon = mirrored ? PlugZap : Plug;
          return (
            <li key={property.id}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-[color:var(--color-primary)]"
                  checked={chosen.includes(property.id)}
                  onChange={(event) => toggle(property.id, event.target.checked)}
                  data-testid="bulk-property"
                  data-property-id={property.id}
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">{property.name}</span>
                  {property.city ? <span className="block break-words text-sm text-foreground/70">{property.city}</span> : null}
                  {mirrored !== undefined ? (
                    <span className="mt-1 flex items-center gap-1.5 text-sm text-foreground/80" data-testid="bulk-property-connection" data-mirrored={mirrored}>
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      {t(mirrored ? 'booking.calendar.bulk.properties.connected' : 'booking.calendar.bulk.properties.notConnected')}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {message ? (
        <p role="alert" className="text-sm text-destructive" data-testid="bulk-properties-problem">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------------------------------- Period */

/** Step 2: from and to (at most 366 days, not entirely over) and the weekdays to touch. */
export function PeriodStep() {
  const { t, i18n } = useTranslation();
  const { control, register, setValue, formState: { errors } } = useFormContext<BulkChangeValues>();
  const values = useWatch({ control }) as BulkChangeValues;
  const days = periodDays(values.from, values.to);
  const weekdays = values.weekdays ?? [];

  const toggle = (weekday: Weekday, on: boolean) => setValue('weekdays', WEEKDAYS.filter((other) => (other === weekday ? on : weekdays.includes(other))), { shouldDirty: true });

  return (
    <div className="min-w-0 space-y-6" data-testid="bulk-period-step">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="bulk-from" label={t('booking.calendar.bulk.period.from')} error={errors.from}>
          {(field) => <Input {...field} type="date" {...register('from')} />}
        </Field>
        <Field
          id="bulk-to"
          label={t('booking.calendar.bulk.period.to')}
          error={errors.to}
          hint={days > 0 ? t('booking.calendar.bulk.period.days', { count: days }) : undefined}
        >
          {(field) => <Input {...field} type="date" min={todayInRome()} {...register('to')} />}
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('booking.calendar.bulk.period.weekdays')}</legend>
        <p className="text-sm text-foreground/70">{t('booking.calendar.bulk.period.weekdaysHint')}</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((weekday, index) => (
            <label key={weekday} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-[color:var(--color-primary)]"
                checked={weekdays.includes(weekday)}
                onChange={(event) => toggle(weekday, event.target.checked)}
                data-testid={`bulk-weekday-${weekday}`}
              />
              {formatStayDate(addDays(A_MONDAY, index), i18n.language, { weekday: 'long' })}
            </label>
          ))}
        </div>
        {errors.weekdays ? (
          <p role="alert" className="text-sm text-destructive" data-testid="bulk-weekdays-problem">
            {t((errors.weekdays as { message?: string }).message ?? BULK_WEEKDAYS_FALLBACK)}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}

const BULK_WEEKDAYS_FALLBACK = 'booking.calendar.bulk.errors.weekdaysRequired';

/* ------------------------------------------------------------------------------------------------------------------------ Changes */

/** The choices of a value: leave it as it is, set it (a flag is closed), clear it (a flag is opened again). */
function actionLabel(flag: boolean, action: FieldAction, t: TFunction): string {
  if (action === 'Keep') return t('booking.calendar.bulk.changes.keep');
  if (action === 'Set') return t(flag ? 'booking.calendar.bulk.changes.close' : 'booking.calendar.bulk.changes.set');
  return t(flag ? 'booking.calendar.bulk.changes.reopen' : 'booking.calendar.bulk.changes.clear');
}

/**
 * Step 3: the seven values of a night, each "leave as is", "set" or "clear"; at least one must change. The price is typed as text and sent as the number typed, at most two
 * decimals between 0,01 and 100.000, exactly as in the panel of the days.
 */
export function ChangesStep() {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { control, setValue, formState: { errors } } = useFormContext<BulkChangeValues>();
  const rules = (useWatch({ control }) as BulkChangeValues).rules;
  const ruleErrors = errors.rules as ({ message?: string } & Partial<Record<DayRuleField, { text?: { message?: string } }>>) | undefined;

  const edit = (field: DayRuleField, next: DayRulesValues[DayRuleField]) => setValue(`rules.${field}`, next, { shouldDirty: true });

  return (
    <div className="min-w-0 space-y-6" data-testid="bulk-changes-step">
      {FIELD_ORDER.map((field) => {
        const flag = FLAG_FIELDS.includes(field);
        const rule = rules[field];
        const unit = flag ? null : NUMBER_UNIT[field as NumberRuleField];
        return (
          <div key={field} className="space-y-2" data-testid={`bulk-rule-${field}`}>
            <Segmented<FieldAction>
              label={t(FIELD_KEYS[field].name)}
              value={rule.action}
              onValueChange={(action) => edit(field, action === 'Keep' ? KEEP : { action, text: action === 'Set' ? rule.text : '' })}
              options={(['Keep', 'Set', 'Clear'] as const).map((action) => ({
                value: action,
                label: actionLabel(flag, action, t),
                testId: `bulk-rule-${field}-${action}`,
              }))}
            />
            <p className="text-sm font-medium">{t(FIELD_KEYS[field].name)}</p>
            {rule.action === 'Set' && unit ? (
              <Field
                label={t(unit === 'currency' ? 'booking.calendar.bulk.changes.priceLabel' : unit === 'nights' ? 'booking.calendar.bulk.changes.nightsLabel' : 'booking.calendar.bulk.changes.daysLabel')}
                hint={unit === 'currency' ? t('booking.calendar.dayRules.priceHint') : undefined}
                error={errorText(ruleErrors?.[field]?.text?.message)}
              >
                <Input
                  inputMode={unit === 'currency' ? 'decimal' : 'numeric'}
                  autoComplete="off"
                  value={rule.text}
                  onChange={(event) => edit(field, { action: 'Set', text: event.target.value })}
                  data-testid={`bulk-rule-${field}-input`}
                />
              </Field>
            ) : null}
          </div>
        );
      })}
      {errorText(ruleErrors?.message) ? (
        <p role="alert" className="text-sm text-destructive" data-testid="bulk-changes-problem">
          {errorText(ruleErrors?.message)}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------------------ Summary */

type PreviewMutation = ReturnType<typeof usePreviewCalendarChange>;

/** What a value is, in words, for the before and after of a sample night. */
function valueText(field: DayRuleField, values: CalendarChangeValues, currency: string, language: string, t: TFunction): string {
  switch (field) {
    case 'price':
      return formatDayPrice(values.priceCents, currency, language);
    case 'minNights':
      return t('booking.calendar.dayRules.current.nights', { count: values.minNights });
    case 'maxNights':
      return values.maxNights === undefined ? t('booking.calendar.dayRules.current.none') : t('booking.calendar.dayRules.current.nights', { count: values.maxNights });
    case 'closedToArrival':
      return t(values.closedToArrival ? 'booking.calendar.dayRules.current.closed' : 'booking.calendar.dayRules.current.open');
    case 'closedToDeparture':
      return t(values.closedToDeparture ? 'booking.calendar.dayRules.current.closed' : 'booking.calendar.dayRules.current.open');
    case 'minAdvanceDays':
      return values.minAdvanceDays === undefined ? t('booking.calendar.dayRules.current.none') : t('booking.calendar.dayRules.current.days', { count: values.minAdvanceDays });
    default:
      return values.maxAdvanceDays === undefined ? t('booking.calendar.dayRules.current.none') : t('booking.calendar.dayRules.current.days', { count: values.maxAdvanceDays });
  }
}

/** The values of a night that differ before and after, as "Prezzo: 100 € → 120 €". */
function diffTexts(before: CalendarChangeValues, after: CalendarChangeValues, currency: string, language: string, t: TFunction): string[] {
  return FIELD_ORDER.filter((field) => valueText(field, before, currency, language, t) !== valueText(field, after, currency, language, t)).map((field) =>
    t('booking.calendar.bulk.summary.diff', {
      field: t(FIELD_KEYS[field].name),
      from: valueText(field, before, currency, language, t),
      to: valueText(field, after, currency, language, t),
    }),
  );
}

/** What the answers of the wizard are, as the lines of the summary ("Edit" goes back to the step that gives each). */
function summaryItems(values: BulkChangeValues, names: (id: string) => string, t: TFunction, language: string): WizardSummaryItem[] {
  const days = periodDays(values.from, values.to);
  const period = `${formatStayDate(values.from, language)} - ${formatStayDate(values.to, language)} (${t('booking.calendar.bulk.period.days', { count: days })})`;
  const weekdays =
    values.weekdays.length === WEEKDAYS.length
      ? ''
      : WEEKDAYS.filter((weekday) => values.weekdays.includes(weekday))
          .map((weekday) => formatStayDate(addDays(A_MONDAY, WEEKDAYS.indexOf(weekday)), language, { weekday: 'long' }))
          .join(', ');
  const changes = changedFields(values.rules).map((field) => {
    const rule = values.rules[field];
    const flag = FLAG_FIELDS.includes(field);
    const what = rule.action === 'Set' ? (flag ? t('booking.calendar.bulk.changes.close') : rule.text.trim()) : actionLabel(flag, 'Clear', t);
    return `${t(FIELD_KEYS[field].name)}: ${what}`;
  });
  return [
    { id: 'properties', label: t('booking.calendar.bulk.steps.properties.label'), value: values.propertyIds.map(names).join(', '), stepId: BULK_CHANGE_STEP.properties },
    { id: 'period', label: t('booking.calendar.bulk.steps.period.label'), value: weekdays ? `${period} · ${weekdays}` : period, stepId: BULK_CHANGE_STEP.period },
    {
      id: 'changes',
      label: t('booking.calendar.bulk.steps.changes.label'),
      value: changes.length > 0 ? (
        <ul className="list-none space-y-0.5 font-normal">
          {changes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null,
      stepId: BULK_CHANGE_STEP.changes,
    },
  ];
}

interface SummaryStepProps {
  /** The preview, owned by the page: its state decides whether the last button is offered. */
  preview: PreviewMutation;
}

/**
 * Step 4, the summary (UX-05): the answers with "Edit", then what would happen, in plain words, from `POST /api/calendar/changes/preview`: what changes on how many days of how
 * many properties, which properties the change is also sent to the channel manager for (and about how many calls it would use: an estimate, said so) and which stay in CasaZen,
 * per property the days that change and the days skipped (past days, days with a booking), and the first changes as before and after. Nothing is sent before the last button.
 */
export function SummaryStep({ preview }: SummaryStepProps) {
  const { t, i18n } = useTranslation();
  const { control } = useFormContext<BulkChangeValues>();
  const values = useWatch({ control }) as BulkChangeValues;
  const properties = useProperties({ mode: 'short' });
  const canRead = useContext(WorkspaceContext)?.hasPermission('short-rent', 'property.read') ?? false;
  const today = todayInRome();
  const { layer } = useDayLayer(canRead ? { from: today, to: today } : undefined, canRead);

  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const names = (id: string) => (Array.isArray(properties.data) ? properties.data : []).find((property) => property.id === id)?.name ?? '';
  // A draft or an address can open the wizard here with answers that do not meet the rules of the steps before: nothing is asked, and the step that is wrong is said.
  const invalidStep = firstInvalidStep(values);
  const requestKey = invalidStep ? null : JSON.stringify(toChangeRequest(values));
  const { mutate } = preview;
  useEffect(() => {
    if (requestKey) mutate(JSON.parse(requestKey) as Parameters<typeof mutate>[0]);
  }, [requestKey, mutate]);

  const items = summaryItems(values, names, t, i18n.language);
  const data = requestKey && preview.isSuccess ? preview.data : undefined;

  return (
    <div className="min-w-0 space-y-4" data-testid="bulk-summary-step">
      <WizardSummary items={items} />

      {invalidStep ? (
        <Alert variant="warning" data-testid="bulk-summary-invalid" title={t('booking.calendar.bulk.summary.invalidTitle')}>
          {t(`booking.calendar.bulk.summary.invalid.${invalidStep}`)}
        </Alert>
      ) : preview.isError ? (
        <div className="space-y-2" data-testid="bulk-summary-error">
          <Alert variant="danger" title={t('booking.calendar.bulk.summary.previewFailed')}>
            {getProblemMessage(preview.error, t) ?? t('booking.calendar.bulk.summary.previewFailedHint')}
          </Alert>
          <Button type="button" variant="outline" onClick={() => requestKey && mutate(JSON.parse(requestKey) as Parameters<typeof mutate>[0])} data-testid="bulk-summary-retry">
            {t('booking.calendar.bulk.summary.retry')}
          </Button>
        </div>
      ) : data ? (
        <PreviewBody preview={data} values={values} names={names} currencyOf={(id) => layer?.get(id)?.currency ?? 'EUR'} connectorOn={connectorOn} />
      ) : (
        <p role="status" aria-busy="true" className="text-sm text-foreground/70" data-testid="bulk-summary-loading">
          {t('booking.calendar.bulk.summary.loading')}
        </p>
      )}
    </div>
  );
}

interface PreviewBodyProps {
  preview: CalendarChangePreview;
  values: BulkChangeValues;
  names: (id: string) => string;
  currencyOf: (id: string) => string;
  /** The connector of the channel manager is on: only then does the summary speak of the channel manager, of the room and of the quota. */
  connectorOn: boolean;
}

function PreviewBody({ preview, values, names, currencyOf, connectorOn }: PreviewBodyProps) {
  const { t, i18n } = useTranslation();
  const what = new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' }).format(changedFields(values.rules).map((field) => t(FIELD_KEYS[field].what)));
  const days = Math.max(0, ...preview.properties.map((property) => property.days));
  const roomMissing = new Set(preview.warnings.filter((warning) => warning.code === 'room_not_chosen').map((warning) => warning.propertyId));

  const lines: ReactNode[] = connectorOn ? preview.properties.map((property) => {
    const name = property.name || names(property.propertyId);
    if (roomMissing.has(property.propertyId)) return <li key={property.propertyId}>{t('booking.calendar.bulk.summary.roomNotChosen', { name })}</li>;
    return property.mirrored ? (
      <li key={property.propertyId}>{t('booking.calendar.bulk.summary.mirrored', { name, count: property.estimatedQuotaUnits })}</li>
    ) : (
      <li key={property.propertyId}>{t('booking.calendar.bulk.summary.notMirrored', { name })}</li>
    );
  }) : [];

  return (
    <div className="space-y-4" data-testid="bulk-summary-preview">
      <div className="space-y-2 rounded-md border bg-muted/40 p-4 text-sm" data-testid="bulk-summary-words">
        <p className="font-medium">{t('booking.calendar.bulk.summary.headline', { what, days, count: preview.properties.length })}</p>
        {lines.length > 0 ? <ul className="list-disc space-y-1 pl-5">{lines}</ul> : null}
        {connectorOn && preview.estimatedQuotaUnits > 0 ? <p data-testid="bulk-summary-quota">{t('booking.calendar.bulk.summary.quota', { count: preview.estimatedQuotaUnits })}</p> : null}
        {preview.changedDays === 0 ? <p data-testid="bulk-summary-nothing">{t('booking.calendar.bulk.summary.nothingChanges')}</p> : null}
        <p className="text-foreground/70">{t('booking.calendar.bulk.summary.nothingSent')}</p>
      </div>

      <ul className="space-y-3" role="list">
        {preview.properties.map((property) => {
          const currency = currencyOf(property.propertyId);
          return (
            <li key={property.propertyId} className="space-y-2 rounded-md border p-4 text-sm" data-testid="bulk-summary-property">
              <p className="break-words font-semibold">{property.name || names(property.propertyId)}</p>
              <ul className="list-none space-y-0.5" role="list">
                <li>{t('booking.calendar.bulk.summary.changed', { count: property.changedDays })}</li>
                {property.unchangedDays > 0 ? <li>{t('booking.calendar.bulk.summary.unchanged', { count: property.unchangedDays })}</li> : null}
                {property.skippedPastDays > 0 ? <li data-testid="bulk-summary-skipped-past">{t('booking.calendar.bulk.summary.skippedPast', { count: property.skippedPastDays })}</li> : null}
                {property.takenDays > 0 ? <li data-testid="bulk-summary-taken">{t('booking.calendar.bulk.summary.taken', { count: property.takenDays })}</li> : null}
              </ul>
              {property.samples.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-foreground/70">{t('booking.calendar.bulk.summary.samples')}</p>
                  <ul className="list-none space-y-0.5" role="list">
                    {property.samples.map((sample) => (
                      <li key={sample.date} data-testid="bulk-summary-sample">
                        <span className="font-medium">{formatStayDate(sample.date, i18n.language, { day: 'numeric', month: 'long' })}</span>
                        {': '}
                        {diffTexts(sample.before, sample.after, currency, i18n.language, t).join(' · ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
