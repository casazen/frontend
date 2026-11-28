import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarDays, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { FROM_DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { usePageTitle } from '@/hooks/use-page-title';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { withListReturn } from '@/lib/list-return';
import { MESSAGES_PATH } from '@/lib/message-hub-routes';
import { useReviewThread } from '@/queries/use-ota-reviews';
import { BookingCard } from './components/booking-card';
import { InboxPane } from './components/inbox-pane';
import { ReviewThread } from './components/review-thread';
import { guestProfilePath } from './lib/guest-profile';
import { EMPTY_HOST_REVIEW, type HostReviewDraft } from './lib/review-model';

function ReviewSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3" data-testid="review-thread-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-64 w-full rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-28 w-full rounded-xl motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/**
 * `/app/short-rent/messages/otareview:…` and `…/review:…`: one review of a guest, of a channel or of the booking site (E05/F06/US02, NF-69), in the place of a conversation (`ThreadPage` tells the
 * two apart by the key). The review in the middle, the list beside it on desktop (the list of the reviews, `view=reviews`) and the booking in a third pane on wide screens; on narrower screens the
 * booking opens on demand. It reads again when it opens, on return to the window, every minute while visible and when the in-app notifications change (a review that appears, a reply the channel
 * confirmed or lost).
 *
 * A reading that failed is not a review: the page says it could not read (with a retry), never the review of an older reading, and a 404 is told as a 404 even when an older reading is still in the
 * cache. What the host typed (the reply, the host's own review) belongs to the page and survives that: it is in the boxes again when the review is read again. The state of the page belongs to
 * the review: another one starts clean.
 */
export function ReviewThreadView({ threadKey }: { threadKey: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const { search } = useLocation();
  const canWrite = hasPermission('short-rent', 'booking.write');
  const withList = useMediaQuery(FROM_DESKTOP_QUERY);
  const thread = useReviewThread(threadKey);
  const [typedReply, setTypedReply] = useState<string | null>(null);
  const [hostDraft, setHostDraft] = useState<HostReviewDraft>(EMPTY_HOST_REVIEW);
  const data = thread.data;
  const status = getHttpStatus(thread.error);
  const replyText = typedReply ?? (data?.reply.state === 'Error' ? (data.reply.text ?? '') : '');

  const title = data && !thread.isError ? data.guestName?.trim() || data.booking?.guestName || t('reviews.thread.title') : t('reviews.thread.title');
  usePageTitle(title);
  const listPath = search ? `${MESSAGES_PATH}${search}` : withListReturn(MESSAGES_PATH);

  let content: ReactNode;
  if (thread.isError && (status === 404 || status === 400)) {
    content = (
      <EmptyState
        icon={SearchX}
        title={t('reviews.thread.notFound')}
        description={t('reviews.thread.notFoundHint')}
        action={{ label: t('messages.thread.backToList'), href: withListReturn(MESSAGES_PATH) }}
      />
    );
  } else if (thread.isPending) {
    content = <ReviewSkeleton label={t('reviews.thread.loading')} />;
  } else if (thread.isError || !data) {
    content = <ErrorState testId="review-thread-error" title={t('reviews.thread.loadError')} error={thread.error} onRetry={() => void thread.refetch()} />;
  } else {
    const booking = data.booking ? (
      <BookingCard
        card={data.booking}
        bookingPath={`/app/short-rent/bookings/${encodeURIComponent(data.booking.bookingId)}`}
        profilePath={guestProfilePath(data.customer?.guestId, hasPermission, flags)}
      />
    ) : (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground" data-testid="booking-card-none">
        {t('reviews.thread.noBooking')}
      </p>
    );
    content = (
      <div
        className="grid min-w-0 flex-1 overflow-hidden rounded-2xl border bg-card lg:min-h-[26rem] lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]"
        data-testid="messages-workspace"
      >
        {withList ? (
          <aside aria-label={t('messages.inbox.title')} className="flex min-h-0 min-w-0 flex-col">
            <InboxPane selectedKey={threadKey} compact canWrite={canWrite} />
          </aside>
        ) : null}
        <ReviewThread
          review={data}
          title={title}
          canWrite={canWrite}
          listPath={listPath}
          bookingDetails={
            (
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    {t('messages.bookingCard.details')}
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby={undefined} className="sm:max-h-[85dvh] sm:overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t('messages.bookingCard.details')}</DialogTitle>
                  </DialogHeader>
                  {booking}
                </DialogContent>
              </Dialog>
            )
          }
          replyText={replyText}
          onReplyText={setTypedReply}
          hostDraft={hostDraft}
          onHostDraft={setHostDraft}
        />
      </div>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-1 flex-col gap-4 lg:min-h-0" data-app-viewport data-testid="messages-thread-page">
        {!data || thread.isError ? <PageHeader title={title} crumbs="auto" /> : null}
        {content}
      </div>
    </AppShell>
  );
}
