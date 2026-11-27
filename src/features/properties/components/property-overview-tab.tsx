import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, ImagePlus } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FACT_LINK, Fact, Facts } from '@/features/bookings/components/booking-facts';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { isValidCin, requiresItalianCin } from '@/lib/cin-format';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { PropertyDetailDto } from '@/types';
import { PRICING_SECTION_ID } from '../lib/property-sheet';
import { propertyEditPath, propertyPricingPath, propertyTabPath } from '../properties-paths';
import { formatPropertyLocation } from '../property-location';
import { MultiChannelStatus } from './multi-channel-status';
import { PropertyAmenitiesGrid } from './property-amenities-grid';
import { PropertyCinBadge } from './property-cin-badge';
import { PropertyPhotoCarousel } from './property-photo-carousel';

interface PropertyOverviewTabProps {
  property: PropertyDetailDto;
  /** `property.write`: the photos, the data and the CIN can be changed from here (the API asks for the same permission). */
  canWrite: boolean;
  /** The page of the property on the booking site, when a guest can open it (it is published); nothing otherwise. */
  publicPath: string | null;
}

/**
 * The tab Panoramica (SR-07d): the photos, the data of the property, its prices and what it has. Sections without a box, a
 * title and what it says; the changes are links to the pages that make them (the form, the photos, the suggestions).
 */
export function PropertyOverviewTab({ property, canWrite, publicPath }: PropertyOverviewTabProps) {
  const { t } = useTranslation();
  // The listing on the channels (E02/F03/US01/T04) is told only where the channel manager is connected: its endpoints answer 404 otherwise.
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const spaces = [
    t('property.table.bedroomsCount', { count: property.bedrooms }),
    t('property.table.bathroomsCount', { count: property.bathrooms }),
    t('property.list.guestsCount', { count: property.maxGuests }),
  ].join(' · ');
  const suggestions = property.pricingAdapterSummary;
  const hasPhotos = property.photoUrls?.some(isDisplayableMediaUrl);

  const data = (
    <>
      <Facts>
        <Fact label={t('property.drawer.address')}>{formatPropertyLocation(property)}</Fact>
        <Fact label={t('property.drawer.spaces')}>{spaces}</Fact>
        {requiresItalianCin(property.country) ? <Fact label={t('property.drawer.cin')}>
          <PropertyCinBadge cinStatus={property.cinStatus} cinCode={property.cinCode} />
        </Fact> : null}
        <Fact label={t('property.info.timezone')}>{property.timezone}</Fact>
        {publicPath ? (
          <Fact label={t('property.detail.onSite')}>
            <a href={publicPath} target="_blank" rel="noopener noreferrer" className={FACT_LINK} data-testid="host-public-site-link">
              {t('property.detail.viewOnPublicSite')}
              <ExternalLink aria-hidden="true" className="ml-1.5 size-4 shrink-0" />
            </a>
          </Fact>
        ) : null}
      </Facts>
      {property.description ? (
        <details className="mt-2 border-t border-border">
          <summary className="min-h-11 cursor-pointer rounded-sm py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
            {t('property.detail.description')}
          </summary>
          <p className="whitespace-pre-line break-words pb-3 text-sm">{property.description}</p>
        </details>
      ) : null}
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
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
        <PlainSection title={t('property.detail.tabs.photos')}>
          {hasPhotos ? <PropertyPhotoCarousel photoUrls={property.photoUrls} name={property.name} /> : (
            <p className="text-sm text-muted-foreground">{t('propertySetup.overview.noPhotos')}</p>
          )}
          {canWrite ? (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link to={propertyTabPath(property.id, 'photos')} data-testid="property-manage-photos">
                <ImagePlus aria-hidden="true" className="size-4" />
                {t(hasPhotos ? 'property.photos.manage' : 'property.photos.add')}
              </Link>
            </Button>
          ) : null}
        </PlainSection>
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
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-sm text-foreground/70">{t('property.info.nightlyRate')}</dt>
              <dd className="break-words text-xl font-semibold tabular-nums">{formatCurrency(property.nightlyRate, property.currency)}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground/70">{t('property.info.cleaning')}</dt>
              <dd className="break-words font-medium tabular-nums">{formatCurrency(property.cleaningFee, property.currency)}</dd>
            </div>
            <div>
              <dt className="text-sm text-foreground/70">{t('property.info.deposit')}</dt>
              <dd className="break-words font-medium tabular-nums">{formatCurrency(property.damageDeposit, property.currency)}</dd>
            </div>
          </dl>
          <Facts>
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

      {connectorOn ? (
        <PlainSection title={t('property.detail.sections.channels')}>
          <MultiChannelStatus propertyId={property.id} canWrite={canWrite} cinValid={!requiresItalianCin(property.country) || isValidCin(property.cinCode)} />
        </PlainSection>
      ) : null}

    </div>
  );
}
