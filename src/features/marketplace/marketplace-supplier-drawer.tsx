import { Link, matchPath, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import {
  registerDetail,
  type DetailContentProps,
  type DetailTitleProps,
} from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { displayableMediaUrls } from '@/lib/media-url';
import { formatWorkDuration } from '@/lib/work-duration';
import { useMarketplaceSuppliers } from '@/queries/use-service-requests';
import type { SupplierPicker } from '@/types/service-request';
import { VerifiedBadge } from './components/verified-badge';
import { MARKETPLACE_CATEGORIES_PATH } from './lib/marketplace-paths';
import { useMarketplaceProperty } from './lib/marketplace-property';
import { responseLabel, servicePriceLabel } from './lib/supplier-labels';
import { useRequestIntervention } from './lib/use-request-intervention';

/** What the address calls the drawer of a supplier of the marketplace: `?detail=marketplace-supplier:<orgId>`. */
export const MARKETPLACE_SUPPLIER_DRAWER_KIND = 'marketplace-supplier';

/**
 * The supplier of the drawer, read from the list of the suppliers of the property the marketplace is about: the same query as
 * the page when it is not narrowed, so there is no second request, and a shared address opens the right supplier.
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

function Photos({ supplier }: { supplier: SupplierPicker }) {
  const { t } = useTranslation();
  const urls = displayableMediaUrls(supplier.photoUrls).slice(0, 3);
  if (urls.length === 0) return null;

  return (
    <div className={urls.length === 1 ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-3 gap-2'}>
      {urls.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={t('marketplace.drawer.photoAlt', { name: supplier.legalName, index: index + 1 })}
          loading="lazy"
          className={urls.length === 1 ? 'aspect-video w-full rounded-md object-cover' : 'aspect-[4/3] w-full rounded-md object-cover'}
        />
      ))}
    </div>
  );
}

function SupplierDetails({ supplier, propertyId }: { supplier: SupplierPicker; propertyId: string }) {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const request = useRequestIntervention(propertyId);

  const services = supplier.services ?? [];
  const response = responseLabel(supplier, t);
  // The category of the page the drawer was opened from, when the supplier offers it; else the first one it offers.
  const narrowedTo = matchPath(`${MARKETPLACE_CATEGORIES_PATH}/:category`, pathname)?.params.category;
  const requestCategory = narrowedTo && supplier.categories.includes(narrowedTo) ? narrowedTo : supplier.categories[0];

  return (
    <div className="space-y-6 pb-2" data-testid="marketplace-supplier-detail">
      <Photos supplier={supplier} />

      {/* The one thing to do here. No commission is shown to the host (D3). */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => request.open({ supplierOrgId: supplier.orgId, category: requestCategory })}
          data-testid="marketplace-request-service-btn"
        >
          {t('serviceRequest.requestSupplier')}
        </Button>
        {supplier.showcaseSlug ? (
          <Button asChild variant="outline" data-testid="marketplace-showcase-link">
            <Link to={`/fornitori/${encodeURIComponent(supplier.showcaseSlug)}`}>{t('marketplace.drawer.showcase')}</Link>
          </Button>
        ) : null}
      </div>
      {request.dialog}

      {supplier.verified ? (
        <div className="space-y-1" data-testid="marketplace-verified-note">
          <VerifiedBadge />
          <p className="text-sm text-foreground/70">{t('marketplace.drawer.verifiedExplanation')}</p>
        </div>
      ) : null}

      {response ? (
        <p className="break-words text-sm font-medium" data-testid="marketplace-supplier-response">
          {response}
        </p>
      ) : null}

      {supplier.bio ? (
        <PlainSection title={t('marketplace.drawer.about')}>
          <p className="whitespace-pre-line break-words text-sm text-foreground/80">{supplier.bio}</p>
        </PlainSection>
      ) : null}

      {services.length > 0 ? (
        <PlainSection title={t('marketplace.drawer.services')}>
          <ul className="divide-y" data-testid="marketplace-supplier-services">
            {services.map((service) => (
              <li key={service.id} className="space-y-0.5 py-2">
                <p className="break-words font-medium">{service.name}</p>
                <p className="break-words text-sm text-foreground/70">
                  {[
                    servicePriceLabel(service, t, i18n.language),
                    service.durationMinutes ? formatWorkDuration(service.durationMinutes, t) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </PlainSection>
      ) : null}

      <PlainSection title={t('marketplace.drawer.coverage')}>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-foreground/70">{t('marketplace.drawer.categories')}</dt>
          <dd className="flex flex-wrap gap-1">
            {supplier.categories.map((category) => (
              <Badge key={category} variant="outline" className="text-xs">
                {getServiceCategoryLabel(category, t)}
              </Badge>
            ))}
          </dd>
          {supplier.comuni.length > 0 ? (
            <>
              <dt className="text-foreground/70">{t('marketplace.drawer.areas')}</dt>
              <dd className="break-words">{supplier.comuni.join(', ')}</dd>
            </>
          ) : null}
        </dl>
      </PlainSection>

      <PlainSection title={t('marketplace.drawer.contacts')}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Phone aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <a href={`tel:${supplier.phone}`} className="min-w-0 break-words hover:underline">
              {supplier.phone}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Mail aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <a href={`mailto:${supplier.email}`} className="min-w-0 break-all hover:underline">
              {supplier.email}
            </a>
          </div>
        </div>
      </PlainSection>
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

// Registered when this module is loaded, which the list of the suppliers does (it imports this file): the drawer opens from the
// list and from a shared address (`?detail=marketplace-supplier:<orgId>`) on the marketplace.
registerDetail(MARKETPLACE_SUPPLIER_DRAWER_KIND, {
  title: SupplierDrawerTitle,
  Content: SupplierDrawerContent,
});
