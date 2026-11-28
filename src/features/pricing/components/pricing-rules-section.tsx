import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { AdaptationFrequency, PricingAdapterConfig, SavePricingAdapterConfigRequest } from '@/types';
import { MAX_MULTIPLIER, MIN_MULTIPLIER, monthLabel, parseMultiplier, percentChange, ruleSentences } from '../seasonal-rules';

interface PricingRulesSectionProps {
  config: PricingAdapterConfig;
  isSaving: boolean;
  onSave: (data: SavePricingAdapterConfigRequest) => void;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const FREQUENCIES: readonly AdaptationFrequency[] = ['daily', 'weekly'];
type Season = 'high' | 'low';
const SEASONS: readonly Season[] = ['high', 'low'];

interface MultiplierFieldProps {
  id: string;
  value: string;
  parsed: number | null;
  disabled: boolean;
  onChange: (value: string) => void;
}

function MultiplierField({ id, value, parsed, disabled, onChange }: MultiplierFieldProps) {
  const { t, i18n } = useTranslation();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Label htmlFor={id} className="font-normal text-foreground/70">
          {t('pricing.config.multiplier')}
        </Label>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={MIN_MULTIPLIER}
          max={MAX_MULTIPLIER}
          step={0.05}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 pointer-coarse:min-h-11"
          aria-invalid={parsed === null}
          aria-describedby={parsed === null ? `${id}-error` : undefined}
          data-testid={id}
        />
        {parsed !== null && <span className="text-sm tabular-nums text-foreground/70">{percentChange(parsed, i18n.language)}</span>}
      </div>
      {parsed === null && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger-foreground">
          {t('pricing.config.multiplierInvalid', {
            min: new Intl.NumberFormat(i18n.language).format(MIN_MULTIPLIER),
            max: new Intl.NumberFormat(i18n.language).format(MAX_MULTIPLIER),
          })}
        </p>
      )}
    </div>
  );
}

interface MonthPickerProps {
  season: Season;
  selected: number[];
  disabled: boolean;
  onToggle: (month: number) => void;
}

function MonthPicker({ season, selected, disabled, onToggle }: MonthPickerProps) {
  const { t, i18n } = useTranslation();
  return (
    <div className="grid grid-cols-6 gap-1.5 @2xl:grid-cols-12" role="group" aria-label={t(`pricing.config.${season}Season`)}>
      {MONTHS.map((month) => {
        const active = selected.includes(month);
        return (
          <Button
            key={month}
            type="button"
            size="sm"
            variant={active ? 'default' : 'outline'}
            className="min-h-11 min-w-0 px-0"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onToggle(month)}
            data-testid={`${season}-month-${month}`}
          >
            {monthLabel(month, i18n.language)}
          </Button>
        );
      })}
    </div>
  );
}

interface FormState {
  frequency: AdaptationFrequency;
  includeSeasonality: boolean;
  highSeasonMonths: number[];
  highSeasonMultiplier: string;
  lowSeasonMonths: number[];
  lowSeasonMultiplier: string;
  includePublicHolidays: boolean;
  holidayMultiplier: string;
}

function toForm(config: PricingAdapterConfig): FormState {
  return {
    frequency: config.adaptationFrequency,
    includeSeasonality: config.includeSeasonality,
    highSeasonMonths: config.highSeasonMonths,
    highSeasonMultiplier: String(config.highSeasonMultiplier),
    lowSeasonMonths: config.lowSeasonMonths,
    lowSeasonMultiplier: String(config.lowSeasonMultiplier),
    includePublicHolidays: config.includePublicHolidays,
    holidayMultiplier: String(config.holidayMultiplier),
  };
}

export function PricingRulesSection({ config, isSaving, onSave }: PricingRulesSectionProps) {
  const { t, i18n } = useTranslation();
  const activeRules = ruleSentences(config, t, i18n.language);
  const isEnabled = config.isEnabled;
  const [form, setForm] = useState<FormState>(() => toForm(config));

  const [syncedConfig, setSyncedConfig] = useState(config);
  if (config !== syncedConfig) {
    setSyncedConfig(config);
    setForm(toForm(config));
  }

  const highMultiplier = parseMultiplier(form.highSeasonMultiplier);
  const lowMultiplier = parseMultiplier(form.lowSeasonMultiplier);
  const holidayMultiplier = parseMultiplier(form.holidayMultiplier);
  const isValid = highMultiplier !== null && lowMultiplier !== null && holidayMultiplier !== null;

  function toggleMonth(season: Season, month: number) {
    setForm((current) => {
      const own = season === 'high' ? current.highSeasonMonths : current.lowSeasonMonths;
      const other = season === 'high' ? current.lowSeasonMonths : current.highSeasonMonths;
      const nextOwn = own.includes(month) ? own.filter((m) => m !== month) : [...own, month].sort((a, b) => a - b);
      const nextOther = other.filter((m) => m !== month);
      return season === 'high'
        ? { ...current, highSeasonMonths: nextOwn, lowSeasonMonths: nextOther }
        : { ...current, lowSeasonMonths: nextOwn, highSeasonMonths: nextOther };
    });
  }

  function handleSave() {
    if (highMultiplier === null || lowMultiplier === null || holidayMultiplier === null) return;
    onSave({
      isEnabled,
      adaptationFrequency: form.frequency,
      includeSeasonality: form.includeSeasonality,
      highSeasonMonths: form.highSeasonMonths,
      highSeasonMultiplier: highMultiplier,
      lowSeasonMonths: form.lowSeasonMonths,
      lowSeasonMultiplier: lowMultiplier,
      includePublicHolidays: form.includePublicHolidays,
      holidayMultiplier,
    });
  }

  return (
    <div className="@container min-w-0 space-y-6" data-testid="pricing-rules">
      {activeRules.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {activeRules.map(rule => <li key={rule}>{rule}</li>)}
        </ul>
      )}
      <p className="text-sm text-foreground/70" data-testid="example-rule-note">
        {t('pricing.config.exampleRuleNote')}
      </p>

      <div className="grid grid-cols-1 gap-5 @5xl:grid-cols-2">
        <div className="flex min-h-11 items-center gap-3 @5xl:col-span-2">
          <Checkbox
            id="include-seasonality"
            className="size-5"
            checked={form.includeSeasonality}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, includeSeasonality: !!checked }))}
            data-testid="include-seasonality"
          />
          <Label htmlFor="include-seasonality" className="cursor-pointer text-base">
            {t('pricing.config.includeSeasonality')}
          </Label>
        </div>
        {SEASONS.map((season) => {
          const high = season === 'high';
          return (
            <div key={season} className="@container min-w-0 space-y-3">
              <p className="text-sm font-medium">{t(`pricing.config.${season}Season`)}</p>
              <MonthPicker
                season={season}
                selected={high ? form.highSeasonMonths : form.lowSeasonMonths}
                disabled={!form.includeSeasonality}
                onToggle={(month) => toggleMonth(season, month)}
              />
              <MultiplierField
                id={`${season}-season-multiplier`}
                value={high ? form.highSeasonMultiplier : form.lowSeasonMultiplier}
                parsed={high ? highMultiplier : lowMultiplier}
                disabled={!form.includeSeasonality}
                onChange={(value) =>
                  setForm((current) =>
                    high ? { ...current, highSeasonMultiplier: value } : { ...current, lowSeasonMultiplier: value }
                  )
                }
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex min-h-11 items-center gap-3">
          <Checkbox
            id="include-public-holidays"
            className="size-5"
            checked={form.includePublicHolidays}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, includePublicHolidays: !!checked }))}
            data-testid="include-public-holidays"
          />
          <Label htmlFor="include-public-holidays" className="cursor-pointer text-base">
            {t('pricing.config.includePublicHolidays')}
          </Label>
        </div>
        <p className="text-sm text-foreground/70">{t('pricing.config.holidaysHint')}</p>
        <MultiplierField
          id="holiday-multiplier"
          value={form.holidayMultiplier}
          parsed={holidayMultiplier}
          disabled={!form.includePublicHolidays}
          onChange={(value) => setForm((current) => ({ ...current, holidayMultiplier: value }))}
        />
      </div>

      <fieldset className="min-w-0 space-y-4">
        <legend className="mb-1 text-base font-medium">{t('pricing.config.frequencyLabel')}</legend>
        <div className="flex flex-col sm:flex-row sm:gap-8">
          {FREQUENCIES.map((frequency) => (
            <label key={frequency} className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="frequency"
                value={frequency}
                checked={form.frequency === frequency}
                onChange={() => setForm((current) => ({ ...current, frequency }))}
                className="size-5 accent-primary"
                data-testid={`frequency-${frequency}`}
              />
              <span className="text-sm">{t(`pricing.config.${frequency}`)}</span>
            </label>
          ))}
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-foreground/70">{t('pricing.config.lastRun')}</dt>
            <dd className="mt-0.5 break-words font-medium" data-testid="last-run">
              {config.lastAdaptedAt ? formatDateTime(config.lastAdaptedAt) : '—'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-foreground/70">{t('pricing.config.nextRun')}</dt>
            <dd className="mt-0.5 break-words font-medium" data-testid="next-run">
              {!isEnabled ? '—' : config.nextRunOn ? formatDate(config.nextRunOn) : t('pricing.config.nextNightlyRun')}
            </dd>
          </div>
        </dl>
      </fieldset>

      <Button
        type="button"
        onClick={handleSave}
        disabled={isSaving || !isValid}
        className="w-full sm:w-auto"
        data-testid="save-config-btn"
      >
        {isSaving ? <Spinner size="sm" /> : null}
        {isSaving ? t('pricing.config.saving') : t('pricing.config.save')}
      </Button>
    </div>
  );
}
