import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { ApprovalDecidedList } from '@/features/approvals/components/approval-decided-list';
import { ApprovalEditDialog } from '@/features/approvals/components/approval-edit-dialog';
import { ApprovalItemCard } from '@/features/approvals/components/approval-item-card';
import { ApprovalRejectDialog } from '@/features/approvals/components/approval-reject-dialog';
import { FILTERABLE_TYPES, approvalTypeLabel, originActionErrorOf } from '@/features/approvals/lib/approval-model';
import { useApproveItem, useEditItem, usePendingApprovals, useRejectItem, useSaveAndApproveItem } from '@/queries/approvalQueue';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';

const matchesType = (item: ApprovalQueueItem, typeFilter: string) => typeFilter === 'all' || item.itemType === typeFilter;

/**
 * The queue of the items that wait for a decision (NF-06, NF-68): the drafts of messages the assistant wrote, the campaigns, the texts of the AI. Each item
 * is read, edited, approved or rejected here; approving runs what the item was waiting for and says what it did, a failed action keeps the item open with a
 * retry, and a rejection keeps its reason. The page asks `approval.decide` (the route). A new item shows up within a minute without a reload.
 */
export function ApprovalQueuePage() {
  const { t } = useTranslation();
  const { data: items, isLoading, error } = usePendingApprovals();
  const approveItem = useApproveItem();
  // The edit and the rejection are started from their dialogs but live here, with the approval: a dialog closed while its request goes on (the X, Esc, a
  // tap outside) would take the callbacks of the request with it, and the decision would be written neither below nor on the card.
  const editItem = useEditItem();
  const saveAndApproveItem = useSaveAndApproveItem();
  const rejectItem = useRejectItem();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editing, setEditing] = useState<ApprovalQueueItem | null>(null);
  const [rejecting, setRejecting] = useState<ApprovalQueueItem | null>(null);
  // The queue lists only what waits: what was decided here stays below, quiet, until the page is left.
  const [decided, setDecided] = useState<ApprovalQueueItem[]>([]);
  // Why the last approval of an item failed (the code of its action), until the next try.
  const [failures, setFailures] = useState<Record<string, string>>({});

  const filteredItems = useMemo(() => (items ?? []).filter((item) => matchesType(item, typeFilter)), [items, typeFilter]);

  // One decision at a time, wherever it was started (the card, the dialog of the edit, the dialog of the rejection), also when its dialog has been closed:
  // while it goes on every button of the queue waits, so an approval cannot be sent twice at once.
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
    approveItem.mutate(item.id, {
      onSuccess: noteDecided,
      onError: (failure) => {
        const code = originActionErrorOf(failure);
        if (code !== undefined) noteFailure(item.id, code);
      },
    });
  };

  if (isLoading) {
    return <LoadingScreen message={t('approval.queue.loading')} />;
  }

  // A reading that failed while the list is on the screen (the minute poll) leaves the list as it is: only a page with nothing to show is an error,
  // and it keeps its title and its tabs, so that the other queue of decisions is still one click away.
  const loadFailed = Boolean(error) && !items;
  const waiting = items ?? [];

  return (
    <>
      <div className="container mx-auto space-y-6 px-4 py-8">
        <PageHeader title={t('approval.queue.title')} description={t('approval.queue.description')} />

        {loadFailed ? (
          <Alert variant="danger" title={t('shared.error')} icon={AlertCircle}>
            {t('approval.queue.loadError')}
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap gap-4">
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
              </div>
            </div>

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
    </>
  );
}
