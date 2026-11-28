import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ApprovalDecidedList } from '@/features/approvals/components/approval-decided-list';
import { ApprovalEditDialog } from '@/features/approvals/components/approval-edit-dialog';
import { ApprovalItemCard } from '@/features/approvals/components/approval-item-card';
import { ApprovalRejectDialog } from '@/features/approvals/components/approval-reject-dialog';
import { FILTERABLE_TYPES, approvalTypeLabel, finalTextOf, isReviewReply, originActionErrorOf } from '@/features/approvals/lib/approval-model';
import { PublishReplyDialog } from '@/features/messages/components/publish-reply-dialog';
import { useApproveItem, useEditItem, usePendingApprovals, useRejectItem, useSaveAndApproveItem } from '@/queries/approvalQueue';
import { invalidateReviews } from '@/queries/use-ota-reviews';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';

const matchesType = (item: ApprovalQueueItem, typeFilter: string) => typeFilter === 'all' || item.itemType === typeFilter;

/**
 * The queue of the items that wait for a decision (NF-06, NF-68): the drafts of messages the assistant wrote, the campaigns, the texts of the AI. Each item
 * is read, edited, approved or rejected here; approving runs what the item was waiting for and says what it did, a failed action keeps the item open with a
 * retry, and a rejection keeps its reason. The page asks `approval.decide` (the route). A new item shows up within a minute without a reload.
 *
 * The draft of the public reply to a review (E05/F06/US02, `ReviewReply`) is the one item that cannot be taken back once approved: its approval, from the card and from
 * «Salva e approva», asks the same question as the page of the review (`PublishReplyDialog`, with the exact words) before anything is published, and the reviews are
 * read again whatever came of it.
 */
export function ApprovalQueuePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: items, isLoading, error, isFetching, refetch } = usePendingApprovals();
  const approveItem = useApproveItem();
  const editItem = useEditItem();
  const saveAndApproveItem = useSaveAndApproveItem();
  const rejectItem = useRejectItem();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editing, setEditing] = useState<ApprovalQueueItem | null>(null);
  const [rejecting, setRejecting] = useState<ApprovalQueueItem | null>(null);
  const [publishing, setPublishing] = useState<ApprovalQueueItem | null>(null);
  const [decided, setDecided] = useState<ApprovalQueueItem[]>([]);
  const [failures, setFailures] = useState<Record<string, string>>({});

  const filteredItems = useMemo(() => (items ?? []).filter((item) => matchesType(item, typeFilter)), [items, typeFilter]);

  const busy = approveItem.isPending || editItem.isPending || saveAndApproveItem.isPending || rejectItem.isPending;
  const approvingId = approveItem.isPending ? approveItem.variables : undefined;

  const clearFailure = (id: string) => {
    setFailures((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const noteFailure = (id: string, code: string) => setFailures((current) => ({ ...current, [id]: code }));

  const noteDecided = (item: ApprovalQueueItem) => {
    clearFailure(item.id);
    setDecided((current) => [item, ...current.filter((candidate) => candidate.id !== item.id)]);
  };

  const handleApprove = (item: ApprovalQueueItem) => {
    clearFailure(item.id);
    if (isReviewReply(item)) {
      setPublishing(item);
      return;
    }
    approveItem.mutate(item.id, {
      onSuccess: noteDecided,
      onError: (failure) => {
        const code = originActionErrorOf(failure);
        if (code !== undefined) noteFailure(item.id, code);
      },
    });
  };

  // The host confirmed the question: the reply is approved (published). Whatever came of it the dialog closes (the toast of the hook and the card tell the rest) and the reviews are
  // read again, because the review keeps where the reply stands (published, to check, refused with its reason).
  const publishReply = async (item: ApprovalQueueItem) => {
    try {
      noteDecided(await approveItem.mutateAsync(item.id));
    } catch (failure) {
      const code = originActionErrorOf(failure);
      if (code !== undefined) noteFailure(item.id, code);
    } finally {
      invalidateReviews(queryClient);
    }
  };

  const publishingItem = publishing === null ? null : ((items ?? []).find((candidate) => candidate.id === publishing.id) ?? publishing);

  if (isLoading) {
    return <LoadingScreen message={t('approval.queue.loading')} />;
  }

  // A reading that failed while the list is on the screen (the minute poll) leaves the list as it is: only a page with nothing to show is an error,
  // and it keeps its title and its tabs, so that the other queue of decisions is still one click away.
  const loadFailed = Boolean(error) && !items;
  const waiting = items ?? [];

  return (
    <>
      <div className="workspace-page space-y-6">
        <PageHeader title={t('approval.queue.title')} description={t('approval.queue.description')} />

        {loadFailed ? (
          <Alert variant="danger" title={t('shared.error')} icon={AlertCircle} action={<Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>{t('approval.action.retry')}</Button>}>
            {t('approval.queue.loadError')}
          </Alert>
        ) : (
          <>
            {(waiting.length > 0 || decided.length > 0) && (
              <div className="w-full sm:w-64">
                <label htmlFor="type-filter" className="mb-2 block text-sm font-medium">
                  {t('approval.filter.type')}
                </label>
                <Select id="type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="all">{t('approval.filter.allTypes')}</option>
                  {FILTERABLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {approvalTypeLabel(type, t)}
                    </option>
                  ))}
                </Select>
                <output htmlFor="type-filter" className="mt-2 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {typeFilter === 'all' ? t('approval.filter.allTypes') : approvalTypeLabel(typeFilter as ApprovalQueueItem['itemType'], t)}
                  <span className="tabular-nums">{filteredItems.length}</span>
                </output>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <Alert variant="info" title={t('approval.queue.emptyTitle')} icon={AlertCircle}>
                {waiting.length > 0 ? t('approval.queue.emptyFiltered') : t('approval.queue.emptyQueue')}
              </Alert>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <ApprovalItemCard
                    key={item.id}
                    item={item}
                    failureCode={failures[item.id]}
                    busy={busy}
                    approving={approvingId === item.id}
                    onApprove={handleApprove}
                    onEdit={setEditing}
                    onReject={setRejecting}
                  />
                ))}
              </div>
            )}

            <ApprovalDecidedList items={decided.filter((item) => matchesType(item, typeFilter))} />
          </>
        )}
      </div>

      <ApprovalEditDialog
        item={editing}
        edit={editItem}
        saveAndApprove={saveAndApproveItem}
        onClose={() => setEditing(null)}
        onApproved={noteDecided}
        onApproveFailed={noteFailure}
      />
      <ApprovalRejectDialog item={rejecting} reject={rejectItem} onClose={() => setRejecting(null)} onRejected={noteDecided} />
      <PublishReplyDialog
        text={publishingItem === null ? null : finalTextOf(publishingItem)}
        isLoading={approveItem.isPending}
        onClose={() => setPublishing(null)}
        onConfirm={async () => {
          if (publishingItem !== null) await publishReply(publishingItem);
        }}
      />
    </>
  );
}
