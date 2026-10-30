import type { CSSProperties, ReactNode } from 'react';
import { Link, type To } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bath, BedDouble, Home, MapPin, Users } from 'lucide-react';
import { PublicCinLabel } from '@/features/properties/components/public-cin-label';
import {
  positiveCount,
  propertyPlace,
  sectionsOfProperty,
  type PropertyCardSections,
} from '@/features/public-site/lib/property-card-sections';
import { FavoriteButton } from '@/features/public-site/favorites/favorite-button';
import { useSiteMoney } from '@/features/public-site/hooks/use-site-money';
import { displayableMediaUrls } from '@/lib/media-url';
import type { PublicPropertyDto } from '@/types';

/** The width from which the grid of the cards has more than one column: `sm` on the landing page, `md` in the search. */
type AlignFrom = 'sm' | 'md';

interface PublicPropertyCardProps {
  property: PublicPropertyDto;
  /**
   * The property's page on the booking site (`buildPropertyBookingPath`, search params kept by the caller). Absent when
   * the page is not known (a search result without its org slug): the card is then shown without a link rather than
   * with one that leads nowhere (BK-20).
   */
  to?: To;
  /**
   * The parts that the cards of the grid have (`propertyCardSections` of the list). Every card takes a row for each of them, an
   * empty one where it has not the part, so that the name, the description, the facts and the price of the cards of a row start
   * at the same height. Without it, the card has the rows of its own parts alone.
   */
  sections?: PropertyCardSections;
  /** The width from which the grid has more than one column (default `sm`): the cards line up from there. */
  alignFrom?: AlignFrom;
  /**
   * The slug of the booking site whose favourites the heart on the photo saves the home in (DB-02b). Absent, as on the pages of
   * CasaZen (search, guides), there is no heart: the list belongs to a host's site.
   */
  favoriteSite?: string;
}

// Spelled out, so that Tailwind finds the classes. Below `alignFrom` there is one column, the cards do not have to line up with
// anything: the card is a plain column of its parts, with no empty rows.
const ALIGNED: Record<AlignFrom, { card: string; empty: string }> = {
  sm: { card: 'sm:grid sm:grid-rows-subgrid sm:gap-y-0 sm:[grid-row:span_var(--card-rows)]', empty: 'max-sm:hidden' },
  md: { card: 'md:grid md:grid-rows-subgrid md:gap-y-0 md:[grid-row:span_var(--card-rows)]', empty: 'max-md:hidden' },
};

/**
 * Property card of the public booking site, painted with the site's theme tokens (`--cz-public-*`). The whole card is
 * one link (on the title), so it can be opened in a new tab and read as one item by a screen reader.
 *
 * Where the grid has several columns the card is a subgrid of it (it has to be a direct child of the grid): each part is a row,
 * as tall as the tallest part of it among the cards of the grid row, so that a name on three lines or a longer description does
 * not push down only the facts and the price of its own card. The rows have no gap: the space between them is the top margin of
 * each part, and the side padding is on each part too (the image runs edge to edge).
 */
export function PublicPropertyCard({ property, to, sections, alignFrom = 'sm', favoriteSite }: PublicPropertyCardProps) {
  const { t } = useTranslation();
  const money = useSiteMoney();
  const [photo] = displayableMediaUrls(property.photoUrls);
  const bedrooms = positiveCount(property.bedrooms);
  const bathrooms = positiveCount(property.bathrooms);
  const guests = positiveCount(property.maxGuests);
  const nightlyRate = positiveCount(property.nightlyRate);
  const place = propertyPlace(property);
  const own = sectionsOfProperty(property);
  const shown = {
    place: own.place || sections?.place === true,
    cin: own.cin || sections?.cin === true,
    description: own.description || sections?.description === true,
    facts: own.facts || sections?.facts === true,
  };
  // The image, the name and the price line are always there: 3 rows, and one more for each of the parts of the grid.
  const rowCount = 3 + Object.values(shown).filter(Boolean).length;
  const aligned = ALIGNED[alignFrom];

  /** An optional part of the card: the part, or an empty row where this card has not it but another card of the grid has. */
  const row = (isShown: boolean, part: ReactNode) => (isShown ? (part ?? <div className={aligned.empty} />) : null);

  return (
    <article
      className={`public-site-card group relative flex flex-col overflow-hidden focus-within:ring-2 focus-within:ring-[var(--cz-public-primary-text)] focus-within:ring-offset-2 ${aligned.card}`}
      style={{ '--card-rows': rowCount } as CSSProperties}
      data-testid="public-property-card"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--cz-public-bg)]">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--cz-public-muted)]" data-testid="public-property-card-no-photo">
            <Home className="h-10 w-10" aria-hidden />
          </div>
        )}
      </div>

      {/* Above the stretched link of the title (z-10), out of the rows of the card (absolute). */}
      {favoriteSite ? (
        <FavoriteButton
          site={favoriteSite}
          propertyId={property.id}
          propertyName={property.name}
          className="absolute right-3 top-3 z-10"
        />
      ) : null}

      <h3 className="public-display px-4 pt-4 text-lg leading-snug">
        {to ? (
          <Link to={to} className="outline-none after:absolute after:inset-0" data-testid="public-property-card-link">
            {property.name}
          </Link>
        ) : (
          property.name
        )}
      </h3>

      {row(
        shown.place,
        place ? (
          <p className="mt-1 flex items-center gap-1 px-4 text-sm text-[var(--cz-public-muted)]">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{place}</span>
          </p>
        ) : null,
      )}

      {row(shown.cin, own.cin ? <PublicCinLabel cinStatus={property.cinStatus} cinCode={property.cinCode} className="mt-3 px-4" /> : null)}

      {row(
        shown.description,
        property.description ? <p className="mt-3 line-clamp-2 px-4 text-sm text-[var(--cz-public-muted)]">{property.description}</p> : null,
      )}

      {row(
        shown.facts,
        own.facts ? (
          <ul className="mt-3 flex flex-wrap content-start gap-x-4 gap-y-1 px-4 text-sm" data-testid="public-property-card-facts">
            {guests ? (
              <li className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[var(--cz-public-primary-text)]" aria-hidden />
                {t('publicSite.card.guests', { count: guests })}
              </li>
            ) : null}
            {bedrooms ? (
              <li className="flex items-center gap-1.5">
                <BedDouble className="h-4 w-4 text-[var(--cz-public-primary-text)]" aria-hidden />
                {t('publicSite.card.bedrooms', { count: bedrooms })}
              </li>
            ) : null}
            {bathrooms ? (
              <li className="flex items-center gap-1.5">
                <Bath className="h-4 w-4 text-[var(--cz-public-primary-text)]" aria-hidden />
                {t('publicSite.card.bathrooms', { count: bathrooms })}
              </li>
            ) : null}
          </ul>
        ) : null,
      )}

      <div className="mx-4 mt-3 flex items-end justify-between gap-3 border-t border-[var(--cz-public-border)] pb-4 pt-3">
        {nightlyRate ? (
          <p data-testid="public-property-card-price">
            <span className="text-xs text-[var(--cz-public-muted)]">{t('publicSite.card.from')} </span>
            <span className="public-display text-xl">{money(nightlyRate, property.currency)}</span>
            <span className="text-sm text-[var(--cz-public-muted)]"> {t('publicSite.card.perNight')}</span>
          </p>
        ) : (
          <span />
        )}
        {to ? (
          <span className="public-site-cta px-3 py-1.5 text-sm" aria-hidden>
            {t('publicSite.card.details')}
          </span>
        ) : null}
      </div>
    </article>
  );
}
