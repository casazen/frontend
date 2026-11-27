import { useTranslation } from 'react-i18next';
import { MapPin, Star } from 'lucide-react';
import { useEmbed } from '@/features/embed/embed-context';
import { PublicCinLabel } from '@/features/properties/components/public-cin-label';
import { formatAverage } from '@/features/reviews/lib/review-format';
import { pickText } from '@/features/public-booking/lib/property-profile';
import { cn } from '@/lib/utils';
import type { PublicPropertyDetailDto } from '@/types';
import '@/features/public-booking/property-page.css';

/**
 * The title of the page (DB-04a): the name of the house, its mark when it has reviews, where it is, and its CIN. In the frame of an embeddable widget (NF-144) the
 * mark is not a link: it leads to the reviews of the page of the site, which the frame does not show, and an address of its own would be one more entry in the
 * history of a frame that has to know where its guest came from.
 */
export function PropertyHeader({ property }: { property: PublicPropertyDetailDto }) {
  const { t, i18n } = useTranslation();
  const embed = useEmbed();
  const zone = pickText(property.zone, i18n.language);
  const place = zone || [property.city?.trim(), property.postalCode?.trim() ? `(${property.postalCode.trim()})` : null].filter(Boolean).join(' ');
  const rating = property.ratingSummary;
  const ratingFace = rating ? (
    <>
      <Star className="h-[17px] w-[17px] fill-[var(--cz-public-star)] text-[var(--cz-public-star)]" aria-hidden />
      <strong>{formatAverage(rating.average, i18n.language)}</strong>
      <span className="sr-only">{t('publicProperty.header.outOfFive')}</span>
      <span className={cn('text-[var(--cz-public-muted)]', !embed && 'underline underline-offset-4')}>· {t('siteReviews.count', { count: rating.count })}</span>
    </>
  ) : null;
  const ratingClass = 'inline-flex min-h-11 items-center gap-1.5 text-[var(--cz-public-text)] no-underline';

  return (
    <header className="space-y-3" data-testid="property-header">
      <h1 id="page-title" tabIndex={-1} className="public-display text-balance break-words text-3xl font-semibold leading-tight outline-none md:text-4xl">
        {property.name}
      </h1>
      <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-1 p-0 text-[var(--cz-public-muted)]">
        {rating ? (
          <li>
            {embed ? (
              <span className={ratingClass} data-testid="property-rating">
                {ratingFace}
              </span>
            ) : (
              <a href="#recensioni" className={ratingClass} data-testid="property-rating">
                {ratingFace}
              </a>
            )}
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
