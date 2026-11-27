import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { buildCockpit, type CockpitModel } from '@/features/compliance/lib/cockpit-model';
import { useComplianceSummary } from '@/features/compliance/use-compliance';
import { useWorkspace } from '@/hooks/use-workspace';
import { useDashboardToday } from '@/queries/use-dashboard';
import { useProperties } from '@/queries/use-properties';

export function useCockpit({ freshProperties = false }: { freshProperties?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const summary = useComplianceSummary();
  const today = useDashboardToday();
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
