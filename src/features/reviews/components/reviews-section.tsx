import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublicReviews } from '@/queries/use-reviews';
import type { RatingSummary } from '@/types';
import { formatAverage } from '../lib/review-format';
import { RatingStars } from './rating-stars';
import { ReviewCard } from './review-card';

interface ReviewsSectionProps {
  orgSlug: string;
  /** Id of the property (the reviews are read by it). */
  propertyId: string;
  /** From the property: the page draws this section only when there is one, so there are never empty stars or a «0 recensioni». */
  summary: RatingSummary;
}

/**
 * The reviews on the page of a property (DB-12b): the average and the number at the top, then the reviews, newest first, ten at a
 * time with "Carica altre". «Verificate» is explained once, in a "?" next to the number, not on every card.
 */
export function ReviewsSection({ orgSlug, propertyId, summary }: ReviewsSectionProps) {
  const { t, i18n } = useTranslation();
  const reviews = usePublicReviews(orgSlug, propertyId);
  const items = reviews.data?.pages.flatMap((page) => page.items) ?? [];
  const average = formatAverage(summary.average, i18n.language);

  return (
    <section id="recensioni" aria-labelledby="property-reviews-title" className="scroll-mt-20 space-y-5" data-testid="property-reviews">
      <div className="space-y-2">
        <h2 id="property-reviews-title" className="public-display text-2xl font-semibold">
          {t('siteReviews.title')}
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <RatingStars value={summary.average} className="size-5" />
          <p className="text-sm">
            {/* A screen reader gets one sentence ("4,8 su 5, 27 recensioni verificate"), the eyes the number and the count. */}
            <span aria-hidden="true">
              <strong className="text-base">{average}</strong>
              <span className="text-[var(--cz-public-muted)]">
                {' · '}
                {t('siteReviews.count', { count: summary.count })}
              </span>
            </span>
            <span className="sr-only">{t('siteReviews.summaryLabel', { count: summary.count, average })}</span>
          </p>
          <span className="inline-flex items-center gap-1 text-sm text-[var(--cz-public-muted)]">
            {t('siteReviews.verified.all')}
            <HelpTip title={t('siteReviews.verified.title')} label={t('siteReviews.verified.helpLabel')}>
              {t('siteReviews.verified.help')}
            </HelpTip>
          </span>
        </div>
      </div>

      {reviews.isLoading ? (
        <div role="status" aria-busy="true" className="space-y-3" data-testid="property-reviews-loading">
          <span className="sr-only">{t('siteReviews.loading')}</span>
          <Skeleton className="h-28 w-full rounded-[var(--cz-public-radius)] motion-reduce:animate-none" aria-hidden="true" />
          <Skeleton className="h-28 w-full rounded-[var(--cz-public-radius)] motion-reduce:animate-none" aria-hidden="true" />
        </div>
      ) : reviews.isError && items.length === 0 ? (
        <div role="alert" className="public-site-card space-y-3 p-5" data-testid="property-reviews-error">
          <p>{t('siteReviews.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void reviews.refetch()}>
            {t('siteReviews.retry')}
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-3" aria-label={t('siteReviews.listLabel')}>
            {items.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
          {reviews.isError ? (
            <p role="alert" className="text-sm text-destructive" data-testid="property-reviews-more-error">
              {t('siteReviews.loadError')}
            </p>
          ) : null}
          {reviews.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              disabled={reviews.isFetchingNextPage}
              onClick={() => void reviews.fetchNextPage()}
              data-testid="property-reviews-more"
            >
              {reviews.isFetchingNextPage ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
              {reviews.isFetchingNextPage ? t('siteReviews.loadingMore') : t('siteReviews.loadMore')}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
