import { useId, useState, type ReactNode } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { StarInput } from '@/features/reviews/components/star-input';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useSendHostReview } from '@/queries/use-ota-reviews';
import { REVIEW_MAX_RATING, type OtaHostReview, type ReviewThread } from '@/types';
import { channelLabel } from '../lib/channels';
import {
  EMPTY_HOST_REVIEW,
  HOST_REVIEW_CATEGORIES,
  HOST_REVIEW_TEXT_MAX_LENGTH,
  actionStateLabel,
  actionStateVariant,
  categoryLabel,
  hostReviewCommandOf,
  hostReviewProblem,
  ratingText,
  reasonText,
  type HostReviewDraft,
} from '../lib/review-model';

interface HostReviewSectionProps {
  review: ReviewThread;
  canWrite: boolean;
  /** What the host has typed. The page keeps it, so that a reading of the review that fails and takes the review away from the screen does not take the words with it. */
  draft: HostReviewDraft;
  onDraft: (draft: HostReviewDraft) => void;
}

function SentHostReview({ hostReview }: { hostReview: OtaHostReview }) {
  const { t, i18n } = useTranslation();
  const sentAt = hostReview.sentAt ? formatRomeDateTime(hostReview.sentAt, i18n.language) : '';
  const text = hostReview.text?.trim();
  const privateText = hostReview.privateText?.trim();

  return (
    <div className="space-y-3" data-testid="host-review-sent">
      {hostReview.ratings.length > 0 ? (
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {hostReview.ratings.map((rating) => (
            <div key={rating.category} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{categoryLabel(rating.category, t)}</dt>
              <dd className="font-medium tabular-nums">{t('reviews.thread.categoryValue', { value: ratingText(rating.value, i18n.language), max: REVIEW_MAX_RATING })}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {text ? (
        <div>
          <h3 className="text-sm font-medium">{t('reviews.hostReview.publicText')}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">{text}</p>
        </div>
      ) : null}
      {privateText ? (
        <div>
          <h3 className="text-sm font-medium">{t('reviews.hostReview.privateText')}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">{privateText}</p>
        </div>
      ) : null}
      {hostReview.state === 'Sent' && sentAt ? <p className="text-xs text-muted-foreground">{t('reviews.hostReview.sentAt', { when: sentAt })}</p> : null}
    </div>
  );
}

/**
 * The host's own review of the guest (E05/F06/US02, NF-69), for a review of a channel: a mark for each category, the public words and, when there are some, the private ones (only the guest
 * reads them). It is written **once**, while the window of the channel is open: the form is there only then, and the page says why it is not when the window is closed, when the channel
 * manager has not said yet whether it is open, when the review was sent already, when the last send waits for the check on the channel (never sent again by a second click), or when the
 * property is not linked to the channel. A send asks a question first (it is public and cannot be taken back) and goes out once: the key of the attempt is kept for a retry
 * (`useSendHostReview`) and every button waits for any request of the page. A refusal says why and keeps the words, so the host can change them and try again.
 */
export function HostReviewSection({ review, canWrite, draft, onDraft }: HostReviewSectionProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { hostReview, capabilities } = review;
  if (!hostReview) return null;

  const sent = hostReview.state === 'Sent' || hostReview.window === 'Sent';
  const verifying = hostReview.state === 'ManualVerify';
  const open = !sent && !verifying && hostReview.window === 'Open';
  const mayWrite = open && capabilities.canHostReview;
  const reason = capabilities.hostReviewReason ?? capabilities.reason;
  const shownState = sent ? 'Sent' : hostReview.state;

  let body: ReactNode = null;
  if (sent) {
    body = <SentHostReview hostReview={hostReview} />;
  } else if (verifying) {
    body = (
      <>
        <Alert variant="warning" data-testid="host-review-verify">
          {t('reviews.hostReview.verify')}
        </Alert>
        <SentHostReview hostReview={hostReview} />
      </>
    );
  } else if (hostReview.window === 'Closed') {
    body = (
      <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status" data-testid="host-review-closed">
        {t('reviews.hostReview.closed')}
      </p>
    );
  } else if (hostReview.window === 'Unknown') {
    body = (
      <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status" data-testid="host-review-unknown">
        {t('reviews.hostReview.unknown')}
      </p>
    );
  } else if (!mayWrite) {
    body = (
      <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status" data-testid="host-review-cannot">
        {reasonText(reason, t, channelLabel(review.channel, t)) ?? t('reviews.hostReview.cannot')}
      </p>
    );
  } else if (!canWrite) {
    body = (
      <p className="text-sm text-muted-foreground" data-testid="host-review-readonly">
        {t('reviews.thread.readOnly')}
      </p>
    );
  } else {
    body = <HostReviewForm review={review} draft={draft} onDraft={onDraft} />;
  }

  return (
    <section aria-labelledby={titleId} className="space-y-3" data-testid="host-review">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={titleId} className="text-base font-semibold">
          {t('reviews.hostReview.title')}
        </h2>
        {shownState !== 'None' ? (
          <Badge variant={actionStateVariant(shownState)} data-testid="host-review-state" data-state={shownState}>
            {actionStateLabel(shownState, t)}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t('reviews.hostReview.intro')}</p>

      {hostReview.state === 'Error' && !sent ? (
        <Alert variant="danger" title={t('reviews.hostReview.notSent')} data-testid="host-review-error">
          <p>{reasonText(hostReview.errorCode, t) ?? t('reviews.hostReview.errorUnknown')}</p>
          {mayWrite ? <p className="mt-1">{t('reviews.hostReview.errorRetry')}</p> : null}
        </Alert>
      ) : null}

      {body}
    </section>
  );
}

interface HostReviewFormProps {
  review: ReviewThread;
  draft: HostReviewDraft;
  onDraft: (draft: HostReviewDraft) => void;
}

function HostReviewForm({ review, draft, onDraft }: HostReviewFormProps) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const send = useSendHostReview(review.threadKey);
  const busy = useIsMutating() > 0;
  const [attempted, setAttempted] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const problem = hostReviewProblem(draft);
  const publicLength = draft.text.trim().length;
  const privateLength = draft.privateText.trim().length;
  const textError =
    attempted && problem === 'text'
      ? t('reviews.hostReview.error.text')
      : publicLength > HOST_REVIEW_TEXT_MAX_LENGTH
        ? t('reviews.hostReview.error.tooLong', { max: HOST_REVIEW_TEXT_MAX_LENGTH })
        : undefined;

  return (
    <div className="space-y-4" data-testid="host-review-form">
      <div className="grid gap-3 sm:grid-cols-2">
        {HOST_REVIEW_CATEGORIES.map((category) => (
          <StarInput
            key={category}
            legend={categoryLabel(category, t)}
            value={draft.ratings[category] ?? 0}
            disabled={send.isPending}
            onChange={(value) => onDraft({ ...draft, ratings: { ...draft.ratings, [category]: value } })}
          />
        ))}
      </div>
      {attempted && problem === 'ratings' ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]" data-testid="host-review-ratings-error">
          {t('reviews.hostReview.error.ratings')}
        </p>
      ) : null}

      <Field label={t('reviews.hostReview.publicText')} counter={`${publicLength}/${HOST_REVIEW_TEXT_MAX_LENGTH}`} hint={t('reviews.hostReview.publicHint')} error={textError}>
        <Textarea
          rows={5}
          maxLength={HOST_REVIEW_TEXT_MAX_LENGTH}
          value={draft.text}
          readOnly={send.isPending}
          onChange={(event) => onDraft({ ...draft, text: event.target.value })}
          data-testid="host-review-text"
        />
      </Field>
      <Field
        label={t('reviews.hostReview.privateText')}
        optional
        counter={`${privateLength}/${HOST_REVIEW_TEXT_MAX_LENGTH}`}
        hint={t('reviews.hostReview.privateHint')}
      >
        <Textarea
          rows={3}
          maxLength={HOST_REVIEW_TEXT_MAX_LENGTH}
          value={draft.privateText}
          readOnly={send.isPending}
          onChange={(event) => onDraft({ ...draft, privateText: event.target.value })}
          data-testid="host-review-private-text"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            setAttempted(true);
            if (!hostReviewProblem(draft)) setConfirming(true);
          }}
          loading={send.isPending}
          disabled={(busy && !send.isPending) || !online}
          data-testid="host-review-send"
        >
          <Send className="size-4" aria-hidden="true" />
          {t('reviews.hostReview.send')}
        </Button>
        {!online ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t('reviews.hostReview.offline')}
          </p>
        ) : null}
      </div>

      <ConfirmationDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('reviews.hostReview.confirm.title')}
        description={t('reviews.hostReview.confirm.description')}
        confirmLabel={t('reviews.hostReview.confirm.send')}
        consequences={[t('reviews.hostReview.confirm.public'), t('reviews.hostReview.confirm.once')]}
        isLoading={send.isPending}
        onConfirm={async () => {
          if (hostReviewProblem(draft)) return;
          try {
            const result = await send.mutateAsync(hostReviewCommandOf(draft));
            // The review is in the channel now (sent, or waiting for the check); a refusal keeps the words in the form, so that the host changes them and tries again.
            if (result.state !== 'Error') onDraft(EMPTY_HOST_REVIEW);
          } catch {
            // The toast of the hook says why; the words stay in the form.
          }
        }}
      />
    </div>
  );
}
