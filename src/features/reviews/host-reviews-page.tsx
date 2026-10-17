import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useHostReviews } from '@/queries/use-reviews';
import type { HostReview } from '@/types';
import { RatingStars } from './components/rating-stars';
import { ReplyReviewDialog } from './components/reply-review-dialog';
import { ReportReviewDialog } from './components/report-review-dialog';
import { formatStayMonth } from './lib/review-format';

const DAY = { day: 'numeric', month: 'long', year: 'numeric' } as const;

interface HostReviewCardProps {
  review: HostReview;
  canWrite: boolean;
  onReply: (review: HostReview) => void;
  onReport: (review: HostReview) => void;
}

/** One review in the host's list: the stars and the words, where it stands, the host's own answer, and what the host can still do. */
function HostReviewCard({ review, canWrite, onReply, onReport }: HostReviewCardProps) {
  const { t, i18n } = useTranslation();
  const month = formatStayMonth(review.stayMonth, i18n.language);
  const removed = review.status === 'Removed';
  const canReply = canWrite && !removed && !review.hostReply;
  const canReport = canWrite && !removed && !review.reportedAt;

  return (
    <li className="space-y-3 rounded-lg bg-card p-4 ring-1 ring-inset ring-border" data-testid="host-review" data-status={review.status}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="break-words font-semibold">{review.authorName}</p>
          <p className="break-words text-sm text-foreground/70">
            <Link to={`/app/short-rent/properties/${review.propertyId}`} className="underline-offset-4 hover:underline">
              {review.propertyName}
            </Link>
            {month ? ` · ${month}` : ''}
          </p>
        </div>
        <p className="flex items-center gap-2">
          <RatingStars value={review.rating} />
          <span className="text-sm font-semibold">{t('siteReviews.ratingOf', { rating: review.rating })}</span>
        </p>
      </div>

      {review.status === 'Reported' ? (
        <Badge variant="warning" data-testid="host-review-reported">
          {t('hostReviews.status.reported')}
        </Badge>
      ) : null}
      {removed ? (
        <Badge variant="destructive" data-testid="host-review-removed">
          {t('hostReviews.status.removed')}
        </Badge>
      ) : null}

      {review.text ? <p className="whitespace-pre-line break-words text-sm leading-relaxed">{review.text}</p> : <p className="text-sm text-foreground/70">{t('hostReviews.noText')}</p>}

      {review.hostReply ? (
        <div className="space-y-1 border-l-4 border-primary/30 pl-3" data-testid="host-review-reply">
          <p className="text-sm font-semibold">
            {t('hostReviews.yourReply')}
            {review.hostRepliedAt ? <span className="font-normal text-foreground/70"> · {formatRomeDateTime(review.hostRepliedAt, i18n.language, DAY)}</span> : null}
          </p>
          <p className="whitespace-pre-line break-words text-sm leading-relaxed">{review.hostReply}</p>
        </div>
      ) : null}

      {canReply || canReport ? (
        <div className="flex flex-wrap gap-2">
          {canReply ? (
            <Button type="button" size="sm" className="min-h-11 md:min-h-0" onClick={() => onReply(review)} data-testid="host-review-reply-open">
              {t('hostReviews.actions.reply')}
            </Button>
          ) : null}
          {canReport ? (
            <Button type="button" size="sm" variant="outline" className="min-h-11 md:min-h-0" onClick={() => onReport(review)} data-testid="host-review-report-open">
              {t('hostReviews.actions.report')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * `/app/short-rent/reviews`: the reviews of the host's properties (DB-12b), newest first, "Carica altre" for the older ones. The host
 * answers each once and reports the ones that break the rules; it can neither hide nor delete one, and the page says so. A person who
 * cannot write bookings only reads. The invitation of a guest starts from the booking, not from here.
 */
export function HostReviewsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('short-rent', 'booking.write');
  const reviews = useHostReviews();
  const [replying, setReplying] = useState<HostReview | null>(null);
  const [reporting, setReporting] = useState<HostReview | null>(null);
  const items = reviews.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <AppShell>
      <div className="space-y-6" data-testid="host-reviews-page">
        <PageHeader title={t('hostReviews.title')} description={t('hostReviews.description')} />

        {reviews.isLoading ? (
          <div role="status" aria-busy="true" className="space-y-3" data-testid="host-reviews-loading">
            <span className="sr-only">{t('hostReviews.loading')}</span>
            <Skeleton className="h-32 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
            <Skeleton className="h-32 w-full rounded-lg motion-reduce:animate-none" aria-hidden="true" />
          </div>
        ) : reviews.isError && items.length === 0 ? (
          <ErrorState testId="host-reviews-error" title={t('hostReviews.loadError')} error={reviews.error} onRetry={() => void reviews.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Star} title={t('hostReviews.empty.title')} description={t('hostReviews.empty.description')} />
        ) : (
          <>
            <ul className="space-y-3" aria-label={t('hostReviews.listLabel')}>
              {items.map((review) => (
                <HostReviewCard key={review.id} review={review} canWrite={canWrite} onReply={setReplying} onReport={setReporting} />
              ))}
            </ul>
            {reviews.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {t('hostReviews.loadError')}
              </p>
            ) : null}
            {reviews.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={reviews.isFetchingNextPage}
                onClick={() => void reviews.fetchNextPage()}
                data-testid="host-reviews-more"
              >
                {reviews.isFetchingNextPage ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
                {reviews.isFetchingNextPage ? t('siteReviews.loadingMore') : t('siteReviews.loadMore')}
              </Button>
            ) : null}
          </>
        )}
      </div>

      <ReplyReviewDialog review={replying} open={replying !== null} onOpenChange={(open) => !open && setReplying(null)} />
      <ReportReviewDialog review={reporting} open={reporting !== null} onOpenChange={(open) => !open && setReporting(null)} />
    </AppShell>
  );
}
