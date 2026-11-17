import { Link } from 'react-router-dom';
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
import { marketplaceSupplierPath } from './lib/marketplace-paths';

/** What the address calls the drawer of a supplier of the marketplace: `?detail=marketplace-supplier:<orgId>`. */
export const MARKETPLACE_SUPPLIER_DRAWER_KIND = 'marketplace-supplier';

/**
 * The supplier of the drawer, read from the account’s supplier list: the same query as
 * the pages when it is not narrowed, so there is no second request, and a shared address opens the right supplier.
 */
function useSupplierOfTheList(id: string) {
  const suppliers = useMarketplaceSuppliers({ accountScope: true });

  return { ...suppliers, supplier: suppliers.data?.items.find((candidate) => candidate.orgId === id) };
}

export function SupplierDrawerTitle({ id }: DetailTitleProps) {
  const { supplier } = useSupplierOfTheList(id);
  return <>{supplier?.legalName ?? ''}</>;
}

/**
 * The quick look at a supplier (UI-15): services, coverage, contacts and links to the supplier’s full page and showcase.
 */
function SupplierDetails({ supplier }: { supplier: SupplierPicker }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 pb-2" data-testid="marketplace-supplier-detail">
      <SupplierPhotos supplier={supplier} />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" data-testid="marketplace-open-page">
          <Link to={marketplaceSupplierPath(supplier.orgId)}>{t('marketplace.drawer.openPage')}</Link>
        </Button>
        {supplier.showcaseSlug ? (
          <Button asChild variant="outline" data-testid="marketplace-showcase-link">
            <Link to={`/fornitori/${encodeURIComponent(supplier.showcaseSlug)}`}>{t('marketplace.drawer.showcase')}</Link>
          </Button>
        ) : null}
      </div>

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
  const { supplier, isLoading, isError, error, refetch } = useSupplierOfTheList(id);

  if (isLoading) return <SkeletonLine lines={4} />;

  if (isError && !supplier) {
    return <ErrorState title={t('marketplace.drawer.loadError')} error={error} onRetry={() => void refetch()} />;
  }

  if (!supplier) {
    return (
      <div role="status" className="space-y-1 py-4" data-testid="marketplace-supplier-not-found">
        <p className="font-semibold">{t('marketplace.drawer.notFound')}</p>
      </div>
    );
  }

  return <SupplierDetails supplier={supplier} />;
}

// Registered when this module is loaded, which every list of the suppliers does (the grid imports it): the drawer opens from a
// card and from a shared address (`?detail=marketplace-supplier:<orgId>`) on the pages of the marketplace.
registerDetail(MARKETPLACE_SUPPLIER_DRAWER_KIND, {
  title: SupplierDrawerTitle,
  Content: SupplierDrawerContent,
});
