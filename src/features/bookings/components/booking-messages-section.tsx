import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { MessageComposer, MessageThread, type ThreadItem } from '@/components/shared/message-thread';
import { Button } from '@/components/ui/button';
import { usePageVisible } from '@/hooks/use-page-visible';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage, getRetryAfterSeconds } from '@/lib/api-errors';
import { useBookingThread, useMarkThreadRead, useSendBookingMessage } from '@/queries/use-booking-messages';
import { GUEST_MESSAGE_MAX_LENGTH, type Booking } from '@/types';

interface BookingMessagesSectionProps {
  booking: Booking;
}

/**
 * The conversation with the guest of a booking (SR-12), in the tab «Messaggi» of the booking and in its drawer: the same thread the
 * guest reads in its area, and a box to answer. The guest's messages are marked as read once the host has this in front of it (the tab visible, and the right to
 * write: marking is a write); an answer marks them too. The first message may be the host's: the guest gets an e-mail without the
 * text and reads it in the area of its booking. A closed thread (the seventh day after the check-out) can be read and not written. The
 * text of the messages is the guest's personal data: shown as plain text, never kept anywhere but in the memory of the page.
 */
export function BookingMessagesSection({ booking }: BookingMessagesSectionProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('short-rent', 'booking.write');
  const online = useOnlineStatus();
  const thread = useBookingThread(booking.id);
  const { mutate: markAsRead } = useMarkThreadRead(booking.id);
  const { pending, send, retry } = useSendBookingMessage(booking.id);

  // The newest message already marked, so that a failed mark is not repeated at every render.
  const unread = thread.data?.unreadCount ?? 0;
  const newest = thread.data?.messages.at(-1)?.id ?? null;
  const marked = useRef<string | null>(null);
  // A thread in a tab the user is not looking at is not read: it is marked once the tab is in front again.
  const visible = usePageVisible();
  useEffect(() => {
    if (!canWrite || !visible || unread === 0 || newest === null || marked.current === newest) return;
    marked.current = newest;
    markAsRead();
  }, [canWrite, visible, unread, newest, markAsRead]);

  const guestName = [booking.guest.firstName, booking.guest.lastName].filter(Boolean).join(' ').trim() || t('booking.messages.guestFallback');
  const firstName = booking.guest.firstName?.trim() || guestName;
  const you = t('booking.messages.you');
  const items: ThreadItem[] = [
    ...(thread.data?.messages ?? []).map((message) => ({
      id: message.id,
      mine: message.sender === 'Host',
      author: message.sender === 'Host' ? you : guestName,
      text: message.text,
      at: message.createdAt,
    })),
    ...pending.map((message) => ({ id: message.key, mine: true, author: you, text: message.text, at: null, status: message.status })),
  ];

  const failed = pending.find((message) => message.status === 'failed');
  const retryAfter = failed ? getRetryAfterSeconds(failed.error) : undefined;
  const sendProblem = failed
    ? retryAfter !== undefined
      ? t('booking.messages.rateLimited', { count: Math.max(1, Math.ceil(retryAfter / 60)) })
      : (getProblemMessage(failed.error, t) ?? t('booking.messages.sendError'))
    : null;

  if (thread.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="booking-messages-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('booking.messages.loading')}
      </p>
    );
  }

  if (thread.isError || !thread.data) {
    return (
      <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert" data-testid="booking-messages-error">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
        <div className="space-y-2">
          <p className="text-sm text-destructive">{getProblemMessage(thread.error, t) ?? t('booking.messages.loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void thread.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('booking.messages.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (thread.data.state === 'Unavailable') {
    return (
      <p className="text-sm text-muted-foreground" data-testid="booking-messages-unavailable">
        {t('booking.messages.unavailable')}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="booking-messages">
      <MessageThread
        items={items}
        label={t('booking.messages.logLabel', { name: guestName })}
        emptyText={t('booking.messages.empty', { name: firstName })}
        onRetry={retry}
      />

      {sendProblem && (
        <p className="text-sm text-destructive" role="alert" data-testid="booking-messages-send-problem">
          {sendProblem}
        </p>
      )}

      {thread.data.state === 'Closed' ? (
        <div className="space-y-1 rounded-lg border bg-muted/40 p-3" data-testid="booking-messages-closed">
          <p className="font-medium">{t('booking.messages.closedTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('booking.messages.closedDescription')}</p>
        </div>
      ) : canWrite ? (
        <div className="space-y-1">
          <MessageComposer
            label={t('booking.messages.composerLabel', { name: firstName })}
            placeholder={t('booking.messages.placeholder')}
            maxLength={GUEST_MESSAGE_MAX_LENGTH}
            disabledReason={online ? null : t('booking.messages.offline')}
            onSend={send}
          />
          <p className="text-xs text-muted-foreground">{t('booking.messages.warning', { name: firstName })}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="booking-messages-read-only">
          {t('booking.messages.readOnly')}
        </p>
      )}
    </div>
  );
}
