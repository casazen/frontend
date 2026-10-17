import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ImagePlus } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FACT_LINK, Fact, Facts } from '@/features/bookings/components/booking-facts';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { PropertyDetailDto } from '@/types';
import { PRICING_SECTION_ID } from '../lib/property-sheet';
import { propertyEditPath, propertyPricingPath, propertyTabPath } from '../properties-paths';
import { formatPropertyLocation } from '../property-location';
import { PropertyAmenitiesGrid } from './property-amenities-grid';
import { PropertyCinBadge } from './property-cin-badge';
import { PropertyPhotoCarousel } from './property-photo-carousel';

interface PropertyOverviewTabProps {
  property: PropertyDetailDto;
  /** `property.write`: the photos, the data and the CIN can be changed from here (the API asks for the same permission). */
  canWrite: boolean;
  /** The page of the property on the booking site, when a guest can open it (it is published); nothing otherwise. */
  publicPath: string | null;
  onEditCin: () => void;
}

/**
 * The tab Panoramica (SR-07d): the photos, the data of the property, its prices and what it has. Sections without a box, a
 * title and what it says; the changes are links to the pages that make them (the form, the photos, the suggestions).
 */
export function PropertyOverviewTab({ property, canWrite, publicPath, onEditCin }: PropertyOverviewTabProps) {
  const { t } = useTranslation();
  const spaces = [
    t('property.table.bedroomsCount', { count: property.bedrooms }),
    t('property.table.bathroomsCount', { count: property.bathrooms }),
    t('property.list.guestsCount', { count: property.maxGuests }),
  ].join(' · ');
  const suggestions = property.pricingAdapterSummary;

  const data = (
    <>
      <Facts>
        <Fact label={t('property.drawer.address')}>{formatPropertyLocation(property)}</Fact>
        <Fact label={t('property.drawer.spaces')}>{spaces}</Fact>
        <Fact label={t('property.drawer.cin')}>
          <PropertyCinBadge cinStatus={property.cinStatus} cinCode={property.cinCode} onEdit={canWrite ? onEditCin : undefined} />
        </Fact>
        <Fact label={t('property.info.timezone')}>{property.timezone}</Fact>
        {property.description ? (
          <Fact label={t('property.detail.description')}>
            <span className="whitespace-pre-line">{property.description}</span>
          </Fact>
        ) : null}
        {publicPath ? (
          <Fact label={t('property.detail.onSite')}>
            <a href={publicPath} target="_blank" rel="noopener noreferrer" className={FACT_LINK} data-testid="host-public-site-link">
              {t('property.detail.viewOnPublicSite')}
              <ExternalLink aria-hidden="true" className="ml-1.5 size-4 shrink-0" />
            </a>
          </Fact>
        ) : null}
      </Facts>
      {/* A note, never an error: the CIN does not change when a comune is renamed or merged (SU-04). */}
      {property.cinIstatMismatch ? (
        <Alert variant="info" role="note" data-testid="property-cin-istat-mismatch" className="mt-3">
          {t('property.cin.istatMismatch')}
        </Alert>
      ) : null}
    </>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <PropertyPhotoCarousel photoUrls={property.photoUrls} name={property.name} />
        {canWrite ? (
          <Button asChild variant="outline" size="sm">
            <Link to={propertyTabPath(property.id, 'photos')} replace data-testid="property-manage-photos">
              <ImagePlus aria-hidden="true" className="size-4" />
              {t(property.photoUrls.length > 0 ? 'property.photos.manage' : 'property.photos.add')}
            </Link>
          </Button>
        ) : null}
      </div>

      {canWrite ? (
        <PlainSection title={t('property.detail.sections.data')} actionLabel={t('property.detail.edit')} href={propertyEditPath(property.id)}>
          {data}
        </PlainSection>
      ) : (
        <PlainSection title={t('property.detail.sections.data')}>{data}</PlainSection>
      )}

      <PlainSection
        id={PRICING_SECTION_ID}
        className="scroll-mt-6"
        title={t('property.detail.sections.pricing')}
        actionLabel={t('property.detail.managePricing')}
        href={propertyPricingPath(property.id)}
        actionTestId="property-manage-pricing"
      >
        <Facts>
          <Fact label={t('property.info.nightlyRate')}>{formatCurrency(property.nightlyRate)}</Fact>
          <Fact label={t('property.info.cleaning')}>{formatCurrency(property.cleaningFee)}</Fact>
          <Fact label={t('property.info.deposit')}>{formatCurrency(property.damageDeposit)}</Fact>
          <Fact label={t('property.pricing.title')}>{suggestions.isEnabled ? t('property.pricing.on') : t('property.pricing.off')}</Fact>
          {suggestions.isEnabled ? (
            <>
              <Fact label={t('property.pricing.lastAdaptation')}>{suggestions.lastAdaptedAt ? formatDateTime(suggestions.lastAdaptedAt) : '—'}</Fact>
              <Fact label={t('property.pricing.nextRun')}>{suggestions.nextRunOn ? formatDate(suggestions.nextRunOn) : '—'}</Fact>
            </>
          ) : null}
        </Facts>
      </PlainSection>

      <PropertyAmenitiesGrid amenities={property.amenities} />
    </div>
  );
}
