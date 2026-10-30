import { useParams } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/shared/empty-state';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import { MarketplaceFrame } from './components/marketplace-frame';
import { SupplierResults } from './components/supplier-results';
import { MARKETPLACE_CATEGORIES_PATH, MARKETPLACE_PATH, marketplaceHref } from './lib/marketplace-paths';
import { useSupplierFilters } from './lib/use-supplier-filters';

/**
 * The page of a category (MKT): every supplier around the property that offers it, in the order the person chooses (name, price,
 * fastest answer) and, if wanted, only the verified ones. A code that is not in the catalog is not a category: it says so.
 */
export function MarketplaceCategoryPage() {
  const { t } = useTranslation();
  const { category = '' } = useParams();
  const label = getServiceCategoryLabel(category, t);

  return (
    <MarketplaceFrame
      section="categories"
      title={label}
      description={t('marketplace.category.description')}
      trail={[
        { label: t('marketplace.title'), path: MARKETPLACE_PATH },
        { label: t('marketplace.categories.title'), path: MARKETPLACE_CATEGORIES_PATH },
        { label },
      ]}
    >
      {({ property }) => <CategorySuppliers category={category} propertyId={property.id} />}
    </MarketplaceFrame>
  );
}

function CategorySuppliers({ category, propertyId }: { category: string; propertyId: string }) {
  const { t } = useTranslation();
  const catalog = useServiceCategories();
  const filters = useSupplierFilters();
  const known = catalog.data?.includes(category) ?? true;
  // Nothing is asked for a code that is not a category: the API would refuse it (422).
  const query = useMarketplaceSuppliers({ propertyId: known ? propertyId : undefined, category, sort: filters.sort });

  if (!known) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title={t('marketplace.category.notFound')}
        description={t('marketplace.category.notFoundHint')}
        action={{ label: t('marketplace.category.seeAll'), href: marketplaceHref(MARKETPLACE_CATEGORIES_PATH, propertyId) }}
        className="py-8"
      />
    );
  }

  return (
    <div data-testid="marketplace-category-page">
      <SupplierResults query={query} filters={filters} emptyText={t('marketplace.noNetwork')} />
    </div>
  );
}
