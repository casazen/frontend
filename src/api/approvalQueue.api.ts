import { ApiClient } from './client';
import type { ApprovalQueueItem, RejectApprovalRequest } from '@/types/approval-queue.types';

/**
 * Approval queue API (NF-06).
 * Items requiring human decision before execution.
 */
export const approvalQueueApi = {
  /** Get pending approval items for the caller's organization (AC-NF06-1). */
  getPending: () =>
    ApiClient.get<ApprovalQueueItem[]>('/approval-queue'),

  /** Approve a pending item (AC-NF06-2). */
  approve: (id: string) =>
    ApiClient.post<ApprovalQueueItem>(`/approval-queue/${id}/approve`),

  /** Reject a pending item (AC-NF06-2). */
  reject: (id: string, data: RejectApprovalRequest) =>
    ApiClient.post<ApprovalQueueItem>(`/approval-queue/${id}/reject`, data),
};
