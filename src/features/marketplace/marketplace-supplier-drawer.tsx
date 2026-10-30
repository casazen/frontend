import { Link, matchPath, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  registerDetail,
  type DetailContentProps,
  type DetailTitleProps,
} from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import type { SupplierPicker } from '@/types/service-request';
import {
  SupplierAbout,
  SupplierContacts,
  SupplierCoverage,
  SupplierPhotos,
  SupplierServices,
  SupplierTrust,
} from './components/supplier-sections';
import { MARKETPLACE_CATEGORIES_PATH, marketplaceHref, marketplaceSupplierPath } from './lib/marketplace-paths';
import { useMarketplaceProperty } from './lib/marketplace-property';
import { useRequestIntervention } from './lib/use-request-intervention';

/** What the address calls the drawer of a supplier of the marketplace: `?detail=marketplace-supplier:<orgId>`. */
export const MARKETPLACE_SUPPLIER_DRAWER_KIND = 'marketplace-supplier';

/**
 * The supplier of the drawer, read from the list of the suppliers of the property the marketplace is about: the same query as
 * the pages when it is not narrowed, so there is no second request, and a shared address opens the right supplier.
 */
function useSupplierOfTheList(id: string) {
  const properties = useMarketplaceProperty();
  const suppliers = useMarketplaceSuppliers({ propertyId: properties.property?.id });

  return {
    property: properties.property,
    supplier: suppliers.data?.items.find((candidate) => candidate.orgId === id),
    isLoading: properties.isLoading || suppliers.isLoading,
    isError: properties.isError || suppliers.isError,
    error: properties.error ?? suppliers.error,
    refetch: () => {
      if (properties.isError) void properties.refetch();
      else void suppliers.refetch();
    },
  };
}

export function SupplierDrawerTitle({ id }: DetailTitleProps) {
  const { supplier } = useSupplierOfTheList(id);
  return <>{supplier?.legalName ?? ''}</>;
}

/**
 * The quick look at a supplier (UI-15): what the card says and a little more, with the one thing to do. The page of the supplier
 * (`marketplaceSupplierPath`) has everything, every service with its own «Richiedi».
 */
function SupplierDetails({ supplier, propertyId }: { supplier: SupplierPicker; propertyId: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const request = useRequestIntervention(propertyId);

  // The category of the page the drawer was opened from, when the supplier offers it; else the first one it offers.
  const narrowedTo = matchPath(`${MARKETPLACE_CATEGORIES_PATH}/:category`, pathname)?.params.category;
  const requestCategory = narrowedTo && supplier.categories.includes(narrowedTo) ? narrowedTo : supplier.categories[0];

  return (
    <div className="space-y-6 pb-2" data-testid="marketplace-supplier-detail">
      <SupplierPhotos supplier={supplier} />

      {/* The one thing to do here. No commission is shown to the host (D3). */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => request.open({ supplierOrgId: supplier.orgId, category: requestCategory })}
          data-testid="marketplace-request-service-btn"
        >
          {t('serviceRequest.requestSupplier')}
        </Button>
        <Button asChild variant="outline" data-testid="marketplace-open-page">
          <Link to={marketplaceHref(marketplaceSupplierPath(supplier.orgId), propertyId)}>{t('marketplace.drawer.openPage')}</Link>
        </Button>
        {supplier.showcaseSlug ? (
          <Button asChild variant="outline" data-testid="marketplace-showcase-link">
            <Link to={`/fornitori/${encodeURIComponent(supplier.showcaseSlug)}`}>{t('marketplace.drawer.showcase')}</Link>
          </Button>
        ) : null}
      </div>
      {request.dialog}

      <SupplierTrust supplier={supplier} />
      <SupplierAbout supplier={supplier} />
      <SupplierServices supplier={supplier} />
      <SupplierCoverage supplier={supplier} />
      <SupplierContacts supplier={supplier} />
    </div>
  );
}

export function SupplierDrawerContent({ id }: DetailContentProps) {
  const { t } = useTranslation();
  const { property, supplier, isLoading, isError, error, refetch } = useSupplierOfTheList(id);

  if (isLoading) return <SkeletonLine lines={4} />;

  if (isError && !supplier) {
    return <ErrorState title={t('marketplace.drawer.loadError')} error={error} onRetry={refetch} />;
  }

  if (!supplier || !property) {
    return (
      <div role="status" className="space-y-1 py-4" data-testid="marketplace-supplier-not-found">
        <p className="font-semibold">{t('marketplace.drawer.notFound')}</p>
        <p className="text-sm text-foreground/70">{t('marketplace.drawer.notFoundDescription')}</p>
      </div>
    );
  }

  return <SupplierDetails supplier={supplier} propertyId={property.id} />;
}

// Registered when this module is loaded, which every list of the suppliers does (the grid imports it): the drawer opens from a
// card and from a shared address (`?detail=marketplace-supplier:<orgId>`) on the pages of the marketplace.
registerDetail(MARKETPLACE_SUPPLIER_DRAWER_KIND, {
  title: SupplierDrawerTitle,
  Content: SupplierDrawerContent,
});
