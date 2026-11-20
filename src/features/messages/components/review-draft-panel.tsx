import { useMemo, useState, type ReactNode } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Sparkles } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApprovalRejectDialog } from '@/features/approvals/components/approval-reject-dialog';
import {
  approvalOutcome,
  failureCodeOf,
  finalTextOf,
  isEdited,
  itemIsGone,
  originActionErrorOf,
  originErrorMessage,
} from '@/features/approvals/lib/approval-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useApproveItem, useEditItem, usePendingApprovals, useRejectItem, useSaveAndApproveItem } from '@/queries/approvalQueue';
import { invalidateReviews, useRequestReviewDraft } from '@/queries/use-ota-reviews';
import { REVIEW_REPLY_MAX_LENGTH } from '@/types';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import { draftReasonText, pendingReviewDraftOf, reasonText, reviewProblemMessage } from '../lib/review-model';
import { PublishReplyDialog } from './publish-reply-dialog';

interface ReviewDraftPanelProps {
  /** The key of the review (`otareview:…` or `review:…`), as the page has it. */
  threadKey: string;
  /** The host may ask for a draft: the permission to write the bookings, which the endpoint asks. */
  canAsk: boolean;
}

/**
 * The assistant on a review (E05/F06/US02, NF-69, AI-06): above the box that answers, the draft of the public reply the assistant wrote, with Approve and publish, Edit and Reject, and,
 * with no draft, «Chiedi una bozza all'assistente». It exists only with the flag `messageAssistant` on and the permission to decide approvals (`approval.decide`): without either nothing
 * is drawn and nothing is asked of the server. **A reply is never published by itself**: the host reads the draft and approves it, after a question that says that a public reply cannot be
 * taken back. What did not complete is said as such: a draft that was not written, and why (a reply that promised money, said it was an AI or held a link is never queued, and the reason
 * is told), an approval that failed (the draft stays here with the reason and a retry), a reading of the queue that failed (never a draft from an older reading).
 */
export function ReviewDraftPanel({ threadKey, canAsk }: ReviewDraftPanelProps) {
  const { flags } = useFeatureFlags();
  const { hasPermission } = useWorkspace();

  if (!flags.messageAssistant || !hasPermission('short-rent', 'approval.decide')) return null;
  return <ReviewDraftPanelBody threadKey={threadKey} canAsk={canAsk} />;
}

/** A line that tells what happened to a draft the host decided on this page: it stays until the next thing the host does. */
interface Notice {
  tone: 'success' | 'warning';
  key: string;
}

/** What the dialog of the publication is about: the draft as it stands, or the text the host has just edited (saved and approved in one step). */
type Publishing = { kind: 'approve'; item: ApprovalQueueItem } | { kind: 'saveAndApprove'; item: ApprovalQueueItem; text: string };

function ReviewDraftPanelBody({ threadKey, canAsk }: ReviewDraftPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pending = usePendingApprovals();
  const approve = useApproveItem();
  // The edit, the rejection and the request for a draft are started from this panel and live here: a dialog closed while its request goes on must not take the callbacks of the request
  // with it. Every button waits for ANY mutation of the page (the reply that is typed below included): a public reply is sent once, by one thing at a time.
  const edit = useEditItem();
  const saveAndApprove = useSaveAndApproveItem();
  const reject = useRejectItem();
  const request = useRequestReviewDraft(threadKey);
  const busy = useIsMutating() > 0;

  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState<Publishing | null>(null);
  const [rejecting, setRejecting] = useState<ApprovalQueueItem | null>(null);
  // Why the last approval of a draft failed (the code of its action), until the next try.
  const [failure, setFailure] = useState<{ id: string; code: string } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // A reading of the queue that failed is not «no draft» and not the draft of the last reading: the panel says it could not read.
  const draft = useMemo(() => (pending.isError ? null : pendingReviewDraftOf(pending.data, threadKey)), [pending.isError, pending.data, threadKey]);
  const failureText = (code: string) => reasonText(code, t) ?? originErrorMessage(code, t);

  const publish = async (target: Publishing) => {
    setFailure(null);
    setNotice(null);
    request.reset();
    try {
      const approved =
        target.kind === 'approve' ? await approve.mutateAsync(target.item.id) : await saveAndApprove.mutateAsync({ id: target.item.id, text: target.text });
      setEditing(false);
      const outcome = approvalOutcome(approved);
      setNotice({ tone: outcome.tone, key: outcome.key });
    } catch (error) {
      // The action the item was waiting for failed: the item stays pending with the reason, and a retry. The toast of the hook says the rest.
      const code = originActionErrorOf(error);
      if (code !== undefined) {
        setFailure({ id: target.item.id, code });
        setEditing(false);
      }
    } finally {
      invalidateReviews(queryClient);
    }
  };

  let body: ReactNode;
  if (pending.isPending) {
    body = (
      <div role="status" aria-busy="true" data-testid="review-draft-loading">
        <span className="sr-only">{t('reviews.thread.draft.loading')}</span>
        <Skeleton aria-hidden="true" className="h-24 w-full rounded-lg motion-reduce:animate-none" />
      </div>
    );
  } else if (pending.isError) {
    body = (
      <Alert
        variant="danger"
        icon={AlertCircle}
        data-testid="review-draft-load-error"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void pending.refetch()}>
            {t('shared.errorFallback.tryAgain')}
          </Button>
        }
      >
        {t('reviews.thread.draft.loadError')}
      </Alert>
    );
  } else if (draft !== null) {
    const failureCode = failure?.id === draft.id ? failure.code : failureCodeOf(draft);
    const edited = isEdited(draft);

    body = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Sparkles aria-hidden="true" className="h-3 w-3" />
            {t('approval.ai_generated')}
          </Badge>
          {edited ? (
            <Badge variant="outline" data-testid="review-draft-edited">
              {t('assistant.draft.edited')}
            </Badge>
          ) : null}
        </div>

        {editing ? (
          <ReviewDraftEditor
            // A new text of the same draft (the queue read again after a save) starts a new editor only when the host opens it again.
            key={draft.id}
            item={draft}
            edit={edit}
            busy={busy}
            publishing={saveAndApprove.isPending}
            onPublish={(text) => setPublishing({ kind: 'saveAndApprove', item: draft, text })}
            onClose={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm" data-testid="review-draft-text">
              {finalTextOf(draft)}
            </div>

            {failureCode ? (
              <Alert variant="danger" title={t('approval.action.originFailed')} data-testid="review-draft-failure">
                <p>{failureText(failureCode)}</p>
                <p className="mt-1">{t('approval.action.originFailedHint')}</p>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => setPublishing({ kind: 'approve', item: draft })}
                loading={approve.isPending}
                disabled={busy && !approve.isPending}
                data-testid="review-draft-approve"
              >
                {failureCode ? t('approval.action.retry') : t('reviews.thread.draft.approve')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(true)} disabled={busy} data-testid="review-draft-edit">
                {t('reviews.thread.draft.edit')}
              </Button>
              <Button type="button" variant="danger-outline" onClick={() => setRejecting(draft)} disabled={busy} data-testid="review-draft-reject">
                {t('reviews.thread.draft.reject')}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground" data-testid="review-draft-none">
          {t('reviews.thread.draft.none')}
        </p>
        {canAsk ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFailure(null);
              setNotice(null);
              request.mutate();
            }}
            loading={request.isPending}
            disabled={busy && !request.isPending}
            data-testid="review-draft-ask"
          >
            {t('reviews.thread.draft.ask')}
          </Button>
        ) : null}
      </div>
    );
  }

  // What the last request for a draft ended in is the state of the panel only while there is no draft: once one is there it is the draft that counts. A decision that is not `Drafted`
  // says why it is not, and is never a success.
  const notDrafted = request.data && request.data.status !== 'Drafted' ? request.data : null;
  const requestError = request.isError && draft === null ? request.error : null;

  return (
    <section aria-label={t('reviews.thread.draft.title')} className="space-y-3 rounded-xl border bg-card p-4" data-testid="review-draft-panel">
      <h3 className="flex items-center gap-2 text-base font-semibold leading-none tracking-tight">
        <Sparkles aria-hidden="true" className="size-4 text-primary" />
        {t('reviews.thread.draft.title')}
      </h3>

      {body}

      {notice ? (
        <Alert variant={notice.tone === 'warning' ? 'warning' : 'success'} data-testid="review-draft-notice">
          {t(notice.key)}
        </Alert>
      ) : null}

      {notDrafted && draft === null ? (
        <Alert variant="warning" data-testid="review-draft-outcome">
          {draftReasonText(notDrafted.reason, t)}
        </Alert>
      ) : null}

      {requestError ? (
        <Alert variant="danger" icon={AlertCircle} data-testid="review-draft-request-error">
          {getHttpStatus(requestError) === 404 ? t('reviews.thread.draft.notFound') : (reviewProblemMessage(requestError, t) ?? t('reviews.thread.draft.requestFailed'))}
        </Alert>
      ) : null}

      <p className="text-xs text-muted-foreground" data-testid="review-draft-transparency">
        {t('assistant.notice.transparency')}
      </p>

      <PublishReplyDialog
        text={publishing === null ? null : publishing.kind === 'approve' ? finalTextOf(publishing.item) : publishing.text}
        isLoading={approve.isPending || saveAndApprove.isPending}
        onClose={() => setPublishing(null)}
        onConfirm={async () => {
          if (publishing !== null) await publish(publishing);
        }}
      />

      <ApprovalRejectDialog
        item={rejecting}
        reject={reject}
        onClose={() => setRejecting(null)}
        onRejected={() => {
          setFailure(null);
          request.reset();
          setNotice({ tone: 'success', key: 'reviews.thread.draft.rejected' });
        }}
      />
    </section>
  );
}

interface ReviewDraftEditorProps {
  /** The draft being edited. The field starts from the text the approval would act with (the host's earlier edit, else the draft). */
  item: ApprovalQueueItem;
  /** The mutation belongs to the panel: it keeps every button waiting while any request of the draft goes on. */
  edit: ReturnType<typeof useEditItem>;
  busy: boolean;
  /** The edit is being approved (the dialog of the publication is over it). */
  publishing: boolean;
  /** «Salva e pubblica»: the text, once it is usable; the panel asks the question and publishes. */
  onPublish: (text: string) => void;
  onClose: () => void;
}

/**
 * The inline editor of the draft of a reply (NF-68): the words in a box, «Salva» to keep the edit for later and «Salva e pubblica» to publish the edited text in one step, so that what goes out
 * is the one on the screen. A reply has at least a word and at most {@link REVIEW_REPLY_MAX_LENGTH} characters; the API stays the judge and a text it refuses (422) stays on the box with its
 * reason. The text is the host's own words about a guest: nothing here logs or stores it.
 */
function ReviewDraftEditor({ item, edit, busy, publishing, onPublish, onClose }: ReviewDraftEditorProps) {
  const { t } = useTranslation();
  const [initial] = useState(() => finalTextOf(item));
  const [text, setText] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const length = text.trim().length;
  const problem = length === 0 ? t('reviews.thread.reply.empty') : length > REVIEW_REPLY_MAX_LENGTH ? t('reviews.thread.reply.tooLong', { max: REVIEW_REPLY_MAX_LENGTH }) : null;
  const error = attempted && problem ? problem : (refused ?? undefined);

  const save = () => {
    setAttempted(true);
    if (problem) return;
    edit.mutate(
      { id: item.id, text },
      {
        onSuccess: onClose,
        onError: (failure) => {
          // The toast of the hook says why; an item that is not there any more is not kept open, a text the API refuses stays on the box.
          if (itemIsGone(failure)) onClose();
          else if (getHttpStatus(failure) === 422) setRefused(getProblemMessage(failure, t) ?? t('reviews.thread.reply.empty'));
        },
      },
    );
  };

  return (
    <div className="space-y-3" data-testid="review-draft-editor">
      <Field label={t('reviews.thread.reply.label')} counter={`${length}/${REVIEW_REPLY_MAX_LENGTH}`} error={error}>
        <Textarea
          rows={6}
          value={text}
          readOnly={busy}
          onChange={(event) => {
            setText(event.target.value);
            setRefused(null);
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => {
            setAttempted(true);
            if (!problem) onPublish(text);
          }}
          loading={publishing}
          disabled={busy && !publishing}
        >
          {t('reviews.thread.draft.saveAndPublish')}
        </Button>
        <Button type="button" variant="outline" onClick={save} loading={edit.isPending} disabled={busy || text === initial}>
          {t('approval.action.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          {t('shared.cancel')}
        </Button>
      </div>
    </div>
  );
}
