import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useSendReviewInvite } from '@/queries/use-reviews';
import type { ReviewInviteStatus } from '@/types';
import type { ReviewInviteView } from '../lib/review-invite';

const REVIEWS_PATH = '/app/short-rent/reviews';

interface ReviewInviteBlockProps {
  bookingId: string;
  status: ReviewInviteStatus;
  view: ReviewInviteView;
  canWrite: boolean;
  showReviewsLink?: boolean;
}

export function ReviewInviteBlock({ bookingId, status, view, canWrite, showReviewsLink = true }: ReviewInviteBlockProps) {
  const { t, i18n } = useTranslation();
  const send = useSendReviewInvite(bookingId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  let content: ReactNode;
  if (view === 'reviewed') {
    content = (
      <p className="text-sm" data-testid="review-invite-reviewed">
        {t('hostReviews.invite.reviewed')}
        {showReviewsLink ? (
          <>
            {' '}
            <Link to={REVIEWS_PATH} className="font-medium text-primary underline-offset-4 hover:underline">
              {t('hostReviews.invite.seeReviews')}
            </Link>
          </>
        ) : null}
      </p>
    );
  } else if (view === 'sent' && status.inviteSentAt) {
    content = (
      <p className="text-sm text-foreground/70" data-testid="review-invite-sent">
        {t('hostReviews.invite.sent', {
          date: formatRomeDateTime(status.inviteSentAt, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }),
        })}
      </p>
    );
  } else if (view === 'canInvite') {
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
  } else if (view === 'blocked' && (status.reason === 'window_closed' || status.reason === 'no_guest_address')) {
    content = (
      <p className="text-sm text-foreground/70" data-testid="review-invite-blocked">
        {t(`hostReviews.invite.blocked.${status.reason}`)}
      </p>
    );
  } else {
    return null;
  }

  return (
    <div className="space-y-2" data-testid="review-invite-block">
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
    </div>
  );
}
