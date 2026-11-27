import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEmbed } from '@/features/embed/embed-context';
import {
  EMBED_FROM_BOOKING,
  EMBED_FROM_QUERY_KEY,
  buildEmbedPropertyUrl,
  embedBookingHref,
  embedCampaignOf,
} from '@/features/embed/embed-urls';
import { useEmbedBridge } from '@/features/embed/use-embed-bridge';
import { PropertyGallery } from '@/features/public-site/components/PropertyGallery';
import { AvailabilitySection } from '@/features/public-booking/booking/availability-section';
import { BookingCard } from '@/features/public-booking/booking/booking-card';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { BookingProvider } from '@/features/public-booking/booking/booking-provider';
import { quoteTotalCents } from '@/features/public-booking/booking/quote-helpers';
import { AmenitySkeleton } from '@/features/public-booking/components/property-page-states';
import { PropertyHeader } from '@/features/public-booking/components/property-header';
import { PropertyOverview } from '@/features/public-booking/components/property-overview';
import { PropertyRules } from '@/features/public-booking/components/property-rules';
import { propertyHasRules } from '@/features/public-booking/lib/property-profile';
import { viewItemEvent } from '@/lib/ga4-ecommerce';
import type { PublicOrgDto, PublicPropertyDetailDto } from '@/types';

const AmenityGrid = lazy(() => import('@/features/public-site/components/AmenityGrid').then((m) => ({ default: m.AmenityGrid })));

/**
 * `view_item` once for each home and stay (NF-144): the key is the home with its dates and guests. The total of the stay is the quote of the server, so with
 * dates chosen the event waits for the quote (a stay that cannot be quoted, a quote that failed, or no dates at all, is told without a total at once); a
 * change of the stay is a new event, the arrival of its quote is not. Never without a page to tell (`bridge.active`). The payload is the builder of
 * `ga4-ecommerce`: the id, the name and the place of the home, and the money of the quote: nothing about the guest.
 */
function useViewItemEvent(property: PublicPropertyDetailDto) {
  const { active, send } = useEmbedBridge();
  const { stay, quote } = useBooking();
  const told = useRef<string | null>(null);
  const key = [property.id, stay.checkIn, stay.checkOut, stay.adults, stay.children].join('|');
  const waiting = quote.status === 'loading';

  useEffect(() => {
    if (!active || waiting || told.current === key) return;
    told.current = key;
    const priced = quote.status === 'ready';
    send.event('view_item', {
      ...viewItemEvent({
        propertyId: property.id,
        propertyName: property.name,
        place: property.city,
        currency: priced ? quote.quote.currency || property.currency : property.currency,
        total: priced ? quoteTotalCents(quote.quote) / 100 : null,
      }),
    });
  }, [active, waiting, key, quote, property, send]);
}

/**
 * Where the guest can go from the widget: back to the results they came from, and the page of the site for what the frame does not do. Both are plain links.
 *
 * «Back to results» is there only when the address says the guest came from the booking widget (`from=booking`). When the home was opened by a link of this very
 * frame (a push of the router, which only the cards of the booking widget make) the previous entry of the history is the list, with its filters, so it goes back
 * to it. Otherwise (the address was opened on its own, or the frame was loaded again) the previous entry may be a page of another site, and a step back
 * would leave it: it is a link to the booking widget with the same stay.
 *
 * «Open on the site» opens the page of the home on the booking site in the whole window (`target="_top"`), with the stay, the language and the same attribution as the
 * checkout; it is also the way to a home that takes no booking online.
 */
function EmbedPropertyNav({ property }: { property: PublicPropertyDetailDto }) {
  const { t } = useTranslation();
  const embed = useEmbed();
  const navigate = useNavigate();
  const { search } = useLocation();
  const navigationType = useNavigationType();
  const { stay } = useBooking();
  const [cameFromInside] = useState(() => navigationType === 'PUSH');
  if (!embed) return null;

  const campaign = embedCampaignOf(search);
  const fromBooking = new URLSearchParams(search).get(EMBED_FROM_QUERY_KEY) === EMBED_FROM_BOOKING;
  const siteUrl = buildEmbedPropertyUrl({
    origin: window.location.origin,
    hostMode: embed.hostMode,
    orgSlug: embed.orgSlug,
    property: { id: property.id, slug: property.slug },
    stay,
    lang: embed.lang,
    campaign,
  });
  const linkClass = 'inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-[var(--cz-public-text)] underline-offset-4 hover:underline';

  return (
    <nav aria-label={t('embed.property.navLabel')} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1" data-testid="embed-property-nav">
      {fromBooking ? (
        cameFromInside ? (
          <button type="button" className={linkClass} onClick={() => navigate(-1)} data-testid="embed-property-back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('embed.property.backToResults')}
          </button>
        ) : (
          <Link to={embedBookingHref(embed, { stay, campaign })} className={linkClass} data-testid="embed-property-back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('embed.property.backToResults')}
          </Link>
        )
      ) : (
        <span />
      )}
      <a href={siteUrl} target="_top" rel="noopener" className={linkClass} data-testid="embed-property-open-site">
        {t('embed.property.openOnSite')}
        <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    </nav>
  );
}

function EmbedPropertyBody({ property, hostLabel }: { property: PublicPropertyDetailDto; hostLabel: string | null }) {
  const { t } = useTranslation();
  useViewItemEvent(property);

  const description = property.description?.trim() ?? '';
  const amenities = (property.amenities ?? []).filter((amenity) => amenity.trim() !== '');

  return (
    <div className="space-y-6 md:space-y-8" data-testid="embed-property">
      <EmbedPropertyNav property={property} />
      <PropertyGallery photoUrls={property.photoUrls} alt={property.name} />

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <PropertyHeader property={property} />
        </div>

        <aside aria-label={t('propertyBooking.aside')} className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <BookingCard />
        </aside>

        <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-2">
          <PropertyOverview property={property} description={description} hostLabel={hostLabel} hasHostCard={false} />

          {amenities.length > 0 ? (
            <section id="servizi" aria-labelledby="property-amenities-title" className="space-y-5">
              <h2 id="property-amenities-title" className="public-display text-2xl font-semibold">
                {t('publicBooking.servicesTitle')}
              </h2>
              <Suspense fallback={<AmenitySkeleton />}>
                <AmenityGrid amenities={amenities} />
              </Suspense>
            </section>
          ) : null}

          <AvailabilitySection />

          {propertyHasRules(property) ? <PropertyRules property={property} /> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * One home in a frame (NF-144), the page of the home of the booking site without what a frame has no room for: gallery, title, overview, amenities, the
 * calendar, the quote of the stay of the address (the tourist tax in it) and the rules, with the card to choose the stay. Left out: the card of the host and every
 * dialog to write to the host (forms with personal data, and one of them keeps a token in the storage of the browser), the bar fixed to the bottom of the window
 * and its sheet, the bar of the sections, the reviews, the plan, the zone, the structured data of the search engines and the viewer of the photos (all of them are
 * fixed to a window as tall as the frame, or do not belong to a page that is not indexed).
 *
 * The stay is the one of the address (`checkin`, `checkout`, `guests`, `children`, `pets`), as on the page of the site. The org is the one of the frame.
 */
export function EmbedPropertyView({ property, org, orgSlug }: { property: PublicPropertyDetailDto; org: PublicOrgDto; orgSlug: string }) {
  const hostLabel = property.hostName?.trim() || org.displayName?.trim() || '';

  return (
    <BookingProvider property={property} orgSlug={orgSlug} hostLabel={hostLabel} contactEmail={org.contactEmail}>
      <EmbedPropertyBody property={property} hostLabel={hostLabel || null} />
    </BookingProvider>
  );
}
