import { isAxiosError } from 'axios';
import type { TFunction, i18n as I18nInstance } from 'i18next';
import { isMessageDraft } from '@/features/approvals/lib/approval-model';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import type { AssistantDraftOutcome } from '@/types/assistant-drafts.types';
import {
  KNOWLEDGE_TOPICS,
  type AssistantRules,
  type EffectiveSituation,
  type KnowledgeEntry,
  type KnowledgeEntryKind,
  type KnowledgeTopic,
  type PropertyAssistantSettings,
  type SaveKnowledgeEntryRequest,
} from '@/types/assistant-settings.types';

export const SITUATION_CODES = [
  'check_in_time',
  'early_arrival_or_late_checkout',
  'parking',
  'wifi',
  'directions',
  'pets',
  'invoice_request',
  'thank_you',
  'malfunction',
  'noise',
  'discount_request',
  'cancellation_or_refund',
  'complaint',
  'emergency',
  'other',
] as const;

const SITUATION_NAMES: Record<(typeof SITUATION_CODES)[number], string> = {
  check_in_time: 'CheckInTime',
  early_arrival_or_late_checkout: 'EarlyArrivalOrLateCheckout',
  parking: 'Parking',
  wifi: 'WiFi',
  directions: 'Directions',
  pets: 'Pets',
  invoice_request: 'InvoiceRequest',
  thank_you: 'ThankYou',
  malfunction: 'Malfunction',
  noise: 'Noise',
  discount_request: 'DiscountRequest',
  cancellation_or_refund: 'CancellationOrRefund',
  complaint: 'Complaint',
  emergency: 'Emergency',
  other: 'Other',
};

export const TOPIC_NAMES: readonly string[] = [
  ...KNOWLEDGE_TOPICS,
  ...Object.values(SITUATION_NAMES).filter((name) => !(KNOWLEDGE_TOPICS as readonly string[]).includes(name)),
];

const CODE_OF_SITUATION_NAME: ReadonlyMap<string, string> = new Map(Object.entries(SITUATION_NAMES).map(([code, name]) => [name, code]));

function phraseOf(code: string): string {
  const phrase = code
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return phrase.length === 0 ? code : phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export function situationText(code: string, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const key = `assistant.situation.${code}`;
  return /^[a-z][a-z0-9_]*$/.test(code) && i18n.exists(key) ? t(key) : phraseOf(code);
}

export function topicText(name: string, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const topicKey = `assistant.knowledge.topic.${name}`;
  if ((KNOWLEDGE_TOPICS as readonly string[]).includes(name) && i18n.exists(topicKey)) return t(topicKey);
  const code = CODE_OF_SITUATION_NAME.get(name);
  return code ? situationText(code, t, i18n) : phraseOf(name);
}

/** The names a list shows: the names the assistant knows, then any other name the server holds, so that saving the list never drops a name this version cannot show. */
export function topicOptions(current: readonly string[]): string[] {
  return [...TOPIC_NAMES, ...current.filter((name) => !TOPIC_NAMES.includes(name))];
}

export function knowledgeTopicText(topic: string, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const key = `assistant.knowledge.topic.${topic}`;
  return i18n.exists(key) ? t(key) : phraseOf(topic);
}

export const ASSISTANT_LANGUAGES = ['it', 'en', 'de', 'fr', 'es'] as const;

export function languageOptions(current: readonly string[]): string[] {
  return [...ASSISTANT_LANGUAGES, ...current.filter((code) => !(ASSISTANT_LANGUAGES as readonly string[]).includes(code))];
}

export function languageText(code: string, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const key = `assistant.language.${code}`;
  return i18n.exists(key) ? t(key) : code.toUpperCase();
}

export function hoursInput(value: string | null | undefined): string {
  const match = value ? /^(\d{2}):(\d{2})/.exec(value) : null;
  return match ? `${match[1]}:${match[2]}` : '';
}

export function hoursApi(input: string): string | null {
  return /^\d{2}:\d{2}$/.test(input) ? `${input}:00` : null;
}

export function hoursProblem(from: string, to: string): 'bothEnds' | 'sameTime' | null {
  const hasFrom = from.length > 0;
  const hasTo = to.length > 0;
  if (hasFrom !== hasTo) return 'bothEnds';
  return hasFrom && from === to ? 'sameTime' : null;
}

export const SIGNATURE_MAX_LENGTH = 300;

export function hasPropertyExceptions(settings: PropertyAssistantSettings): boolean {
  return (
    settings.enabled !== null ||
    settings.tone !== null ||
    settings.signature !== null ||
    settings.hoursFrom !== null ||
    settings.hoursTo !== null ||
    settings.confidenceThreshold !== null ||
    settings.forbiddenTopics !== null
  );
}

/**
 * The topics the organization forbids and the property's own list lets through: an exception can loosen what the organization forbids, and the screen says so, so that
 * nothing is relaxed in silence. `null` for a property that follows the organization (it loosens nothing); an empty list of its own means that nothing is forbidden.
 */
export function relaxedTopics(organization: readonly string[], property: readonly string[] | null): string[] {
  if (property === null) return [];
  const kept = new Set(property.map((name) => name.toLowerCase()));
  return organization.filter((name) => !kept.has(name.toLowerCase()));
}

export function relaxedThreshold(property: number | null, organization: number | undefined): boolean {
  return property !== null && organization !== undefined && property < organization;
}

function sameList(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((name, index) => name === second[index]);
}

/**
 * Whether the rules the server holds now (`current`) are the ones a form started from (`base`): every field the form owns, the threshold it does not show included.
 * The version of the instructions is NOT compared: it grows with every change that affects drafting (an answer of the knowledge, a situation, the exceptions of a
 * property), and a form must not be refused for something it does not hold.
 */
export function sameRules(base: AssistantRules, current: AssistantRules): boolean {
  return (
    base.enabled === current.enabled &&
    base.tone === current.tone &&
    base.signature === current.signature &&
    base.hoursFrom === current.hoursFrom &&
    base.hoursTo === current.hoursTo &&
    base.confidenceThreshold === current.confidenceThreshold &&
    sameList(base.languages, current.languages) &&
    sameList(base.allowedTopics, current.allowedTopics) &&
    sameList(base.forbiddenTopics, current.forbiddenTopics)
  );
}

export function sameExceptions(base: PropertyAssistantSettings, current: PropertyAssistantSettings): boolean {
  return (
    base.enabled === current.enabled &&
    base.tone === current.tone &&
    base.signature === current.signature &&
    base.hoursFrom === current.hoursFrom &&
    base.hoursTo === current.hoursTo &&
    base.confidenceThreshold === current.confidenceThreshold &&
    (base.forbiddenTopics === null || current.forbiddenTopics === null ? base.forbiddenTopics === current.forbiddenTopics : sameList(base.forbiddenTopics, current.forbiddenTopics))
  );
}

/** The stable code of the 409 the server gives to two changes of the instructions that meet at the same moment (`AssistantStore.ConcurrentChangeCode`). */
const CONCURRENT_CHANGE_CODE = 'assistant_concurrent_change';

/**
 * A save that was not sent because the server no longer holds what the form started from: somebody changed it meanwhile, and a whole-set save would have written over it
 * in silence (the server has no version to check a PUT against). Nothing was written. The screen tells it with the sentence of the 409 `assistant_concurrent_change`.
 */
export class StaleSettingsError extends Error {
  readonly code = CONCURRENT_CHANGE_CODE;

  constructor() {
    super('The settings changed while the form was open');
    this.name = 'StaleSettingsError';
  }
}

export function pendingDraftOf(items: readonly ApprovalQueueItem[] | undefined, threadKey: string): ApprovalQueueItem | null {
  const drafts = (items ?? []).filter((item) => isMessageDraft(item) && item.status === 'Pending' && item.threadKey === threadKey);
  return drafts.reduce<ApprovalQueueItem | null>((newest, item) => (newest === null || item.createdAt > newest.createdAt ? item : newest), null);
}

export interface DraftOutcomeView {
  key: string;
  tone: 'warning' | 'info';
  todoLink: boolean;
  settingsLink: boolean;
}

const NOT_HANDLED_REASONS: ReadonlySet<string> = new Set([
  'thread_not_found',
  'message_not_found',
  'property_unassigned',
  'thread_closed',
  'octorate_not_connected',
  'mapping_not_confirmed',
  'assistant_disabled',
  'ai_provider_not_configured',
  'ai_budget_exceeded',
  'ai_provider_error',
  'ai_invalid_answer',
  'message_too_old',
  'superseded',
  'host_already_replied',
]);

const ESCALATED_REASONS: ReadonlySet<string> = new Set(['mode_escalate', 'forbidden_topic', 'topic_not_allowed']);

const REASON_CODE = /^[a-z][a-z0-9_]*$/;

/**
 * What the assistant did when it was asked for a draft, in words. A draft that was written needs none (`null`: the draft is on the screen). Everything else is
 * a state that did not complete and is said as such, never as a success: a «To do» raised instead of a draft, a message that was not processed with its reason, and
 * any decision this version does not know (the server may add one).
 */
export function draftOutcomeView(outcome: Pick<AssistantDraftOutcome, 'decision' | 'reason'>): DraftOutcomeView | null {
  const reason = outcome.reason !== null && REASON_CODE.test(outcome.reason) ? outcome.reason : null;
  switch (outcome.decision) {
    case 'Drafted':
      return null;
    case 'Escalated':
      return {
        key: reason !== null && ESCALATED_REASONS.has(reason) ? `assistant.draft.outcome.escalated.${reason}` : 'assistant.draft.outcome.escalated.default',
        tone: 'info',
        todoLink: true,
        settingsLink: false,
      };
    case 'NotHandled':
      return {
        key: reason !== null && NOT_HANDLED_REASONS.has(reason) ? `assistant.draft.reason.${reason}` : 'assistant.draft.reason.unknown',
        tone: 'warning',
        todoLink: false,
        settingsLink: reason === 'assistant_disabled',
      };
    default:
      return { key: 'assistant.draft.reason.unknown', tone: 'warning', todoLink: false, settingsLink: false };
  }
}

const ERROR_KEYS: Readonly<Record<string, string>> = {
  assistant_no_guest_message: 'assistant.error.noGuestMessage',
  assistant_concurrent_change: 'assistant.error.concurrentChange',
  assistant_rules_invalid: 'assistant.error.rulesInvalid',
  assistant_threshold_invalid: 'assistant.error.thresholdInvalid',
  assistant_entry_invalid: 'assistant.error.entryInvalid',
  assistant_entry_not_found: 'assistant.error.entryNotFound',
  assistant_mode_not_allowed: 'assistant.error.modeNotAllowed',
  assistant_template_invalid: 'assistant.error.templateInvalid',
  assistant_situation_invalid: 'assistant.error.situationInvalid',
  assistant_situation_not_found: 'assistant.error.situationNotFound',
  property_not_found: 'assistant.error.propertyNotFound',
};

/** The stable code of an error of the API, if it has one (a save refused before it was sent, because the settings changed meanwhile, carries the code of the 409). */
export function errorCodeOf(error: unknown): string | undefined {
  if (error instanceof StaleSettingsError) return error.code;
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

export function assistantProblemMessage(error: unknown, t: TFunction): string | undefined {
  const code = errorCodeOf(error);
  const key = code === undefined ? undefined : ERROR_KEYS[code];
  return key === undefined ? getProblemMessage(error, t) : t(key);
}

export function isNotFound(error: unknown): boolean {
  return getHttpStatus(error) === 404;
}

export function modeKey(mode: string): 'escalate' | 'draft' | 'notActive' {
  if (mode === 'Escalate') return 'escalate';
  if (mode === 'Draft') return 'draft';
  return 'notActive';
}

export function answerSource(situation: Pick<EffectiveSituation, 'hasTemplate' | 'source'>): { kind: 'template' } | { kind: 'topic'; topic: string } | { kind: 'none' } {
  if (situation.hasTemplate) return { kind: 'template' };
  return situation.source ? { kind: 'topic', topic: situation.source } : { kind: 'none' };
}

export const ENTRY_TEXT_MAX_LENGTH = 1000;
export const ENTRY_TITLE_MAX_LENGTH = 200;

export const TEMPLATE_MAX_LENGTH = 1000;

export interface EntryFields {
  topic: KnowledgeTopic;
  kind: KnowledgeEntryKind;
  title: string;
  text: string;
  language: string;
  isActive: boolean;
}

export function entryProblem(fields: EntryFields): { field: 'title' | 'text'; key: string; max?: number } | null {
  const text = fields.text.trim();
  if (text.length === 0) return { field: 'text', key: 'assistant.knowledge.entry.error.textRequired' };
  if (text.length > ENTRY_TEXT_MAX_LENGTH) return { field: 'text', key: 'assistant.knowledge.entry.error.textTooLong', max: ENTRY_TEXT_MAX_LENGTH };
  const title = fields.title.trim();
  if (fields.kind === 'Faq' && title.length === 0) return { field: 'title', key: 'assistant.knowledge.entry.error.questionRequired' };
  if (title.length > ENTRY_TITLE_MAX_LENGTH) return { field: 'title', key: 'assistant.knowledge.entry.error.titleTooLong', max: ENTRY_TITLE_MAX_LENGTH };
  return null;
}

export function entryFieldsOf(entry: KnowledgeEntry | null, topic: KnowledgeTopic = 'Faq'): EntryFields {
  if (entry === null) return { topic, kind: topic === 'Faq' ? 'Faq' : 'Fact', title: '', text: '', language: '', isActive: true };
  return {
    topic: (KNOWLEDGE_TOPICS as readonly string[]).includes(entry.topic) ? (entry.topic as KnowledgeTopic) : 'Faq',
    kind: (['Faq', 'Fact', 'Rule'] as readonly string[]).includes(entry.kind) ? (entry.kind as KnowledgeEntryKind) : 'Fact',
    title: entry.title ?? '',
    text: entry.text,
    language: entry.language ?? '',
    isActive: entry.isActive,
  };
}

export function entryRequestOf(fields: EntryFields): SaveKnowledgeEntryRequest {
  return {
    topic: fields.topic,
    kind: fields.kind,
    title: fields.kind === 'Faq' ? fields.title.trim() : null,
    text: fields.text.trim(),
    language: fields.language.length > 0 ? fields.language : null,
    isActive: fields.isActive,
  };
}
