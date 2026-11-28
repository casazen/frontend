import { lazy, Suspense } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { Mail, MessageCircle } from 'lucide-react';
import { useOrgProperties, useOrgPublicProperty } from '@/queries/use-public-org';
import { useTrackViewItem } from '@/features/host-tracking/use-track-ecommerce';
import { ReviewsSection } from '@/features/reviews/components/reviews-section';
import { PropertyGallery } from '@/features/public-site/components/PropertyGallery';
import { StorefrontChatDialog } from '@/features/public-site/contact/storefront-chat-dialog';
import { ContactHostDialog } from '@/features/public-site/contact/contact-host-dialog';
import { usePropertySeoMeta } from '@/features/public-site/hooks/use-org-seo-meta';
import { AvailabilitySection } from '@/features/public-booking/booking/availability-section';
import { BookingAside } from '@/features/public-booking/booking/booking-aside';
import { BookingBar } from '@/features/public-booking/booking/booking-bar';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { BookingProvider } from '@/features/public-booking/booking/booking-provider';
import { quoteTotalCents } from '@/features/public-booking/booking/quote-helpers';
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
import { useSeoMeta } from '@/lib/seo-meta';
import type { PublicOrgDto, PublicPropertyDetailDto } from '@/types';

const AmenityGrid = lazy(() => import('@/features/public-site/components/AmenityGrid').then((m) => ({ default: m.AmenityGrid })));

interface PublicBookingContext {
  org: PublicOrgDto;
}

export function PublicPropertyPage() {
  const { t } = useTranslation();
  const { orgSlug, propertySlugOrId } = useParams<{ orgSlug: string; propertySlugOrId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const { data: property, isLoading, isError, error, refetch } = useOrgPublicProperty(orgSlug, propertySlugOrId);
  usePropertySeoMeta(org, property);
  const notFound = isError && isAxiosError(error) && error.response?.status === 404;
  useSeoMeta(notFound || (!isLoading && !isError && !property) ? { title: t('publicProperty.notFound.title'), noindex: true } : null);

  const slug = orgSlug ?? org.slug;
  const basePath = buildOrgBookingPath(slug);

  if (isLoading) return <PropertyPageSkeleton />;

  if (!property) {
    return isError && !notFound ? (
      <PropertyLoadError orgName={org.displayName} basePath={basePath} onRetry={() => void refetch()} />
    ) : (
      <PropertyNotFound basePath={basePath} contactEmail={org.contactEmail} />
    );
  }

  const hostLabel = property.hostName?.trim() || org.displayName?.trim() || '';
  return (
    <BookingProvider property={property} orgSlug={slug} hostLabel={hostLabel} contactEmail={org.contactEmail}>
      <PropertyPageBody property={property} org={org} orgSlug={slug} basePath={basePath} hostLabel={hostLabel || null} />
      <TrackPropertyView property={property} />
    </BookingProvider>
  );
}

function TrackPropertyView({ property }: { property: PublicPropertyDetailDto }) {
  const { quote } = useBooking();
  const ready = quote.status === 'ready' ? quote.quote : null;
  useTrackViewItem(
    quote.status === 'loading'
      ? null
      : {
          propertyId: property.id,
          propertyName: property.name,
          place: property.city,
          currency: ready ? ready.currency || property.currency : property.currency,
          total: ready ? quoteTotalCents(ready) / 100 : null,
        },
  );
  return null;
}

interface PropertyPageBodyProps {
  property: PublicPropertyDetailDto;
  org: PublicOrgDto;
  orgSlug: string;
  basePath: string;
  hostLabel: string | null;
}

function PropertyPageBody({ property, org, orgSlug, basePath, hostLabel }: PropertyPageBodyProps) {
  const { t } = useTranslation();
  const homes = useOrgProperties(orgSlug);

  const description = property.description?.trim() ?? '';
  const amenities = (property.amenities ?? []).filter((amenity) => amenity.trim() !== '');
  const hasRules = propertyHasRules(property);
  const hasPlan = usableLevels(property).length > 0;
  const hasZone = propertyHasZone(property);
  const publicPhone = property.publicPhone?.trim() || null;
  const canContactHost = org.canContactHost ?? Boolean(org.contactEmail);
  const writeAction = org.storefrontChatEnabled && hostLabel ? (
    <StorefrontChatDialog
      site={orgSlug}
      propertyId={property.id}
      trigger={
        <button type="button" className={HOST_ACTION_CLASS} data-testid="property-host-chat">
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('storefrontChat.title')}
        </button>
      }
    />
  ) : canContactHost && hostLabel ? (
    <ContactHostDialog
      site={orgSlug}
      hostName={hostLabel}
      propertyId={property.id}
      trigger={
        <button type="button" className={HOST_ACTION_CLASS} data-testid="property-host-write">
          <Mail className="h-4 w-4" aria-hidden />
          {t('publicProperty.host.write', { host: hostLabel })}
        </button>
      }
    />
  ) : null;
  const hasHostCard = Boolean(hostLabel && (writeAction || publicPhone));

  const sections: PropertySection[] = [
    { id: 'panoramica', label: t('publicProperty.sections.overview') },
    amenities.length > 0 ? { id: 'servizi', label: t('publicProperty.sections.amenities') } : null,
    hasPlan ? { id: 'planimetria', label: t('publicProperty.sections.plan') } : null,
    { id: 'disponibilita', label: t('publicProperty.sections.availability') },
    property.ratingSummary ? { id: 'recensioni', label: t('publicProperty.sections.reviews') } : null,
    hasZone ? { id: 'zona', label: t('publicProperty.sections.zone') } : null,
    hasRules ? { id: 'regole', label: t('publicProperty.sections.rules') } : null,
  ].filter((section): section is PropertySection => section !== null);

  const shareUrl = property.canonicalUrl || `${window.location.origin}${window.location.pathname}`;

  return (
    <div className="space-y-6 md:space-y-8 md:pb-16 lg:pb-0" data-testid="public-property-page">
      <PropertyStructuredData property={property} org={org} />
      <PropertyUtilBar basePath={basePath} hasOtherHomes={(homes.data?.length ?? 0) > 1} shareTitle={property.name} shareUrl={shareUrl} />

      <PropertyGallery photoUrls={property.photoUrls} alt={property.name} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-12">
        <div className="min-w-0 space-y-10">
          <PropertyHeader property={property} />

          {sections.length >= 3 ? <PropertySectionBar sections={sections} /> : null}

          <PropertyOverview property={property} description={description} hostLabel={hostLabel} hasHostCard={hasHostCard} />

          {hasHostCard && hostLabel ? (
            <HostCard name={hostLabel} phone={publicPhone} writeAction={writeAction} takesPayments={property.acceptsBookings === true} />
          ) : null}

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

          <AvailabilitySection />

          {property.ratingSummary ? (
            <ReviewsSection orgSlug={orgSlug} propertyId={property.id} summary={property.ratingSummary} />
          ) : null}

          {hasZone ? <ZoneSection property={property} /> : null}

          {hasRules ? <PropertyRules property={property} /> : null}
        </div>

        <BookingAside />
      </div>

      <BookingBar />
    </div>
  );
}
