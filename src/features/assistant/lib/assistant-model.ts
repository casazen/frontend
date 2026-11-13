import { isAxiosError } from 'axios';
import type { TFunction, i18n as I18nInstance } from 'i18next';
import { isMessageDraft } from '@/features/approvals/lib/approval-model';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import type { AssistantDraftOutcome } from '@/types/assistant-drafts.types';
import {
  KNOWLEDGE_TOPICS,
  type EffectiveSituation,
  type KnowledgeEntry,
  type KnowledgeEntryKind,
  type KnowledgeTopic,
  type PropertyAssistantSettings,
  type SaveKnowledgeEntryRequest,
} from '@/types/assistant-settings.types';

/*
 * What the screens of the assistant say about its data, as plain functions: the situations and the topics in words, the hours the server keeps as
 * `HH:mm:ss`, what a request for a draft ended in, what a mode does and why a field is read-only. Nothing here reads, logs or stores the text of a guest or
 * of a draft; the texts of the knowledge are the host's own and stay in the components that show them.
 */

// -- the situations and the topics -----------------------------------------------------------------------------------------------------

/** The stable codes of the situations the assistant recognises (`AssistantSituationCatalog`), in the order the screens list them: the key of their label. */
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

/** The name of the enum member of each situation (`AssistantSituation`), the one the lists of allowed and forbidden topics hold. */
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

/**
 * The names a list of allowed or forbidden topics may hold (`AssistantTopicNames.Known`): the topics of the knowledge, then the situations that are not topics.
 * A name that is both (`Parking`, `WiFi`, `Pets`, `Directions`) covers the topic and the situation.
 */
export const TOPIC_NAMES: readonly string[] = [
  ...KNOWLEDGE_TOPICS,
  ...Object.values(SITUATION_NAMES).filter((name) => !(KNOWLEDGE_TOPICS as readonly string[]).includes(name)),
];

const CODE_OF_SITUATION_NAME: ReadonlyMap<string, string> = new Map(Object.entries(SITUATION_NAMES).map(([code, name]) => [name, code]));

/** A word for a code the version of the app does not know: the code itself written as a phrase («late_check_in» → «Late check in»), never a raw identifier. */
function phraseOf(code: string): string {
  const phrase = code
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return phrase.length === 0 ? code : phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** The situation in words: `assistant.situation.<code>` for the situations the assistant has (snake_case codes), a phrase for a code a later version adds. */
export function situationText(code: string, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const key = `assistant.situation.${code}`;
  return /^[a-z][a-z0-9_]*$/.test(code) && i18n.exists(key) ? t(key) : phraseOf(code);
}

/** The name of a list of topics in words: a topic of the knowledge, a situation, or (for a name a later version adds) a phrase. */
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

/** A topic of the knowledge in words. */
export function knowledgeTopicText(topic: string, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const key = `assistant.knowledge.topic.${topic}`;
  return i18n.exists(key) ? t(key) : phraseOf(topic);
}

/** The languages the assistant offers for its drafts: the ones the guests of the product write in. The server takes any two lower-case letters. */
export const ASSISTANT_LANGUAGES = ['it', 'en', 'de', 'fr', 'es'] as const;

/** The languages a list shows: the ones offered, then any other code the server holds (it is kept when the rules are saved). */
export function languageOptions(current: readonly string[]): string[] {
  return [...ASSISTANT_LANGUAGES, ...current.filter((code) => !(ASSISTANT_LANGUAGES as readonly string[]).includes(code))];
}

/** A language in words: `assistant.language.<code>` for the ones offered, the code in capitals for any other. */
export function languageText(code: string, t: TFunction, i18n: Pick<I18nInstance, 'exists'>): string {
  const key = `assistant.language.${code}`;
  return i18n.exists(key) ? t(key) : code.toUpperCase();
}

// -- the hours -------------------------------------------------------------------------------------------------------------------------

/** The hours of the server (`HH:mm:ss`) as an `<input type="time">` takes them (`HH:mm`); empty when there are none. */
export function hoursInput(value: string | null | undefined): string {
  const match = value ? /^(\d{2}):(\d{2})/.exec(value) : null;
  return match ? `${match[1]}:${match[2]}` : '';
}

/** The hours of an `<input type="time">` as the server takes them (`HH:mm:ss`); `null` for none. */
export function hoursApi(input: string): string | null {
  return /^\d{2}:\d{2}$/.test(input) ? `${input}:00` : null;
}

/** What is wrong with a window of hours, as the server judges it (`assistant_rules_invalid`): one end only, or the same time at both ends. `null` when it is usable (both empty = at any time). */
export function hoursProblem(from: string, to: string): 'bothEnds' | 'sameTime' | null {
  const hasFrom = from.length > 0;
  const hasTo = to.length > 0;
  if (hasFrom !== hasTo) return 'bothEnds';
  return hasFrom && from === to ? 'sameTime' : null;
}

/** The longest signature (`OrgAssistantRules.SignatureMaxLength`); the server checks again. */
export const SIGNATURE_MAX_LENGTH = 300;

// -- the exceptions of a property ------------------------------------------------------------------------------------------------------

/** Whether a property has any exception to the rules of the organization (a `null` field is «as the organization»). */
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

/** Whether the threshold of confidence of the property is lower than the organization's (the property accepts drafts the organization would not): a looser rule, said as such. */
export function relaxedThreshold(property: number | null, organization: number | undefined): boolean {
  return property !== null && organization !== undefined && property < organization;
}

// -- the draft of a conversation -------------------------------------------------------------------------------------------------------

/** The pending draft of the assistant for a conversation: the newest one (a new draft supersedes the one that was waiting), or `null`. */
export function pendingDraftOf(items: readonly ApprovalQueueItem[] | undefined, threadKey: string): ApprovalQueueItem | null {
  const drafts = (items ?? []).filter((item) => isMessageDraft(item) && item.status === 'Pending' && item.threadKey === threadKey);
  return drafts.reduce<ApprovalQueueItem | null>((newest, item) => (newest === null || item.createdAt > newest.createdAt ? item : newest), null);
}

/** How a request for a draft ended, for the screen: the i18n key of the sentence, its weight, and where a person goes from there. */
export interface DraftOutcomeView {
  key: string;
  tone: 'warning' | 'info';
  /** The assistant raised a «To do» for the host: the list of the activities is where it is. */
  todoLink: boolean;
  /** The assistant is off for the organization or for the property: its settings are where it is switched on. */
  settingsLink: boolean;
}

/** The reasons a decision `NotHandled` carries (the codes of the decision log) that have a sentence of their own. */
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

/** The reasons a decision `Escalated` carries that have a sentence of their own: the situation is set to a «To do», or its topic is not allowed. */
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
      // `AutoSent` is never the answer of «a draft now» (nothing is sent), and a value of a later version is not known: neither is told as a success.
      return { key: 'assistant.draft.reason.unknown', tone: 'warning', todoLink: false, settingsLink: false };
  }
}

// -- errors ----------------------------------------------------------------------------------------------------------------------------

/** The codes of the endpoints of the assistant that have a sentence of their own (`assistant.error.<camelCase>`); the others fall back to the general ones. */
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

/** The stable code of an error of the API, if it has one. */
export function errorCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/** Why a request of the assistant did not go through, in plain words: the sentence of its code, else the general one of the API, else `undefined` (the caller says its own). */
export function assistantProblemMessage(error: unknown, t: TFunction): string | undefined {
  const code = errorCodeOf(error);
  const key = code === undefined ? undefined : ERROR_KEYS[code];
  return key === undefined ? getProblemMessage(error, t) : t(key);
}

/** A 404: whatever the code, the thing is not there (not in the caller's organization, not within its reach, or gone), even when an older answer is still in the cache. */
export function isNotFound(error: unknown): boolean {
  return getHttpStatus(error) === 404;
}

// -- the modes -------------------------------------------------------------------------------------------------------------------------

/**
 * What a situation does, as the screen says it, from the real mode the server answers. A mode this release does not offer (an automatic one set through the API)
 * is not shown as if it worked: the assistant still only drafts, and the screen says so.
 */
export function modeKey(mode: string): 'escalate' | 'draft' | 'notActive' {
  if (mode === 'Escalate') return 'escalate';
  if (mode === 'Draft') return 'draft';
  return 'notActive';
}

/** Where the answer of a situation comes from, as the server says it: the host's template, the topic of the knowledge, or nothing in particular. */
export function answerSource(situation: Pick<EffectiveSituation, 'hasTemplate' | 'source'>): { kind: 'template' } | { kind: 'topic'; topic: string } | { kind: 'none' } {
  if (situation.hasTemplate) return { kind: 'template' };
  return situation.source ? { kind: 'topic', topic: situation.source } : { kind: 'none' };
}

// -- the entries of the knowledge ------------------------------------------------------------------------------------------------------

/** The longest text of an entry and the longest question of a FAQ (`assistant_entry_invalid`); the server checks again. */
export const ENTRY_TEXT_MAX_LENGTH = 1000;
export const ENTRY_TITLE_MAX_LENGTH = 200;

/** The longest text of the answer of a situation (`assistant_template_invalid`); the server checks again. */
export const TEMPLATE_MAX_LENGTH = 1000;

/** What the form of an entry holds. */
export interface EntryFields {
  topic: KnowledgeTopic;
  kind: KnowledgeEntryKind;
  title: string;
  text: string;
  /** `''` for any language. */
  language: string;
  isActive: boolean;
}

/** What is wrong with an entry (what the server would refuse as `assistant_entry_invalid`): the field and the i18n key of the sentence. `null` when it is usable. */
export function entryProblem(fields: EntryFields): { field: 'title' | 'text'; key: string; max?: number } | null {
  const text = fields.text.trim();
  if (text.length === 0) return { field: 'text', key: 'assistant.knowledge.entry.error.textRequired' };
  if (text.length > ENTRY_TEXT_MAX_LENGTH) return { field: 'text', key: 'assistant.knowledge.entry.error.textTooLong', max: ENTRY_TEXT_MAX_LENGTH };
  const title = fields.title.trim();
  if (fields.kind === 'Faq' && title.length === 0) return { field: 'title', key: 'assistant.knowledge.entry.error.questionRequired' };
  if (title.length > ENTRY_TITLE_MAX_LENGTH) return { field: 'title', key: 'assistant.knowledge.entry.error.titleTooLong', max: ENTRY_TITLE_MAX_LENGTH };
  return null;
}

/** The form of an entry that exists, or the empty form of a new one (for a topic that has no data: the topic is chosen). */
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

/** The body of the save of an entry, from its form: the whole entry, a FAQ with its question, any other kind with no title. */
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
