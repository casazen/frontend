import { Link, type To } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bath, BedDouble, Home, MapPin, Users } from 'lucide-react';
import { PublicCinLabel } from '@/features/properties/components/public-cin-label';
import { displayableMediaUrls } from '@/lib/media-url';
import { formatCurrency } from '@/lib/utils';
import type { PublicPropertyDto } from '@/types';

interface PublicPropertyCardProps {
  property: PublicPropertyDto;
  /** The property's page on the booking site (`buildPropertyBookingPath`, search params kept by the caller). */
  to: To;
}

/** A positive finite count, or null: a missing or malformed number is left out, never shown as "NaN" or "0". */
function positiveCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Property card of the public booking site, painted with the site's theme tokens (`--cz-public-*`). The whole card is
 * one link (on the title), so it can be opened in a new tab and read as one item by a screen reader.
 */
export function PublicPropertyCard({ property, to }: PublicPropertyCardProps) {
  const { t } = useTranslation();
  const [photo] = displayableMediaUrls(property.photoUrls);
  const bedrooms = positiveCount(property.bedrooms);
  const bathrooms = positiveCount(property.bathrooms);
  const guests = positiveCount(property.maxGuests);
  const nightlyRate = positiveCount(property.nightlyRate);
  const place = [property.city?.trim(), property.postalCode?.trim() ? `(${property.postalCode.trim()})` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className="public-site-card group relative flex flex-col overflow-hidden focus-within:ring-2 focus-within:ring-[var(--cz-public-primary-text)] focus-within:ring-offset-2"
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

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <h3 className="public-display text-lg leading-snug">
            <Link to={to} className="outline-none after:absolute after:inset-0" data-testid="public-property-card-link">
              {property.name}
            </Link>
          </h3>
          {place ? (
            <p className="flex items-center gap-1 text-sm text-[var(--cz-public-muted)]">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-1">{place}</span>
            </p>
          ) : null}
        </div>

        <PublicCinLabel cinStatus={property.cinStatus} cinCode={property.cinCode} />

        {property.description ? (
          <p className="line-clamp-2 text-sm text-[var(--cz-public-muted)]">{property.description}</p>
        ) : null}

        {guests || bedrooms || bathrooms ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="public-property-card-facts">
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
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--cz-public-border)] pt-3">
          {nightlyRate ? (
            <p data-testid="public-property-card-price">
              <span className="text-xs text-[var(--cz-public-muted)]">{t('publicSite.card.from')} </span>
              <span className="public-display text-xl">{formatCurrency(nightlyRate)}</span>
              <span className="text-sm text-[var(--cz-public-muted)]"> {t('publicSite.card.perNight')}</span>
            </p>
          ) : (
            <span />
          )}
          <span className="public-site-cta px-3 py-1.5 text-sm" aria-hidden>
            {t('publicSite.card.details')}
          </span>
        </div>
      </div>
    </article>
  );
}
