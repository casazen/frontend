import { useTranslation } from 'react-i18next';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import { CategoryTile } from './components/category-tile';
import { MarketplaceFrame } from './components/marketplace-frame';
import { SuppliersError, SuppliersLoading } from './components/suppliers-state';
import { countByCategory } from './lib/category-groups';
import { MARKETPLACE_PATH } from './lib/marketplace-paths';

/**
 * Categorie (MKT): the categories of the catalog (`GET api/service-categories`, all of them), each with the number of suppliers that
 * offer it around the property; a category with none says so and leads to its page, which tells the network is not there yet.
 */
export function MarketplaceCategoriesPage() {
  const { t } = useTranslation();

  return (
    <MarketplaceFrame
      section="categories"
      title={t('marketplace.categories.title')}
      description={t('marketplace.categories.description')}
      trail={[{ label: t('marketplace.title'), path: MARKETPLACE_PATH }, { label: t('marketplace.categories.title') }]}
    >
      {({ property }) => <CategoryTiles propertyId={property.id} />}
    </MarketplaceFrame>
  );
}

function CategoryTiles({ propertyId }: { propertyId: string }) {
  const suppliers = useMarketplaceSuppliers({ propertyId });
  const catalog = useServiceCategories();

  if (suppliers.isLoading || catalog.isLoading) return <SuppliersLoading />;
  if (suppliers.isError && !suppliers.data) return <SuppliersError error={suppliers.error} onRetry={() => void suppliers.refetch()} />;
  if (catalog.isError || !catalog.data) return <SuppliersError error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const counts = countByCategory(suppliers.data?.items ?? []);

  return (
    <ul role="list" className="grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="marketplace-categories">
      {catalog.data.map((category) => (
        <li key={category} className="min-w-0">
          <CategoryTile category={category} count={counts.get(category) ?? 0} propertyId={propertyId} />
        </li>
      ))}
    </ul>
  );
}
