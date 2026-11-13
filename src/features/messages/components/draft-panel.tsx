import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalRejectDialog } from '@/features/approvals/components/approval-reject-dialog';
import {
  approvalOutcome,
  confidenceView,
  failureCodeOf,
  finalTextOf,
  isEdited,
  originActionErrorOf,
  originErrorMessage,
  type ApprovalOutcome,
} from '@/features/approvals/lib/approval-model';
import { assistantProblemMessage, draftOutcomeView, isNotFound, pendingDraftOf, situationText } from '@/features/assistant/lib/assistant-model';
import { ASSISTANT_SETTINGS_PATH, TODO_LIST_PATH } from '@/features/assistant/lib/assistant-routes';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { useApproveItem, useEditItem, usePendingApprovals, useRejectItem, useSaveAndApproveItem } from '@/queries/approvalQueue';
import { useRequestDraft } from '@/queries/use-assistant-drafts';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import { DraftEditor } from './draft-editor';

interface DraftPanelProps {
  /** The conversation (`ota:…` or `direct:…`), as the page has it. */
  threadKey: string;
  /** The host may ask for a draft: the permission to write the bookings, which the endpoint asks. */
  canAsk: boolean;
}

/**
 * The assistant in the conversation (E05/F05/US04/T01, NF-66, NF-67): above the box that answers, the draft the assistant wrote for the last message of the guest, with
 * its situation and how sure it is (in words; the number is in the tip), and Approve and send, Edit and Reject. With no draft the panel offers to ask for one.
 *
 * It exists only with the flag `messageAssistant` on and the permission to decide approvals (`approval.decide`); without either nothing is shown and nothing is asked
 * of the server. **A draft is never sent by itself**: the host reads it and approves it, and the panel says so, and says that the guest is not told (the transparency
 * notice of NF-67 stays in the CasaZen interface). What did not complete is said as such: a draft that was not written (and why), a message the channel has not
 * confirmed, an approval that failed (the draft stays here, with the reason and a retry).
 */
export function DraftPanel({ threadKey, canAsk }: DraftPanelProps) {
  const { flags } = useFeatureFlags();
  const { hasPermission } = useWorkspace();

  if (!flags.messageAssistant || !hasPermission('short-rent', 'approval.decide')) return null;
  return <DraftPanelBody threadKey={threadKey} canAsk={canAsk} />;
}

/** A line that tells what happened to a draft the host decided on this page: it stays until the next thing the host does. */
interface Notice {
  tone: 'success' | 'warning';
  key: string;
}

function noticeOf(outcome: ApprovalOutcome): Notice {
  return { tone: outcome.tone, key: outcome.key };
}

function DraftPanelBody({ threadKey, canAsk }: DraftPanelProps) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const pending = usePendingApprovals();
  const approve = useApproveItem();
  // The edit, the rejection and the request for a draft are started from this panel and live here: a dialog closed while its request goes on must not take the
  // callbacks of the request with it, and every button of the panel waits for any of them.
  const edit = useEditItem();
  const saveAndApprove = useSaveAndApproveItem();
  const reject = useRejectItem();
  const request = useRequestDraft(threadKey);

  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState<ApprovalQueueItem | null>(null);
  // Why the last approval of a draft failed (the code of its action), until the next try.
  const [failure, setFailure] = useState<{ id: string; code: string } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const draft = useMemo(() => pendingDraftOf(pending.data, threadKey), [pending.data, threadKey]);
  const busy = approve.isPending || edit.isPending || saveAndApprove.isPending || reject.isPending || request.isPending;
  const canOpenSettings = hasPermission('short-rent', 'property.write');

  const handleApprove = (item: ApprovalQueueItem) => {
    setFailure(null);
    setNotice(null);
    approve.mutate(item.id, {
      onSuccess: (approved) => setNotice(noticeOf(approvalOutcome(approved))),
      onError: (error) => {
        const code = originActionErrorOf(error);
        if (code !== undefined) setFailure({ id: item.id, code });
      },
    });
  };

  const handleAsk = () => {
    setFailure(null);
    setNotice(null);
    request.mutate();
  };

  let body: ReactNode;
  if (pending.isPending) {
    body = (
      <div role="status" aria-busy="true" data-testid="assistant-draft-loading">
        <span className="sr-only">{t('assistant.draft.loading')}</span>
        <Skeleton aria-hidden="true" className="h-24 w-full rounded-lg motion-reduce:animate-none" />
      </div>
    );
  } else if (draft === null && pending.isError && !pending.data) {
    // A reading that failed is not «no draft»: it is told as a failure, with a way to try again.
    body = (
      <Alert
        variant="danger"
        icon={AlertCircle}
        data-testid="assistant-draft-load-error"
        action={
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void pending.refetch()}>
            {t('shared.errorFallback.tryAgain')}
          </Button>
        }
      >
        {t('assistant.draft.loadError')}
      </Alert>
    );
  } else if (draft !== null) {
    const confidence = confidenceView(draft.confidenceScore);
    const failureCode = failure?.id === draft.id ? failure.code : failureCodeOf(draft);
    const edited = isEdited(draft);

    let approveLabel = t('assistant.draft.approve');
    if (failureCode) approveLabel = t('approval.action.retry');

    body = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" data-testid="assistant-draft-meta">
          {draft.situationCode ? (
            <span>
              <span className="text-muted-foreground">{t('assistant.draft.situation')}: </span>
              <span className="font-medium">{situationText(draft.situationCode, t, i18n)}</span>
            </span>
          ) : null}
          {confidence ? (
            <span className="inline-flex items-center gap-1">
              <Badge variant="outline" className="flex items-center gap-1" data-testid="assistant-draft-confidence" data-level={confidence.level}>
                {confidence.level === 'high' ? <CheckCircle2 aria-hidden="true" className="h-3 w-3" /> : <AlertTriangle aria-hidden="true" className="h-3 w-3" />}
                {confidence.level === 'high' ? t('assistant.draft.confidence.high') : t('assistant.draft.confidence.low')}
              </Badge>
              <HelpTip title={t('assistant.draft.confidence.helpTitle')}>{t('assistant.draft.confidence.score', { percent: confidence.percent })}</HelpTip>
            </span>
          ) : null}
          {edited ? (
            <Badge variant="secondary" data-testid="assistant-draft-edited">
              {t('assistant.draft.edited')}
            </Badge>
          ) : null}
        </div>

        {editing ? (
          <DraftEditor
            // A new text of the same draft (the list read again after a save) starts a new editor only when the host opens it again.
            key={draft.id}
            item={draft}
            edit={edit}
            saveAndApprove={saveAndApprove}
            busy={busy}
            onClose={() => setEditing(false)}
            onApproved={(approved) => {
              setFailure(null);
              setNotice(noticeOf(approvalOutcome(approved)));
            }}
            onApproveFailed={(id, code) => setFailure({ id, code })}
          />
        ) : (
          <>
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm" data-testid="assistant-draft-text">
              {finalTextOf(draft)}
            </div>

            {failureCode ? (
              <Alert variant="danger" title={t('approval.action.originFailed')} data-testid="assistant-draft-failure">
                <p>{originErrorMessage(failureCode, t)}</p>
                <p className="mt-1">{t('approval.action.originFailedHint')}</p>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className="min-h-11" onClick={() => handleApprove(draft)} loading={approve.isPending} disabled={busy && !approve.isPending}>
                {approveLabel}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(true)} disabled={busy}>
                {t('assistant.draft.edit')}
              </Button>
              <Button type="button" variant="danger-outline" className="min-h-11" onClick={() => setRejecting(draft)} disabled={busy}>
                {t('assistant.draft.reject')}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground" data-testid="assistant-draft-none">
          {t('assistant.draft.none')}
        </p>
        {canAsk ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={handleAsk} loading={request.isPending} disabled={busy && !request.isPending}>
            {t('assistant.draft.ask')}
          </Button>
        ) : null}
      </div>
    );
  }

  const outcome = request.data ? draftOutcomeView(request.data) : null;
  const requestError = request.isError ? request.error : null;

  return (
    <section aria-label={t('assistant.draft.title')} className="space-y-3 rounded-xl border bg-card p-4" data-testid="assistant-draft-panel">
      <h2 className="flex items-center gap-2 text-base font-semibold leading-none tracking-tight">
        <Sparkles aria-hidden="true" className="size-4 text-primary" />
        {t('assistant.draft.title')}
      </h2>

      {body}

      {notice ? (
        <Alert variant={notice.tone === 'warning' ? 'warning' : 'success'} data-testid="assistant-draft-notice">
          {t(notice.key)}
        </Alert>
      ) : null}

      {outcome && draft === null ? (
        <Alert variant={outcome.tone} data-testid="assistant-draft-outcome">
          <p>{t(outcome.key)}</p>
          {outcome.todoLink ? (
            <p className="mt-1">
              <Link to={TODO_LIST_PATH} className="font-medium underline underline-offset-4">
                {t('assistant.draft.outcome.openTodo')}
              </Link>
            </p>
          ) : null}
          {outcome.settingsLink && canOpenSettings ? (
            <p className="mt-1">
              <Link to={ASSISTANT_SETTINGS_PATH} className="font-medium underline underline-offset-4">
                {t('assistant.draft.outcome.openSettings')}
              </Link>
            </p>
          ) : null}
        </Alert>
      ) : null}

      {requestError ? (
        <Alert variant="danger" icon={AlertCircle} data-testid="assistant-draft-request-error">
          {isNotFound(requestError) ? t('assistant.draft.notFound') : (assistantProblemMessage(requestError, t) ?? t('assistant.draft.requestFailed'))}
        </Alert>
      ) : null}

      <p className="text-xs text-muted-foreground" data-testid="assistant-draft-transparency">
        {t('assistant.notice.transparency')}
      </p>

      <ApprovalRejectDialog
        item={rejecting}
        reject={reject}
        onClose={() => setRejecting(null)}
        onRejected={() => {
          setFailure(null);
          setNotice({ tone: 'success', key: 'assistant.draft.rejected' });
        }}
      />
    </section>
  );
}
