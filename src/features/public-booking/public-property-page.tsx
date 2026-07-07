import { lazy, Suspense } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrgPublicProperty, usePropertyAvailability } from '@/queries/use-public-org';
import { PropertyCinBadge } from '@/features/properties/components/property-cin-badge';
import { AiContentNotice } from '@/components/shared/ai-content-notice';
import { Button } from '@/components/ui/button';
import type { PublicOrgDto } from '@/types';
import { ArrowLeft, Bed, Bath, Loader2, Users } from 'lucide-react';

const Hero = lazy(() => import('@/features/public-site/components/Hero').then((m) => ({ default: m.Hero })));
const PropertyGallery = lazy(() => import('@/features/public-site/components/PropertyGallery').then((m) => ({ default: m.PropertyGallery })));
const AmenityGrid = lazy(() => import('@/features/public-site/components/AmenityGrid').then((m) => ({ default: m.AmenityGrid })));
const BookingWidget = lazy(() => import('@/features/public-site/components/BookingWidget').then((m) => ({ default: m.BookingWidget })));

interface PublicBookingContext {
  org: PublicOrgDto;
}

export function PublicPropertyPage() {
  const { t } = useTranslation();
  const { orgSlug, propertyId } = useParams<{ orgSlug: string; propertyId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const { data: property, isLoading, isError } = useOrgPublicProperty(orgSlug, propertyId);
  const { data: availability } = usePropertyAvailability(propertyId);

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

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" className="px-0">
        <Link to={`/book/${orgSlug}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('publicBooking.backToOrg', { orgName: org.displayName })}
        </Link>
      </Button>

      <Suspense fallback={null}>
        <Hero imageUrl={property.photoUrls[0]} title={property.name} tagline={property.city} />
      </Suspense>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-8">
          <Suspense fallback={null}>
            <PropertyGallery photoUrls={property.photoUrls} alt={property.name} />
          </Suspense>

          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="public-display text-2xl font-semibold">{property.name}</h2>
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
                <h3 className="font-semibold">{t('publicBooking.servicesTitle')}</h3>
                <Suspense fallback={null}>
                  <AmenityGrid amenities={property.amenities} />
                </Suspense>
              </div>
            ) : null}

            {property.houseRules ? (
              <div>
                <h3 className="font-semibold mb-2">{t('publicBooking.rulesTitle')}</h3>
                <p className="text-sm whitespace-pre-wrap">{property.houseRules}</p>
              </div>
            ) : null}

            {property.cancellationPolicySummary ? (
              <div>
                <h3 className="font-semibold mb-2">{t('publicBooking.cancellationTitle')}</h3>
                <p className="text-sm text-[var(--cz-public-muted)]">{property.cancellationPolicySummary}</p>
              </div>
            ) : null}
          </div>
        </div>

        <Suspense fallback={null}>
          <BookingWidget property={property} availability={availability} orgSlug={orgSlug!} />
        </Suspense>
      </div>
    </div>
  );
}
