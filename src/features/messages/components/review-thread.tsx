import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RatingStars } from '@/features/reviews/components/rating-stars';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { REVIEW_MAX_RATING, type ReviewThread as ReviewThreadData } from '@/types';
import { channelLabel } from '../lib/channels';
import { categoryLabel, ratingText, reasonText, type HostReviewDraft } from '../lib/review-model';
import { ChannelBadge } from './channel-badge';
import { GuestAvatar } from './guest-avatar';
import { HostReviewSection } from './host-review-form';
import { ReviewReplySection } from './review-reply';

const PUBLISHED_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** What the guest wrote: the stars in words, the marks of the categories, the words and when they were published. */
function GuestReview({ review }: { review: ReviewThreadData }) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const locale = i18n.language;
  const rating = typeof review.rating === 'number' ? review.rating : null;
  const text = review.text?.trim();
  const published = review.publishedAt ? formatRomeDateTime(review.publishedAt, locale, PUBLISHED_FORMAT) : '';

  return (
    <section aria-labelledby={titleId} className="space-y-3" data-testid="review-guest">
      <h2 id={titleId} className="text-base font-semibold">
        {t('reviews.thread.guest.title')}
      </h2>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="review-rating">
        {rating !== null ? (
          <>
            <RatingStars value={rating} className="size-6" />
            <p className="text-lg font-semibold">{t('reviews.thread.ratingOf', { rating: ratingText(rating, locale), max: REVIEW_MAX_RATING })}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('reviews.thread.noRating')}</p>
        )}
      </div>

      {review.categoryRatings.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2" data-testid="review-categories">
          {review.categoryRatings.map((rating) => (
            <div key={rating.category} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{categoryLabel(rating.category, t)}</dt>
              <dd className="font-medium tabular-nums">{t('reviews.thread.categoryValue', { value: ratingText(rating.value, locale), max: REVIEW_MAX_RATING })}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {text ? (
        <p className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm" data-testid="review-guest-text">
          {text}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('reviews.thread.noText')}</p>
      )}

      {published ? <p className="text-xs text-muted-foreground">{t('reviews.thread.publishedAt', { when: published })}</p> : null}
    </section>
  );
}

interface ReviewThreadProps {
  review: ReviewThreadData;
  /** The heading of the page: the guest, or «Recensione». */
  title: string;
  /** The host may write the bookings (`booking.write`): the reply, the draft and the host's own review need it. */
  canWrite: boolean;
  /** Where «Torna ai messaggi» goes (the list as it was left). */
  listPath: string;
  /** The booking on a screen too narrow to have it beside the review: a button that opens it. */
  bookingDetails?: ReactNode;
  /** What the host has typed in the reply and in the host's own review: the page keeps it, so a failed reading cannot take the words away. */
  replyText: string;
  onReplyText: (text: string | null) => void;
  hostDraft: HostReviewDraft;
  onHostDraft: (draft: HostReviewDraft) => void;
}

/**
 * One review in the middle column of the page of the messages (E05/F06/US02, NF-69, AC-NF69-2): where it comes from, the stars with their categories, the words of the guest, the host's reply with
 * its state (and, while the host has not answered and the channel allows it, the box with the draft of the assistant), and, for Airbnb, the host's own review of the guest. A review of a channel that
 * cannot be read or answered shows one sentence about what is not available and why, and nothing in its place: no placeholder review, never. How the last read of the channel manager went is told
 * too, so what is shown is not taken for newer than it is. The booking is beside it (`ThreadPage`).
 */
export function ReviewThread({ review, title, canWrite, listPath, bookingDetails, replyText, onReplyText, hostDraft, onHostDraft }: ReviewThreadProps) {
  const { t, i18n } = useTranslation();
  const name = review.guestName?.trim() || review.booking?.guestName || t('messages.thread.sender.guest');
  const readable = review.capabilities.canRead;
  const notAnswered = readable && (review.reply.state === 'None' || review.reply.state === 'Error');
  const readAt = review.lastSyncedAt ? formatRomeDateTime(review.lastSyncedAt, i18n.language) : '';

  return (
    <section className="flex min-h-0 min-w-0 flex-col lg:border-l" aria-label={t('reviews.thread.title')} data-testid="review-thread" data-source={review.source}>
      <header className="shrink-0 space-y-2 border-b px-4 py-3 sm:px-5">
        <Link
          to={listPath}
          className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('messages.thread.backToList')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
            <GuestAvatar name={name} />
            <div className="min-w-0">
              <h1 className="break-words text-xl font-semibold tracking-tight">{title}</h1>
              {review.propertyName ? <p className="break-words text-sm text-muted-foreground">{review.propertyName}</p> : null}
            </div>
          </div>
          {bookingDetails}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ChannelBadge channel={review.channel} />
          {notAnswered ? (
            <Badge variant="warning" data-testid="review-not-answered">
              {t('reviews.row.notAnswered')}
            </Badge>
          ) : null}
          {review.source === 'OtaReview' && readAt ? <span>{t('reviews.thread.readAt', { when: readAt })}</span> : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 p-3 sm:p-5 lg:overflow-y-auto lg:overscroll-contain" data-testid="review-thread-body">
        {readable ? (
          <>
            {review.lastSyncError ? (
              <Alert variant="warning" title={t('reviews.thread.readFailed')} data-testid="review-read-error">
                <p>{reasonText(review.lastSyncError, t) ?? t('reviews.thread.readFailedUnknown')}</p>
                <p className="mt-1">{t('reviews.thread.readFailedHint')}</p>
              </Alert>
            ) : null}
            <GuestReview review={review} />
            <ReviewReplySection review={review} canWrite={canWrite} text={replyText} onText={onReplyText} />
            <HostReviewSection review={review} canWrite={canWrite} draft={hostDraft} onDraft={onHostDraft} />
          </>
        ) : (
          // The channel gives no reviews and takes no reply (Booking.com, Vrbo, Expedia), or the connection is off: the one sentence, and nothing in its place.
          <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status" data-testid="review-thread-limit">
            {reasonText(review.capabilities.reason, t, channelLabel(review.channel, t)) ?? t('reviews.thread.unavailable')}
          </p>
        )}
      </div>
    </section>
  );
}
