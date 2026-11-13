import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { approvalOutcome, approvalTypeLabel, finalTextOf, firstLineOf, isMessageDraft } from '@/features/approvals/lib/approval-model';
import { messageThreadPath } from '@/lib/message-hub-routes';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';

interface ApprovalDecidedListProps {
  /** The items decided on this page, as the API answered them (an approved one with what the approval did, a rejected one with its reason), the latest first. */
  items: ApprovalQueueItem[];
}

/**
 * What has just been decided on this page. The queue lists only what waits, so a decided item leaves it at once: it stays here, quiet, for as long as
 * the page is open, with what the approval did (message sent, campaign scheduled, no action linked) or the reason it was rejected for (AC-NF68-1,
 * AC-NF68-3). Leaving the page empties it: the decision, its author and its reason stay on the item.
 */
export function ApprovalDecidedList({ items }: ApprovalDecidedListProps) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="approval-decided-title" className="space-y-3" data-testid="approval-decided">
      <h2 id="approval-decided-title" className="text-sm font-semibold text-muted-foreground">
        {t('approval.decided.title')}
      </h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const rejected = item.status === 'Rejected';
          const outcome = approvalOutcome(item);
          const StatusIcon = rejected ? XCircle : outcome.tone === 'warning' ? AlertTriangle : CheckCircle2;
          const summary = firstLineOf(finalTextOf(item));

          return (
            <li key={item.id} className="rounded-md border bg-card p-3 text-sm" data-testid="approval-decided-item" data-status={item.status}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{approvalTypeLabel(item.itemType, t)}</Badge>
                <span className="flex items-center gap-1 font-medium">
                  <StatusIcon aria-hidden="true" className="h-4 w-4" />
                  {rejected ? t('approval.status.rejected') : t('approval.status.approved')}
                </span>
              </div>
              {summary ? <p className="mt-1 line-clamp-2 break-words text-muted-foreground">{summary}</p> : null}
              {rejected ? (
                <p className="mt-1 whitespace-pre-wrap break-words" data-testid="approval-decided-reason">
                  <span className="font-medium">{t('approval.decided.reason')}: </span>
                  {item.rejectionReason}
                </p>
              ) : (
                <p className="mt-1" data-testid="approval-decided-outcome">
                  {t(outcome.key)}
                </p>
              )}
              {!rejected && isMessageDraft(item) && item.threadKey ? (
                <Link
                  to={messageThreadPath(item.threadKey)}
                  className="mt-1 inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                >
                  {t('approval.thread.open')}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
