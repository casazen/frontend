import { useParams } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/shared/empty-state';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import { MarketplaceFrame } from './components/marketplace-frame';
import { SupplierResults } from './components/supplier-results';
import { MARKETPLACE_PATH } from './lib/marketplace-paths';
import { useSupplierFilters } from './lib/use-supplier-filters';

export function MarketplaceCategoryPage() {
  const { t } = useTranslation();
  const { category = '' } = useParams();
  const label = getServiceCategoryLabel(category, t);

  return (
    <MarketplaceFrame
      section="discover"
      title={label}
      crumbs={[{ label: t('marketplace.title'), to: MARKETPLACE_PATH }, { label }]}
    >
      <CategorySuppliers category={category} />
    </MarketplaceFrame>
  );
}

function CategorySuppliers({ category }: { category: string }) {
  const { t } = useTranslation();
  const catalog = useServiceCategories();
  const filters = useSupplierFilters();
  const known = catalog.data?.includes(category) ?? true;
  const query = useMarketplaceSuppliers({ accountScope: known, category, sort: filters.sort });

  if (!known) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title={t('marketplace.category.notFound')}
        description={t('marketplace.category.notFoundHint')}
        action={{ label: t('marketplace.category.seeAll'), href: MARKETPLACE_PATH }}
        className="py-8"
      />
    );
  }

  return (
    <div data-testid="marketplace-category-page">
      <SupplierResults query={query} filters={filters} emptyText={t('marketplace.categories.none')} />
    </div>
  );
}
