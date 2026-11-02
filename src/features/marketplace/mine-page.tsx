import { Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/shared/empty-state';
import { MarketplaceAccountFrame } from './components/marketplace-frame';
import { IntegrationCard } from './components/integration-card';
import { MARKETPLACE_PATH, marketplaceHref } from './lib/marketplace-paths';
import { useMarketplaceProperty } from './lib/marketplace-property';
import { useIntegrations } from './lib/use-integrations';

const GRID = 'grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3';

/**
 * Le mie app (MKT): the integrations the host has on, and only those (the suppliers it asked for a job and its requests are in
 * Interventi, not here). The card of each leads to the page where it is managed. With none on it says so and leads to Scopri.
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
      <ActiveIntegrations />
    </MarketplaceAccountFrame>
  );
}

function ActiveIntegrations() {
  const { t } = useTranslation();
  const { property } = useMarketplaceProperty();
  const integrations = useIntegrations();
  const active = integrations.filter((integration) => integration.status === 'active');
  const reading = integrations.some((integration) => integration.status === 'loading');

  if (active.length === 0 && reading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground" role="status">
        {t('marketplace.loading')}
      </p>
    );
  }

  if (active.length === 0) {
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
    <ul role="list" className={GRID} data-testid="marketplace-active-integrations">
      {active.map((integration) => (
        <IntegrationCard key={integration.id} integration={integration} />
      ))}
    </ul>
  );
}
