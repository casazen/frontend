import { useCallback, useMemo, useState } from 'react';
import type { ReportPeriod } from '@/api/reports.api';
import { basicPeriodProblem, presetPeriod, type PeriodPresetId } from '@/features/reports/report-period';
import { useWorkspace } from '@/hooks/use-workspace';
import { todayInRome } from '@/lib/stay-dates';
import { useProperties } from '@/queries/use-properties';

interface MoneyReportFilterState {
  preset: PeriodPresetId;
  custom: ReportPeriod;
  propertyId: string;
}

type MoneyPeriodProblem = ReturnType<typeof basicPeriodProblem>;

export interface MoneyReportFilters {
  preset: PeriodPresetId;
  custom: ReportPeriod;
  days: ReportPeriod;
  problem: MoneyPeriodProblem;
  propertyId: string;
  properties: ReadonlyArray<{ id: string; name: string }>;
  choosePreset: (preset: PeriodPresetId) => void;
  changeCustom: (change: Partial<ReportPeriod>) => void;
  chooseProperty: (propertyId: string) => void;
}

/**
 * The filters of a money report page (period and property), shared by the collections and the channel costs: the presets of the reports
 * and the days to type, with the checks of every report (`basicPeriodProblem`, the ones `periodProblem` makes for a report that is not
 * fiscal), and the properties of the short-stay list. The days are Europe/Rome calendar days, `yyyy-MM-dd`, and both are required.
 *
 * The list of the properties is another permission than the report's (`property.read`, not `payment.read`): for who may not read the
 * properties the server answers 403, which on a read sends the whole app to the page of the missing access, so it is not asked for at all
 * and the report simply covers every property of the person's scope, with no property to choose.
 */
export function useMoneyReportFilters(defaultPreset: Exclude<PeriodPresetId, 'custom'>): MoneyReportFilters {
  const today = todayInRome();
  const { hasPermission } = useWorkspace();
  const mayListProperties = hasPermission('short-rent', 'property.read');
  const [state, setState] = useState<MoneyReportFilterState>(() => ({
    preset: defaultPreset,
    custom: presetPeriod(defaultPreset, today),
    propertyId: '',
  }));
  const propertyQuery = useProperties({ mode: 'short' }, { enabled: mayListProperties });
  const properties = useMemo(
    () => (mayListProperties && Array.isArray(propertyQuery.data) ? propertyQuery.data : []),
    [mayListProperties, propertyQuery.data],
  );

  const days = state.preset === 'custom' ? state.custom : presetPeriod(state.preset, today);
  const propertyId = properties.some((property) => property.id === state.propertyId) ? state.propertyId : '';

  const choosePreset = useCallback(
    (preset: PeriodPresetId) =>
      setState((current) => ({
        ...current,
        preset,
        custom: preset === 'custom' ? (current.preset === 'custom' ? current.custom : presetPeriod(current.preset, todayInRome())) : current.custom,
      })),
    [],
  );
  const changeCustom = useCallback((change: Partial<ReportPeriod>) => setState((current) => ({ ...current, custom: { ...current.custom, ...change } })), []);
  const chooseProperty = useCallback((next: string) => setState((current) => ({ ...current, propertyId: next })), []);

  return { preset: state.preset, custom: state.custom, days, problem: basicPeriodProblem(days), propertyId, properties, choosePreset, changeCustom, chooseProperty };
}
