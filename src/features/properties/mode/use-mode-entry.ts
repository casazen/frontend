import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft } from 'lucide-react';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { propertyModePath, type ModeArea } from './paths';

/** The change of mode exists only behind the backend flag `PropertyModeChange`: off, nothing of it is on screen. */
export function usePropertyModeEnabled(): boolean {
  return useFeatureFlags().flags.propertyModeChange;
}

/**
 * The entry "Cambia modalità" of the menu "⋯" of the page of a property: the wizard of the section the property is in. Nothing
 * while the flag is off, nor for who may not write the property (the API asks for the same permission). The workspace is read
 * as it is, without `useWorkspace`, which refuses to run outside its provider: a page rendered on its own simply has no entry.
 */
export function useModeChangeMenuItems(area: ModeArea, propertyId: string): PageHeaderMenuItem[] {
  const { t } = useTranslation();
  const enabled = usePropertyModeEnabled();
  const workspace = useContext(WorkspaceContext);

  if (!enabled || !workspace?.hasPermission(area, 'property.write')) return [];
  return [
    {
      label: t('propertyMode.entry.change'),
      icon: ArrowRightLeft,
      to: propertyModePath(area, propertyId),
      testId: 'property-mode-change',
    },
  ];
}
