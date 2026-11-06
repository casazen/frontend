import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useMarketplaceCatalog } from '@/queries/use-marketplace';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import { useServiceCategories } from '@/queries/use-service-categories';
import type { MarketplaceCardStatus, MarketplaceCatalogEntry, MarketplaceGroupId } from '@/types';
import { CategoryTile } from './components/category-tile';
import { MarketplaceEntryCard } from './components/marketplace-entry-card';
import { MarketplaceEntryDrawer } from './components/marketplace-entry-drawer';
import { MarketplaceFrame } from './components/marketplace-frame';
import { ChannelManagerOffNote, MarketplaceCards, MarketplaceGroup, MarketplaceGroupError } from './components/marketplace-group';
import { SupplierSearchBox } from './components/supplier-search-box';
import { SuppliersError, SuppliersLoading } from './components/suppliers-state';
import { countByCategory } from './lib/category-groups';
import { CHANNEL_MANAGER_GROUP_IDS, channelManagerAvailable, findMarketplaceGroup } from './lib/marketplace-entry';
import { MARKETPLACE_QUERY_PARAM, MARKETPLACE_SEARCH_PATH, marketplaceHref } from './lib/marketplace-paths';
import { useMarketplaceProperty } from './lib/marketplace-property';
import { useIntegrations, type Integration, type IntegrationId } from './lib/use-integrations';

/** Where each of CasaZen's own integrations stands among the groups: the calendars are a sales channel, the card payments a tool. */
const BUILT_IN_GROUP: Record<IntegrationId, MarketplaceGroupId> = { calendars: 'salesChannels', payments: 'connectedTools' };

const BUILT_IN_STATUS: Record<'active' | 'pending' | 'inactive', MarketplaceCardStatus> = {
  active: 'Active',
  pending: 'Pending',
  inactive: 'NotActive',
};

type CatalogQuery = ReturnType<typeof useMarketplaceCatalog>;

/**
 * Scopri (MKT-01, spec #466 and the design of the marketplace «like the App Store»): the first page of the marketplace, in five groups
 * one under the other: Sales channels, Connected tools and Channel manager functions (the first three wait for the channel manager),
 * Home services (the categories of the services, each leading to its suppliers, as the page always had them) and Partners. Every card
 * but the categories comes from the catalog of the server, plus CasaZen's own integrations (the calendars and the card payments),
 * which the page has always shown. The search is at the top (Enter leads to the page of the search). Nothing that does not exist is
 * shown: no ratings, no «Popolari», no «Novità», no price that the catalog did not give, no partner written in the page.
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
      before={<ChannelManagerGroups />}
      after={
        <>
          <PartnersGroup />
          {/* The detail card of an integration: open while the address has `?entry=`, so that it can be shared. */}
          <MarketplaceEntryDrawer />
        </>
      }
    >
      {({ property: current }) => <HomeServicesGroup propertyId={current.id} />}
    </MarketplaceFrame>
  );
}

/** The card of one of CasaZen's own integrations: an entry in the format of the catalog, with its icon, its page and its status. */
function integrationCardProps(integration: Integration, t: TFunction) {
  const key = `marketplace.integrations.items.${integration.id}`;
  const status = integration.status === 'loading' || integration.status === 'unknown' ? null : BUILT_IN_STATUS[integration.status];
  const entry: MarketplaceCatalogEntry = {
    kind: 'Tool',
    code: integration.id,
    name: t(`${key}.title`),
    logoUrl: null,
    benefit: t(`${key}.summary`),
    // CasaZen has no price for them in the page: it is not specified, never invented.
    cost: { text: null, invoicedBy: 'Unknown' },
    status: status ?? 'NotActive',
    statusScope: 'Org',
    canActivate: true,
    reason: null,
  };

  return {
    entry,
    testId: `marketplace-integration-${integration.id}`,
    builtIn: {
      href: integration.href,
      icon: integration.icon,
      detail: status === 'Active' ? t(`${key}.detail`, { count: integration.count ?? 0 }) : null,
      showStatus: status !== null,
    },
  };
}

/** The first three groups. They do not look for suppliers, so they do not wait for the comune of the property. */
function ChannelManagerGroups() {
  const { property } = useMarketplaceProperty();
  const catalog = useMarketplaceCatalog(property?.id);
  const integrations = useIntegrations();

  return (
    <>
      {CHANNEL_MANAGER_GROUP_IDS.map((id) => (
        <CatalogGroup
          key={id}
          id={id}
          propertyId={property?.id}
          catalog={catalog}
          integrations={integrations.filter((integration) => BUILT_IN_GROUP[integration.id] === id)}
        />
      ))}
    </>
  );
}

interface CatalogGroupProps {
  id: MarketplaceGroupId;
  propertyId: string | undefined;
  catalog: CatalogQuery;
  /** CasaZen's own integrations of this group: they are there whatever the catalog says. */
  integrations: Integration[];
}

/**
 * A group that waits for the channel manager: CasaZen's own integrations, then the cards of the catalog. While the channel manager is
 * not available or not connected the cards of the catalog are replaced by a sentence and the way to connect it.
 */
function CatalogGroup({ id, propertyId, catalog, integrations }: CatalogGroupProps) {
  const { t } = useTranslation();
  const data = catalog.data;
  const waiting = data !== undefined && !channelManagerAvailable(data);
  const entries = data && !waiting ? (findMarketplaceGroup(data, id)?.entries ?? []) : [];

  const cards = [
    ...integrations.map((integration) => {
      const { entry, testId, builtIn } = integrationCardProps(integration, t);
      return <MarketplaceEntryCard key={`built-in-${integration.id}`} entry={entry} propertyId={propertyId} builtIn={builtIn} testId={testId} />;
    }),
    ...entries.map((entry) => <MarketplaceEntryCard key={`${entry.kind}:${entry.code}`} entry={entry} propertyId={propertyId} />),
  ];

  return (
    <MarketplaceGroup id={id}>
      {cards.length > 0 ? <MarketplaceCards>{cards}</MarketplaceCards> : null}
      {catalog.isPending ? (
        <SkeletonLine lines={2} label={t('marketplace.loading')} className="pt-2" />
      ) : !data ? (
        <MarketplaceGroupError onRetry={() => void catalog.refetch()} />
      ) : waiting ? (
        <ChannelManagerOffNote groupId={id} />
      ) : cards.length === 0 ? (
        <p className="pt-2 text-sm text-muted-foreground" data-testid={`marketplace-group-${id}-empty`}>
          {t('marketplace.groups.empty')}
        </p>
      ) : null}
    </MarketplaceGroup>
  );
}

/** «Fornitori CasaZen», the group that kept its flow: one tile for each category, with its suppliers around the property. */
function HomeServicesGroup({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const suppliers = useMarketplaceSuppliers({ propertyId });
  const catalog = useServiceCategories();
  const items = suppliers.data?.items ?? [];
  const counts = countByCategory(items);

  return (
    <MarketplaceGroup id="homeServices">
      {suppliers.isLoading || catalog.isLoading ? (
        <SuppliersLoading />
      ) : suppliers.isError && !suppliers.data ? (
        <SuppliersError error={suppliers.error} onRetry={() => void suppliers.refetch()} />
      ) : catalog.isError || !catalog.data ? (
        <SuppliersError error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : (
        <>
          {items.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground" role="status" data-testid="marketplace-no-network">
              {t('marketplace.noNetwork')} {t('marketplace.noNetworkPartners')}
            </p>
          ) : null}
          <ul role="list" className="grid list-none gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="marketplace-categories">
            {catalog.data.map((category) => (
              <li key={category} className="min-w-0">
                <CategoryTile category={category} count={counts.get(category) ?? 0} propertyId={propertyId} />
              </li>
            ))}
          </ul>
        </>
      )}
    </MarketplaceGroup>
  );
}

/** The last group: the external partners the administrator of CasaZen put in the catalog. None is written in the page. */
function PartnersGroup() {
  const { t } = useTranslation();
  const { property } = useMarketplaceProperty();
  const catalog = useMarketplaceCatalog(property?.id);
  const partners = findMarketplaceGroup(catalog.data, 'partners')?.entries ?? [];

  return (
    <MarketplaceGroup id="partners">
      {partners.length > 0 ? (
        <MarketplaceCards>
          {partners.map((partner) => (
            <MarketplaceEntryCard key={`${partner.kind}:${partner.code}`} entry={partner} propertyId={property?.id} />
          ))}
        </MarketplaceCards>
      ) : catalog.isPending ? (
        <SkeletonLine lines={2} label={t('marketplace.loading')} className="pt-2" />
      ) : !catalog.data ? (
        <MarketplaceGroupError onRetry={() => void catalog.refetch()} />
      ) : (
        <p className="pt-2 text-sm text-muted-foreground" data-testid="marketplace-partners-empty">
          {t('marketplace.groups.partners.empty')}
        </p>
      )}
    </MarketplaceGroup>
  );
}
