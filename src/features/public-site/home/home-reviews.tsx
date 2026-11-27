import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { RatingStars } from '@/features/reviews/components/rating-stars';
import { ReviewCard } from '@/features/reviews/components/review-card';
import { formatAverage } from '@/features/reviews/lib/review-format';
import { buildPropertyBookingPath } from '@/lib/booking-url';
import { usePublicReviewsPreview } from '@/queries/use-public-stays';
import type { PublicStayCard } from '@/types/public-stays.types';
import type { SiteRating } from './home-model';

const SHOWN = 3;

function mostReviewed(cards: readonly PublicStayCard[]): PublicStayCard | undefined {
  return cards.reduce<PublicStayCard | undefined>(
    (best, card) => ((card.rating?.count ?? 0) > (best?.rating?.count ?? 0) ? card : best),
    undefined,
  );
}

export function HomeReviews({ slug, cards, rating }: { slug: string; cards: readonly PublicStayCard[]; rating: SiteRating }) {
  const { t, i18n } = useTranslation();
  const home = mostReviewed(cards);
  const reviews = usePublicReviewsPreview(slug, home?.id, SHOWN);
  const items = reviews.data?.items ?? [];
  const average = formatAverage(rating.average, i18n.language);

  return (
    <section className="hm-section hm-reviews" aria-labelledby="home-reviews-title" data-testid="home-reviews">
      <div className="hm-reviews__head">
        <div className="hm-score">
          <strong className="hm-score__n" aria-hidden="true">
            {average}
          </strong>
          <div>
            <RatingStars value={rating.average} className="size-5" />
            <span className="hm-score__t" aria-hidden="true">
              {t('siteHome.hero.reviews', { count: rating.count })}
            </span>
            <span className="sr-only">{t('siteReviews.summaryLabel', { count: rating.count, average })}</span>
          </div>
        </div>
        <div className="hm-head__text">
          <p className="hm-eyebrow">{t('siteHome.reviews.eyebrow')}</p>
          <h2 id="home-reviews-title">{t('siteHome.reviews.title')}</h2>
          <p className="hm-head__lead">{t('siteHome.reviews.lead')}</p>
        </div>
      </div>

      {items.length > 0 && home ? (
        <>
          <ul className="hm-reviews__list">
            {items.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
          <Link className="hm-more" to={`${buildPropertyBookingPath(slug, home)}#recensioni`}>
            {t('siteHome.reviews.all', { name: home.name })}
            <ArrowRight aria-hidden="true" />
          </Link>
        </>
      ) : null}
    </section>
  );
}
