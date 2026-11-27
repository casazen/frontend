import { ApiClient } from './client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { ApprovalQueueItem, EditApprovalRequest, RejectApprovalRequest } from '@/types/approval-queue.types';

/**
 * Approval queue API (NF-06, NF-68).
 * Items requiring human decision before execution. Every call needs `approval.decide`; an item of another organization or of a
 * property out of the caller's reach is a 404. The answers carry the text of messages to guests: private, never cached.
 */
export const approvalQueueApi = {
  /**
   * Get pending approval items for the caller's organization, oldest first (AC-NF06-1). The endpoint answers a JSON array: anything else (a page
   * served in its place by a rewrite that does not reach the API) is a load error, never a list.
   */
  getPending: async () => {
    const items = await ApiClient.get<ApprovalQueueItem[]>('/approval-queue');
    if (!Array.isArray(items)) throw new UnexpectedApiResponseError('/approval-queue');
    return items;
  },

  /**
   * Edit the text of a pending item: the original is kept and the approval acts with the edited one (AC-NF68-2). 422 `approval_edit_invalid`
   * for a text that is empty, a message longer than 2000 characters or a campaign that is not a subject line, a blank line and a body.
   */
  edit: (id: string, text: string) =>
    ApiClient.put<ApprovalQueueItem>(`/approval-queue/${id}/edit`, { text } satisfies EditApprovalRequest),

  /**
   * Approve a pending item: the action it was waiting for runs (a message goes to the guest, a campaign is approved and scheduled) and the
   * answer says how far it went (`originActionResult`). 409 `approval_origin_action_failed` when the action failed: the item stays pending (AC-NF68-1).
   */
  approve: (id: string) =>
    ApiClient.post<ApprovalQueueItem>(`/approval-queue/${id}/approve`),

  /** Reject a pending item; the reason is mandatory and is saved on the item (AC-NF68-3). */
  reject: (id: string, data: RejectApprovalRequest) =>
    ApiClient.post<ApprovalQueueItem>(`/approval-queue/${id}/reject`, data),
};
