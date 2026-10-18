import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { CalendarX2, MapPin, ScrollText } from 'lucide-react';
import { useOrgPublicProperty, usePropertyAvailability } from '@/queries/use-public-org';
import { PublicCinLabel } from '@/features/properties/components/public-cin-label';
import { ReviewsSection } from '@/features/reviews/components/reviews-section';
import { PublicBreadcrumb } from '@/features/public-site/components/PublicBreadcrumb';
import { PropertyGallery } from '@/features/public-site/components/PropertyGallery';
import { usePropertySeoMeta } from '@/features/public-site/hooks/use-org-seo-meta';
import type { WidgetAvailability } from '@/features/public-site/components/BookingWidget';
import { PropertyDescription } from '@/features/public-booking/components/property-description';
import { PropertyFacts } from '@/features/public-booking/components/property-facts';
import { AmenitySkeleton, PropertyLoadError, PropertyNotFound, PropertyPageSkeleton } from '@/features/public-booking/components/property-page-states';
import { PropertySectionBar, type PropertySection } from '@/features/public-booking/components/property-section-bar';
import { buildOrgBookingPath } from '@/lib/booking-url';
import { getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { useSeoMeta } from '@/lib/seo-meta';
import type { PublicOrgDto } from '@/types';

// The amenity icons and the booking widget come with the page, not with the app. The gallery is not lazy: it is the first thing on the page.
const AmenityGrid = lazy(() => import('@/features/public-site/components/AmenityGrid').then((m) => ({ default: m.AmenityGrid })));
const BookingWidget = lazy(() => import('@/features/public-site/components/BookingWidget').then((m) => ({ default: m.BookingWidget })));

interface PublicBookingContext {
  org: PublicOrgDto;
}

/** A section of the page: a title, then what the host wrote. Only rendered when there is something to say. */
function InfoCard({ title, icon, text, testId }: { title: string; icon: ReactNode; text: string; testId: string }) {
  return (
    <article className="public-site-card space-y-3 p-5" data-testid={testId}>
      <h3 className="flex items-center gap-2 font-semibold">
        <span className="text-[var(--cz-public-primary-text)]">{icon}</span>
        {title}
      </h3>
      <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[var(--cz-public-muted)]">{text}</p>
    </article>
  );
}

export function PublicPropertyPage() {
  const { t } = useTranslation();
  const { orgSlug, propertySlugOrId } = useParams<{ orgSlug: string; propertySlugOrId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const { data: property, isLoading, isError, error, refetch } = useOrgPublicProperty(orgSlug, propertySlugOrId);
  // By the id of the loaded property: the URL may carry its slug, the availability takes the id (BK-05, R-03).
  const availabilityQuery = usePropertyAvailability(property?.id);
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
  const place = [property.city?.trim(), property.postalCode?.trim() ? `(${property.postalCode.trim()})` : null].filter(Boolean).join(' ');
  const description = property.description?.trim() ?? '';
  const amenities = (property.amenities ?? []).filter((amenity) => amenity.trim() !== '');
  const houseRules = property.houseRules?.trim() ?? '';
  const cancellation = property.cancellationPolicySummary?.trim() ?? '';
  const hasKnowBefore = Boolean(houseRules || cancellation);

  const sections: PropertySection[] = [
    description ? { id: 'descrizione', label: t('publicProperty.sections.description') } : null,
    amenities.length > 0 ? { id: 'servizi', label: t('publicProperty.sections.amenities') } : null,
    hasKnowBefore ? { id: 'da-sapere', label: t('publicProperty.sections.know') } : null,
    // DB-12b: only a property with reviews has this section (and so its stop in the bar): no stars and no «0 recensioni» before the first.
    property.ratingSummary ? { id: 'recensioni', label: t('publicProperty.sections.reviews') } : null,
  ].filter((section): section is PropertySection => section !== null);

  return (
    <div className="space-y-6 md:space-y-8" data-testid="public-property-page">
      <PublicBreadcrumb
        segments={[
          { label: org.displayName, href: basePath },
          { label: property.name },
        ]}
      />

      <PropertyGallery photoUrls={property.photoUrls} alt={property.name} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-12">
        <div className="min-w-0 space-y-10">
          <header className="space-y-2">
            <h1 className="public-display text-balance break-words text-3xl font-semibold leading-tight md:text-4xl">{property.name}</h1>
            {place ? (
              <p className="flex items-center gap-1.5 text-[var(--cz-public-muted)]">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span>{place}</span>
              </p>
            ) : null}
            <PublicCinLabel cinStatus={property.cinStatus} cinCode={property.cinCode} className="text-[var(--cz-public-muted)]" />
          </header>

          <PropertyFacts property={property} />

          {sections.length >= 3 ? <PropertySectionBar sections={sections} /> : null}

          {description ? <PropertyDescription id="descrizione" text={description} /> : null}

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

          {hasKnowBefore ? (
            <section id="da-sapere" aria-labelledby="property-know-title" className="scroll-mt-20 space-y-5">
              <h2 id="property-know-title" className="public-display text-2xl font-semibold">
                {t('publicProperty.know.title')}
              </h2>
              <div className={cn('grid gap-4', houseRules && cancellation && 'md:grid-cols-2')}>
                {houseRules ? (
                  <InfoCard testId="property-rules" title={t('publicBooking.rulesTitle')} icon={<ScrollText className="h-5 w-5" aria-hidden />} text={houseRules} />
                ) : null}
                {cancellation ? (
                  <InfoCard testId="property-cancellation" title={t('publicBooking.cancellationTitle')} icon={<CalendarX2 className="h-5 w-5" aria-hidden />} text={cancellation} />
                ) : null}
              </div>
            </section>
          ) : null}

          {property.ratingSummary ? (
            <ReviewsSection orgSlug={orgSlug ?? org.slug} propertyId={property.id} summary={property.ratingSummary} />
          ) : null}
        </div>

        <Suspense fallback={<div aria-hidden className="hidden h-[26rem] animate-pulse rounded-[var(--cz-public-radius)] bg-[var(--cz-public-border)] motion-reduce:animate-none lg:block" />}>
          <BookingWidget property={property} availability={availability} orgSlug={orgSlug ?? org.slug} />
        </Suspense>
      </div>
    </div>
  );
}
