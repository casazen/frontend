import { useId, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useReplyToReview } from '@/queries/use-ota-reviews';
import { REVIEW_REPLY_MAX_LENGTH, type ReviewThread } from '@/types';
import { channelLabel } from '../lib/channels';
import { actionStateLabel, actionStateVariant, reasonText } from '../lib/review-model';
import { PublishReplyDialog } from './publish-reply-dialog';
import { ReviewDraftPanel } from './review-draft-panel';

interface ReviewReplySectionProps {
  review: ReviewThread;
  canWrite: boolean;
  /** What the host has typed. The page keeps it, so that a reading of the review that fails and takes the review away from the screen does not take the words with it. */
  text: string;
  onText: (text: string | null) => void;
}

/**
 * The host's reply to a review (E05/F06/US02, NF-69): the reply with the time and where it stands (published, waiting for the check on the channel, refused with the reason in words),
 * or, while the host has not answered and the channel allows it, the box with the draft of the assistant on top (`ReviewDraftPanel`) and «Pubblica la risposta». A public reply cannot be
 * taken back, so the dialog says so before it goes out, and it goes out once: the key of the attempt is kept for a retry (`useReplyToReview`) and every button waits for any request of the
 * page. When the host cannot answer the page says why in one sentence (the channel, the property, the permission), and shows no box. A reply is never told as published until the channel says so.
 */
export function ReviewReplySection({ review, canWrite, text, onText }: ReviewReplySectionProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const online = useOnlineStatus();
  const send = useReplyToReview(review.threadKey);
  const busy = useIsMutating() > 0;
  const [confirming, setConfirming] = useState<string | null>(null);

  const { reply, capabilities } = review;
  const sentAt = reply.sentAt ? formatRomeDateTime(reply.sentAt, i18n.language) : '';
  const open = reply.state === 'None' || reply.state === 'Error';
  const mayAnswer = open && capabilities.canReply;
  const length = text.trim().length;
  const reason = capabilities.replyReason ?? capabilities.reason;

  return (
    <section aria-labelledby={titleId} className="space-y-3" data-testid="review-reply">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={titleId} className="text-base font-semibold">
          {t('reviews.thread.reply.title')}
        </h2>
        {reply.state !== 'None' ? (
          <Badge variant={actionStateVariant(reply.state)} data-testid="review-reply-state" data-state={reply.state}>
            {actionStateLabel(reply.state, t)}
          </Badge>
        ) : null}
      </div>

      {reply.state !== 'Error' && reply.text?.trim() ? (
        <div>
          <p className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm" data-testid="review-reply-text-shown">
            {reply.text}
          </p>
          {reply.state === 'Sent' && sentAt ? <p className="mt-1 text-xs text-muted-foreground">{t('reviews.thread.reply.sentAt', { when: sentAt })}</p> : null}
        </div>
      ) : null}

      {reply.state === 'ManualVerify' ? (
        <Alert variant="warning" data-testid="review-reply-verify">
          {t('reviews.thread.reply.verify')}
        </Alert>
      ) : null}

      {reply.state === 'Error' ? (
        <Alert variant="danger" title={t('reviews.thread.reply.notPublished')} data-testid="review-reply-error">
          <p>{reasonText(reply.errorCode, t) ?? t('reviews.thread.reply.errorUnknown')}</p>
          {mayAnswer ? <p className="mt-1">{t('reviews.thread.reply.errorRetry')}</p> : null}
        </Alert>
      ) : null}

      {mayAnswer && !canWrite ? (
        <p className="text-sm text-muted-foreground" data-testid="review-reply-readonly">
          {t('reviews.thread.readOnly')}
        </p>
      ) : null}

      {open && !capabilities.canReply ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status" data-testid="review-reply-cannot">
          {reasonText(reason, t, channelLabel(review.channel, t)) ?? t('reviews.thread.reply.cannot')}
        </p>
      ) : null}

      {mayAnswer && canWrite ? (
        <div className="space-y-3">
          {/* The draft of the assistant (E05/F06/US02): only with the flag `messageAssistant` and the permission to decide approvals; it renders nothing otherwise. */}
          <ReviewDraftPanel threadKey={review.threadKey} canAsk />

          <Field
            label={t('reviews.thread.reply.label')}
            counter={`${length}/${REVIEW_REPLY_MAX_LENGTH}`}
            hint={t('reviews.thread.reply.hint')}
            error={length > REVIEW_REPLY_MAX_LENGTH ? t('reviews.thread.reply.tooLong', { max: REVIEW_REPLY_MAX_LENGTH }) : undefined}
          >
            <Textarea
              rows={5}
              maxLength={REVIEW_REPLY_MAX_LENGTH}
              value={text}
              readOnly={send.isPending}
              onChange={(event) => onText(event.target.value)}
              data-testid="review-reply-text"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => setConfirming(text.trim())}
              loading={send.isPending}
              disabled={(busy && !send.isPending) || length === 0 || length > REVIEW_REPLY_MAX_LENGTH || !online}
              data-testid="review-reply-publish"
            >
              <Send className="size-4" aria-hidden="true" />
              {t('reviews.thread.reply.publish')}
            </Button>
            {!online ? (
              <p className="text-sm text-muted-foreground" role="status">
                {t('reviews.thread.reply.offline')}
              </p>
            ) : null}
          </div>

          <PublishReplyDialog
            text={confirming}
            isLoading={send.isPending}
            onClose={() => setConfirming(null)}
            onConfirm={async () => {
              if (confirming === null) return;
              try {
                const result = await send.mutateAsync(confirming);
                // The words are in the review now (published, or waiting for the check on the channel); a refusal keeps them in the box, so that the host changes them and tries again.
                if (result.state !== 'Error') onText(null);
              } catch {
                // The toast of the hook says why; the words stay in the box.
              }
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
