import { Compass, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RouteTabs, type RouteTabItem } from '@/components/ui/route-tabs';
import { MARKETPLACE_MINE_PATH, MARKETPLACE_PATH } from '../lib/marketplace-paths';

export type MarketplaceSection = 'discover' | 'mine';

interface MarketplaceTabsProps {
  section: MarketplaceSection;
}

export function MarketplaceTabs({ section }: MarketplaceTabsProps) {
  const { t } = useTranslation();

  const items: RouteTabItem[] = [
    {
      label: t('marketplace.sections.discover'),
      href: MARKETPLACE_PATH,
      current: section === 'discover',
      icon: Compass,
      testId: 'marketplace-section-discover',
    },
    {
      label: t('marketplace.sections.mine'),
      href: MARKETPLACE_MINE_PATH,
      current: section === 'mine',
      icon: Plug,
      testId: 'marketplace-section-mine',
    },
  ];

  return <RouteTabs label={t('marketplace.sections.label')} items={items} selectTestId="marketplace-section-select" />;
}
