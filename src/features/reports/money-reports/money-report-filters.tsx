import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PERIOD_PRESETS, type PeriodPresetId } from '@/features/reports/report-period';
import { shortDay } from './money-model';
import type { MoneyReportFilters as Filters } from './use-money-report-filters';

interface MoneyReportFiltersProps {
  filters: Filters;
  /** Prefix of the test ids (`<prefix>-period`, `-from`, `-to`, `-range`, `-property`, `-problem`). */
  testId: string;
}

/**
 * The filters of a money report: the period (the presets of the reports and the days to type, both days required) and, when the person
 * has more than one property, one property or all of them. A period the server would refuse is told here, before the call, and the
 * report is not asked for.
 */
export function MoneyReportFilters({ filters, testId }: MoneyReportFiltersProps) {
  const { t, i18n } = useTranslation();
  const { preset, custom, days, problem, propertyId, properties } = filters;

  return (
    <div className="space-y-2">
      <div role="group" aria-label={t('reports.dialog.period')} className="flex flex-wrap items-end gap-3" data-testid={`${testId}-filters`}>
        <Field label={t('reports.dialog.period')} className="w-full sm:w-56">
          <Select value={preset} onChange={(event) => filters.choosePreset(event.target.value as PeriodPresetId)} data-testid={`${testId}-period`}>
            {PERIOD_PRESETS.map((id) => (
              <option key={id} value={id}>
                {t(`reports.preset.${id}`)}
              </option>
            ))}
          </Select>
        </Field>

        {preset === 'custom' ? (
          <>
            <Field label={t('reports.dialog.customFrom')} className="w-full sm:w-44">
              <Input
                type="date"
                value={custom.from}
                min="2000-01-01"
                max="2100-12-31"
                required
                onChange={(event) => filters.changeCustom({ from: event.target.value })}
                data-testid={`${testId}-from`}
              />
            </Field>
            <Field label={t('reports.dialog.customTo')} className="w-full sm:w-44">
              <Input
                type="date"
                value={custom.to}
                min="2000-01-01"
                max="2100-12-31"
                required
                onChange={(event) => filters.changeCustom({ to: event.target.value })}
                data-testid={`${testId}-to`}
              />
            </Field>
          </>
        ) : (
          <p className="pb-2 text-sm text-foreground/70" data-testid={`${testId}-range`}>
            {t('reports.dialog.range', { from: shortDay(days.from, i18n.language), to: shortDay(days.to, i18n.language) })}
          </p>
        )}

        {properties.length > 1 ? (
          <Field label={t('reports.overview.filters.property')} className="w-full sm:w-60">
            <Select value={propertyId} onChange={(event) => filters.chooseProperty(event.target.value)} data-testid={`${testId}-property`}>
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

      {problem ? (
        // The server is not asked for days it would refuse: the page says why, and shows nothing of an earlier choice.
        <p role="alert" className="text-sm text-destructive" data-testid={`${testId}-problem`}>
          {t(`reports.error.${problem}`)}
        </p>
      ) : null}
    </div>
  );
}
