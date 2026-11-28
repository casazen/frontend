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

export const ASSISTANT_QUERY = 'assistant';

const RULES_KEY = [ASSISTANT_QUERY, 'rules'] as const;

const SETTINGS_STALE_MS = 30_000;

const LIVE = {
  staleTime: SETTINGS_STALE_MS,
  refetchOnMount: 'always' as const,
  retry: retryTransientErrors(1),
};

async function withoutRequestOnFailure<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw withoutRequest(error);
  }
}

function useRefreshAssistant() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [ASSISTANT_QUERY] });
}

export function useAssistantRules(enabled: boolean) {
  return useQuery({ queryKey: RULES_KEY, queryFn: () => assistantSettingsApi.getRules(), enabled, ...LIVE });
}

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

const propertySettingsKey = (propertyId: string | null) => [ASSISTANT_QUERY, 'property-settings', propertyId] as const;

export function usePropertyAssistantSettings(propertyId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: propertySettingsKey(propertyId),
    queryFn: () => assistantSettingsApi.getPropertySettings(propertyId as string),
    enabled: enabled && propertyId !== null,
    ...LIVE,
  });
}

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

export function useAssistantKnowledge(propertyId: string | null, language: string, enabled: boolean) {
  return useQuery({
    queryKey: [ASSISTANT_QUERY, 'knowledge', propertyId, language],
    queryFn: () => assistantSettingsApi.getKnowledge(propertyId as string, language),
    enabled: enabled && propertyId !== null,
    gcTime: 0,
    ...LIVE,
  });
}

export function useOrganizationEntries(enabled: boolean) {
  return useQuery({
    queryKey: [ASSISTANT_QUERY, 'organization-entries'],
    queryFn: () => assistantSettingsApi.listOrganizationEntries(),
    enabled,
    gcTime: 0,
    ...LIVE,
  });
}

export interface EntryScope {
  propertyId: string | null;
}

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

export function useAssistantSituations(propertyId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [ASSISTANT_QUERY, 'situations', propertyId],
    queryFn: () => (propertyId === null ? assistantSettingsApi.getSituations() : assistantSettingsApi.getPropertySituations(propertyId)),
    enabled,
    ...LIVE,
  });
}

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
