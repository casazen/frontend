import { useEffect, useRef } from 'react';
import { Check, CircleAlert, Clock, Download, Paperclip, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { cn } from '@/lib/utils';
import { useDownloadAttachment, useMessageAttachment } from '@/queries/use-message-thread';
import type { PendingThreadMessage } from '@/queries/use-thread-send';
import type { MessageHubMessage } from '@/types';
import { canRetryReply, replyProblemMessage } from '../lib/reply-problems';
import type { HubThreadItem } from '../lib/thread-items';
import { formatMessageTime } from '../lib/thread-format';
import { TranslateButton } from './translate-button';

/** The files the API serves as a picture: they are shown; any other is a download. */
const IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png'];

/** What the host can do about a message, handed by the page that holds the send. */
export interface BubbleActions {
  /** Sends the text of a message the channel refused again, as a new message. */
  onResend: (message: MessageHubMessage) => void;
  /** Reads the conversation again: the channel may have told by now whether it received the message. */
  onCheck: () => void;
  checking: boolean;
  /** Sends a message that did not leave this page again, with the same key (the server writes it once). */
  onRetryPending: (key: string) => void;
  /** Takes a message the API refused back to the box, to be changed. */
  onEditPending: (item: PendingThreadMessage) => void;
}

interface MessageBubbleProps {
  item: HubThreadItem;
  threadKey: string;
  /** The language the host reads: the messages of the guest are translated into it. */
  hostLanguage: string;
  /** Answering asks `booking.write`: without it there is nothing to retry or to send again. */
  canWrite: boolean;
  /** The messages the host already sent again after the channel refused them: their button is gone. */
  resent: ReadonlySet<string>;
  actions: BubbleActions;
}

/** A picture of a message: read through the API, shown from the memory of the page, never from an address of the channel. */
function AttachmentImage({ blob, alt }: { blob: Blob; alt: string }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return <img ref={image} alt={alt} className="max-h-64 max-w-full rounded-lg border bg-muted object-contain" data-testid="message-attachment-image" />;
}

/**
 * The file of a message (NF-62): a picture is shown, anything else is a button that downloads it. It is read through the API, which checks
 * the reach of the host and never gives the address of the channel. A file that is gone says «allegato non più disponibile» (the 404 of the
 * API), in simple words, and not a broken picture.
 */
function MessageAttachment({ messageId, contentType }: { messageId: string; contentType: string }) {
  const { t } = useTranslation();
  const isImage = IMAGE_TYPES.includes(contentType);
  const picture = useMessageAttachment(messageId, isImage);
  const download = useDownloadAttachment();
  const failure = isImage ? picture.error : download.error;
  const gone = failure !== null && failure !== undefined && getHttpStatus(failure) === 404;

  if (gone) {
    return (
      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground" data-testid="message-attachment-unavailable">
        <Paperclip className="size-3.5" aria-hidden="true" />
        {t('messages.attachment.unavailable')}
      </p>
    );
  }
  if (isImage) {
    if (picture.isPending) {
      return (
        <div role="status" aria-busy="true">
          <span className="sr-only">{t('messages.attachment.loading')}</span>
          <Skeleton className="h-32 w-48 motion-reduce:animate-none" aria-hidden="true" />
        </div>
      );
    }
    return picture.data ? (
      <AttachmentImage blob={picture.data} alt={t('messages.attachment.imageAlt')} />
    ) : (
      <p className="px-1 text-xs text-destructive" role="alert">
        {t('messages.attachment.error')}
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={download.isPending}
        onClick={() => download.mutate(messageId, { onSuccess: (blob) => saveBlobAs(blob, t('messages.attachment.fileName')) })}
        data-testid="message-attachment-download"
      >
        <Download className="size-4" aria-hidden="true" />
        {t('messages.attachment.download')}
      </Button>
      {download.isError ? (
        <p className="px-1 text-xs text-destructive" role="alert">
          {t('messages.attachment.error')}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Where a message of a channel is on its way, in simple words (NF-63, UX-09): sent, sending, not sent (the channel refused it: «Riprova» sends
 * it again as a new message) or to check (the outcome is not known: it is looked at on the channel, never sent again by a second send, and
 * «Controlla» reads the conversation again). Each has an icon and a word, so the color is never the only signal.
 */
function DeliveryProblem({ message, canWrite, resent, actions }: { message: MessageHubMessage; canWrite: boolean; resent: boolean; actions: BubbleActions }) {
  const { t } = useTranslation();
  if (message.deliveryState === 'Error') {
    return (
      <div className="max-w-[85%] space-y-1 px-1 text-xs text-destructive" role="alert" data-testid="delivery-error">
        <p className="flex items-center gap-1.5 font-semibold">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {t('messages.state.error')}
        </p>
        <p>{t('messages.state.errorHint')}</p>
        {canWrite && !resent ? (
          <Button type="button" variant="outline" size="sm" onClick={() => actions.onResend(message)} data-testid="delivery-retry">
            {t('messages.state.retry')}
          </Button>
        ) : null}
      </div>
    );
  }
  if (message.deliveryState === 'ManualVerify') {
    return (
      <div className="max-w-[85%] space-y-1 px-1 text-xs text-foreground/80" role="alert" data-testid="delivery-needs-verification">
        <p className="flex items-center gap-1.5 font-semibold">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {t('messages.state.needsVerification')}
        </p>
        <p>{t('messages.state.needsVerificationHint')}</p>
        <Button type="button" variant="outline" size="sm" loading={actions.checking} onClick={actions.onCheck} data-testid="delivery-check">
          {t('messages.state.check')}
        </Button>
      </div>
    );
  }
  return null;
}

/** The message that did not leave this page: the sentence for what happened, and the one thing to do about it. */
function PendingProblem({ pending, actions }: { pending: PendingThreadMessage; actions: BubbleActions }) {
  const { t } = useTranslation();
  const retry = canRetryReply(pending.error);
  return (
    <div className="max-w-[85%] space-y-1 px-1 text-xs text-destructive" role="alert" data-testid="pending-error">
      <p className="flex items-center gap-1.5 font-semibold">
        <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
        {t('messages.state.error')}
      </p>
      <p>{replyProblemMessage(pending.error, t)}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => (retry ? actions.onRetryPending(pending.key) : actions.onEditPending(pending))}
        data-testid={retry ? 'pending-retry' : 'pending-edit'}
      >
        {t(retry ? 'messages.state.retry' : 'messages.state.edit')}
      </Button>
    </div>
  );
}

/**
 * One message of the conversation (NF-61, NF-63): who wrote it (the guest, you, a colleague or the channel's host by name, the assistant),
 * when (Rome time), its text as plain text, its file, where it is on its way when it is a message of a channel, and, for a message of the
 * guest, a button that translates it into the language of the host, labelled «traduzione automatica». A message the host is sending shows
 * as «sending», and one that did not go says why and offers the way on. The interface says «il canale» and never who carries the
 * message (NF-12).
 */
export function MessageBubble({ item, threadKey, hostLanguage, canWrite, resent, actions }: MessageBubbleProps) {
  const { t, i18n } = useTranslation();
  const { message, pending } = item;
  const sending = pending?.status === 'sending';
  const state = message?.deliveryState;
  const hasText = item.text.trim().length > 0;

  return (
    <div className={cn('flex flex-col gap-1', item.mine ? 'items-end' : 'items-start')} data-testid="message-bubble" data-direction={message?.direction ?? 'Outbound'}>
      <p className="flex flex-wrap items-center gap-x-1 px-1 text-xs text-muted-foreground">
        <span>{item.author}</span>
        {sending ? <span>{`· ${t('messageThread.sending')}`}</span> : item.at ? <span>{`· ${formatMessageTime(item.at, i18n.language)}`}</span> : null}
        {state === 'Sent' ? (
          <span className="inline-flex items-center gap-0.5" data-testid="delivery-sent">
            <Check className="size-3" aria-hidden="true" />
            {t('messages.state.sent')}
          </span>
        ) : state === 'Created' || state === 'WaitingAuthorization' ? (
          <span className="inline-flex items-center gap-0.5" data-testid="delivery-sending">
            <Clock className="size-3" aria-hidden="true" />
            {t('messages.state.sending')}
          </span>
        ) : null}
      </p>
      {hasText ? (
        <div
          className={cn(
            'max-w-[85%] whitespace-pre-wrap rounded-2xl border px-3 py-2 text-sm [overflow-wrap:anywhere]',
            item.mine ? 'border-transparent bg-primary text-primary-foreground' : 'bg-card',
            sending && 'opacity-70',
          )}
        >
          {item.text}
        </div>
      ) : null}
      {message?.attachment ? <MessageAttachment messageId={message.id} contentType={message.attachment.contentType} /> : null}
      {message ? <DeliveryProblem message={message} canWrite={canWrite} resent={resent.has(message.id)} actions={actions} /> : null}
      {pending?.status === 'failed' ? <PendingProblem pending={pending} actions={actions} /> : null}
      {message && message.direction === 'Inbound' && hasText ? (
        <div className="flex max-w-[85%] flex-wrap items-start gap-1">
          <TranslateButton threadKey={threadKey} source={{ messageId: message.id }} targetLanguage={hostLanguage} label={t('messages.thread.translate')} />
        </div>
      ) : null}
    </div>
  );
}
