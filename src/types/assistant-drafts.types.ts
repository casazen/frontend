/**
 * Types of the drafts of the assistant (E05/F05/US02/T01, NF-66, NF-67): what a person gets when they ask for a draft of the last message of a
 * guest. The answer carries ids and codes only, never a word of the guest or of the draft: the text of the draft is read from the queue of
 * approvals (`GET api/approval-queue`), where it waits for the host.
 */

/** What the assistant did with the last message of the guest (`AssistantDecision`). The server may add a value later: the screen tells it as «not completed». */
export const ASSISTANT_DECISIONS = ['Drafted', 'AutoSent', 'Escalated', 'NotHandled'] as const;

/** A decision this version of the app knows. */
export type AssistantDecision = (typeof ASSISTANT_DECISIONS)[number];

/** How soon a person must look at a message, as the assistant judged it (`AssistantUrgency`). */
export type AssistantUrgency = 'Normal' | 'High' | 'Urgent';

/**
 * The answer of `POST api/assistant/threads/{threadKey}/draft`: the `decision` (`Drafted` with the item of the queue, `Escalated` with the «To do» raised,
 * `NotHandled` with its `reason` code), the situation the assistant recognised (the stable `situationCode`, the key of the label the screen shows), the
 * urgency and the confidence score. No text.
 */
export interface AssistantDraftOutcome {
  inboundMessageId: string;
  /** `Drafted`, `Escalated`, `NotHandled`, or a value a later version adds. */
  decision: string;
  /** The stable code of a decision that is not a draft (`thread_closed`, `assistant_disabled`, `mode_escalate`…). */
  reason: string | null;
  situation: string | null;
  situationCode: string | null;
  urgency: AssistantUrgency | null;
  confidenceScore: number | null;
  approvalItemId: string | null;
  activityId: string | null;
}
