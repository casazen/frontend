/**
 * Types of the settings of the assistant (E05/F05/US01/T02 and T03, NF-66, NF-67): the rules of the organization and the exceptions of a property, the
 * knowledge base the assistant may use, and what it does in each situation. Enums are the names the server writes (`Draft`, `CheckIn`); times are `HH:mm:ss`.
 */

/** The tone of the drafts (`AssistantTone`). */
export const ASSISTANT_TONES = ['Neutral', 'Friendly', 'Formal'] as const;

/** A tone of {@link ASSISTANT_TONES}. */
export type AssistantTone = (typeof ASSISTANT_TONES)[number];

/**
 * What the assistant does when it recognises a situation (`AssistantMode`). In this release it only drafts: `Escalate` raises a «To do» for a person,
 * `Draft` writes a draft that waits for the host. The automatic modes exist on the server and are not offered: a draft is never sent by itself.
 */
export type AssistantMode = 'Escalate' | 'Draft' | 'Automatic' | 'AutomaticWithExceptions';

/** The modes this release offers, in the order they are shown. */
export const OFFERED_MODES: readonly AssistantMode[] = ['Escalate', 'Draft'];

/** What a piece of knowledge is about (`KnowledgeTopic`). */
export const KNOWLEDGE_TOPICS = [
  'CheckIn',
  'CheckOut',
  'WiFi',
  'Parking',
  'HouseRules',
  'Hours',
  'Amenities',
  'Directions',
  'Pets',
  'Contacts',
  'Faq',
] as const;

/** A topic of {@link KNOWLEDGE_TOPICS}. */
export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

/** The kind of an entry the host wrote: a question with its answer, a fact, or a rule (`KnowledgeEntryKind`). */
export const KNOWLEDGE_ENTRY_KINDS = ['Faq', 'Fact', 'Rule'] as const;

/** A kind of {@link KNOWLEDGE_ENTRY_KINDS}. */
export type KnowledgeEntryKind = (typeof KNOWLEDGE_ENTRY_KINDS)[number];

/**
 * The rules of the organization (`GET api/assistant/rules`): the switch, the tone, the languages, the signature, the hours (`hoursFrom` to `hoursTo`, both `null` =
 * at any time), the allowed topics (an empty list means «no restriction»: the assistant may answer on any topic) and the forbidden ones (names of topics or
 * situations), and the confidence threshold the server keeps.
 */
export interface AssistantRules {
  enabled: boolean;
  tone: AssistantTone;
  languages: string[];
  signature: string | null;
  hoursFrom: string | null;
  hoursTo: string | null;
  allowedTopics: string[];
  forbiddenTopics: string[];
  confidenceThreshold: number;
  instructionVersion: number;
}

/**
 * The body of `PUT api/assistant/rules`: the WHOLE set. What it does not give is the default of the server (off, neutral, Italian and English, no signature, any
 * hour, no lists, threshold 0.85): a save always sends every field it has read, the threshold included, so that it never resets what this screen does not show.
 */
export interface SaveAssistantRulesRequest {
  enabled: boolean;
  tone: AssistantTone;
  languages: string[];
  signature: string | null;
  hoursFrom: string | null;
  hoursTo: string | null;
  allowedTopics: string[];
  forbiddenTopics: string[];
  confidenceThreshold: number;
}

/**
 * The exceptions of a property to the rules of its organization (`GET api/assistant/properties/{propertyId}/settings`): a `null` field means «as the
 * organization», and a property with no exception has every field `null`. `forbiddenTopics` replaces the organization's list when it is given (an empty
 * list means that nothing is forbidden for the property).
 */
export interface PropertyAssistantSettings {
  propertyId: string;
  enabled: boolean | null;
  tone: AssistantTone | null;
  signature: string | null;
  hoursFrom: string | null;
  hoursTo: string | null;
  confidenceThreshold: number | null;
  forbiddenTopics: string[] | null;
  updatedAt: string | null;
}

/** The body of `PUT api/assistant/properties/{propertyId}/settings`: the whole set of the exceptions; a `null` field is «as the organization». */
export interface SavePropertyAssistantSettingsRequest {
  enabled: boolean | null;
  tone: AssistantTone | null;
  signature: string | null;
  hoursFrom: string | null;
  hoursTo: string | null;
  confidenceThreshold: number | null;
  forbiddenTopics: string[] | null;
}

/** A fact the server read from the listing: its topic, its text in the language asked and the field of the listing it comes from. Never stored. */
export interface ListingFact {
  topic: KnowledgeTopic | string;
  text: string;
  sourceField: string;
}

/** An entry of the knowledge base the host wrote (`source` `Custom`) or the assistant learnt (`Lesson`). `propertyId` is `null` for an entry of the whole organization. */
export interface KnowledgeEntry {
  id: string;
  propertyId: string | null;
  topic: KnowledgeTopic | string;
  kind: KnowledgeEntryKind | string;
  source: string;
  title: string | null;
  /** The host's own words: it can hold a password, so it is never logged, never put in an address and not kept after the page is left. */
  text: string;
  language: string | null;
  lessonId: string | null;
  isActive: boolean;
  /** True for an entry of the organization shown under a property. */
  inherited: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The knowledge base of a property (`GET api/assistant/properties/{propertyId}/knowledge`): the facts of the listing, the entries, and the topics without any data. */
export interface AssistantKnowledgeView {
  propertyId: string;
  language: string;
  facts: ListingFact[];
  entries: KnowledgeEntry[];
  topicsWithoutData: Array<KnowledgeTopic | string>;
}

/** The body of an entry to create or change: the whole entry. A bad value is a 422 `assistant_entry_invalid`. */
export interface SaveKnowledgeEntryRequest {
  topic: KnowledgeTopic;
  kind: KnowledgeEntryKind;
  /** The question of a FAQ (it needs one), up to 200 characters. */
  title: string | null;
  /** 1 to 1,000 characters. */
  text: string;
  /** Two lower-case letters, or `null` for any language. */
  language: string | null;
  isActive: boolean;
}

/** Where the value of a situation comes from (`origin`): the default of the assistant, the organization's row, or the exception of a property. */
export type SituationOrigin = 'default' | 'organization' | 'property';

/**
 * A situation with the value it has (`GET api/assistant/situations`, `GET api/assistant/properties/{propertyId}/situations`): the stable `code` (the key of the
 * label), the `mode`, the modes it allows, whether it is sensitive (never beyond a draft), the `template` (only for who may edit it; others read `hasTemplate`), the
 * `source` topic the answer comes from when there is no template, and `modeSince`, the start of the trust period: `null` for a situation nobody configured.
 */
export interface EffectiveSituation {
  situation: string;
  code: string;
  mode: AssistantMode | string;
  allowedModes: Array<AssistantMode | string>;
  sensitiveCategories: string;
  isSensitive: boolean;
  hasTemplate: boolean;
  template: string | null;
  source: KnowledgeTopic | string | null;
  modeSince: string | null;
  origin: SituationOrigin | string;
}

/** The body of `PUT api/assistant/situations/{code}` and of the property's one: the whole row. What it does not give is none (no template, no source). */
export interface SaveAssistantSituationRequest {
  mode: AssistantMode;
  template: string | null;
  source: KnowledgeTopic | null;
}
