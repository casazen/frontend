import { lazy, Suspense } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrgPublicProperty, usePropertyAvailability } from '@/queries/use-public-org';
import { PropertyCinBadge } from '@/features/properties/components/property-cin-badge';
import { AiContentNotice } from '@/components/shared/ai-content-notice';
import { Button } from '@/components/ui/button';
import { PublicBreadcrumb } from '@/features/public-site/components/PublicBreadcrumb';
import { useBookingSearchParams } from '@/features/public-site/hooks/use-booking-search-params';
import type { PublicOrgDto } from '@/types';
import { Bed, Bath, Loader2, Users } from 'lucide-react';

const PropertyGallery = lazy(() => import('@/features/public-site/components/PropertyGallery').then((m) => ({ default: m.PropertyGallery })));
const AmenityGrid = lazy(() => import('@/features/public-site/components/AmenityGrid').then((m) => ({ default: m.AmenityGrid })));
const BookingWidget = lazy(() => import('@/features/public-site/components/BookingWidget').then((m) => ({ default: m.BookingWidget })));

interface PublicBookingContext {
  org: PublicOrgDto;
}

export function PublicPropertyPage() {
  const { t } = useTranslation();
  const { orgSlug, propertySlugOrId } = useParams<{ orgSlug: string; propertySlugOrId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const { data: property, isLoading, isError } = useOrgPublicProperty(orgSlug, propertySlugOrId);
  const { data: availability } = usePropertyAvailability(propertySlugOrId);
  const { toQueryString } = useBookingSearchParams();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cz-public-primary)]" />
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-[var(--cz-public-muted)]">{t('publicBooking.propertyNotFound')}</p>
        <Button asChild variant="outline">
          <Link to={`/book/${orgSlug}`}>{t('publicBooking.backToProperties')}</Link>
        </Button>
      </div>
    );
  }

  const basePath = `/book/${orgSlug}`;
  const query = toQueryString();

  return (
    <div className="space-y-6 md:space-y-8" data-testid="public-property-page">
      <PublicBreadcrumb
        segments={[
          { label: org.displayName, href: basePath },
          { label: property.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-8">
          <Suspense fallback={null}>
            <PropertyGallery photoUrls={property.photoUrls} alt={property.name} />
          </Suspense>

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="public-display text-xl font-semibold md:text-2xl">{property.name}</h1>
                <p className="text-[var(--cz-public-muted)]">
                  {property.city}
                  {property.postalCode ? ` (${property.postalCode})` : ''}
                </p>
              </div>
              <PropertyCinBadge cinStatus={property.cinStatus} cinCode={property.cinCode} />
            </div>

            <AiContentNotice visible={false} />
            <p className="text-[var(--cz-public-muted)]">{property.description}</p>

            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1"><Bed className="h-4 w-4" /> {property.bedrooms} {t('publicBooking.camere')}</span>
              <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {property.bathrooms} {t('publicBooking.bagni')}</span>
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {t('publicBooking.ospiti', { count: property.maxGuests })}</span>
            </div>

            {property.amenities.length > 0 ? (
              <div className="space-y-3">
                <h2 className="font-semibold">{t('publicBooking.servicesTitle')}</h2>
                <Suspense fallback={null}>
                  <AmenityGrid amenities={property.amenities} />
                </Suspense>
              </div>
            ) : null}

            {property.houseRules ? (
              <div>
                <h2 className="mb-2 font-semibold">{t('publicBooking.rulesTitle')}</h2>
                <p className="text-sm whitespace-pre-wrap">{property.houseRules}</p>
              </div>
            ) : null}

            {property.cancellationPolicySummary ? (
              <div>
                <h2 className="mb-2 font-semibold">{t('publicBooking.cancellationTitle')}</h2>
                <p className="text-sm text-[var(--cz-public-muted)]">{property.cancellationPolicySummary}</p>
              </div>
            ) : null}
          </div>
        </div>

        <Suspense fallback={null}>
          <BookingWidget property={property} availability={availability} orgSlug={orgSlug!} querySuffix={query} />
        </Suspense>
      </div>
    </div>
  );
}
