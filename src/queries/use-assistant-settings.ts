import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { assistantSettingsApi } from '@/api/assistant-settings.api';
import { StaleSettingsError, sameExceptions, sameRules } from '@/features/assistant/lib/assistant-model';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { retryTransientErrors } from '@/lib/query-client';
import type {
  AssistantRules,
  PropertyAssistantSettings,
  SaveAssistantRulesRequest,
  SaveAssistantSituationRequest,
  SaveKnowledgeEntryRequest,
  SavePropertyAssistantSettingsRequest,
} from '@/types/assistant-settings.types';

/** Root of the queries of the settings of the assistant: the rules, the exceptions of the properties, the knowledge and the situations. */
export const ASSISTANT_QUERY = 'assistant';

const RULES_KEY = [ASSISTANT_QUERY, 'rules'] as const;

/** How long a reading of the settings counts as fresh: they are changed by other people of the organization and every page that opens reads them again. */
const SETTINGS_STALE_MS = 30_000;

/**
 * What every query of this page has in common: read again at every visit (`refetchOnMount: 'always'`, `true` would read only data that is stale), fresh for half a
 * minute, and a transient failure tried once more. A refusal (403, 404) is final and is told by the page.
 */
const LIVE = {
  staleTime: SETTINGS_STALE_MS,
  refetchOnMount: 'always' as const,
  retry: retryTransientErrors(1),
};

/** A save whose refusal is kept without the request that carried it: the host's own words (a signature, an answer that may hold a password) are not kept with the error. */
async function withoutRequestOnFailure<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw withoutRequest(error);
  }
}

/**
 * The instructions of the assistant depend on all of these (rules, exceptions, knowledge, situations): a change to one of them makes the whole root stale, so the
 * pages that are open read what the server holds now. A refusal of a save is told by the component that holds the mutation, which is not the form that is started again
 * when the reading brings other values (a form that holds its own mutation loses the refusal with the remount).
 */
function useRefreshAssistant() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [ASSISTANT_QUERY] });
}

// -- rules -----------------------------------------------------------------------------------------------------------------------------

/** The rules of the organization (`booking.read`): `enabled` false asks nothing (a person who cannot read them, or a page that is not open). */
export function useAssistantRules(enabled: boolean) {
  return useQuery({ queryKey: RULES_KEY, queryFn: () => assistantSettingsApi.getRules(), enabled, ...LIVE });
}

/**
 * Saves the rules of the organization, the whole set (the organization administrator only). The server has no version to check a PUT against (the version of the
 * instructions is only read, and the 409 `assistant_concurrent_change` is for two changes that meet at the same moment), so a form that was open for a while would write
 * over what somebody else saved, in silence. The rules are therefore read again first: when they are no longer what the form started from (`base`) nothing is sent, the values
 * the server holds are put on the screen and the refusal is `StaleSettingsError`. The refusal is told by the component that holds this mutation (the rules are read again
 * whatever the answer, and the form that started from the old ones is started again).
 */
export function useSaveAssistantRules() {
  const queryClient = useQueryClient();
  const refresh = useRefreshAssistant();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ request, base }: { request: SaveAssistantRulesRequest; base: AssistantRules }) =>
      withoutRequestOnFailure(async () => {
        const current = await assistantSettingsApi.getRules();
        if (!sameRules(base, current)) {
          queryClient.setQueryData(RULES_KEY, current);
          throw new StaleSettingsError();
        }
        return assistantSettingsApi.saveRules(request);
      }),
    onSuccess: () => {
      toast.success(i18n.t('assistant.toast.rulesSaved'));
    },
    onSettled: refresh,
  });
}

// -- the exceptions of a property ------------------------------------------------------------------------------------------------------

const propertySettingsKey = (propertyId: string | null) => [ASSISTANT_QUERY, 'property-settings', propertyId] as const;

/** The exceptions of a property (`property.read`). */
export function usePropertyAssistantSettings(propertyId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: propertySettingsKey(propertyId),
    queryFn: () => assistantSettingsApi.getPropertySettings(propertyId as string),
    enabled: enabled && propertyId !== null,
    ...LIVE,
  });
}

/**
 * Saves the exceptions of a property, the whole set (`property.write`). Like the rules of the organization, it reads them again first and sends nothing when they are no
 * longer what the form started from (`base`): `StaleSettingsError`, and the values the server holds are put on the screen.
 */
export function useSavePropertyAssistantSettings() {
  const queryClient = useQueryClient();
  const refresh = useRefreshAssistant();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ propertyId, request, base }: { propertyId: string; request: SavePropertyAssistantSettingsRequest; base: PropertyAssistantSettings }) =>
      withoutRequestOnFailure(async () => {
        const current = await assistantSettingsApi.getPropertySettings(propertyId);
        if (!sameExceptions(base, current)) {
          queryClient.setQueryData(propertySettingsKey(propertyId), current);
          throw new StaleSettingsError();
        }
        return assistantSettingsApi.savePropertySettings(propertyId, request);
      }),
    onSuccess: () => {
      toast.success(i18n.t('assistant.toast.propertySaved'));
    },
    onSettled: refresh,
  });
}

/** Removes every exception of a property: it follows the organization again. */
export function useRemovePropertyAssistantSettings() {
  const refresh = useRefreshAssistant();
  return useMutation({
    gcTime: 0,
    mutationFn: (propertyId: string) => withoutRequestOnFailure(() => assistantSettingsApi.deletePropertySettings(propertyId)),
    onSuccess: () => {
      toast.success(i18n.t('assistant.toast.propertyReset'));
    },
    onSettled: refresh,
  });
}

// -- knowledge -------------------------------------------------------------------------------------------------------------------------

/**
 * The knowledge base of a property in a language (`property.read`): the facts of its listing, its entries and the organization's, and the topics with no data. The texts
 * are the host's own and can hold a password: the reading is dropped as soon as the page that shows it is left (`gcTime: 0`).
 */
export function useAssistantKnowledge(propertyId: string | null, language: string, enabled: boolean) {
  return useQuery({
    queryKey: [ASSISTANT_QUERY, 'knowledge', propertyId, language],
    queryFn: () => assistantSettingsApi.getKnowledge(propertyId as string, language),
    enabled: enabled && propertyId !== null,
    gcTime: 0,
    ...LIVE,
  });
}

/** The entries of the whole organization (`booking.read`), dropped like the knowledge of a property as soon as nothing shows them. */
export function useOrganizationEntries(enabled: boolean) {
  return useQuery({
    queryKey: [ASSISTANT_QUERY, 'organization-entries'],
    queryFn: () => assistantSettingsApi.listOrganizationEntries(),
    enabled,
    gcTime: 0,
    ...LIVE,
  });
}

/** Where an entry lives: a property, or the whole organization (`propertyId: null`, the organization administrator only). */
export interface EntryScope {
  propertyId: string | null;
}

/**
 * Creates an entry (no `entryId`) or changes one. The text is the host's own words and can hold a password: it is not kept in the cache of the mutations (`gcTime: 0`) and
 * a refusal is kept without the request that carried it (`withoutRequest`).
 */
export function useSaveKnowledgeEntry() {
  const refresh = useRefreshAssistant();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ scope, entryId, request }: { scope: EntryScope; entryId: string | null; request: SaveKnowledgeEntryRequest }) =>
      withoutRequestOnFailure(() => {
        if (scope.propertyId === null) {
          return entryId === null ? assistantSettingsApi.createOrganizationEntry(request) : assistantSettingsApi.updateOrganizationEntry(entryId, request);
        }
        return entryId === null
          ? assistantSettingsApi.createPropertyEntry(scope.propertyId, request)
          : assistantSettingsApi.updatePropertyEntry(scope.propertyId, entryId, request);
      }),
    onSuccess: () => {
      toast.success(i18n.t('assistant.toast.entrySaved'));
    },
    onSettled: refresh,
  });
}

/** Deletes an entry of a property or of the organization. */
export function useDeleteKnowledgeEntry() {
  const refresh = useRefreshAssistant();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ scope, entryId }: { scope: EntryScope; entryId: string }) =>
      withoutRequestOnFailure(() =>
        scope.propertyId === null ? assistantSettingsApi.deleteOrganizationEntry(entryId) : assistantSettingsApi.deletePropertyEntry(scope.propertyId, entryId),
      ),
    onSuccess: () => {
      toast.success(i18n.t('assistant.toast.entryDeleted'));
    },
    onSettled: refresh,
  });
}

// -- situations ------------------------------------------------------------------------------------------------------------------------

/** The situations as the organization has them (`propertyId` null, `booking.read`) or as a property has them (`property.read`). */
export function useAssistantSituations(propertyId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [ASSISTANT_QUERY, 'situations', propertyId],
    queryFn: () => (propertyId === null ? assistantSettingsApi.getSituations() : assistantSettingsApi.getPropertySituations(propertyId)),
    enabled,
    ...LIVE,
  });
}

/** Saves a situation for the organization (`propertyId` null, the administrator only) or the exception of a property (`property.write`): a whole row. */
export function useSaveSituation() {
  const refresh = useRefreshAssistant();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ propertyId, code, request }: { propertyId: string | null; code: string; request: SaveAssistantSituationRequest }) =>
      withoutRequestOnFailure(() =>
        propertyId === null ? assistantSettingsApi.saveSituation(code, request) : assistantSettingsApi.savePropertySituation(propertyId, code, request),
      ),
    onSuccess: () => {
      toast.success(i18n.t('assistant.toast.situationSaved'));
    },
    onSettled: refresh,
  });
}

/** Removes the exception of a property for a situation: it goes back to the organization's value. */
export function useRemoveSituationException() {
  const refresh = useRefreshAssistant();
  return useMutation({
    gcTime: 0,
    mutationFn: ({ propertyId, code }: { propertyId: string; code: string }) =>
      withoutRequestOnFailure(() => assistantSettingsApi.deletePropertySituation(propertyId, code)),
    onSuccess: () => {
      toast.success(i18n.t('assistant.toast.situationReset'));
    },
    onSettled: refresh,
  });
}
