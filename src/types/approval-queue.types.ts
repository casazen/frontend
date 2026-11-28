export const APPROVAL_ITEM_TYPES = ['MessageDraft', 'Campaign', 'Routine', 'AiText', 'ReviewReply'] as const;

export type KnownApprovalItemType = (typeof APPROVAL_ITEM_TYPES)[number];

type ApprovalOriginAction = 'SendGuestMessage' | 'ApproveCampaign' | 'SendReviewReply' | 'None';

type ApprovalOriginActionStatus = 'NotRequired' | 'Pending' | 'Executed' | 'Failed';

export type ApprovalOriginActionResult = 'Sent' | 'Created' | 'WaitingAuthorization' | 'ManualVerify' | 'Scheduled' | 'Approved';

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
  propertyId: string | null;
  originAction: ApprovalOriginAction | null;
  originActionStatus: ApprovalOriginActionStatus;
  /** The stable code of the last failure of the action (`Failed`); `null` otherwise. */
  originActionError: string | null;
  originActionExecutedAt: string | null;
  originActionResult: ApprovalOriginActionResult | null;
  confidenceScore: number | null;
  situationCode: string | null;
  threadKey: string | null;
  editedContentText: string | null;
  editedAt: string | null;
  rejectionReason: string | null;
}

export interface EditApprovalRequest {
  text: string;
}

export interface RejectApprovalRequest {
  reason?: string;
}
