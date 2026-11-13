import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Plug } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { useMarketplaceActive, useMarketplaceHealth } from '@/queries/use-marketplace';
import { ActiveIntegrationCard, BuiltInIntegrationCard } from './components/active-integration-card';
import { IntegrationHealthPanel } from './components/integration-health-panel';
import { MarketplaceEntryDrawer } from './components/marketplace-entry-drawer';
import { MarketplaceAccountFrame } from './components/marketplace-frame';
import { UsedProvidersList } from './components/used-providers-list';
import { buildActiveRows, fixPathOf, mayManageKind, rowHasProblem } from './lib/active-model';
import { marketplaceReturnTarget } from './lib/marketplace-entry';
import { MARKETPLACE_PATH, marketplaceHref } from './lib/marketplace-paths';
import { useMarketplaceProperty } from './lib/marketplace-property';
import { useIntegrations } from './lib/use-integrations';

const GRID = 'grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3';

/**
 * Attivi (MKT-01, MKT-04, NF-54, NF-57): what the host has on, in one page: the integrations (the channels, the tools, the functions of the license and the partners the server lists,
 * and CasaZen's own calendars and card payments) with where each stands, the health of the connections, and the CasaZen suppliers already asked for a job. With nothing on it says so
 * and leads to Scopri. A read that failed is said, never shown as an empty tab or as «all fine».
 */
export function MarketplaceMinePage() {
  const { t } = useTranslation();

  return (
    <MarketplaceAccountFrame
      section="mine"
      title={t('marketplace.mine.title')}
      description={t('marketplace.mine.description')}
      trail={[{ label: t('marketplace.title'), path: MARKETPLACE_PATH }, { label: t('marketplace.mine.title') }]}
    >
      <ActiveTab />
      {/* The detail card of an integration (the one of a row): open while the address has `?entry=`, so that it can be shared. */}
      <MarketplaceEntryDrawer />
    </MarketplaceAccountFrame>
  );
}

function ActiveTab() {
  const { t } = useTranslation();
  const location = useLocation();
  const { hasPermission } = useWorkspace();
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const { property } = useMarketplaceProperty();
  const builtIns = useIntegrations();
  const active = useMarketplaceActive(undefined);
  // The health is read only while the connector is on and for who may read it: with it off (or without the right) nothing is asked, nothing is said and no error is shown.
  const canReadHealth = connectorOn && hasPermission('short-rent', 'ota.read');
  const health = useMarketplaceHealth(undefined, canReadHealth);

  const healthItems = canReadHealth && !health.isError && health.data?.outcome === 'items' ? health.data.items : null;
  const activeData = active.isError ? undefined : active.data;
  const rows = useMemo(() => (activeData ? buildActiveRows(activeData.integrations, healthItems) : []), [activeData, healthItems]);
  const providers = activeData?.providers ?? [];
  const builtInActive = builtIns.filter((integration) => integration.status === 'active');
  const builtInReading = builtIns.some((integration) => integration.status === 'loading');

  const mayFix = (kind: string) => mayManageKind(kind, hasPermission, connectorOn);
  const returnTo = marketplaceReturnTarget(location);

  if ((active.isPending || builtInReading) && rows.length === 0 && builtInActive.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.loading')}
      </p>
    );
  }

  // Nothing is on, and every read said so: an empty tab is told only when nothing failed to be read.
  if (!active.isPending && !active.isError && rows.length === 0 && providers.length === 0 && builtInActive.length === 0 && !builtInReading) {
    return (
      <EmptyState
        icon={Plug}
        title={t('marketplace.mine.emptyTitle')}
        description={t('marketplace.mine.emptyHint')}
        action={{ label: t('marketplace.mine.discover'), href: marketplaceHref(MARKETPLACE_PATH, property?.id) }}
        className="py-8"
      />
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      {canReadHealth ? <IntegrationHealthPanel query={health} mayFix={mayFix} /> : null}

      <PlainSection title={t('marketplace.mine.integrations.title')} data-testid="marketplace-active-section">
        {builtInActive.length + rows.length > 0 ? (
          <ul role="list" className={GRID} data-testid="marketplace-active-integrations">
            {builtInActive.map((integration) => (
              <BuiltInIntegrationCard key={integration.id} integration={integration} />
            ))}
            {rows.map((row) => (
              <ActiveIntegrationCard key={row.key} row={row} fixTo={rowHasProblem(row) && mayFix(row.kind) ? fixPathOf(row, returnTo) : null} />
            ))}
          </ul>
        ) : null}
        {active.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="marketplace-active-loading">
            <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            {t('marketplace.loading')}
          </p>
        ) : null}
        {active.isError ? (
          <ErrorState testId="marketplace-active-error" title={t('marketplace.mine.integrations.loadError')} error={active.error} onRetry={() => void active.refetch()} />
        ) : null}
      </PlainSection>

      {providers.length > 0 ? (
        <PlainSection title={t('marketplace.mine.providers.title')} data-testid="marketplace-providers-section">
          <p className="text-sm text-foreground/70">{t('marketplace.mine.providers.description')}</p>
          <UsedProvidersList providers={providers} propertyId={property?.id} />
        </PlainSection>
      ) : null}
    </div>
  );
}
