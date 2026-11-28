import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { RatingStars } from '@/features/reviews/components/rating-stars';
import { messageThreadPath } from '@/lib/message-hub-routes';
import { cn } from '@/lib/utils';
import { REVIEW_MAX_RATING, type MessageHubThread } from '@/types';
import { ratingText } from '../lib/review-model';
import { formatListTime, formatStayRange } from '../lib/thread-format';
import { ChannelBadge } from './channel-badge';
import { GuestAvatar } from './guest-avatar';

interface ReviewRowProps {
  thread: MessageHubThread;
  selected: boolean;
  /** The query string the row keeps, so that the page of the review draws the same list. */
  search: string;
  now: Date;
  compact: boolean;
}

export function ReviewRow({ thread, selected, search, now, compact }: ReviewRowProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const guest = thread.guestName?.trim() || t('messages.thread.sender.guest');
  const preview = thread.preview?.trim() || t('reviews.row.noText');
  const stay = formatStayRange(thread.checkInDate, thread.checkOutDate, locale);
  const rating = typeof thread.rating === 'number' ? thread.rating : null;

  return (
    <li>
      <Link
        to={`${messageThreadPath(thread.threadKey)}${search}`}
        aria-current={selected ? 'true' : undefined}
        data-testid="message-thread-row"
        data-thread-key={thread.threadKey}
        data-kind="review"
        className={cn(
          'grid min-h-11 grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-xl px-3 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          selected ? 'bg-accent ring-1 ring-inset ring-primary/30' : 'bg-card',
        )}
      >
        <GuestAvatar name={thread.guestName} className="row-span-2" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{guest}</p>
            {rating !== null ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm" data-testid="review-row-rating">
                <RatingStars value={rating} />
                <span className="font-medium">{t('reviews.thread.ratingOf', { rating: ratingText(rating, locale), max: REVIEW_MAX_RATING })}</span>
              </p>
            ) : null}
            <p className="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground">{preview}</p>
          </div>
          <time dateTime={thread.lastMessageAt} className="shrink-0 text-xs text-foreground/70">
            {formatListTime(thread.lastMessageAt, locale, now)}
          </time>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/70">
          <ChannelBadge channel={thread.channel} />
          {thread.bookingCode ? <span>{thread.bookingCode}</span> : null}
          {thread.propertyName ? <span className="min-w-0 truncate">{thread.propertyName}</span> : null}
          {!compact && stay ? <span>{stay}</span> : null}
          {thread.needsReply ? (
            <Badge variant="warning" data-testid="review-row-not-answered">
              {t('reviews.row.notAnswered')}
            </Badge>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
