import { lazy, Suspense } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { Mail } from 'lucide-react';
import { useOrgProperties, useOrgPublicProperty, usePropertyAvailability } from '@/queries/use-public-org';
import { ReviewsSection } from '@/features/reviews/components/reviews-section';
import { PropertyGallery } from '@/features/public-site/components/PropertyGallery';
import { usePropertySeoMeta } from '@/features/public-site/hooks/use-org-seo-meta';
import { useStayState } from '@/features/public-site/stay/use-stay-state';
import type { WidgetAvailability } from '@/features/public-site/components/BookingWidget';
import { HOST_ACTION_CLASS, HostCard } from '@/features/public-booking/components/host-card';
import { PropertyHeader } from '@/features/public-booking/components/property-header';
import { PropertyOverview } from '@/features/public-booking/components/property-overview';
import { PropertyRules } from '@/features/public-booking/components/property-rules';
import { FloorPlanSection } from '@/features/public-booking/components/floor-plan-section';
import { ZoneSection } from '@/features/public-booking/components/zone-section';
import { propertyHasRules, propertyHasZone, usableLevels } from '@/features/public-booking/lib/property-profile';
import { PropertyUtilBar } from '@/features/public-booking/components/property-util-bar';
import { PropertyStructuredData } from '@/components/seo/PropertyStructuredData';
import { AmenitySkeleton, PropertyLoadError, PropertyNotFound, PropertyPageSkeleton } from '@/features/public-booking/components/property-page-states';
import { PropertySectionBar, type PropertySection } from '@/features/public-booking/components/property-section-bar';
import { buildOrgBookingPath } from '@/lib/booking-url';
import { getProblemMessage } from '@/lib/api-errors';
import { useSeoMeta } from '@/lib/seo-meta';
import type { PublicOrgDto } from '@/types';

// The amenity icons and the booking widget come with the page, not with the app. The gallery is not lazy: it is the first thing on the page.
const AmenityGrid = lazy(() => import('@/features/public-site/components/AmenityGrid').then((m) => ({ default: m.AmenityGrid })));
const BookingWidget = lazy(() => import('@/features/public-site/components/BookingWidget').then((m) => ({ default: m.BookingWidget })));

interface PublicBookingContext {
  org: PublicOrgDto;
}

export function PublicPropertyPage() {
  const { t } = useTranslation();
  const { orgSlug, propertySlugOrId } = useParams<{ orgSlug: string; propertySlugOrId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const { data: property, isLoading, isError, error, refetch } = useOrgPublicProperty(orgSlug, propertySlugOrId);
  // By the id of the loaded property: the URL may carry its slug, the availability takes the id (BK-05, R-03).
  const availabilityQuery = usePropertyAvailability(property?.id);
  // The other homes of the site (the footer reads the same list): «Tutte le case» is offered only when there is more than one.
  const homes = useOrgProperties(orgSlug);
  const { linkTo } = useStayState();
  usePropertySeoMeta(org, property);
  // The API answers 404 for a home that does not exist and for one that is not bookable online; any other failure is not that.
  const notFound = isError && isAxiosError(error) && error.response?.status === 404;
  useSeoMeta(notFound || (!isLoading && !isError && !property) ? { title: t('publicProperty.notFound.title'), noindex: true } : null);

  const basePath = buildOrgBookingPath(orgSlug ?? org.slug);

  if (isLoading) return <PropertyPageSkeleton />;

  if (!property) {
    return isError && !notFound ? (
      <PropertyLoadError orgName={org.displayName} basePath={basePath} onRetry={() => void refetch()} />
    ) : (
      <PropertyNotFound basePath={basePath} contactEmail={org.contactEmail} />
    );
  }

  // An error is never shown as "every night free": the calendar shows the error and a retry (BK-05).
  const availability: WidgetAvailability = {
    status: availabilityQuery.isError ? 'error' : availabilityQuery.data ? 'ready' : 'loading',
    bookedDates: availabilityQuery.data?.bookedDates,
    endDate: availabilityQuery.data?.endDate.slice(0, 10),
    errorMessage: availabilityQuery.isError ? getProblemMessage(availabilityQuery.error, t) : undefined,
    onRetry: () => void availabilityQuery.refetch(),
  };

  // Every block below exists only when the host gave it something to say: no empty headings, no invented content.
  const description = property.description?.trim() ?? '';
  const amenities = (property.amenities ?? []).filter((amenity) => amenity.trim() !== '');
  const hasRules = propertyHasRules(property);
  const hasPlan = usableLevels(property).length > 0;
  const hasZone = propertyHasZone(property);
  const hostLabel = property.hostName?.trim() || org.displayName?.trim() || null;
  const publicPhone = property.publicPhone?.trim() || null;
  // The way to write to the host is the address they published; the contact form of the site replaces it when that one is in.
  const writeAction = org.contactEmail ? (
    <a href={`mailto:${org.contactEmail}`} className={HOST_ACTION_CLASS} data-testid="property-host-write">
      <Mail className="h-4 w-4" aria-hidden />
      {t('publicProperty.host.write', { host: hostLabel ?? '' })}
    </a>
  ) : null;
  const hasHostCard = Boolean(hostLabel && (writeAction || publicPhone));

  const sections: PropertySection[] = [
    { id: 'panoramica', label: t('publicProperty.sections.overview') },
    amenities.length > 0 ? { id: 'servizi', label: t('publicProperty.sections.amenities') } : null,
    hasPlan ? { id: 'planimetria', label: t('publicProperty.sections.plan') } : null,
    // DB-12b: only a property with reviews has this section (and so its stop in the bar): no stars and no «0 recensioni» before the first.
    property.ratingSummary ? { id: 'recensioni', label: t('publicProperty.sections.reviews') } : null,
    hasZone ? { id: 'zona', label: t('publicProperty.sections.zone') } : null,
    hasRules ? { id: 'regole', label: t('publicProperty.sections.rules') } : null,
  ].filter((section): section is PropertySection => section !== null);

  // A link is a place, not a search: the address to share has no dates and no guests in it.
  const shareUrl = property.canonicalUrl || `${window.location.origin}${window.location.pathname}`;

  return (
    <div className="space-y-6 md:space-y-8" data-testid="public-property-page">
      <PropertyStructuredData property={property} org={org} />
      <PropertyUtilBar
        backTo={(homes.data?.length ?? 0) > 1 ? linkTo(basePath) : null}
        shareTitle={property.name}
        shareUrl={shareUrl}
      />

      <PropertyGallery photoUrls={property.photoUrls} alt={property.name} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-12">
        <div className="min-w-0 space-y-10">
          <PropertyHeader property={property} />

          {sections.length >= 3 ? <PropertySectionBar sections={sections} /> : null}

          <PropertyOverview property={property} description={description} hostLabel={hostLabel} hasHostCard={hasHostCard} />

          {amenities.length > 0 ? (
            <section id="servizi" aria-labelledby="property-amenities-title" className="scroll-mt-20 space-y-5">
              <h2 id="property-amenities-title" className="public-display text-2xl font-semibold">
                {t('publicBooking.servicesTitle')}
              </h2>
              <Suspense fallback={<AmenitySkeleton />}>
                <AmenityGrid amenities={amenities} />
              </Suspense>
            </section>
          ) : null}

          {hasPlan ? <FloorPlanSection property={property} /> : null}

          {property.ratingSummary ? (
            <ReviewsSection orgSlug={orgSlug ?? org.slug} propertyId={property.id} summary={property.ratingSummary} />
          ) : null}

          {hasZone ? <ZoneSection property={property} /> : null}

          {hasRules ? <PropertyRules property={property} /> : null}

          {hasHostCard && hostLabel ? (
            <HostCard name={hostLabel} phone={publicPhone} writeAction={writeAction} takesPayments={property.acceptsBookings === true} />
          ) : null}
        </div>

        <Suspense fallback={<div aria-hidden className="hidden h-[26rem] animate-pulse rounded-[var(--cz-public-radius)] bg-[var(--cz-public-border)] motion-reduce:animate-none lg:block" />}>
          <BookingWidget property={property} availability={availability} orgSlug={orgSlug ?? org.slug} />
        </Suspense>
      </div>
    </div>
  );
}
