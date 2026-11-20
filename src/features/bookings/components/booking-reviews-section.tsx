import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, MessageSquare, RefreshCw } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelBadge } from '@/features/messages/components/channel-badge';
import { actionStateVariant, ratingText, reasonText, reviewProblemMessage } from '@/features/messages/lib/review-model';
import { RatingStars } from '@/features/reviews/components/rating-stars';
import { ReviewInviteBlock } from '@/features/reviews/components/review-invite-panel';
import { reviewInviteViewOf } from '@/features/reviews/lib/review-invite';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus, getRetryAfterSeconds } from '@/lib/api-errors';
import { reviewThreadPath } from '@/lib/message-hub-routes';
import { formatRomeDateTime, todayInRome } from '@/lib/stay-dates';
import { useBookingReviews, useRefreshBookingReviews } from '@/queries/use-ota-reviews';
import { useReviewInviteStatus } from '@/queries/use-reviews';
import { REVIEW_MAX_RATING, type Booking, type BookingReviewItem, type OtaReviewActionState } from '@/types';
import { bookingReviewsKindOf, type BookingReviewsKind } from '../lib/booking-reviews';
import { bookingSourceName } from '../lib/ota-stay';

const PUBLISHED_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** Where the reply to a review stands, in the words of the list of the booking: it is never «published» until the channel says so. */
function replyWords(state: OtaReviewActionState, t: TFunction): string {
  switch (state) {
    case 'Sent':
      return t('reviews.booking.reply.sent');
    case 'Error':
      return t('reviews.booking.reply.error');
    case 'ManualVerify':
      return t('reviews.booking.reply.manualVerify');
    default:
      return t('reviews.booking.reply.none');
  }
}

/** One review of the booking: the stars in words, the channel, when it was published, the first words, where the reply stands, and the way to the review in the messages. */
function BookingReviewItemRow({ item }: { item: BookingReviewItem }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const rating = typeof item.rating === 'number' ? item.rating : null;
  const published = item.publishedAt ? formatRomeDateTime(item.publishedAt, locale, PUBLISHED_FORMAT) : '';
  const preview = item.preview?.trim();

  return (
    <li className="space-y-1.5" data-testid="booking-review-item" data-thread-key={item.threadKey}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {rating !== null ? (
          <>
            <RatingStars value={rating} />
            <span className="text-sm font-medium">{t('reviews.thread.ratingOf', { rating: ratingText(rating, locale), max: REVIEW_MAX_RATING })}</span>
          </>
        ) : null}
        <ChannelBadge channel={item.channel} />
        {published ? <span className="text-xs text-foreground/70">{published}</span> : null}
      </div>
      {preview ? <p className="line-clamp-3 break-words text-sm">{preview}</p> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Badge variant={actionStateVariant(item.replyState)} data-testid="booking-review-reply-state" data-state={item.replyState}>
          {replyWords(item.replyState, t)}
        </Badge>
        <Link
          to={reviewThreadPath(item.threadKey)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="booking-review-open"
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          {t('reviews.booking.open')}
        </Link>
      </div>
    </li>
  );
}

interface BookingReviewsSectionProps {
  booking: Booking;
  /** The host may write the bookings (`booking.write`): asking the guest of the site for a review needs it. */
  canWrite: boolean;
}

/**
 * «Recensioni» on the page of a booking (E05/F06/US02, NF-69, AC-NF69-1): the one section of the reviews of the stay, which holds both what was there before (the host asks the guest of the
 * booking site for a review, DB-12b) and the reviews of the guests, of the site and of the channel, each with its stars, the first words, where the reply stands and «Apri nei Messaggi»; never two
 * sections. For an Airbnb stay it also has «Aggiorna», which reads the booking from the channel manager now (at most once every ten minutes: the answer to a second click says in how many minutes
 * to try again); with no review it says «Nessuna recensione per ora». For Booking.com, Vrbo and Expedia the channel manager gives no review and takes no reply: the section says so in one sentence,
 * and shows nothing in place of a review.
 *
 * It is drawn only where there is something to say (`bookingReviewsKindOf`): a stay of the site once it is over, a stay of a portal while the connector of the channel manager is on (with it
 * off nothing is drawn or asked), and never for a stay that does not happen. A reading that failed is told as such, with a retry, and never shown as the reviews of an older reading.
 */
export function BookingReviewsSection({ booking, canWrite }: BookingReviewsSectionProps) {
  const { flags } = useFeatureFlags();
  const kind = bookingReviewsKindOf(booking, flags.octorateConnector, todayInRome());
  if (kind === null) return null;
  return <BookingReviewsBody booking={booking} canWrite={canWrite} kind={kind} />;
}

function BookingReviewsBody({ booking, canWrite, kind }: BookingReviewsSectionProps & { kind: BookingReviewsKind }) {
  const { t, i18n } = useTranslation();
  const reviews = useBookingReviews(booking.id, true);
  const invite = useReviewInviteStatus(booking.id, kind === 'direct');
  const refresh = useRefreshBookingReviews(booking.id);

  const title = t('reviews.booking.title');
  if (reviews.isPending || (kind === 'direct' && invite.isPending)) {
    return (
      <PlainSection title={title} data-testid="booking-reviews">
        <div role="status" aria-busy="true" data-testid="booking-reviews-loading">
          <span className="sr-only">{t('reviews.booking.loading')}</span>
          <Skeleton aria-hidden="true" className="h-16 w-full max-w-xl motion-reduce:animate-none" />
        </div>
      </PlainSection>
    );
  }

  // A reading that failed says so: it is never the reviews of the reading before (TanStack Query keeps the old data on an error).
  const data = reviews.isError ? undefined : reviews.data;
  const items = data?.items ?? [];
  const limit = data && !data.channelCapabilities.canRead ? data.channelCapabilities.reason : null;
  const inviteStatus = kind === 'direct' ? invite.data : undefined;
  const inviteView = reviewInviteViewOf(inviteStatus);

  // Nothing to say: a booking with no reviews at all, or a stay of the site that nobody asked about and nobody reviewed.
  if (data && (limit === 'no_reviews_for_booking_source' || (kind === 'direct' && inviteView === null && items.length === 0))) return null;

  const canRefresh = kind === 'channel' && data !== undefined && data.channelCapabilities.canRead;
  const wait = getRetryAfterSeconds(refresh.error);
  const refreshProblem = !refresh.isError
    ? null
    : wait !== undefined
      ? t('reviews.booking.refreshTooSoon', { count: Math.max(1, Math.ceil(wait / 60)) })
      : (reviewProblemMessage(refresh.error, t) ?? t('reviews.booking.refreshFailed'));
  const readAt = data?.lastSyncedAt ? formatRomeDateTime(data.lastSyncedAt, i18n.language) : '';

  return (
    <PlainSection title={title} data-testid="booking-reviews">
      {inviteStatus && inviteView ? (
        <ReviewInviteBlock bookingId={booking.id} status={inviteStatus} view={inviteView} canWrite={canWrite} showReviewsLink={!items.some((item) => item.source === 'Review')} />
      ) : null}

      {reviews.isError && getHttpStatus(reviews.error) === 404 ? (
        // A 404 is told as a 404, whatever an older reading holds: the reviews of a booking that is gone, or out of the reach of the caller, are not shown.
        <p className="max-w-prose text-sm text-foreground/70" role="status" data-testid="booking-reviews-not-found">
          {t('reviews.booking.notFound')}
        </p>
      ) : reviews.isError ? (
        <Alert
          variant="danger"
          icon={AlertCircle}
          data-testid="booking-reviews-error"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void reviews.refetch()}>
              {t('shared.errorFallback.tryAgain')}
            </Button>
          }
        >
          {t('reviews.booking.loadError')}
        </Alert>
      ) : limit ? (
        // The channel gives no review and takes no reply: the one sentence, never a placeholder review.
        <p className="max-w-prose text-sm text-foreground/70" data-testid="booking-reviews-limit">
          {reasonText(limit, t, bookingSourceName(booking, t)) ?? t('reviews.booking.limit')}
        </p>
      ) : (
        <>
          {canRefresh ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="booking-reviews-read">
              <Button type="button" variant="outline" size="sm" onClick={() => refresh.mutate()} loading={refresh.isPending} data-testid="booking-reviews-refresh">
                <RefreshCw className="size-4" aria-hidden="true" />
                {t('reviews.booking.refresh')}
              </Button>
              {readAt ? <span className="text-xs text-foreground/70">{t('reviews.booking.readAt', { when: readAt })}</span> : null}
            </div>
          ) : null}
          {refreshProblem ? (
            <p role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]" data-testid="booking-reviews-refresh-problem">
              {refreshProblem}
            </p>
          ) : null}
          {canRefresh && data?.lastSyncError ? (
            <p className="max-w-prose text-sm text-foreground/70" data-testid="booking-reviews-read-failed">
              {t('reviews.booking.readFailed', { reason: reasonText(data.lastSyncError, t) ?? t('reviews.booking.readFailedUnknown') })}
            </p>
          ) : null}
          {items.length > 0 ? (
            <ul className="space-y-4" aria-label={t('reviews.booking.listLabel')} data-testid="booking-reviews-list">
              {items.map((item) => (
                <BookingReviewItemRow key={item.threadKey} item={item} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground/70" data-testid="booking-reviews-empty">
              {t('reviews.booking.empty')}
            </p>
          )}
        </>
      )}
    </PlainSection>
  );
}
