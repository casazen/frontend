import { ApiClient } from './client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type {
  AssistantKnowledgeView,
  AssistantRules,
  EffectiveSituation,
  KnowledgeEntry,
  PropertyAssistantSettings,
  SaveAssistantRulesRequest,
  SaveAssistantSituationRequest,
  SaveKnowledgeEntryRequest,
  SavePropertyAssistantSettingsRequest,
} from '@/types/assistant-settings.types';

/**
 * Settings of the assistant (E05/F05/US01, NF-66): the rules, the knowledge and the situations. Behind the backend flag `MessageAssistant`: every endpoint answers 404
 * (`feature_disabled`) while it is off. An answer that is not the JSON shape of the endpoint (a page served in its place by a rewrite) is a load error, never an empty
 * list. The texts of the knowledge are the host's own and can hold a password: they are private answers, and the caller never logs or stores them.
 */

function expectObject<T>(value: T, url: string): T {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new UnexpectedApiResponseError(url);
  return value;
}

function expectList<T>(value: T[], url: string): T[] {
  if (!Array.isArray(value)) throw new UnexpectedApiResponseError(url);
  return value;
}

const propertyPath = (propertyId: string) => `/assistant/properties/${encodeURIComponent(propertyId)}`;
const situationPath = (code: string) => encodeURIComponent(code);

export const assistantSettingsApi = {
  getRules: async () => expectObject(await ApiClient.get<AssistantRules>('/assistant/rules'), '/assistant/rules'),

  saveRules: (request: SaveAssistantRulesRequest) => ApiClient.put<AssistantRules>('/assistant/rules', request),

  /** The exceptions of a property (`property.read` and the property in the caller's reach: 404 `property_not_found` otherwise). */
  getPropertySettings: async (propertyId: string) =>
    expectObject(await ApiClient.get<PropertyAssistantSettings>(`${propertyPath(propertyId)}/settings`), '/assistant/properties/settings'),

  savePropertySettings: (propertyId: string, request: SavePropertyAssistantSettingsRequest) =>
    ApiClient.put<PropertyAssistantSettings>(`${propertyPath(propertyId)}/settings`, request),

  deletePropertySettings: (propertyId: string) => ApiClient.delete<void>(`${propertyPath(propertyId)}/settings`),

  getKnowledge: async (propertyId: string, language: string) =>
    expectObject(
      await ApiClient.get<AssistantKnowledgeView>(`${propertyPath(propertyId)}/knowledge`, { language }),
      '/assistant/properties/knowledge',
    ),

  createPropertyEntry: (propertyId: string, request: SaveKnowledgeEntryRequest) =>
    ApiClient.post<KnowledgeEntry>(`${propertyPath(propertyId)}/knowledge`, request),

  updatePropertyEntry: (propertyId: string, entryId: string, request: SaveKnowledgeEntryRequest) =>
    ApiClient.put<KnowledgeEntry>(`${propertyPath(propertyId)}/knowledge/${encodeURIComponent(entryId)}`, request),

  deletePropertyEntry: (propertyId: string, entryId: string) =>
    ApiClient.delete<void>(`${propertyPath(propertyId)}/knowledge/${encodeURIComponent(entryId)}`),

  listOrganizationEntries: async () => expectList(await ApiClient.get<KnowledgeEntry[]>('/assistant/knowledge'), '/assistant/knowledge'),

  createOrganizationEntry: (request: SaveKnowledgeEntryRequest) => ApiClient.post<KnowledgeEntry>('/assistant/knowledge', request),

  updateOrganizationEntry: (entryId: string, request: SaveKnowledgeEntryRequest) =>
    ApiClient.put<KnowledgeEntry>(`/assistant/knowledge/${encodeURIComponent(entryId)}`, request),

  deleteOrganizationEntry: (entryId: string) => ApiClient.delete<void>(`/assistant/knowledge/${encodeURIComponent(entryId)}`),

  getSituations: async () => expectList(await ApiClient.get<EffectiveSituation[]>('/assistant/situations'), '/assistant/situations'),

  saveSituation: (code: string, request: SaveAssistantSituationRequest) =>
    ApiClient.put<EffectiveSituation>(`/assistant/situations/${situationPath(code)}`, request),

  getPropertySituations: async (propertyId: string) =>
    expectList(
      await ApiClient.get<EffectiveSituation[]>(`${propertyPath(propertyId)}/situations`),
      '/assistant/properties/situations',
    ),

  savePropertySituation: (propertyId: string, code: string, request: SaveAssistantSituationRequest) =>
    ApiClient.put<EffectiveSituation>(`${propertyPath(propertyId)}/situations/${situationPath(code)}`, request),

  deletePropertySituation: (propertyId: string, code: string) =>
    ApiClient.delete<void>(`${propertyPath(propertyId)}/situations/${situationPath(code)}`),
};
