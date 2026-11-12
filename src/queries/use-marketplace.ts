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
  getPartnerBrief,
  importActivation,
  refreshLicensedFunctions,
  requestLicensedFunction,
  saveActivationMapping,
  startActivation,
} from '@/api/marketplace.api';
import { useWorkspace } from '@/hooks/use-workspace';
import type {
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

/** The integrations that are on and the suppliers already used (the Active tab). Read again every time the page opens. */
export function useMarketplaceActive(propertyId: string | undefined) {
  return useQuery({
    queryKey: [MARKETPLACE_KEY, 'active', propertyId ?? null],
    queryFn: () => getMarketplaceActive(propertyId),
    staleTime: 0,
    refetchOnMount: true,
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
    })),
  });
}

/**
 * The state of an activation, as the channel manager says it (`GET /api/marketplace/activations/{id}`: each read is a call to it, so the window
 * gaining the focus does not ask again). Nothing is asked until the activation is known.
 */
export function useActivation(id: string | null | undefined) {
  return useQuery({
    queryKey: activationKey(id ?? ''),
    queryFn: () => getActivation(id ?? ''),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
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
 * The rooms of the channel with the proposal of CasaZen for each, and the products of the listing (`GET .../mapping`). `pollUntilRooms` reads again
 * until the channel manager has brought the rooms of the channel (the import is asynchronous there).
 */
export function useActivationMapping(id: string | null | undefined, options: { enabled?: boolean; pollUntilRooms?: boolean } = {}) {
  const { enabled = true, pollUntilRooms = false } = options;

  return useQuery({
    queryKey: activationMappingKey(id ?? ''),
    queryFn: () => getActivationMapping(id ?? ''),
    enabled: !!id && enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchInterval: pollUntilRooms ? (query) => (query.state.data && query.state.data.channelRooms.length > 0 ? false : MAPPING_POLL_MS) : false,
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
