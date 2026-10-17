import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageComposer, MessageThread, type ThreadItem } from '@/components/shared/message-thread';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { getHttpStatus, getProblemMessage, getRetryAfterSeconds } from '@/lib/api-errors';
import { useGuestThread, useSendGuestMessage } from '@/queries/use-guest-messages';
import { GUEST_MESSAGE_MAX_LENGTH, type GuestBookingDetails, type GuestBookingStatus, type GuestSession } from '@/types';

/** The states of a booking that has a thread: confirmed, or the stay in progress / over (the backend answers 404 for the others). */
const MESSAGING_STATUSES: readonly GuestBookingStatus[] = ['Confirmed', 'StayInProgress', 'StayCompleted'];

interface GuestMessagesSectionProps {
  session: GuestSession;
  booking: GuestBookingDetails;
}

/**
 * «Messaggi» of the guest area (DB-14b): the thread with the host and a box to write to them, under the booking of "Le mie prenotazioni"
 * (the {@link GuestAreaSlot} hooks it in). Nothing is shown for a booking that is not confirmed or has no thread. The thread is read
 * again every minute while the page is visible; a message goes out at once as «sending» and has its own retry; when the thread is closed
 * (the seventh day after the check-out) it can be read and not written, and the guest is pointed to the host's contact. The text of the
 * messages is the guest's and the host's own: it is shown as plain text, never stored in the browser and never put in an error report.
 */
export function GuestMessagesSection({ session, booking }: GuestMessagesSectionProps) {
  if (!MESSAGING_STATUSES.includes(booking.status)) return null;
  return <GuestMessages session={session} booking={booking} />;
}

function GuestMessages({ session, booking }: GuestMessagesSectionProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const online = useOnlineStatus();
  const thread = useGuestThread(session);
  const { pending, redacted, send, retry } = useSendGuestMessage(session);

  // No thread for this booking (cancelled, not confirmed): nothing to show, not even a placeholder.
  if (thread.isError && getHttpStatus(thread.error) === 404) return null;

  const hostName = booking.host.name ?? t('publicBooking.guestMessages.hostFallback');
  const you = t('publicBooking.guestMessages.you');
  const items: ThreadItem[] = [
    ...(thread.data?.messages ?? []).map((message) => ({
      id: message.id,
      mine: message.sender === 'Guest',
      author: message.sender === 'Guest' ? you : hostName,
      text: message.text,
      at: message.createdAt,
    })),
    ...pending.map((message) => ({
      id: message.key,
      mine: true,
      author: you,
      text: message.text,
      at: null,
      status: message.status,
    })),
  ];

  const failed = pending.find((message) => message.status === 'failed');
  const retryAfter = failed ? getRetryAfterSeconds(failed.error) : undefined;
  const sendProblem = failed
    ? retryAfter !== undefined
      ? t('publicBooking.guestMessages.rateLimited', { count: Math.max(1, Math.ceil(retryAfter / 60)) })
      : (getProblemMessage(failed.error, t) ?? t('publicBooking.guestMessages.sendError'))
    : null;

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-3 rounded-lg border bg-card p-4 sm:p-5"
      data-testid="guest-messages"
    >
      <div className="space-y-1">
        <h3 id={headingId} className="text-lg font-semibold">
          {t('publicBooking.guestMessages.title')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('publicBooking.guestMessages.intro')}</p>
      </div>

      {thread.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="guest-messages-loading">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('publicBooking.guestMessages.loading')}
        </p>
      )}

      {thread.isError && !thread.data && (
        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert" data-testid="guest-messages-error">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              {getProblemMessage(thread.error, t) ?? t('publicBooking.guestMessages.loadError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void thread.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('publicBooking.guestMessages.retry')}
            </Button>
          </div>
        </div>
      )}

      {thread.data && (
        <>
          <MessageThread
            items={items}
            label={t('publicBooking.guestMessages.logLabel')}
            emptyText={t('publicBooking.guestMessages.empty')}
            onRetry={retry}
          />

          {sendProblem && (
            <p className="text-sm text-destructive" role="alert" data-testid="guest-messages-send-problem">
              {sendProblem}
            </p>
          )}
          {redacted && (
            <p className="text-sm text-amber-800" role="status" data-testid="guest-messages-redacted">
              {t('publicBooking.guestMessages.redacted')}
            </p>
          )}

          {thread.data.state === 'Open' ? (
            <div className="space-y-1">
              <MessageComposer
                label={t('publicBooking.guestMessages.composerLabel')}
                placeholder={t('publicBooking.guestMessages.placeholder')}
                maxLength={GUEST_MESSAGE_MAX_LENGTH}
                disabledReason={online ? null : t('publicBooking.guestMessages.offline')}
                onSend={send}
              />
              <p className="text-xs text-muted-foreground">{t('publicBooking.guestMessages.warning')}</p>
            </div>
          ) : (
            <div className="space-y-1 rounded-lg border bg-muted/40 p-3" data-testid="guest-messages-closed">
              <p className="font-medium">{t('publicBooking.guestMessages.closedTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('publicBooking.guestMessages.closedDescription')}</p>
              {booking.host.email && (
                <a
                  href={`mailto:${booking.host.email}`}
                  className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('publicBooking.guestMessages.writeToHost', { host: hostName })}
                </a>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
