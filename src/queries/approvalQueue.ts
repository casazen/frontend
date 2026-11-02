import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalQueueApi } from '@/api/approvalQueue.api';
import type { RejectApprovalRequest } from '@/types/approval-queue.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const APPROVAL_QUEUE_KEY = 'approval-queue';

/**
 * Pending approval items within the caller's organization (AC-NF06-1).
 * Refetches on mount: the list changes when operators work on it elsewhere.
 */
export function usePendingApprovals() {
  return useQuery({
    queryKey: [APPROVAL_QUEUE_KEY, 'pending'],
    queryFn: () => approvalQueueApi.getPending(),
    refetchOnMount: true,
  });
}

/** Approve an approval queue item (AC-NF06-2). */
export function useApproveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approvalQueueApi.approve(id),
    onSuccess: () => {
      toast.success(i18n.t('approval.action.approved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('approval.action.approveFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [APPROVAL_QUEUE_KEY] });
    },
  });
}

/** Reject an approval queue item (AC-NF06-2). */
export function useRejectItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectApprovalRequest }) =>
      approvalQueueApi.reject(id, data),
    onSuccess: () => {
      toast.success(i18n.t('approval.action.rejected'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('approval.action.rejectFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [APPROVAL_QUEUE_KEY] });
    },
  });
}
