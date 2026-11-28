import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft } from 'lucide-react';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { propertyModePath, type ModeArea } from './paths';

export function useModeChangeMenuItems(area: ModeArea, propertyId: string): PageHeaderMenuItem[] {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);

  if (area === 'short-rent' || !workspace?.hasPermission(area, 'property.write')) return [];
  return [
    {
      label: t('propertyMode.entry.change'),
      icon: ArrowRightLeft,
      to: propertyModePath(area, propertyId),
      testId: 'property-mode-change',
    },
  ];
}
