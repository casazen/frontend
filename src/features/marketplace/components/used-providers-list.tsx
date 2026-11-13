import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import type { MarketplaceActiveProvider } from '@/types';
import { marketplaceHref, marketplaceSupplierPath } from '../lib/marketplace-paths';

const GRID = 'grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3';

interface UsedProvidersListProps {
  providers: readonly MarketplaceActiveProvider[];
  /** The property the marketplace is about: the page of a supplier is read for it. */
  propertyId: string | undefined;
}

/**
 * The CasaZen suppliers the host already asked for a job (the Active tab, AC-NF54-3): the name, how many requests are open, the last kind of work asked, and the way to the
 * page of the supplier. They are the ones the server lists, in its order; nothing is added to them.
 */
export function UsedProvidersList({ providers, propertyId }: UsedProvidersListProps) {
  const { t } = useTranslation();

  return (
    <ul role="list" className={GRID} data-testid="marketplace-used-providers">
      {providers.map((provider) => (
        <li
          key={provider.supplierOrgId}
          className="flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4"
          data-testid={`marketplace-provider-${provider.supplierOrgId}`}
        >
          <div className="min-w-0 space-y-1">
            <h3 className="break-words font-medium">{provider.supplierName}</h3>
            <p className="text-sm text-foreground/70" data-testid={`marketplace-provider-${provider.supplierOrgId}-open`}>
              {t('marketplace.mine.providers.openRequests', { count: provider.openCount })}
            </p>
            {provider.lastCategory ? (
              <p className="text-sm text-foreground/70">
                {t('marketplace.mine.providers.lastCategory', { category: getServiceCategoryLabel(provider.lastCategory, t) })}
              </p>
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-auto self-start">
            <Link
              to={marketplaceHref(marketplaceSupplierPath(provider.supplierOrgId), propertyId)}
              aria-label={t('marketplace.mine.providers.viewAria', { name: provider.supplierName })}
              data-testid={`marketplace-provider-${provider.supplierOrgId}-link`}
            >
              {t('marketplace.mine.providers.view')}
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
