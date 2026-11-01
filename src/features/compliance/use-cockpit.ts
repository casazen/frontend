import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildCockpit, type CockpitModel } from '@/features/compliance/lib/cockpit-model';
import { useComplianceSummary } from '@/features/compliance/use-compliance';
import { useWorkspace } from '@/hooks/use-workspace';
import { useDashboardToday } from '@/queries/use-dashboard';
import { useProperties } from '@/queries/use-properties';

/**
 * The cockpit of the adempimenti as the host reads it, for the page `/compliance` and for the block of the Home: everything comes
 * from `GET api/compliance/summary`; the property of a stay (and its deadline, when the summary does not say it) from the Home's
 * "Da fare", and the state and the city of a property from the list of properties. When those are late or fail the rows do without
 * them. `model` is null until the summary arrives.
 */
export function useCockpit({ freshProperties = false }: { freshProperties?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const summary = useComplianceSummary();
  const today = useDashboardToday();
  // The page reads the properties again at every visit: it is where one comes back to see whether what was fixed is fixed.
  const properties = useProperties({ mode: 'short' }, { fresh: freshProperties });

  const propertyList = Array.isArray(properties.data) ? properties.data : undefined;
  const todo = today.data?.todo?.items;
  const locale = i18n.language;
  const model = useMemo<CockpitModel | null>(
    () => (summary.data ? buildCockpit(summary.data, { todo, properties: propertyList }, { t, locale, hasPermission, exists: (key) => i18n.exists(key) }) : null),
    [summary.data, todo, propertyList, t, locale, hasPermission, i18n],
  );

  return { model, summary };
}
