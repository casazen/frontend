import { Cable, Globe2, Handshake, House, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
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
import { splitMainChannels } from './lib/main-channels';
import { CHANNEL_MANAGER_GROUP_IDS, channelManagerAvailable, findMarketplaceGroup } from './lib/marketplace-entry';
import { MARKETPLACE_QUERY_PARAM, MARKETPLACE_SEARCH_PATH, marketplaceHref } from './lib/marketplace-paths';
import { useIntegrations, type Integration, type IntegrationId } from './lib/use-integrations';

const BUILT_IN_GROUP: Record<IntegrationId, MarketplaceGroupId> = { calendars: 'salesChannels', payments: 'connectedTools' };

const BUILT_IN_STATUS: Record<'active' | 'pending' | 'inactive', MarketplaceCardStatus> = {
  active: 'Active',
  pending: 'Pending',
  inactive: 'NotActive',
};

const DISCOVERY_GROUPS = [
  { id: 'salesChannels', icon: Globe2 },
  { id: 'connectedTools', icon: Cable },
  { id: 'channelManagerFunctions', icon: SlidersHorizontal },
  { id: 'homeServices', icon: House },
  { id: 'partners', icon: Handshake },
] as const;

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

  return (
    <MarketplaceFrame
      section="discover"
      title={t('marketplace.title')}
      description={t('marketplace.description')}
      toolbar={
        <SupplierSearchBox
          onSearch={(words) => navigate(marketplaceHref(MARKETPLACE_SEARCH_PATH, undefined, { [MARKETPLACE_QUERY_PARAM]: words.trim() }))}
        />
      }
    >
      <div className="grid min-w-0 gap-5 2xl:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={t('marketplace.title')} className="flex flex-wrap content-start gap-1.5 self-start 2xl:sticky 2xl:top-[calc(var(--header-height)+1rem)] 2xl:flex-col">
          {DISCOVERY_GROUPS.map(({ id, icon: Icon }) => (
            <a key={id} href={`#catalog-${id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-ring 2xl:rounded-lg">
              <Icon aria-hidden="true" className="size-4 shrink-0 text-primary-text" />
              {t(`marketplace.groups.${id}.title`)}
            </a>
          ))}
        </nav>
        <div className="min-w-0 space-y-8">
          <ChannelManagerGroups />
          <HomeServicesGroup />
          <PartnersGroup />
        </div>
      </div>
      <MarketplaceEntryDrawer />
    </MarketplaceFrame>
  );
}

function integrationCardProps(integration: Integration, t: TFunction) {
  const key = `marketplace.integrations.items.${integration.id}`;
  const status = integration.status === 'loading' || integration.status === 'unknown' ? null : BUILT_IN_STATUS[integration.status];
  const entry: MarketplaceCatalogEntry = {
    kind: 'Tool',
    code: integration.id,
    name: t(`${key}.title`),
    logoUrl: null,
    benefit: t(`${key}.summary`),
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

function ChannelManagerGroups() {
  const catalog = useMarketplaceCatalog(undefined);
  const integrations = useIntegrations();

  return (
    <>
      {CHANNEL_MANAGER_GROUP_IDS.map((id) => (
        <CatalogGroup
          key={id}
          id={id}
          catalog={catalog}
          integrations={integrations.filter((integration) => BUILT_IN_GROUP[integration.id] === id)}
        />
      ))}
    </>
  );
}

interface CatalogGroupProps {
  id: MarketplaceGroupId;
  catalog: CatalogQuery;
  integrations: Integration[];
}

/**
 * A group that waits for the channel manager: CasaZen's own integrations, then the cards of the catalog. While the channel manager is
 * not available or not connected the cards of the catalog are replaced by a sentence and the way to connect it. The sales channels show
 * the main ones at once and the others behind «Visualizza altri»: a channel that is active, pending or to fix is never hidden.
 */
function CatalogGroup({ id, catalog, integrations }: CatalogGroupProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const data = catalog.data;
  const waiting = data !== undefined && !channelManagerAvailable(data);
  const entries = data && !waiting ? (findMarketplaceGroup(data, id)?.entries ?? []) : [];
  const split = id === 'salesChannels' ? splitMainChannels(entries, (entry) => entry.status !== 'NotActive') : { main: entries, others: [] };
  const shown = showAll ? [...split.main, ...split.others] : split.main;

  const cards = [
    ...integrations.map((integration) => {
      const { entry, testId, builtIn } = integrationCardProps(integration, t);
      return <MarketplaceEntryCard key={`built-in-${integration.id}`} entry={entry} builtIn={builtIn} testId={testId} />;
    }),
    ...shown.map((entry) => <MarketplaceEntryCard key={`${entry.kind}:${entry.code}`} entry={entry} />),
  ];

  return (
    <MarketplaceGroup id={id}>
      {cards.length > 0 ? <MarketplaceCards>{cards}</MarketplaceCards> : null}
      {split.others.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 pointer-coarse:min-h-11"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
          data-testid={`marketplace-group-${id}-show-more`}
        >
          {showAll ? t('marketplace.groups.showLess') : t('marketplace.groups.showMore', { count: split.others.length })}
        </Button>
      ) : null}
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

function HomeServicesGroup() {
  const { t } = useTranslation();
  const suppliers = useMarketplaceSuppliers({ accountScope: true });
  const catalog = useServiceCategories();
  const marketplace = useMarketplaceCatalog(undefined);
  const partnersBelow = (findMarketplaceGroup(marketplace.data, 'partners')?.entries.length ?? 0) > 0;
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
              {t('marketplace.categories.none')}
              {partnersBelow ? ` ${t('marketplace.noNetworkPartners')}` : null}
            </p>
          ) : null}
          <ul role="list" className="grid list-none gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="marketplace-categories">
            {catalog.data.map((category) => (
              <li key={category} className="min-w-0">
                <CategoryTile category={category} count={counts.get(category) ?? 0} />
              </li>
            ))}
          </ul>
        </>
      )}
    </MarketplaceGroup>
  );
}

function PartnersGroup() {
  const { t } = useTranslation();
  const catalog = useMarketplaceCatalog(undefined);
  const partners = findMarketplaceGroup(catalog.data, 'partners')?.entries ?? [];

  return (
    <MarketplaceGroup id="partners">
      {partners.length > 0 ? (
        <MarketplaceCards>
          {partners.map((partner) => (
            <MarketplaceEntryCard key={`${partner.kind}:${partner.code}`} entry={partner} />
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
