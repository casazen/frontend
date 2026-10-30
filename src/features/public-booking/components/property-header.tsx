import { useTranslation } from 'react-i18next';
import { MapPin, Star } from 'lucide-react';
import { PublicCinLabel } from '@/features/properties/components/public-cin-label';
import { formatAverage } from '@/features/reviews/lib/review-format';
import { pickText } from '@/features/public-booking/lib/property-profile';
import type { PublicPropertyDetailDto } from '@/types';
import '@/features/public-booking/property-page.css';

/** The title of the page (DB-04a): the name of the house, its mark when it has reviews, where it is, and its CIN. */
export function PropertyHeader({ property }: { property: PublicPropertyDetailDto }) {
  const { t, i18n } = useTranslation();
  const zone = pickText(property.zone, i18n.language);
  const place = zone || [property.city?.trim(), property.postalCode?.trim() ? `(${property.postalCode.trim()})` : null].filter(Boolean).join(' ');
  const rating = property.ratingSummary;

  return (
    <header className="space-y-3" data-testid="property-header">
      <h1 id="page-title" tabIndex={-1} className="public-display text-balance break-words text-3xl font-semibold leading-tight outline-none md:text-4xl">
        {property.name}
      </h1>
      <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-1 p-0 text-[var(--cz-public-muted)]">
        {rating ? (
          <li>
            <a href="#recensioni" className="inline-flex min-h-11 items-center gap-1.5 text-[var(--cz-public-text)] no-underline" data-testid="property-rating">
              <Star className="h-[17px] w-[17px] fill-[var(--cz-public-star)] text-[var(--cz-public-star)]" aria-hidden />
              <strong>{formatAverage(rating.average, i18n.language)}</strong>
              <span className="sr-only">{t('publicProperty.header.outOfFive')}</span>
              <span className="text-[var(--cz-public-muted)] underline underline-offset-4">· {t('siteReviews.count', { count: rating.count })}</span>
            </a>
          </li>
        ) : null}
        {place ? (
          <li className="inline-flex min-h-9 items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span>{place}</span>
          </li>
        ) : null}
        {property.cinStatus === 'Valid' && property.cinCode ? (
          <li>
            <PublicCinLabel cinStatus={property.cinStatus} cinCode={property.cinCode} className="text-[var(--cz-public-muted)]" />
          </li>
        ) : null}
      </ul>
    </header>
  );
}
