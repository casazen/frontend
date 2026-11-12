/**
 * Approval queue types (NF-06, NF-68, E05/F04).
 * Items requiring a human decision before they take effect: approving one runs the action it was waiting for.
 */

/** The types of item the queue knows (`ItemType`). The server may send another one later: it is shown as «other». */
export const APPROVAL_ITEM_TYPES = ['MessageDraft', 'Campaign', 'Routine', 'AiText'] as const;

/** An item type of {@link APPROVAL_ITEM_TYPES}. */
export type KnownApprovalItemType = (typeof APPROVAL_ITEM_TYPES)[number];

/** What approving an item does (`OriginAction`): `null` for an item of before the column existed. */
export type ApprovalOriginAction = 'SendGuestMessage' | 'ApproveCampaign' | 'SendReviewReply' | 'None';

/** Where the action an item was waiting for stands (`OriginActionStatus`). `Failed`: the item stays pending, with the code in `originActionError`. */
export type ApprovalOriginActionStatus = 'NotRequired' | 'Pending' | 'Executed' | 'Failed';

/**
 * How far the action went, on the answer of an approval only (`OriginActionResult`): `Sent`, `Created` or `WaitingAuthorization` (the channel has the
 * message and sends it) and `ManualVerify` (the outcome of the send is not known: it is checked on the channel, never sent again) for a message;
 * `Scheduled` or `Approved` (no time yet) for a campaign. `null` for a pure decision, for an item that was already approved and everywhere else.
 */
export type ApprovalOriginActionResult = 'Sent' | 'Created' | 'WaitingAuthorization' | 'ManualVerify' | 'Scheduled' | 'Approved';

/** Approval queue item from backend (`ApprovalQueueItemDto`). The texts are the host's to read: never log them, never put them in an address. */
export interface ApprovalQueueItem {
  id: string;
  /** `MessageDraft`, `Campaign`, `Routine`, `AiText` or a type a later version adds. */
  itemType: string;
  itemId: string;
  /** The text as it was submitted: an edit never overwrites it. */
  contentText: string;
  contentVersion: string | null;
  isAiGenerated: boolean;
  /** `Pending`, `Approved`, `Rejected` or `Expired`. */
  status: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  expiresAt: string;
  /** The property the item concerns; `null` for an item of the whole organization. */
  propertyId: string | null;
  originAction: ApprovalOriginAction | null;
  originActionStatus: ApprovalOriginActionStatus;
  /** The stable code of the last failure of the action (`Failed`); `null` otherwise. */
  originActionError: string | null;
  originActionExecutedAt: string | null;
  /** Only on the answer of an approval. */
  originActionResult: ApprovalOriginActionResult | null;
  /** The score of the assistant for a draft of a message, from 0 to 1. */
  confidenceScore: number | null;
  /** The situation the assistant recognised in the message of the guest (a snake_case code). */
  situationCode: string | null;
  /** The conversation of a draft of a message (`ota:…` or `direct:…`). */
  threadKey: string | null;
  /** The text as the host edited it, or `null` while it was not edited: the one the approval acts with. */
  editedContentText: string | null;
  editedAt: string | null;
  /** Why the item was rejected. */
  rejectionReason: string | null;
}

/** Request to edit the text of an approval item (`PUT api/approval-queue/{id}/edit`). */
export interface EditApprovalRequest {
  text: string;
}

/** Request to reject an approval item: the reason is mandatory (at most 500 characters). */
export interface RejectApprovalRequest {
  reason?: string;
}
