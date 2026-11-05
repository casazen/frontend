import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportPeriod } from '@/api/reports.api';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PERIOD_PRESETS, type PeriodPresetId } from '@/features/reports/report-period';
import type { OverviewGrouping, OverviewState } from './overview-model';

interface OverviewFiltersProps {
  state: OverviewState;
  /** The days the period stands for now: the days to type start from them. */
  days: ReportPeriod;
  properties: ReadonlyArray<{ id: string; name: string }>;
  /** The property in force (already checked against the list), or an empty string. */
  propertyId: string;
  /** The ways the figures can be cut that this caller is offered, in order. */
  groupings: readonly OverviewGrouping[];
  onChange: (change: Partial<OverviewState>) => void;
}

/**
 * The filters of the overview of the Reports page: the period (the presets of the downloads and the days to type, the same checks),
 * one property or all, the comparison with last year and how the figures are cut. With one property there is nothing to choose
 * between, so the property is not asked.
 */
export function OverviewFilters({ state, days, properties, propertyId, groupings, onChange }: OverviewFiltersProps) {
  const { t } = useTranslation();
  const compareId = useId();

  const choosePreset = (preset: PeriodPresetId) => {
    // The days to type start from the ones the person was looking at.
    onChange(preset === 'custom' ? { preset, custom: days } : { preset });
  };

  return (
    <div role="group" aria-label={t('reports.overview.filters.label')} data-testid="reports-overview-filters" className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('reports.overview.filters.period')} className="w-full sm:w-56">
          <Select
            value={state.preset}
            onChange={(event) => choosePreset(event.target.value as PeriodPresetId)}
            data-testid="reports-overview-period"
          >
            {PERIOD_PRESETS.map((id) => (
              <option key={id} value={id}>
                {t(`reports.preset.${id}`)}
              </option>
            ))}
          </Select>
        </Field>

        {state.preset === 'custom' ? (
          <>
            <Field label={t('reports.dialog.customFrom')} className="w-full sm:w-44">
              <Input
                type="date"
                value={state.custom.from}
                min="2000-01-01"
                max="2100-12-31"
                onChange={(event) => onChange({ custom: { ...state.custom, from: event.target.value } })}
                data-testid="reports-overview-from"
              />
            </Field>
            <Field label={t('reports.dialog.customTo')} className="w-full sm:w-44">
              <Input
                type="date"
                value={state.custom.to}
                min="2000-01-01"
                max="2100-12-31"
                onChange={(event) => onChange({ custom: { ...state.custom, to: event.target.value } })}
                data-testid="reports-overview-to"
              />
            </Field>
          </>
        ) : null}

        {properties.length > 1 ? (
          <Field label={t('reports.overview.filters.property')} className="w-full sm:w-60">
            <Select value={propertyId} onChange={(event) => onChange({ propertyId: event.target.value })} data-testid="reports-overview-property">
              <option value="">{t('reports.overview.filters.allProperties')}</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Segmented<OverviewGrouping>
          label={t('reports.overview.groupBy.label')}
          options={groupings.map((id) => ({ value: id, label: t(`reports.overview.groupBy.${id}`), testId: `reports-overview-group-${id}` }))}
          value={state.grouping}
          onValueChange={(grouping) => onChange({ grouping })}
          testId="reports-overview-group"
        />
        <div className="flex min-h-11 items-center gap-3">
          <Switch id={compareId} checked={state.compare} onCheckedChange={(compare) => onChange({ compare })} data-testid="reports-overview-compare" />
          <Label htmlFor={compareId} className="cursor-pointer leading-snug">
            {t('reports.overview.compare')}
          </Label>
        </div>
      </div>
    </div>
  );
}
