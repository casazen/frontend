import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRomeDateTime, todayInRome } from '@/lib/stay-dates';
import { useReviewInviteStatus, useSendReviewInvite } from '@/queries/use-reviews';
import type { Booking } from '@/types';

/** Where the host reads and answers its reviews. */
const REVIEWS_PATH = '/app/short-rent/reviews';

/** Only a booking made through the site, not cancelled, whose check-out day has passed can be reviewed: no question for any other. */
function mayBeReviewed(booking: Booking): boolean {
  return (
    booking.source === 'Direct' &&
    (booking.status === 'Confirmed' || booking.status === 'CheckedIn' || booking.status === 'CheckedOut') &&
    booking.checkOutDate.slice(0, 10) < todayInRome()
  );
}

/**
 * "Chiedi una recensione" on the booking of a stay that is over (DB-12b): the host asks the guest for the review, and one email with
 * the link leaves, once, when the host confirms. Nothing is sent by itself. The panel says what happened (asked, reviewed) and, when
 * the host cannot ask, why; for the bookings that are not reviewable it draws nothing at all.
 */
export function ReviewInvitePanel({ booking, canWrite }: { booking: Booking; canWrite: boolean }) {
  const { t, i18n } = useTranslation();
  const reviewable = mayBeReviewed(booking);
  const status = useReviewInviteStatus(booking.id, reviewable);
  const send = useSendReviewInvite(booking.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!reviewable) return null;

  let content: ReactNode = null;
  if (status.isLoading) {
    content = <Skeleton className="h-10 w-48 motion-reduce:animate-none" aria-hidden="true" />;
  } else if (status.data) {
    const data = status.data;
    if (data.reviewed) {
      content = (
        <p className="text-sm" data-testid="review-invite-reviewed">
          {t('hostReviews.invite.reviewed')}{' '}
          <Link to={REVIEWS_PATH} className="font-medium text-primary underline-offset-4 hover:underline">
            {t('hostReviews.invite.seeReviews')}
          </Link>
        </p>
      );
    } else if (data.inviteSentAt) {
      content = (
        <p className="text-sm text-foreground/70" data-testid="review-invite-sent">
          {t('hostReviews.invite.sent', {
            date: formatRomeDateTime(data.inviteSentAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }),
          })}
        </p>
      );
    } else if (data.canInvite) {
      content = (
        <div className="space-y-3">
          <p className="max-w-prose text-sm text-foreground/70">{t('hostReviews.invite.description')}</p>
          {canWrite ? (
            <Button type="button" className="min-h-11" onClick={() => setConfirmOpen(true)} data-testid="review-invite-open">
              <Send className="mr-2 size-4" aria-hidden="true" />
              {t('hostReviews.invite.action')}
            </Button>
          ) : null}
        </div>
      );
    } else if (data.reason === 'window_closed' || data.reason === 'no_guest_address') {
      content = (
        <p className="text-sm text-foreground/70" data-testid="review-invite-blocked">
          {t(`hostReviews.invite.blocked.${data.reason}`)}
        </p>
      );
    }
  }

  // Nothing to say (not reviewable after all, or the state could not be read): the section does not appear.
  if (content === null) return null;

  return (
    <PlainSection title={t('hostReviews.invite.title')} data-testid="review-invite-panel">
      {content}
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('hostReviews.invite.confirmTitle')}
        description={t('hostReviews.invite.confirmDescription')}
        confirmLabel={t('hostReviews.invite.confirm')}
        consequences={[t('hostReviews.invite.once'), t('hostReviews.invite.public')]}
        isLoading={send.isPending}
        onConfirm={async () => {
          try {
            await send.mutateAsync();
          } catch {
            // The toast of the mutation tells what went wrong, and the state above is read again.
          }
        }}
      />
    </PlainSection>
  );
}
