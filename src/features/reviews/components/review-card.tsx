import { BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { PublicReview } from '@/types';
import { formatStayMonth } from '../lib/review-format';
import { RatingStars } from './rating-stars';

/**
 * One review on the public page: who (the first name the guest agreed to show, or «Ospite»), the month of the stay, the stars, what
 * the guest wrote and, in a block of its own, the answer of the host. «Verificata» is shown only when the backend says so. The text is
 * plain text, never markup and never a link.
 */
export function ReviewCard({ review }: { review: PublicReview }) {
  const { t, i18n } = useTranslation();
  const month = formatStayMonth(review.stayMonth, i18n.language);

  return (
    <article className="public-site-card space-y-3 p-5" data-testid="review-card">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="break-words font-semibold">{review.authorName}</p>
          {month ? <p className="text-sm text-[var(--cz-public-muted)]">{month}</p> : null}
        </div>
        <p className="flex items-center gap-2">
          <RatingStars value={review.rating} />
          <span className="text-sm font-semibold">{t('siteReviews.ratingOf', { rating: review.rating })}</span>
        </p>
      </header>

      {review.verified ? (
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--cz-public-primary-text)]" data-testid="review-verified">
          <BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
          {t('siteReviews.verified.label')}
        </p>
      ) : null}

      {review.text ? <p className="whitespace-pre-line break-words leading-relaxed">{review.text}</p> : null}

      {review.hostReply ? (
        <div className="space-y-1 border-l-4 border-[var(--cz-public-border)] pl-4" data-testid="review-host-reply">
          <p className="text-sm font-semibold">
            {t('siteReviews.hostReply')}
            {review.hostRepliedAt ? (
              <span className="font-normal text-[var(--cz-public-muted)]"> · {formatRomeDateTime(review.hostRepliedAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            ) : null}
          </p>
          <p className="whitespace-pre-line break-words text-sm leading-relaxed">{review.hostReply}</p>
        </div>
      ) : null}
    </article>
  );
}
