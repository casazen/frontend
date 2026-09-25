import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';
import { CalendarRange, RefreshCw, Save } from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { AdaptationFrequency, PricingAdapterConfig, SavePricingAdapterConfigRequest } from '@/types';
import { MAX_MULTIPLIER, MIN_MULTIPLIER, monthLabel, parseMultiplier, percentChange } from '../seasonal-rules';

interface PricingConfigCardProps {
  config: PricingAdapterConfig | undefined;
  isSaving: boolean;
  isRecalculating: boolean;
  onToggle: (enabled: boolean) => void;
  onSave: (data: SavePricingAdapterConfigRequest) => void;
  onRecalculate: () => void;
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
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
          className="h-8 w-24"
          aria-invalid={parsed === null}
          data-testid={id}
        />
        {parsed !== null && (
          <span className="text-xs text-muted-foreground">{percentChange(parsed, i18n.language)}</span>
        )}
      </div>
      {parsed === null && (
        <p role="alert" className="text-xs text-destructive">
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
    <div className="flex flex-wrap gap-1" role="group" aria-label={t(`pricing.config.${season}Season`)}>
      {MONTHS.map((month) => {
        const active = selected.includes(month);
        return (
          <Button
            key={month}
            type="button"
            size="sm"
            variant={active ? 'default' : 'outline'}
            className="h-7 px-2 text-xs"
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

function toForm(config: PricingAdapterConfig | undefined): FormState {
  return {
    frequency: config?.adaptationFrequency ?? 'daily',
    includeSeasonality: config?.includeSeasonality ?? true,
    highSeasonMonths: config?.highSeasonMonths ?? [],
    highSeasonMultiplier: String(config?.highSeasonMultiplier ?? 1),
    lowSeasonMonths: config?.lowSeasonMonths ?? [],
    lowSeasonMultiplier: String(config?.lowSeasonMultiplier ?? 1),
    includePublicHolidays: config?.includePublicHolidays ?? true,
    holidayMultiplier: String(config?.holidayMultiplier ?? 1),
  };
}

export function PricingConfigCard({
  config,
  isSaving,
  isRecalculating,
  onToggle,
  onSave,
  onRecalculate,
}: PricingConfigCardProps) {
  const { t } = useTranslation();
  const isEnabled = config?.isEnabled ?? false;
  const [form, setForm] = useState<FormState>(() => toForm(config));

  // Sync local form state when server data changes (adjusting state during render)
  const [syncedConfig, setSyncedConfig] = useState(config);
  if (config !== syncedConfig) {
    setSyncedConfig(config);
    if (config) setForm(toForm(config));
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            <CardTitle>{t('pricing.config.title')}</CardTitle>
          </div>
          <Badge variant={isEnabled ? 'success' : 'secondary'}>
            {isEnabled ? t('pricing.config.active') : t('pricing.config.disabled')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable / disable toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="pricing-toggle" className="text-sm font-medium">
              {t('pricing.config.enableLabel')}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('pricing.config.enableDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && <Spinner className="h-4 w-4" />}
            <Switch
              id="pricing-toggle"
              checked={isEnabled}
              disabled={isSaving}
              onCheckedChange={onToggle}
              data-testid="pricing-toggle"
            />
          </div>
        </div>

        {/* Frequency selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('pricing.config.frequencyLabel')}</Label>
          <div className="flex gap-4">
            {FREQUENCIES.map((frequency) => (
              <label key={frequency} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="frequency"
                  value={frequency}
                  checked={form.frequency === frequency}
                  onChange={() => setForm((current) => ({ ...current, frequency }))}
                  className="accent-primary"
                  data-testid={`frequency-${frequency}`}
                />
                <span className="text-sm">{t(`pricing.config.${frequency}`)}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">{t('pricing.config.rulesLabel')}</Label>
            <p className="text-xs text-muted-foreground mt-0.5" data-testid="example-rule-note">
              {t('pricing.config.exampleRuleNote')}
            </p>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-seasonality"
                checked={form.includeSeasonality}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, includeSeasonality: !!checked }))}
                data-testid="include-seasonality"
              />
              <Label htmlFor="include-seasonality" className="text-sm cursor-pointer">
                {t('pricing.config.includeSeasonality')}
              </Label>
            </div>
            {SEASONS.map((season) => {
              const high = season === 'high';
              return (
                <div key={season} className="space-y-2">
                  <p className="text-xs font-medium">{t(`pricing.config.${season}Season`)}</p>
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

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-public-holidays"
                checked={form.includePublicHolidays}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, includePublicHolidays: !!checked }))}
                data-testid="include-public-holidays"
              />
              <Label htmlFor="include-public-holidays" className="text-sm cursor-pointer">
                {t('pricing.config.includePublicHolidays')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">{t('pricing.config.holidaysHint')}</p>
            <MultiplierField
              id="holiday-multiplier"
              value={form.holidayMultiplier}
              parsed={holidayMultiplier}
              disabled={!form.includePublicHolidays}
              onChange={(value) => setForm((current) => ({ ...current, holidayMultiplier: value }))}
            />
          </div>
        </div>

        {/* Timestamps */}
        {config && (
          <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
            <div>
              <span className="text-muted-foreground text-xs">{t('pricing.config.lastRun')}</span>
              <p className="font-medium text-xs mt-0.5" data-testid="last-run">
                {config.lastAdaptedAt ? formatDateTime(config.lastAdaptedAt) : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t('pricing.config.nextRun')}</span>
              <p className="font-medium text-xs mt-0.5" data-testid="next-run">
                {!isEnabled
                  ? '—'
                  : config.nextRunOn
                    ? formatDate(config.nextRunOn)
                    : t('pricing.config.nextNightlyRun')}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2 border-t pt-4">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !isValid}
            className="w-full"
            data-testid="save-config-btn"
          >
            {isSaving ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? t('pricing.config.saving') : t('pricing.config.save')}
          </Button>

          {isEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRecalculate}
              disabled={isRecalculating}
              className="w-full"
              data-testid="recalculate-btn"
            >
              {isRecalculating ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isRecalculating ? t('pricing.config.recalculating') : t('pricing.config.recalculateNow')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
