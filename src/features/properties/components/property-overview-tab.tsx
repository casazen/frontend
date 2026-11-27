import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, Bath, BedDouble, BrushCleaning, Building2, CalendarClock, CheckCircle2, CircleOff, Clock, ExternalLink, Globe, History, ImageOff, ImagePlus, Info, MapPin, Share2, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Figure, Figures, IconFact, IconFacts, InfoCard } from '@/components/shared/calm';
import { ManualHint } from '@/components/shared/manual-hint';
import { StatusPill } from '@/components/shared/status/status-pill';
import { Button } from '@/components/ui/button';
import { FACT_LINK } from '@/features/bookings/components/booking-facts';
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
  children?: ReactNode;
}

export function PropertyOverviewTab({ property, canWrite, publicPath, children }: PropertyOverviewTabProps) {
  const { t } = useTranslation();
  // The listing on the channels (E02/F03/US01/T04) is told only where the channel manager is connected: its endpoints answer 404 otherwise.
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const suggestions = property.pricingAdapterSummary;
  const hasPhotos = property.photoUrls?.some(isDisplayableMediaUrl);

  const photos = (
    <div className="relative min-w-0">
      {hasPhotos ? (
        <PropertyPhotoCarousel photoUrls={property.photoUrls} name={property.name} />
      ) : (
        <div className="flex aspect-[3/1] max-h-40 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-foreground/70">
          <ImageOff aria-hidden="true" className="size-8" />
          <span className="text-sm">{t('property.photos.emptyTitle')}</span>
        </div>
      )}
      {canWrite ? (
        <Button asChild variant="secondary" size="sm" className="absolute right-3 top-3 min-h-11 bg-card text-foreground shadow-sm">
          <Link to={propertyTabPath(property.id, 'photos')} data-testid="property-manage-photos">
            <ImagePlus aria-hidden="true" className="size-4" />
            {t(hasPhotos ? 'property.photos.manage' : 'property.photos.add')}
          </Link>
        </Button>
      ) : null}
    </div>
  );

  const facts = (
    <InfoCard
      icon={Building2}
      title={t('property.detail.sections.data')}
      action={canWrite ? { label: t('property.detail.edit'), href: propertyEditPath(property.id) } : undefined}
    >
      <IconFacts>
        <IconFact icon={MapPin} label={t('property.drawer.address')}>
          {formatPropertyLocation(property)}
        </IconFact>
      </IconFacts>
      <IconFacts layout="inline">
        <IconFact icon={BedDouble}>{t('property.table.bedroomsCount', { count: property.bedrooms })}</IconFact>
        <IconFact icon={Bath}>{t('property.table.bathroomsCount', { count: property.bathrooms })}</IconFact>
        <IconFact icon={Users}>{t('property.list.guestsCount', { count: property.maxGuests })}</IconFact>
      </IconFacts>
      <IconFacts>
        {requiresItalianCin(property.country) ? (
          <IconFact icon={ShieldCheck} label={t('property.drawer.cin')}>
            <PropertyCinBadge cinStatus={property.cinStatus} cinCode={property.cinCode} />
          </IconFact>
        ) : null}
        <IconFact icon={Clock} label={t('property.info.timezone')}>
          {property.timezone}
        </IconFact>
        {publicPath ? (
          <IconFact icon={Globe} label={t('property.detail.onSite')}>
            <a href={publicPath} target="_blank" rel="noopener noreferrer" className={FACT_LINK} data-testid="host-public-site-link">
              {t('property.detail.viewOnPublicSite')}
              <ExternalLink aria-hidden="true" className="ml-1.5 size-4 shrink-0" />
            </a>
          </IconFact>
        ) : null}
      </IconFacts>
      {property.cinIstatMismatch ? (
        <div className="flex flex-wrap items-center gap-1" role="note" data-testid="property-cin-istat-mismatch">
          <StatusPill tone="info" icon={Info}>
            {t('property.cin.istatMismatchShort')}
          </StatusPill>
          <ManualHint page="cin-identificazione-ticino" anchor="cin-cosa-e-e-cosa-controlla-casazen" title={t('property.drawer.cin')}>
            {t('property.cin.istatMismatch')}
          </ManualHint>
        </div>
      ) : null}
      {property.description ? (
        <details className="border-t border-border">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
            {t('property.detail.description')}
          </summary>
          <p className="whitespace-pre-line break-words pb-1 text-sm">{property.description}</p>
        </details>
      ) : null}
    </InfoCard>
  );

  return (
    <div className="@container space-y-4">
      <div className="grid min-w-0 gap-4 @3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @3xl:items-start">
        {photos}
        {facts}
      </div>

      <div className="grid min-w-0 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
        <InfoCard
          id={PRICING_SECTION_ID}
          className="scroll-mt-6"
          icon={Banknote}
          title={t('property.detail.sections.pricing')}
          action={{ label: t('property.detail.managePricing'), href: propertyPricingPath(property.id), testId: 'property-manage-pricing' }}
        >
          <div className="min-w-0">
            <p className="text-sm text-foreground/70">{t('property.info.nightlyRate')}</p>
            <p className="break-words text-3xl font-bold tabular-nums tracking-tight">{formatCurrency(property.nightlyRate, property.currency)}</p>
          </div>
          <Figures className="grid-cols-2">
            <Figure icon={BrushCleaning} label={t('property.info.cleaning')}>
              {formatCurrency(property.cleaningFee, property.currency)}
            </Figure>
            <Figure icon={ShieldCheck} label={t('property.info.deposit')}>
              {formatCurrency(property.damageDeposit, property.currency)}
            </Figure>
          </Figures>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-sm">
              <Sparkles aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
              {t('property.pricing.title')}
            </span>
            {suggestions.isEnabled ? (
              <StatusPill tone="success" icon={CheckCircle2}>
                {t('property.pricing.on')}
              </StatusPill>
            ) : (
              <StatusPill icon={CircleOff}>{t('property.pricing.off')}</StatusPill>
            )}
          </div>
          {suggestions.isEnabled ? (
            <IconFacts layout="inline">
              <IconFact icon={History} label={t('property.pricing.lastAdaptation')}>
                {suggestions.lastAdaptedAt ? formatDateTime(suggestions.lastAdaptedAt) : '—'}
              </IconFact>
              <IconFact icon={CalendarClock} label={t('property.pricing.nextRun')}>
                {suggestions.nextRunOn ? formatDate(suggestions.nextRunOn) : '—'}
              </IconFact>
            </IconFacts>
          ) : null}
        </InfoCard>

        <PropertyAmenitiesGrid amenities={property.amenities} />

        {connectorOn ? (
          <InfoCard icon={Share2} title={t('property.detail.sections.channels')} data-testid="property-channels">
            <MultiChannelStatus propertyId={property.id} canWrite={canWrite} cinValid={!requiresItalianCin(property.country) || isValidCin(property.cinCode)} />
          </InfoCard>
        ) : null}

        {children}
      </div>
    </div>
  );
}
