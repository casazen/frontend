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
  /** The rules of the organization; the defaults of the server while it never saved any. Read by whoever reads the bookings (`booking.read`). */
  getRules: async () => expectObject(await ApiClient.get<AssistantRules>('/assistant/rules'), '/assistant/rules'),

  /**
   * Saves the rules of the organization, the whole set (the organization administrator only: 403 for anyone else). 409 `assistant_concurrent_change` (someone changed
   * the instructions at the same moment: read them again), 422 `assistant_rules_invalid` or `assistant_threshold_invalid`.
   */
  saveRules: (request: SaveAssistantRulesRequest) => ApiClient.put<AssistantRules>('/assistant/rules', request),

  /** The exceptions of a property (`property.read` and the property in the caller's reach: 404 `property_not_found` otherwise). */
  getPropertySettings: async (propertyId: string) =>
    expectObject(await ApiClient.get<PropertyAssistantSettings>(`${propertyPath(propertyId)}/settings`), '/assistant/properties/settings'),

  /** Saves the exceptions of a property, the whole set (`property.write`); every field `null` removes them. */
  savePropertySettings: (propertyId: string, request: SavePropertyAssistantSettingsRequest) =>
    ApiClient.put<PropertyAssistantSettings>(`${propertyPath(propertyId)}/settings`, request),

  /** Removes the exceptions of a property: it follows the organization again. */
  deletePropertySettings: (propertyId: string) => ApiClient.delete<void>(`${propertyPath(propertyId)}/settings`),

  /** The knowledge base of a property in a language (`it` or `en`): the facts of its listing, its entries and the organization's, and the topics without data. */
  getKnowledge: async (propertyId: string, language: string) =>
    expectObject(
      await ApiClient.get<AssistantKnowledgeView>(`${propertyPath(propertyId)}/knowledge`, { language }),
      '/assistant/properties/knowledge',
    ),

  /** Creates an entry of a property (`property.write`). 422 `assistant_entry_invalid`. */
  createPropertyEntry: (propertyId: string, request: SaveKnowledgeEntryRequest) =>
    ApiClient.post<KnowledgeEntry>(`${propertyPath(propertyId)}/knowledge`, request),

  /** Changes an entry of a property. 404 `assistant_entry_not_found` for an entry that is not this property's. */
  updatePropertyEntry: (propertyId: string, entryId: string, request: SaveKnowledgeEntryRequest) =>
    ApiClient.put<KnowledgeEntry>(`${propertyPath(propertyId)}/knowledge/${encodeURIComponent(entryId)}`, request),

  /** Deletes an entry of a property. */
  deletePropertyEntry: (propertyId: string, entryId: string) =>
    ApiClient.delete<void>(`${propertyPath(propertyId)}/knowledge/${encodeURIComponent(entryId)}`),

  /** The entries of the whole organization (no property), active or not (`booking.read`). */
  listOrganizationEntries: async () => expectList(await ApiClient.get<KnowledgeEntry[]>('/assistant/knowledge'), '/assistant/knowledge'),

  /** Creates an entry of the whole organization: it applies to every property that has no entry of its own with the same topic and kind (the organization administrator only). */
  createOrganizationEntry: (request: SaveKnowledgeEntryRequest) => ApiClient.post<KnowledgeEntry>('/assistant/knowledge', request),

  /** Changes an entry of the whole organization. 404 `assistant_entry_not_found`: an entry of a property is not one. */
  updateOrganizationEntry: (entryId: string, request: SaveKnowledgeEntryRequest) =>
    ApiClient.put<KnowledgeEntry>(`/assistant/knowledge/${encodeURIComponent(entryId)}`, request),

  /** Deletes an entry of the whole organization. */
  deleteOrganizationEntry: (entryId: string) => ApiClient.delete<void>(`/assistant/knowledge/${encodeURIComponent(entryId)}`),

  /** The 15 situations as the organization has them: its own row, else the default of the situation (`booking.read`). */
  getSituations: async () => expectList(await ApiClient.get<EffectiveSituation[]>('/assistant/situations'), '/assistant/situations'),

  /** Saves a situation for the whole organization (the organization administrator only). 422 `assistant_mode_not_allowed`, `assistant_template_invalid`. */
  saveSituation: (code: string, request: SaveAssistantSituationRequest) =>
    ApiClient.put<EffectiveSituation>(`/assistant/situations/${situationPath(code)}`, request),

  /** The situations as a property has them: its own exception, else the organization's row, else the default. */
  getPropertySituations: async (propertyId: string) =>
    expectList(
      await ApiClient.get<EffectiveSituation[]>(`${propertyPath(propertyId)}/situations`),
      '/assistant/properties/situations',
    ),

  /** Saves the exception of a property for a situation: a whole row that replaces the organization's value for this property (`property.write`). */
  savePropertySituation: (propertyId: string, code: string, request: SaveAssistantSituationRequest) =>
    ApiClient.put<EffectiveSituation>(`${propertyPath(propertyId)}/situations/${situationPath(code)}`, request),

  /** Removes the exception of a property for a situation: it goes back to the organization's value. */
  deletePropertySituation: (propertyId: string, code: string) =>
    ApiClient.delete<void>(`${propertyPath(propertyId)}/situations/${situationPath(code)}`),
};
