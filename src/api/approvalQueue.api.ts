import { ApiClient } from './client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { ApprovalQueueItem, EditApprovalRequest, RejectApprovalRequest } from '@/types/approval-queue.types';

/**
 * Approval queue API (NF-06, NF-68).
 * Items requiring human decision before execution. Every call needs `approval.decide`; an item of another organization or of a
 * property out of the caller's reach is a 404. The answers carry the text of messages to guests: private, never cached.
 */
export const approvalQueueApi = {
  getPending: async () => {
    const items = await ApiClient.get<ApprovalQueueItem[]>('/approval-queue');
    if (!Array.isArray(items)) throw new UnexpectedApiResponseError('/approval-queue');
    return items;
  },

  edit: (id: string, text: string) =>
    ApiClient.put<ApprovalQueueItem>(`/approval-queue/${id}/edit`, { text } satisfies EditApprovalRequest),

  approve: (id: string) =>
    ApiClient.post<ApprovalQueueItem>(`/approval-queue/${id}/approve`),

  reject: (id: string, data: RejectApprovalRequest) =>
    ApiClient.post<ApprovalQueueItem>(`/approval-queue/${id}/reject`, data),
};
