import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { AdaptationFrequency, PricingAdapterConfig, SavePricingAdapterConfigRequest } from '@/types';
import { MAX_MULTIPLIER, MIN_MULTIPLIER, monthLabel, parseMultiplier, percentChange } from '../seasonal-rules';

interface PricingRulesSectionProps {
  config: PricingAdapterConfig;
  isSaving: boolean;
  onToggle: (enabled: boolean) => void;
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

/** The twelve months in two rows on a phone, one row on a computer: every month is a 44 px target. */
function MonthPicker({ season, selected, disabled, onToggle }: MonthPickerProps) {
  const { t, i18n } = useTranslation();
  return (
    <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-12" role="group" aria-label={t(`pricing.config.${season}Season`)}>
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

/**
 * The rules of the seasonal suggestions (the one section of the page that is a form): on or off, the seasons and the national
 * holidays with how much each moves the price, how often the suggestions are computed, and the button that saves it. No box
 * inside the section: groups are told apart by space and by their own titles.
 */
export function PricingRulesSection({ config, isSaving, onToggle, onSave }: PricingRulesSectionProps) {
  const { t } = useTranslation();
  const isEnabled = config.isEnabled;
  const [form, setForm] = useState<FormState>(() => toForm(config));

  // Sync local form state when server data changes (adjusting state during render)
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
      // A month belongs to one season only.
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
    <PlainSection title={t('pricing.config.rulesLabel')} data-testid="pricing-rules">
      <div className="max-w-2xl space-y-8 pt-2">
        {/* On or off */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="pricing-toggle" className="text-base leading-snug">
              {t('pricing.config.enableLabel')}
            </Label>
            <p id="pricing-toggle-hint" className="text-sm text-foreground/70">
              {t('pricing.config.enableDescription')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {isSaving ? <Spinner size="sm" /> : null}
            <Switch
              id="pricing-toggle"
              aria-describedby="pricing-toggle-hint"
              checked={isEnabled}
              disabled={isSaving}
              onCheckedChange={onToggle}
              data-testid="pricing-toggle"
            />
          </div>
        </div>

        <p className="text-sm text-foreground/70" data-testid="example-rule-note">
          {t('pricing.config.exampleRuleNote')}
        </p>

        {/* Seasons */}
        <div className="space-y-5">
          <div className="flex min-h-11 items-center gap-3">
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
              <div key={season} className="space-y-3">
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

        {/* National holidays */}
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

        {/* How often they are computed */}
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
    </PlainSection>
  );
}
