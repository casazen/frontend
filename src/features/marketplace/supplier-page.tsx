import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { Store, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { useMarketplaceSupplier } from '@/queries/use-service-requests';
import { MarketplaceFrame, type MarketplaceContext } from './components/marketplace-frame';
import {
  SupplierAbout,
  SupplierContacts,
  SupplierCoverage,
  SupplierPhotos,
  SupplierServices,
  SupplierTrust,
} from './components/supplier-sections';
import { MARKETPLACE_PATH, marketplaceHref } from './lib/marketplace-paths';
import { useMarketplaceProperty } from './lib/marketplace-property';

/**
 * The page of a supplier (MKT): the same things the drawer says, with every service and a «Richiedi» for each, and the way to
 * its showcase when it has one. It can be shared (`/marketplace/suppliers/<orgId>?propertyId=`): the supplier is read for the
 * property in the address, and one that does not work around it, or is not active, is not found. No commission is shown (D3).
 */
export function MarketplaceSupplierPage() {
  const { t } = useTranslation();
  const { orgId = '' } = useParams();
  const { property } = useMarketplaceProperty();
  const query = useMarketplaceSupplier(property?.id, orgId);
  const supplier = query.data;
  const name = supplier?.legalName ?? t('marketplace.supplier.title');

  return (
    <MarketplaceFrame
      section="discover"
      title={name}
      description={supplier?.categories.map((category) => getServiceCategoryLabel(category, t)).join(' · ')}
      trail={[{ label: t('marketplace.title'), path: MARKETPLACE_PATH }, { label: name }]}
      primary={
        supplier
          ? (requestIntervention) => ({
              label: t('serviceRequest.requestSupplier'),
              icon: Wrench,
              onClick: () => requestIntervention({ supplierOrgId: supplier.orgId, category: supplier.categories[0] }),
              testId: 'marketplace-request-service-btn',
            })
          : null
      }
    >
      {(context) => <SupplierPageBody orgId={orgId} context={context} />}
    </MarketplaceFrame>
  );
}

function SupplierPageBody({ orgId, context }: { orgId: string; context: MarketplaceContext }) {
  const { t } = useTranslation();
  const { property, requestIntervention } = context;
  const query = useMarketplaceSupplier(property.id, orgId);

  if (query.isLoading) return <SkeletonLine lines={6} />;

  if (query.isError) {
    if (isAxiosError(query.error) && query.error.response?.status === 404) {
      return (
        <EmptyState
          icon={Store}
          title={t('marketplace.drawer.notFound')}
          description={t('marketplace.drawer.notFoundDescription')}
          action={{ label: t('marketplace.supplier.backToMarketplace'), href: marketplaceHref(MARKETPLACE_PATH, property.id) }}
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
        <SupplierServices
          supplier={supplier}
          onRequest={(service) =>
            requestIntervention({
              supplierOrgId: supplier.orgId,
              service: { id: service.id, name: service.name, category: service.category, durationMinutes: service.durationMinutes },
            })
          }
        />
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
