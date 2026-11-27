import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getProblemMessage } from '@/lib/api-errors';
import type { CalendarChangeRequest } from '@/types/calendar-changes.types';
import type { CalendarDayInfo, DayPriceSource } from '@/types/calendar-days.types';
import { formatDayPrice } from '../lib/day-layer';
import {
  KEEP,
  currentRules,
  dayRulesProblems,
  emptyDayRules,
  toChangeRequest,
  type CurrentRules,
  type CurrentValue,
  type DayRuleField,
  type DayRulesValues,
  type NumberRuleField,
  type RuleEdit,
} from '../lib/day-rules-model';
import type { DaySelection } from '../lib/day-selection';

/** The words of each source of a price, by key (`booking.calendar.day.source.*`), written out so that the i18n test finds a missing translation. */
const SOURCE_KEYS: Record<DayPriceSource, string> = {
  DayRule: 'booking.calendar.day.source.DayRule',
  Seasonal: 'booking.calendar.day.source.Seasonal',
  Weekend: 'booking.calendar.day.source.Weekend',
  Base: 'booking.calendar.day.source.Base',
};

const NUMBER_FIELDS: Record<Exclude<NumberRuleField, 'price'>, { label: string; unit: 'nights' | 'days' }> = {
  minNights: { label: 'booking.calendar.dayRules.minNights', unit: 'nights' },
  maxNights: { label: 'booking.calendar.dayRules.maxNights', unit: 'nights' },
  minAdvanceDays: { label: 'booking.calendar.dayRules.minAdvanceDays', unit: 'days' },
  maxAdvanceDays: { label: 'booking.calendar.dayRules.maxAdvanceDays', unit: 'days' },
};

const FLAG_FIELDS = {
  closedToArrival: 'booking.calendar.dayRules.closedToArrival',
  closedToDeparture: 'booking.calendar.dayRules.closedToDeparture',
} as const;

/** The restrictions in the order the form shows them. */
const RESTRICTION_FIELDS = ['minNights', 'maxNights', 'closedToArrival', 'closedToDeparture', 'minAdvanceDays', 'maxAdvanceDays'] as const;

interface DayRulesFormProps {
  /** `price`: one price per night; `restrictions`: the stay and the advance rules and the two closures. */
  mode: 'price' | 'restrictions';
  selection: DaySelection;
  /** The nights that change (the days of the selection that are not over), from the day layer; absent when the caller may not read it: no current value is shown. */
  days?: readonly CalendarDayInfo[];
  currency: string;
  /** The request is on its way: the buttons are off. */
  pending: boolean;
  /** The refusal of the last try, shown above the buttons. */
  error: unknown;
  onSubmit: (request: CalendarChangeRequest) => void;
}

/**
 * The form of a change of price or of rules for the days selected (E08/F05/US03/T02, NF-36): each value shows what it is now, is left as it is until the host types, and has a
 * "Clear" that removes the rule. The price is typed as text (`120`, `120,5`, `120.50`) and sent as the number typed, at most two decimals between 0,01 and 100.000: a price that
 * does not meet that is refused here, before anything is sent, and never rounded.
 */
export function DayRulesForm({ mode, selection, days, currency, pending, error, onSubmit }: DayRulesFormProps) {
  const { t, i18n } = useTranslation();
  const [values, setValues] = useState<DayRulesValues>(emptyDayRules);
  const [submitted, setSubmitted] = useState(false);
  const current = useMemo<CurrentRules | undefined>(() => (days ? currentRules(days) : undefined), [days]);
  const problems = dayRulesProblems(values);

  const edit = (field: DayRuleField, next: RuleEdit) => setValues((previous) => ({ ...previous, [field]: next }));
  const problemOf = (field: DayRuleField) => (submitted ? problems[field] : undefined);

  const handleSubmit = (event: FormEvent) => {
    // A form of a panel that sits inside the page: the page must not see the press of its button.
    event.preventDefault();
    event.stopPropagation();
    setSubmitted(true);
    if (Object.keys(problems).length > 0 || pending) return;
    onSubmit(toChangeRequest(selection, values));
  };

  const nowText = (value: CurrentValue<number | boolean>, kind: 'nights' | 'days' | 'flag'): string | undefined => {
    if (!current) return undefined;
    if (value.kind === 'mixed') return t('booking.calendar.dayRules.current.mixed');
    if (value.kind === 'none') return t('booking.calendar.dayRules.current.none');
    if (kind === 'flag') return t(value.value ? 'booking.calendar.dayRules.current.closed' : 'booking.calendar.dayRules.current.open');
    return t(`booking.calendar.dayRules.current.${kind}`, { count: Number(value.value) });
  };

  const clearButton = (field: DayRuleField, label: string, labelWhenCleared: string) => {
    const cleared = values[field].action === 'Clear';
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-pressed={cleared}
        disabled={pending}
        data-testid={`day-rule-clear-${field}`}
        onClick={() => edit(field, cleared ? KEEP : { action: 'Clear', text: '' })}
      >
        {cleared ? labelWhenCleared : label}
      </Button>
    );
  };

  const numberField = (field: Exclude<NumberRuleField, 'price'>) => {
    const { label, unit } = NUMBER_FIELDS[field];
    const rule = values[field];
    const now = current ? nowText(current[field] as CurrentValue<number>, unit) : undefined;
    return (
      <div key={field} className="space-y-2" data-testid={`day-rule-${field}`}>
        <Field label={t(label)} hint={rule.action === 'Clear' ? t('booking.calendar.dayRules.willClear') : now ? t('booking.calendar.dayRules.current.now', { value: now }) : undefined} error={problemOf(field)}>
          <Input
            inputMode="numeric"
            autoComplete="off"
            value={rule.action === 'Set' ? rule.text : ''}
            disabled={pending || rule.action === 'Clear'}
            onChange={(event) => edit(field, event.target.value.trim() === '' ? KEEP : { action: 'Set', text: event.target.value })}
          />
        </Field>
        {clearButton(field, t('booking.calendar.dayRules.clear'), t('booking.calendar.dayRules.keep'))}
      </div>
    );
  };

  const flagField = (field: keyof typeof FLAG_FIELDS) => {
    const rule = values[field];
    const now = current ? nowText(current[field], 'flag') : undefined;
    const currentlyOn = current?.[field].kind === 'value' && current[field].value === true;
    // What the box shows: what the host asked for, else what the days are now.
    const checked = rule.action === 'Set' ? true : rule.action === 'Clear' ? false : currentlyOn;
    return (
      <div key={field} className="space-y-2" data-testid={`day-rule-${field}`}>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-[color:var(--color-primary)]"
            checked={checked}
            disabled={pending}
            onChange={(event) => {
              // Back to what the days are now is "leave as it is"; anything else is the host's choice.
              if (event.target.checked === currentlyOn) edit(field, KEEP);
              else edit(field, event.target.checked ? { action: 'Set', text: '' } : { action: 'Clear', text: '' });
            }}
          />
          {t(FLAG_FIELDS[field])}
        </label>
        {now ? <p className="text-sm text-muted-foreground">{t('booking.calendar.dayRules.current.now', { value: now })}</p> : null}
        {rule.action === 'Clear' ? <p className="text-sm text-muted-foreground">{t('booking.calendar.dayRules.willClear')}</p> : null}
        {clearButton(field, t('booking.calendar.dayRules.clear'), t('booking.calendar.dayRules.keep'))}
      </div>
    );
  };

  const price = values.price;
  const priceNow = current?.priceCents;
  const priceNowText =
    priceNow?.kind === 'value'
      ? t('booking.calendar.dayRules.current.price', {
          price: formatDayPrice(priceNow.value, currency, i18n.language),
          source: current?.priceSource.kind === 'value' ? t(SOURCE_KEYS[current.priceSource.value]) : '',
        })
      : priceNow?.kind === 'mixed'
        ? t('booking.calendar.dayRules.current.mixedPrices')
        : undefined;

  // Nothing to go back to when no night has a price of its own (and the layer says so); without the layer the host cannot know, so the button is there.
  const priceClearButton = !current || current.hasPriceRule ? clearButton('price', t('booking.calendar.dayRules.backToUsual'), t('booking.calendar.dayRules.keepPrice')) : null;

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate data-testid={mode === 'price' ? 'day-price-form' : 'day-restrictions-form'}>
      {mode === 'price' ? (
        <div className="space-y-2">
          <Field
            label={t('booking.calendar.dayRules.price')}
            hint={price.action === 'Clear' ? t('booking.calendar.dayRules.priceWillClear') : t('booking.calendar.dayRules.priceHint')}
            error={problemOf('price')}
          >
            <Input
              inputMode="decimal"
              autoComplete="off"
              value={price.action === 'Set' ? price.text : ''}
              disabled={pending || price.action === 'Clear'}
              onChange={(event) => edit('price', event.target.value.trim() === '' ? KEEP : { action: 'Set', text: event.target.value })}
              data-testid="day-price-input"
            />
          </Field>
          {priceNowText ? <p className="text-sm text-muted-foreground" data-testid="day-price-now">{priceNowText}</p> : null}
          {priceClearButton}
        </div>
      ) : (
        <div className="space-y-5">
          {RESTRICTION_FIELDS.map((field) => (field === 'closedToArrival' || field === 'closedToDeparture' ? flagField(field) : numberField(field)))}
        </div>
      )}

      {submitted && problems.form ? (
        <p role="alert" className="text-sm text-destructive" data-testid="day-rules-nothing">
          {t(problems.form)}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive" data-testid="day-rules-error">
          {getProblemMessage(error, t) ?? t('booking.calendar.dayRules.saveFailed')}
        </p>
      ) : null}

      <Button type="submit" className="w-full sm:w-auto" loading={pending} disabled={pending} data-testid="day-rules-submit">
        {t(mode === 'price' ? 'booking.calendar.dayRules.savePrice' : 'booking.calendar.dayRules.saveRestrictions')}
      </Button>
    </form>
  );
}
