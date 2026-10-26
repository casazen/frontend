/**
 * Approval queue types (NF-06).
 * Items requiring human decision before execution.
 */

/** Approval queue item from backend. */
export interface ApprovalQueueItem {
  id: string;
  itemType: string;
  itemId: string;
  contentText: string;
  contentVersion: string | null;
  isAiGenerated: boolean;
  status: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

/** Request to reject an approval item. */
export interface RejectApprovalRequest {
  reason?: string;
}
