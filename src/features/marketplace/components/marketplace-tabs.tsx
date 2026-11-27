import { Compass, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RouteTabs, type RouteTabItem } from '@/components/ui/route-tabs';
import { MARKETPLACE_MINE_PATH, MARKETPLACE_PATH } from '../lib/marketplace-paths';

/**
 * The tabs of the marketplace: each is a page of its own. A search, a category and the page of a supplier belong to Scopri, which shows
 * the categories itself (the tab «Categorie» was folded into it).
 */
export type MarketplaceSection = 'discover' | 'mine';

interface MarketplaceTabsProps {
  /** The tab the page is. */
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
