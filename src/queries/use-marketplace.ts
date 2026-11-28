import { useCallback, useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  activateActivation,
  deactivateActivation,
  declarePartner,
  getActivation,
  getActivationMapping,
  getActivationPlan,
  getDeactivationPreview,
  getLicensedFunctions,
  getMarketplaceActive,
  getMarketplaceCatalog,
  getMarketplaceEntry,
  getMarketplaceHealth,
  getPartnerBrief,
  importActivation,
  refreshLicensedFunctions,
  requestFunctionChange,
  requestLicensedFunction,
  saveActivationMapping,
  startActivation,
  updateActivationSettings,
} from '@/api/marketplace.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { useWorkspace } from '@/hooks/use-workspace';
import type {
  MarketplaceActivationMapping,
  MarketplaceActivationPlan,
  MarketplaceActivationState,
  MarketplaceCatalogEntry,
  MarketplaceCatalogResponse,
  MarketplaceConnectionKind,
  MarketplaceFunction,
  MarketplaceFunctionList,
  MarketplaceLanguage,
  MarketplaceRoomChoice,
  StartMarketplaceActivationRequest,
  UpdateMarketplaceSettingsRequest,
} from '@/types';

const MARKETPLACE_KEY = 'marketplace';

/**
 * Prefix of what the guided wizards read for themselves (the plan, the state, the mapping, the license, the brief). It is not under
 * {@link MARKETPLACE_KEY}: a step that succeeds makes the pages of the marketplace read again, and must not also make the wizard ask the channel
 * manager again for what it holds and has just been told (each read of a state or a mapping is a call to the channel manager).
 */
const WIZARD_KEY = 'marketplace-wizard';

function refreshMarketplace(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [MARKETPLACE_KEY] });
}

export function marketplaceLanguage(language: string | undefined): MarketplaceLanguage {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'it';
}

function useMarketplaceLanguage(): MarketplaceLanguage {
  const { i18n } = useTranslation();
  return marketplaceLanguage(i18n.resolvedLanguage ?? i18n.language);
}

function partnersOf(catalog: MarketplaceCatalogResponse | undefined): MarketplaceCatalogEntry[] {
  return catalog?.groups.find((group) => group.id === 'partners')?.entries ?? [];
}

export function useMarketplaceCatalog(propertyId: string | undefined, { enabled = true } = {}) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: [MARKETPLACE_KEY, 'catalog', propertyId ?? null, language],
    queryFn: () => getMarketplaceCatalog(propertyId, language),
    enabled,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useMarketplaceEntry(kind: string | undefined, code: string | undefined, propertyId: string | undefined) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: [MARKETPLACE_KEY, 'entry', kind ?? null, code ?? null, propertyId ?? null, language],
    queryFn: () => getMarketplaceEntry(kind ?? '', code ?? '', propertyId, language),
    enabled: !!kind && !!code,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useMarketplaceActive(propertyId: string | undefined) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: [MARKETPLACE_KEY, 'active', propertyId ?? null, language],
    queryFn: () => getMarketplaceActive(propertyId, language),
    staleTime: 0,
    refetchOnMount: true,
  });
}

/**
 * The health of the active integrations: the status, the last sync, the problem and the quota of each channel, tool or function of the license (the Active tab). A read of
 * CasaZen's own rows, so the window gaining the focus may read it again; every visit of the page reads it again and a stale answer is never trusted (`staleTime: 0`). `enabled`
 * is false for who may not read it and while the connector is off: nothing is asked then. The answer says `items`, `forbidden` or `notFound`: a read that failed is the query's
 * error, and the rows of an older read are not to be shown for it.
 */
export function useMarketplaceHealth(propertyId: string | undefined, enabled = true) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: [MARKETPLACE_KEY, 'health', propertyId ?? null, language],
    queryFn: () => getMarketplaceHealth(propertyId, language),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function usePartnersByServiceCategory() {
  const language = useMarketplaceLanguage();
  const { hasPermission } = useWorkspace();
  const canRead = hasPermission('short-rent', 'booking.read');

  const catalog = useQuery({
    queryKey: [MARKETPLACE_KEY, 'catalog', null, language],
    queryFn: () => getMarketplaceCatalog(undefined, language),
    enabled: canRead,
  });

  const partners = useMemo(() => partnersOf(catalog.data), [catalog.data]);
  const partnersFor = useCallback(
    (serviceCategory: string): MarketplaceCatalogEntry[] => partners.filter((partner) => partner.serviceCategories?.includes(serviceCategory)),
    [partners],
  );

  return { partnersFor, isLoading: canRead && catalog.isPending };
}

const activationPlanKey = (kind: MarketplaceConnectionKind, code: string, propertyId: string) => [WIZARD_KEY, 'plan', kind, code, propertyId] as const;
const activationKey = (id: string) => [WIZARD_KEY, 'activation', id] as const;
const activationMappingKey = (id: string) => [WIZARD_KEY, 'mapping', id] as const;
const importRequestedKey = (id: string) => [WIZARD_KEY, 'import-requested', id] as const;

const MAPPING_POLL_MS = 15_000;

function rememberActivation(queryClient: QueryClient, state: MarketplaceActivationState): void {
  queryClient.setQueryData(activationKey(state.activationId), state);
  queryClient.setQueriesData<MarketplaceActivationPlan>({ queryKey: [WIZARD_KEY, 'plan'] }, (plan) =>
    plan && plan.propertyId === state.propertyId && plan.code.toLowerCase() === state.code.toLowerCase()
      ? { ...plan, activationId: state.activationId, activationStatus: state.status }
      : plan,
  );
  refreshMarketplace(queryClient);
}

export function useActivationPlans(kind: MarketplaceConnectionKind, code: string, propertyIds: readonly string[]) {
  return useQueries({
    queries: propertyIds.map((propertyId) => ({
      queryKey: activationPlanKey(kind, code, propertyId),
      queryFn: () => getActivationPlan(kind, code, propertyId),
      staleTime: 0,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: false,
    })),
  });
}

const ACTIVATION_FRESH_MS = 30_000;

export function fetchActivationPlan(queryClient: QueryClient, kind: MarketplaceConnectionKind, code: string, propertyId: string): Promise<MarketplaceActivationPlan> {
  return queryClient.fetchQuery({
    queryKey: activationPlanKey(kind, code, propertyId),
    queryFn: () => getActivationPlan(kind, code, propertyId),
    staleTime: ACTIVATION_FRESH_MS,
  });
}

/**
 * The state of each activation given (`GET /api/marketplace/activations/{id}`, one read for each; `null` for a property that has none yet): as the channel manager
 * says it, read again when a step opens (unless a step of this wizard gave it a moment ago: that is trusted for a while, the channel manager's list may lag behind a create).
 * The window gaining the focus does not ask again.
 */
export function useActivations(ids: ReadonlyArray<string | null | undefined>) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: activationKey(id ?? ''),
      queryFn: () => getActivation(id ?? ''),
      enabled: !!id,
      staleTime: ACTIVATION_FRESH_MS,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    })),
  });
}

export function cachedActivation(queryClient: QueryClient, id: string | null | undefined): MarketplaceActivationState | undefined {
  return id ? queryClient.getQueryData<MarketplaceActivationState>(activationKey(id)) : undefined;
}

export function activationReadOf(
  queryClient: QueryClient,
  id: string | null | undefined,
): { hasActivation: boolean; state: MarketplaceActivationState | undefined; reading: boolean } {
  if (!id) return { hasActivation: false, state: undefined, reading: false };
  const query = queryClient.getQueryState<MarketplaceActivationState>(activationKey(id));

  return { hasActivation: true, state: query?.data, reading: query === undefined || query.fetchStatus === 'fetching' };
}

export function refreshActivation(queryClient: QueryClient, id: string): Promise<void> {
  return queryClient.refetchQueries({ queryKey: activationKey(id), exact: true });
}

export function useStartActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: StartMarketplaceActivationRequest) => startActivation(request),
    gcTime: 0,
    onSuccess: (state) => rememberActivation(queryClient, state),
  });
}

export function useImportActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => importActivation(id),
    onSuccess: (state) => {
      queryClient.setQueryData(importRequestedKey(state.activationId), true);
      rememberActivation(queryClient, state);
    },
  });
}

export function isImportRequested(queryClient: QueryClient, id: string): boolean {
  return queryClient.getQueryData(importRequestedKey(id)) === true;
}

export function useActivationMappings(entries: ReadonlyArray<{ id: string | null | undefined; enabled?: boolean }>, options: { pollUntilRooms?: boolean } = {}) {
  const { pollUntilRooms = false } = options;

  return useQueries({
    queries: entries.map(({ id, enabled = true }) => ({
      queryKey: activationMappingKey(id ?? ''),
      queryFn: () => getActivationMapping(id ?? ''),
      enabled: !!id && enabled,
      staleTime: 0,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: false,
      refetchInterval: pollUntilRooms
        ? (query: { state: { data: MarketplaceActivationMapping | undefined } }) =>
            query.state.data && query.state.data.channelRooms.length > 0 ? false : MAPPING_POLL_MS
        : false,
    })),
  });
}

export function fetchActivationMapping(queryClient: QueryClient, id: string, options: { fresh?: boolean } = {}): Promise<MarketplaceActivationMapping> {
  return queryClient.fetchQuery({
    queryKey: activationMappingKey(id),
    queryFn: () => getActivationMapping(id),
    staleTime: options.fresh ? 0 : MAPPING_POLL_MS,
  });
}

export function useSaveActivationMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mappings }: { id: string; mappings: readonly MarketplaceRoomChoice[] }) => saveActivationMapping(id, mappings),
    onSuccess: (state) => {
      void queryClient.invalidateQueries({ queryKey: activationMappingKey(state.activationId) });
      rememberActivation(queryClient, state);
    },
  });
}

export function useActivate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activateActivation(id),
    onSuccess: (state) => rememberActivation(queryClient, state),
  });
}

const licensedFunctionsKey = (propertyId: string, language: MarketplaceLanguage) => [WIZARD_KEY, 'functions', propertyId, language] as const;

export function useLicensedFunctions(propertyId: string | null | undefined, options: { enabled?: boolean } = {}) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: licensedFunctionsKey(propertyId ?? '', language),
    queryFn: () => getLicensedFunctions(propertyId ?? '', language),
    enabled: !!propertyId && (options.enabled ?? true),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export function fetchLicensedFunctions(queryClient: QueryClient, propertyId: string, language: MarketplaceLanguage): Promise<MarketplaceFunctionList> {
  return queryClient.fetchQuery({
    queryKey: licensedFunctionsKey(propertyId, language),
    queryFn: () => getLicensedFunctions(propertyId, language),
    staleTime: 0,
  });
}

function rememberFunctions(queryClient: QueryClient, list: MarketplaceFunctionList, language: MarketplaceLanguage): void {
  queryClient.setQueryData(licensedFunctionsKey(list.propertyId, language), list);
  refreshMarketplace(queryClient);
}

export function useRequestLicensedFunction() {
  const queryClient = useQueryClient();
  const language = useMarketplaceLanguage();

  return useMutation({
    mutationFn: ({ moduleCode, propertyId }: { moduleCode: string; propertyId: string }) => requestLicensedFunction(moduleCode, propertyId, language),
    onSuccess: (entry: MarketplaceFunction, { propertyId }) => {
      queryClient.setQueryData<MarketplaceFunctionList>(licensedFunctionsKey(propertyId, language), (list) =>
        list ? { ...list, functions: list.functions.map((candidate) => (candidate.code === entry.code ? entry : candidate)) } : list,
      );
      refreshMarketplace(queryClient);
    },
  });
}

export function useRefreshLicensedFunctions() {
  const queryClient = useQueryClient();
  const language = useMarketplaceLanguage();

  return useMutation({
    mutationFn: (propertyId: string) => refreshLicensedFunctions(propertyId, language),
    onSuccess: (list) => rememberFunctions(queryClient, list, language),
  });
}

export function usePartnerBrief(code: string | undefined, propertyId: string | undefined) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: [WIZARD_KEY, 'partner-brief', code ?? '', propertyId ?? '', language],
    queryFn: () => getPartnerBrief(code ?? '', propertyId, language),
    enabled: !!code,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export function useDeclarePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, propertyId, declaredOn }: { code: string; propertyId: string | undefined; declaredOn: string }) =>
      declarePartner(code, propertyId, declaredOn),
    onSuccess: () => refreshMarketplace(queryClient),
  });
}

const CHANGE_KEY = 'marketplace-change';

export function useUpdateActivationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async ({ id, settings }: { id: string; settings: UpdateMarketplaceSettingsRequest }) => {
      try {
        return await updateActivationSettings(id, settings);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => refreshMarketplace(queryClient),
  });
}

export function useDeactivationPreview(id: string | null | undefined, enabled = true) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: [CHANGE_KEY, 'deactivation-preview', id ?? '', language],
    queryFn: () => getDeactivationPreview(id ?? '', language),
    enabled: !!id && enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/**
 * Turns an activation off (`POST .../deactivate`, always with `confirmed: true`: the dialog asks before it calls). Not kept once nothing observes it (`gcTime: 0`), a refusal is kept
 * without the request (`withoutRequest`), and whatever the answer the pages of the marketplace read again: an answer that is not `Deactivated`, or one that never came, must show what
 * the server holds and not what the person hoped.
 */
export function useDeactivateActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (id: string) => {
      try {
        return await deactivateActivation(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => refreshMarketplace(queryClient),
  });
}

export function useRequestFunctionChange() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (id: string) => {
      try {
        return await requestFunctionChange(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => refreshMarketplace(queryClient),
  });
}
