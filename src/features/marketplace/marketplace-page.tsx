import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import { useServiceCategories } from '@/queries/use-service-categories';
import { CategoryTile } from './components/category-tile';
import { IntegrationCard } from './components/integration-card';
import { MarketplaceFrame } from './components/marketplace-frame';
import { PartnerCard } from './components/partner-card';
import { SupplierSearchBox } from './components/supplier-search-box';
import { SuppliersError, SuppliersLoading } from './components/suppliers-state';
import { countByCategory } from './lib/category-groups';
import { EXTERNAL_PARTNERS } from './lib/external-partners';
import { MARKETPLACE_QUERY_PARAM, MARKETPLACE_SEARCH_PATH, marketplaceHref } from './lib/marketplace-paths';
import { useMarketplaceProperty } from './lib/marketplace-property';
import { useIntegrations } from './lib/use-integrations';

const GRID = 'grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3';

/**
 * Scopri (MKT, spec #466 and the design of the marketplace "like the App Store"): the first page of the marketplace, in three groups
 * one under the other. «Fornitori CasaZen» is the categories of the services with the number of suppliers around the property, each
 * leading to its suppliers; then «Integrazioni con partner esterni» and «Altre integrazioni». The search is at the top (Enter leads to
 * the page of the search). Nothing that does not exist is shown: no ratings, no «Popolari», no «Novità», no app of a third party that
 * CasaZen does not offer.
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
      after={<DiscoverIntegrations />}
    >
      {({ property: current }) => <DiscoverSuppliers propertyId={current.id} />}
    </MarketplaceFrame>
  );
}

/** «Fornitori CasaZen», as the page of the categories used to show it: one tile for each category, with its suppliers around the property. */
function DiscoverSuppliers({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const suppliers = useMarketplaceSuppliers({ propertyId });
  const catalog = useServiceCategories();

  if (suppliers.isLoading || catalog.isLoading) return <SuppliersLoading />;
  if (suppliers.isError && !suppliers.data) return <SuppliersError error={suppliers.error} onRetry={() => void suppliers.refetch()} />;
  if (catalog.isError || !catalog.data) return <SuppliersError error={catalog.error} onRetry={() => void catalog.refetch()} />;

  const items = suppliers.data?.items ?? [];
  const counts = countByCategory(items);

  return (
    <PlainSection title={t('marketplace.casazenSuppliers')} data-testid="marketplace-suppliers-section">
      {items.length === 0 ? (
        <p className="py-1 text-sm text-muted-foreground" role="status" data-testid="marketplace-no-network">
          {t('marketplace.noNetwork')} {t('marketplace.noNetworkPartners')}
        </p>
      ) : null}
      <ul role="list" className={`${GRID} pt-2`} data-testid="marketplace-categories">
        {catalog.data.map((category) => (
          <li key={category} className="min-w-0">
            <CategoryTile category={category} count={counts.get(category) ?? 0} propertyId={propertyId} />
          </li>
        ))}
      </ul>
    </PlainSection>
  );
}

/** The two groups that do not look for suppliers: they do not wait for the comune of the property. */
function DiscoverIntegrations() {
  const { t } = useTranslation();
  const integrations = useIntegrations();

  return (
    <>
      <PlainSection title={t('marketplace.partners.title')} data-testid="marketplace-partners-section">
        <p className="text-sm text-foreground/70">{t('marketplace.partners.description')}</p>
        <ul role="list" className={`${GRID} pt-2`}>
          {EXTERNAL_PARTNERS.map((partner) => (
            <PartnerCard key={partner.code} partner={partner} />
          ))}
        </ul>
      </PlainSection>

      {integrations.length > 0 ? (
        <PlainSection title={t('marketplace.integrations.title')} data-testid="marketplace-integrations-section">
          <p className="text-sm text-foreground/70">{t('marketplace.integrations.description')}</p>
          <ul role="list" className={`${GRID} pt-2`}>
            {integrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </ul>
        </PlainSection>
      ) : null}
    </>
  );
}
