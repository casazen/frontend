import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { useMarketplaceSupplier } from '@/queries/use-service-requests';
import { MarketplaceFrame } from './components/marketplace-frame';
import {
  SupplierAbout,
  SupplierContacts,
  SupplierCoverage,
  SupplierPhotos,
  SupplierServices,
  SupplierTrust,
} from './components/supplier-sections';
import { MARKETPLACE_PATH } from './lib/marketplace-paths';

/**
 * The page of a supplier (MKT): the same things the drawer says, with every published service and the way to
 * its showcase when it has one. It can be shared (`/marketplace/suppliers/<orgId>`): the supplier is read across the account’s service areas. No commission is shown (D3).
 */
export function MarketplaceSupplierPage() {
  const { t } = useTranslation();
  const { orgId = '' } = useParams();
  const query = useMarketplaceSupplier(orgId);
  const supplier = query.data;
  const name = supplier?.legalName ?? t('marketplace.supplier.title');

  return (
    <MarketplaceFrame
      section="discover"
      title={name}
      description={supplier?.categories.map((category) => getServiceCategoryLabel(category, t)).join(' · ')}
      crumbs={[{ label: t('marketplace.title'), to: MARKETPLACE_PATH }, { label: name }]}
    >
      <SupplierPageBody query={query} />
    </MarketplaceFrame>
  );
}

function SupplierPageBody({ query }: { query: ReturnType<typeof useMarketplaceSupplier> }) {
  const { t } = useTranslation();

  if (query.isLoading) return <SkeletonLine lines={6} />;

  if (query.isError) {
    if (isAxiosError(query.error) && query.error.response?.status === 404) {
      return (
        <EmptyState
          icon={Store}
          title={t('marketplace.drawer.notFound')}
          description={t('marketplace.detail.notFoundDescription')}
          action={{ label: t('marketplace.supplier.backToMarketplace'), href: MARKETPLACE_PATH }}
          className="py-8"
        />
      );
    }
    return <ErrorState title={t('marketplace.drawer.loadError')} error={query.error} onRetry={() => void query.refetch()} />;
  }

  const supplier = query.data;
  if (!supplier) return null;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" data-testid="marketplace-supplier-page">
      <div className="min-w-0 space-y-8">
        <SupplierPhotos supplier={supplier} />
        <SupplierTrust supplier={supplier} />
        <SupplierAbout supplier={supplier} />
        <SupplierServices supplier={supplier} />
      </div>
      <div className="min-w-0 space-y-8">
        {supplier.showcaseSlug ? (
          <div>
            <Button asChild variant="outline" className="min-h-11" data-testid="marketplace-showcase-link">
              <Link to={`/fornitori/${encodeURIComponent(supplier.showcaseSlug)}`}>{t('marketplace.drawer.showcase')}</Link>
            </Button>
          </div>
        ) : null}
        <SupplierCoverage supplier={supplier} />
        <SupplierContacts supplier={supplier} />
      </div>
    </div>
  );
}
