import type { HTMLAttributes, MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Award, Check, MapPin, Star } from 'lucide-react';
import { HelpTip } from '@/components/ui/help-tip';
import { FavoriteButton } from '@/features/public-site/favorites/favorite-button';
import { formatAverage } from '@/features/reviews/lib/review-format';
import { formatDayMonth, formatPrice } from '@/features/public-site/stay/stay-format';
import type { StayState } from '@/features/public-site/stay/stay-state';
import { listAmenities } from '@/lib/public-amenities';
import { siteLocale } from '@/lib/site-language';
import { cn } from '@/lib/utils';
import type { PublicStayCard } from '@/types/public-stays.types';
import {
  availabilityNote,
  cardFacts,
  cardLink,
  cardPrice,
  freeCancellationUntil,
  isGuestFavourite,
  placeOfCard,
} from './house-card-model';
import { PhotoCarousel } from './photo-carousel';
import { SITE_TAG_ICONS, isSiteTag } from './site-tags';
import './house-card.css';

/** The amenities a row card shows as icons: the ones guests look for first (the catalog puts them first). */
const ROW_AMENITIES = 5;
/** The labels a row card writes out. */
const ROW_TAGS = 3;

export interface HouseCardProps {
  card: PublicStayCard;
  /**
   * The slug of the booking site: the page of the home and the list of hearts belong to it. In the search across all the sites it is
   * left out: each home brings its own (`card.orgSlug`), there is no list of hearts and the host is named on the card.
   */
  orgSlug?: string;
  /** `grid` for the home, `row` for the results: more facts, the amenities, the labels and the cancellation. */
  variant?: 'grid' | 'row';
  /** The nights of the stay chosen (`result.nights`): with them the card gives the total, without them the night price. */
  nights?: number | null;
  /** The stay chosen: the page of the home opens with the same dates and guests. */
  stay?: StayState | null;
  /** The link with the map (`useMapLink().bind(id)`): the card lights its pin and the pin lights the card. */
  mapLink?: HTMLAttributes<HTMLElement>;
  /** The photo of the first cards is the one the page waits for. */
  eager?: boolean;
}

/**
 * A home of the booking site in a list (DB-07b, DB-07c): the photos, the heart, the name as the one link of the card (stretched
 * over all of it), the mark, the place, the facts and the price. The price is what the server says: the night while no dates are
 * chosen and, with dates, the total of the quote, with a word on the tourist tax that does not promise more than is known (the
 * tax is an estimate until the ages of the children are, and it is said). A label such as «Preferita dagli ospiti» is worked out
 * from the marks and never written by hand; the free cancellation is shown only with its date and only when the guest can use it.
 */
export function HouseCard({ card, orgSlug, variant = 'grid', nights = null, stay = null, mapLink, eager = false }: HouseCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = siteLocale(i18n.language);
  // Across all the sites the home brings the slug of its own site; on a site it is the site's.
  const site = orgSlug ?? card.orgSlug ?? '';
  const ofAllSites = orgSlug === undefined;
  const host = ofAllSites ? card.hostName?.trim() : '';
  const to = cardLink(site, card, stay);
  const facts = cardFacts(card);
  const price = cardPrice(card, nights);
  const currency = card.price.currency || 'EUR';
  const place = placeOfCard(card, i18n.language);
  const favourite = isGuestFavourite(card);
  const freeUntil = variant === 'row' ? freeCancellationUntil(card) : null;
  const amenities = variant === 'row' ? listAmenities(card.amenities).slice(0, ROW_AMENITIES) : [];
  const tags = variant === 'row' ? card.tags.filter(isSiteTag).slice(0, ROW_TAGS) : [];
  const average = card.rating ? formatAverage(card.rating.average, i18n.language) : '';
  const unavailable = availabilityNote(card, t, locale);

  const factLine = [
    facts.guests ? t('publicSite.card.guests', { count: facts.guests }) : null,
    facts.bedrooms ? t('publicSite.card.bedrooms', { count: facts.bedrooms }) : null,
    facts.bathrooms ? t('publicSite.card.bathrooms', { count: facts.bathrooms }) : null,
    facts.areaSqm ? t('siteHome.card.area', { count: facts.areaSqm }) : null,
  ].filter(Boolean);

  // The photo opens the home too (the link is stretched over the text; the photo has to be above it to be swiped).
  const openFromPhoto = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button, a')) return;
    navigate(to);
  };

  return (
    <article className={cn('hcard', `hcard--${variant}`, unavailable && 'hcard--off')} data-testid="house-card" data-prop={card.id} {...mapLink}>
      <div className="hcard__media" onClick={openFromPhoto}>
        <PhotoCarousel photos={card.photos} label={t('siteHome.card.photosOf', { name: card.name })} eager={eager} />
        {favourite ? (
          <div className="hcard__badges">
            <span
              className="hcard__chip"
              title={t('siteHome.card.guestFavouriteHint', { average, count: card.rating?.count ?? 0 })}
            >
              <Award aria-hidden="true" />
              {t('siteHome.card.guestFavourite')}
            </span>
          </div>
        ) : null}
        {ofAllSites ? null : <FavoriteButton site={site} propertyId={card.id} propertyName={card.name} className="hcard__heart" />}
      </div>

      <div className="hcard__body">
        <div className="hcard__top">
          <h3 className="hcard__title">
            <Link to={to} className="hcard__stretch" data-testid="house-card-link">
              {card.name}
            </Link>
          </h3>
          {card.rating ? (
            <p className="hcard__rating">
              <Star aria-hidden="true" />
              <strong aria-hidden="true">{average}</strong>
              <span aria-hidden="true">({card.rating.count})</span>
              <span className="sr-only">{t('siteHome.card.ratingLabel', { average, count: card.rating.count })}</span>
            </p>
          ) : null}
        </div>

        {/* In a grid the cards of a row share their rows (subgrid): a part this card has not is an empty row, so that the next ones stay in step. */}
        {place ? (
          <p className="hcard__zone">
            <MapPin aria-hidden="true" />
            {place}
          </p>
        ) : variant === 'grid' ? (
          <p className="hcard__zone" aria-hidden="true" />
        ) : null}
        {factLine.length > 0 ? (
          <p className="hcard__facts">{factLine.join(' · ')}</p>
        ) : variant === 'grid' ? (
          <p className="hcard__facts" aria-hidden="true" />
        ) : null}
        {host ? (
          <p className="hcard__host" data-testid="house-card-host">
            {t('platformSearch.card.host', { host })}
          </p>
        ) : null}

        {variant === 'row' ? (
          <>
            {amenities.length > 0 ? (
              <ul className="hcard__amen" aria-label={t('siteHome.card.mainAmenities')}>
                {amenities.map((amenity) => {
                  const Icon = amenity.icon;
                  const label = amenity.labelKey ? t(amenity.labelKey) : amenity.fallbackLabel;
                  return (
                    <li key={amenity.id} title={label}>
                      <Icon aria-hidden="true" />
                      <span className="sr-only">{label}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {tags.length > 0 ? (
              <ul className="hcard__tags">
                {tags.map((tag) => {
                  const Icon = SITE_TAG_ICONS[tag];
                  return (
                    <li key={tag}>
                      <Icon aria-hidden="true" />
                      {t(`siteHome.tags.${tag}`)}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        ) : null}

        <div className="hcard__foot">
          {unavailable ? (
            <p className="hcard__off-note" data-testid="house-card-off">
              {unavailable}
            </p>
          ) : price.kind === 'total' ? (
            <>
              <p className="hcard__price" data-testid="house-card-price" data-kind="total">
                <strong>{formatPrice(price.totalCents, currency, locale)}</strong>
                <span>{t('siteHome.card.totalFor', { count: price.nights })}</span>
              </p>
              <p className="hcard__sub">
                {t('siteHome.card.perNightAverage', { price: formatPrice(price.perNightCents, currency, locale) })}
                {' · '}
                {t(`siteHome.card.tax.${price.tax}`)}
                {price.tax === 'estimated' ? (
                  <HelpTip title={t('siteHome.card.taxHelpTitle')} label={t('siteHome.card.taxHelpLabel')} className="hcard__help">
                    {t('siteHome.card.taxHelp')}
                  </HelpTip>
                ) : null}
              </p>
            </>
          ) : (
            <p className="hcard__price" data-testid="house-card-price" data-kind="from">
              <span>{t('publicSite.card.from')}</span>
              <strong>{formatPrice(price.perNightCents, currency, locale)}</strong>
              <span>/ {t('siteHome.card.night')}</span>
            </p>
          )}
          {freeUntil && !unavailable ? (
            <p className="hcard__ok">
              <Check aria-hidden="true" />
              {t('siteHome.card.freeCancellation', { date: formatDayMonth(freeUntil, locale) })}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
