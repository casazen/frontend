/**
 * Types of the drafts of the assistant (E05/F05/US02/T01, NF-66, NF-67): what a person gets when they ask for a draft of the last message of a
 * guest. The answer carries ids and codes only, never a word of the guest or of the draft: the text of the draft is read from the queue of
 * approvals (`GET api/approval-queue`), where it waits for the host.
 */

type AssistantUrgency = 'Normal' | 'High' | 'Urgent';

export interface AssistantDraftOutcome {
  inboundMessageId: string;
  decision: string;
  reason: string | null;
  situation: string | null;
  situationCode: string | null;
  urgency: AssistantUrgency | null;
  confidenceScore: number | null;
  approvalItemId: string | null;
  activityId: string | null;
}
