import { useCallback, useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  activateActivation,
  declarePartner,
  getActivation,
  getActivationMapping,
  getActivationPlan,
  getLicensedFunctions,
  getMarketplaceActive,
  getMarketplaceCatalog,
  getMarketplaceEntry,
  getMarketplaceHealth,
  getPartnerBrief,
  importActivation,
  refreshLicensedFunctions,
  requestLicensedFunction,
  saveActivationMapping,
  startActivation,
} from '@/api/marketplace.api';
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
} from '@/types';

/** Prefix of every marketplace query: a wizard that changes what the page shows can read them again with `invalidateQueries`. */
const MARKETPLACE_KEY = 'marketplace';

/**
 * Prefix of what the guided wizards read for themselves (the plan, the state, the mapping, the license, the brief). It is not under
 * {@link MARKETPLACE_KEY}: a step that succeeds makes the pages of the marketplace read again, and must not also make the wizard ask the channel
 * manager again for what it holds and has just been told (each read of a state or a mapping is a call to the channel manager).
 */
const WIZARD_KEY = 'marketplace-wizard';

/** What a step of a wizard that succeeded changes on the pages of the marketplace (the cards, the Active tab, the detail of an entry): they read it again. */
function refreshMarketplace(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [MARKETPLACE_KEY] });
}

/** `it` or `en`, from the language of the interface: the backend answers in Italian where a text is missing in the other one. */
export function marketplaceLanguage(language: string | undefined): MarketplaceLanguage {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'it';
}

function useMarketplaceLanguage(): MarketplaceLanguage {
  const { i18n } = useTranslation();
  return marketplaceLanguage(i18n.resolvedLanguage ?? i18n.language);
}

/** The partners of a catalog, in the order the backend sent them. */
function partnersOf(catalog: MarketplaceCatalogResponse | undefined): MarketplaceCatalogEntry[] {
  return catalog?.groups.find((group) => group.id === 'partners')?.entries ?? [];
}

/**
 * The catalog of the Scopri page for a property (all the properties of the caller's scope without one), in the language of the
 * interface. Other screens (the activation wizards) change what it says, so it is stale at once and read again every time a page
 * that shows it opens (the app does not read again on mount what it read in the last 5 minutes: `query-client.ts`).
 */
export function useMarketplaceCatalog(propertyId: string | undefined) {
  const language = useMarketplaceLanguage();

  return useQuery({
    queryKey: [MARKETPLACE_KEY, 'catalog', propertyId ?? null, language],
    queryFn: () => getMarketplaceCatalog(propertyId, language),
    staleTime: 0,
    refetchOnMount: true,
  });
}

/** The detail card of an entry. It asks nothing until the address names a kind and a code. */
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

/**
 * The integrations that are on and the suppliers already used (the Active tab), the names of the licensed functions in the language of the interface. Read again every
 * time the page opens. Without a property it is the whole scope of the caller.
 */
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

/**
 * The external partners of the catalog, by the service they work for (the guided request of home services offers them when the host goes
 * outside CasaZen). It reads the catalog without a property: a partner does not depend on one. Nothing is offered while the catalog
 * loads, when it fails, and when the person may not read it (a read they may not make would send them to the page of no access, out of
 * the request they are making): the guided request then behaves as when no partner covers the service. Whether a partner is of any use
 * is the wizard's call, from the kinds of work it offers: a partner that lists none of them covers nothing.
 */
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

// ─── The guided activation of a channel or a tool (E09/F02/US04) ─────────────────────────────────────────────────────────────────────────

const activationPlanKey = (kind: MarketplaceConnectionKind, code: string, propertyId: string) => [WIZARD_KEY, 'plan', kind, code, propertyId] as const;
const activationKey = (id: string) => [WIZARD_KEY, 'activation', id] as const;
const activationMappingKey = (id: string) => [WIZARD_KEY, 'mapping', id] as const;
const importRequestedKey = (id: string) => [WIZARD_KEY, 'import-requested', id] as const;

/** How often the rooms of a channel are asked for while the import has not brought them (each read is two calls to the channel manager). */
const MAPPING_POLL_MS = 15_000;

/**
 * What a step that moved an activation leaves behind: the state is the one the server gave, the plan of its property knows the activation now (a
 * resume finds it there), and the pages of the marketplace read again.
 */
function rememberActivation(queryClient: QueryClient, state: MarketplaceActivationState): void {
  queryClient.setQueryData(activationKey(state.activationId), state);
  queryClient.setQueriesData<MarketplaceActivationPlan>({ queryKey: [WIZARD_KEY, 'plan'] }, (plan) =>
    plan && plan.propertyId === state.propertyId && plan.code.toLowerCase() === state.code.toLowerCase()
      ? { ...plan, activationId: state.activationId, activationStatus: state.status }
      : plan,
  );
  refreshMarketplace(queryClient);
}

/**
 * The plan of the activation of one portal for each of the properties given (`GET /api/marketplace/activations/plan`, one read for each): what the
 * portal asks of the person, whether the property is linked to the channel manager and the activation that exists already. Stale at once and read
 * again at every visit: the host may have linked the property or started the activation on another screen.
 */
export function useActivationPlans(kind: MarketplaceConnectionKind, code: string, propertyIds: readonly string[]) {
  return useQueries({
    queries: propertyIds.map((propertyId) => ({
      queryKey: activationPlanKey(kind, code, propertyId),
      queryFn: () => getActivationPlan(kind, code, propertyId),
      staleTime: 0,
      refetchOnMount: 'always' as const,
      // One read for each property of the host: the window gaining the focus (the person is back from the panel of the channel manager) does not ask for all of them again.
      refetchOnWindowFocus: false,
    })),
  });
}

/** How long the state a step has just given is trusted: the channel manager's list may lag behind what it was just told, and each read is a call to it. */
const ACTIVATION_FRESH_MS = 30_000;

/**
 * The plan of the portal for one property as it is now: the one read a moment ago, or a new read. The activation of a property is looked for here by a button that
 * acts on it, which must not take a plan that has not been read yet for «there is no activation».
 */
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

/** The state of an activation as the last step gave it (nothing is asked): what a button that decides whether the wizard goes on reads. `undefined` when no step has given it. */
export function cachedActivation(queryClient: QueryClient, id: string | null | undefined): MarketplaceActivationState | undefined {
  return id ? queryClient.getQueryData<MarketplaceActivationState>(activationKey(id)) : undefined;
}

/**
 * How the read of an activation stands (nothing is asked): the state it gave, and whether it is being read now or its read has not begun. A read that failed has no state
 * and is not going on. What the page reads, without a hook, of what a step of the wizard has asked.
 */
export function activationReadOf(
  queryClient: QueryClient,
  id: string | null | undefined,
): { hasActivation: boolean; state: MarketplaceActivationState | undefined; reading: boolean } {
  if (!id) return { hasActivation: false, state: undefined, reading: false };
  const query = queryClient.getQueryState<MarketplaceActivationState>(activationKey(id));

  return { hasActivation: true, state: query?.data, reading: query === undefined || query.fetchStatus === 'fetching' };
}

/** Reads the state of an activation again, whatever its age: «Check again» of the access step, and a guided step that has just been done. */
export function refreshActivation(queryClient: QueryClient, id: string): Promise<void> {
  return queryClient.refetchQueries({ queryKey: activationKey(id), exact: true });
}

/**
 * Creates the connection on the channel manager and the activation. Starting again gives back the activation that exists. The request holds the
 * access data of the portal, so the mutation is not kept once the call is over (`gcTime: 0`), and the caller resets it. Errors are not toasted: the
 * step says them where the person is looking.
 */
export function useStartActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: StartMarketplaceActivationRequest) => startActivation(request),
    gcTime: 0,
    onSuccess: (state) => rememberActivation(queryClient, state),
  });
}

/** Asks the channel manager to import the rooms, the reservations and the calendar of the channel; the activation is marked, so a visit that comes back does not ask again. */
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

/** True when this session already asked for the import of the activation (the answer is not the channel manager's: it only keeps a visit from asking twice). */
export function isImportRequested(queryClient: QueryClient, id: string): boolean {
  return queryClient.getQueryData(importRequestedKey(id)) === true;
}

/**
 * The rooms of the channel with the proposal of CasaZen for each, and the products of the listing, for each activation given (`GET .../mapping`, two calls to
 * the channel manager each). `enabled` is asked for each: a property whose import was not asked has nothing to read. `pollUntilRooms` reads again until the
 * channel manager has brought the rooms of the channel (the import is asynchronous there).
 */
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

/**
 * The mapping as the channel manager has it right now (`fresh`), or as the step on screen read it a moment ago: the wizard decides what to save, or whether the
 * rooms are in, from this and not from a guess.
 */
export function fetchActivationMapping(queryClient: QueryClient, id: string, options: { fresh?: boolean } = {}): Promise<MarketplaceActivationMapping> {
  return queryClient.fetchQuery({
    queryKey: activationMappingKey(id),
    queryFn: () => getActivationMapping(id),
    staleTime: options.fresh ? 0 : MAPPING_POLL_MS,
  });
}

/** Saves the rooms the person chose and completes the mapping on the channel manager (`PUT .../mapping`; a list that is empty is refused by the server). */
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

/** Marks the connection connected and verifies it: the activation is Active only when the channel manager shows it working. */
export function useActivate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => activateActivation(id),
    onSuccess: (state) => rememberActivation(queryClient, state),
  });
}

// ─── The request of a function of the license (E09/F02/US04/T03) ─────────────────────────────────────────────────────────────────────────

const licensedFunctionsKey = (propertyId: string, language: MarketplaceLanguage) => [WIZARD_KEY, 'functions', propertyId, language] as const;

/**
 * The functions of the license of a property, its plan and its room limit (`GET /api/marketplace/functions?propertyId=`): what CasaZen stored, with
 * no call to the channel manager. Read again at every visit, in the language of the interface.
 */
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

/**
 * The functions of the license of the property as the server has them now: the step that decides whether the request can go on reads them, and a property that has
 * no confirmed listing (or an organization that is not connected) is the refusal that read throws.
 */
export function fetchLicensedFunctions(queryClient: QueryClient, propertyId: string, language: MarketplaceLanguage): Promise<MarketplaceFunctionList> {
  return queryClient.fetchQuery({
    queryKey: licensedFunctionsKey(propertyId, language),
    queryFn: () => getLicensedFunctions(propertyId, language),
    staleTime: 0,
  });
}

/** What a read or a request of the license leaves behind: the list of the property is the one the server gave, and the pages of the marketplace read again. */
function rememberFunctions(queryClient: QueryClient, list: MarketplaceFunctionList, language: MarketplaceLanguage): void {
  queryClient.setQueryData(licensedFunctionsKey(list.propertyId, language), list);
  refreshMarketplace(queryClient);
}

/**
 * Records that the host asked the channel manager for the function (`POST .../functions/{moduleCode}/request`): Requested, declared, until the license
 * shows it. Asking again gives back the request that exists. 409 `marketplace_function_already_active`: the license shows the module on already.
 */
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

/** Reads the license of the property from the channel manager now (`POST .../functions/refresh`) and brings the requests in line with it: "Check now". */
export function useRefreshLicensedFunctions() {
  const queryClient = useQueryClient();
  const language = useMarketplaceLanguage();

  return useMutation({
    mutationFn: (propertyId: string) => refreshLicensedFunctions(propertyId, language),
    onSuccess: (list) => rememberFunctions(queryClient, list, language),
  });
}

// ─── The hand-off to a partner (E09/F02/US04/T04) ────────────────────────────────────────────────────────────────────────────────────────

/**
 * What the host takes to the partner's own site (`GET .../partners/{code}/brief`): the checklist and, with a property, the fixed list of its data.
 * Read again at every visit, in the language of the interface; CasaZen sends nothing to the partner.
 */
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

/**
 * Records that the host activated the partner on the partner's own site, on the day it gives (`POST .../partners/{code}/declare`): Active and declared,
 * never verified by this call. Declaring again gives back the same activation.
 */
export function useDeclarePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, propertyId, declaredOn }: { code: string; propertyId: string | undefined; declaredOn: string }) =>
      declarePartner(code, propertyId, declaredOn),
    onSuccess: () => refreshMarketplace(queryClient),
  });
}
