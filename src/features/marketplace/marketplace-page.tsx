import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import { useServiceCategories } from '@/queries/use-service-categories';
import { CategoryRow } from './components/category-row';
import { MarketplaceFrame } from './components/marketplace-frame';
import { SupplierSearchBox } from './components/supplier-search-box';
import { SuppliersError, SuppliersLoading } from './components/suppliers-state';
import { categoryRows } from './lib/category-groups';
import { MARKETPLACE_QUERY_PARAM, MARKETPLACE_SEARCH_PATH, marketplaceHref } from './lib/marketplace-paths';
import { useMarketplaceProperty } from './lib/marketplace-property';

/**
 * Scopri (MKT, spec #466 and the design of the marketplace "like the App Store"): the suppliers that work in the comune of a property
 * and the way to ask one of them for a job. The search is at the top (Enter leads to the page of the search); under it «Fornitori
 * CasaZen» has a row for each category that has suppliers around the property, the one with the most suppliers first. Nothing that
 * does not exist is shown: no ratings, no «Popolari», no «Novità».
 */
export function MarketplacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { property } = useMarketplaceProperty();

  return (
    <MarketplaceFrame
      section="discover"
      title={t('marketplace.title')}
      description={t('marketplace.description')}
      toolbar={
        <SupplierSearchBox
          onSearch={(words) => navigate(marketplaceHref(MARKETPLACE_SEARCH_PATH, property?.id, { [MARKETPLACE_QUERY_PARAM]: words.trim() }))}
        />
      }
    >
      {({ property: current }) => <DiscoverSuppliers propertyId={current.id} />}
    </MarketplaceFrame>
  );
}

function DiscoverSuppliers({ propertyId }: { propertyId: string }) {
  const { t, i18n } = useTranslation();
  const suppliers = useMarketplaceSuppliers({ propertyId });
  const catalog = useServiceCategories();

  if (suppliers.isLoading || catalog.isLoading) return <SuppliersLoading />;
  if (suppliers.isError && !suppliers.data) return <SuppliersError error={suppliers.error} onRetry={() => void suppliers.refetch()} />;
  if (catalog.isError || !catalog.data) return <SuppliersError error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const rows = categoryRows(suppliers.data?.items ?? [], catalog.data, (category) => getServiceCategoryLabel(category, t), i18n.language);

  return (
    <PlainSection title={t('marketplace.casazenSuppliers')} data-testid="marketplace-suppliers-section">
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground" role="status" data-testid="marketplace-no-network">
          {t('marketplace.noNetwork')}
        </p>
      ) : (
        <div className="space-y-8 pt-2">
          {rows.map((row) => (
            <CategoryRow key={row.category} category={row.category} suppliers={row.suppliers} propertyId={propertyId} />
          ))}
        </div>
      )}
    </PlainSection>
  );
}
