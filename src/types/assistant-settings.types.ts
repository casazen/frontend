export const ASSISTANT_TONES = ['Neutral', 'Friendly', 'Formal'] as const;

export type AssistantTone = (typeof ASSISTANT_TONES)[number];

export type AssistantMode = 'Escalate' | 'Draft' | 'Automatic' | 'AutomaticWithExceptions';

export const OFFERED_MODES: readonly AssistantMode[] = ['Escalate', 'Draft'];

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

export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

export const KNOWLEDGE_ENTRY_KINDS = ['Faq', 'Fact', 'Rule'] as const;

export type KnowledgeEntryKind = (typeof KNOWLEDGE_ENTRY_KINDS)[number];

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

export interface SavePropertyAssistantSettingsRequest {
  enabled: boolean | null;
  tone: AssistantTone | null;
  signature: string | null;
  hoursFrom: string | null;
  hoursTo: string | null;
  confidenceThreshold: number | null;
  forbiddenTopics: string[] | null;
}

interface ListingFact {
  topic: KnowledgeTopic | string;
  text: string;
  sourceField: string;
}

export interface KnowledgeEntry {
  id: string;
  propertyId: string | null;
  topic: KnowledgeTopic | string;
  kind: KnowledgeEntryKind | string;
  source: string;
  title: string | null;
  text: string;
  language: string | null;
  lessonId: string | null;
  isActive: boolean;
  inherited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantKnowledgeView {
  propertyId: string;
  language: string;
  facts: ListingFact[];
  entries: KnowledgeEntry[];
  topicsWithoutData: Array<KnowledgeTopic | string>;
}

export interface SaveKnowledgeEntryRequest {
  topic: KnowledgeTopic;
  kind: KnowledgeEntryKind;
  title: string | null;
  text: string;
  language: string | null;
  isActive: boolean;
}

type SituationOrigin = 'default' | 'organization' | 'property';

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

export interface SaveAssistantSituationRequest {
  mode: AssistantMode;
  template: string | null;
  source: KnowledgeTopic | null;
}
