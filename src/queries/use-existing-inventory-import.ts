import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { octorateApi } from '@/api/octorate.api';
import type {
  ConnectChannelAccommodation,
  CreateExistingInventoryBatchRequest,
  ExistingInventoryBatch,
  InventoryIntentAssignment,
  MarketplaceCatalogEntry,
} from '@/types';
import { OCTORATE_LISTINGS_KEY } from './use-octorate-mapping';
import { useMarketplaceCatalog } from './use-marketplace';

/**
 * The import of the listings that already exist on OTAs or in another channel manager (E02/F01/US03, D6): under `['octorate']`, so a guided step that
 * moves on (the access to a channel verified, a panel step done) reads the batch again with the rest of the connection.
 */
export const EXISTING_INVENTORY_KEY = ['octorate', 'existing-inventory'] as const;
const batchKey = (batchId: string) => [...EXISTING_INVENTORY_KEY, 'batch', batchId] as const;
export const INVENTORY_INTENTS_KEY = ['octorate', 'inventory-intents'] as const;

/** How often a batch that is working (or whose access is being checked) is read again: the server checks at its own pace, this only asks. */
export const BATCH_POLL_MS = 4_000;

/** The batch as the server answers any of its commands: the cache of the screens that follow it. */
function remember(queryClient: QueryClient, batch: ExistingInventoryBatch): void {
  queryClient.setQueryData(batchKey(batch.id), batch);
}

/**
 * One import batch, read again every visit and, while `poll` says there is something to wait for, every few seconds. Reading it is what makes the
 * server read the result of the access to a channel when its backoff is due, so this is also the way a screen follows the access. The window of
 * the panel being closed or the tab coming back call `refetch` for one check at once. Nothing is read without an id (a batch not started yet).
 */
export function useExistingInventoryBatch(
  batchId: string | null | undefined,
  options?: { enabled?: boolean; poll?: (batch: ExistingInventoryBatch | undefined) => boolean },
) {
  const poll = options?.poll;

  return useQuery({
    queryKey: batchKey(batchId ?? ''),
    queryFn: () => octorateApi.getExistingInventoryBatch(batchId ?? ''),
    enabled: Boolean(batchId) && (options?.enabled ?? true),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (poll?.(query.state.data) ? BATCH_POLL_MS : false),
    refetchIntervalInBackground: false,
  });
}

/**
 * Starts an import for the OTA channels the host uses (`POST api/octorate/existing-inventory/batches`). Nothing is called on the channel manager:
 * it only stores the intention. Errors are not toasted: the step says what went wrong where the host is looking.
 */
export function useCreateExistingInventoryBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateExistingInventoryBatchRequest) => octorateApi.createExistingInventoryBatch(request),
    onSuccess: (batch) => remember(queryClient, batch),
  });
}

/**
 * Starts the handoff to the panel for the access to a channel. The answer carries the address of the panel, which is used once and is never kept
 * (`gcTime: 0`). The batch is read again: the channel is now waiting for the access.
 */
export function useStartChannelAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, channelCode }: { batchId: string; channelCode: string }) => octorateApi.startChannelAccess(batchId, channelCode),
    gcTime: 0,
    onSettled: (_started, _error, { batchId }) => void queryClient.invalidateQueries({ queryKey: batchKey(batchId) }),
  });
}

/** The host says the access to a channel was given, which the server accepts only after a check that could not tell. */
export function useConfirmChannelAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, channelCode }: { batchId: string; channelCode: string }) => octorateApi.confirmChannelAccess(batchId, channelCode),
    onSuccess: (batch) => remember(queryClient, batch),
    onError: (_error, { batchId }) => void queryClient.invalidateQueries({ queryKey: batchKey(batchId) }),
  });
}

/**
 * The host gives the id of each structure on a portal that needs nothing else (`POST .../channels/{code}/connect`): the server makes the connection
 * on the channel manager and answers the batch, whose channel now waits only for the approval on the portal's own site. The answer is the batch the
 * screens follow; a refusal (422) is shown by the step where the host is looking, and the batch is read again (the server may have moved on).
 */
export function useConnectChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, channelCode, accommodations }: { batchId: string; channelCode: string; accommodations: ConnectChannelAccommodation[] }) =>
      octorateApi.connectChannel(batchId, channelCode, { accommodations }),
    onSuccess: (batch) => remember(queryClient, batch),
    onError: (_error, { batchId }) => void queryClient.invalidateQueries({ queryKey: batchKey(batchId) }),
  });
}

/**
 * Imports the rooms of the channels whose access is given (`POST .../run`; repeating it is safe) and stops at the mapping. The listings found are
 * read again: the mapping step shows what the import brought.
 */
export function useRunExistingInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, retryUnknown }: { batchId: string; retryUnknown?: readonly string[] }) =>
      octorateApi.runExistingInventoryBatch(batchId, retryUnknown),
    onSuccess: (batch) => remember(queryClient, batch),
    onSettled: (_batch, _error, { batchId }) => {
      void queryClient.invalidateQueries({ queryKey: OCTORATE_LISTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: batchKey(batchId) });
    },
  });
}

/**
 * Goes on for the listings the host confirmed (`POST .../continue`): reservations, calendars, «mark connected». The listings left for later stay
 * write-blocked. Repeating it is safe.
 */
export function useContinueExistingInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, leaveForLater, retryUnknown }: { batchId: string; leaveForLater?: readonly string[]; retryUnknown?: readonly string[] }) =>
      octorateApi.continueExistingInventoryBatch(batchId, { leaveForLater, retryUnknown }),
    onSuccess: (batch) => remember(queryClient, batch),
    onSettled: (_batch, _error, { batchId }) => {
      void queryClient.invalidateQueries({ queryKey: OCTORATE_LISTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: batchKey(batchId) });
    },
  });
}

/** The scenario the host declared for each property or group it reaches. */
export function useInventoryIntents(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: INVENTORY_INTENTS_KEY,
    queryFn: () => octorateApi.getInventoryIntents(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/**
 * Declares the scenario of each property (or group) of a mixed portfolio (`PUT api/octorate/inventory-intents`). `newInventory` is refused while an
 * import or a mapping exists (409 `inventory_intent_change_refused`): it is never an automatic recovery, and the step says so.
 */
export function useSetInventoryIntents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignments: readonly InventoryIntentAssignment[]) => octorateApi.setInventoryIntents(assignments),
    onSuccess: (intents) => queryClient.setQueryData(INVENTORY_INTENTS_KEY, intents),
  });
}

/** An OTA the host can choose to import from: its portal code (what the batch takes), its name and its logo. */
export interface OtaChannelChoice {
  code: string;
  name: string;
  logoUrl: string | null;
  /** The portal needs only the id of each property on it: the host gives them in CasaZen (`connect`) instead of going through the panel. */
  connectByPropertyId: boolean;
}

/** The sales channels of the catalog the host can import from (the entries of the group «Canali di vendita»), in the order the catalog gives them. */
export function otaChannelChoices(entries: readonly MarketplaceCatalogEntry[] | undefined): OtaChannelChoice[] {
  return (entries ?? [])
    .filter((entry) => entry.kind === 'Channel')
    .map((entry) => ({ code: entry.code, name: entry.name, logoUrl: entry.logoUrl, connectByPropertyId: entry.connectByPropertyId === true }));
}

/** The OTAs the host can choose from: the sales channels of the marketplace catalog (the same list the host sees in «Scopri»). */
export function useOtaChannelChoices() {
  const catalog = useMarketplaceCatalog(undefined);
  const choices = useMemo(() => otaChannelChoices(catalog.data?.groups.find((group) => group.id === 'salesChannels')?.entries), [catalog.data]);

  return { choices, isPending: catalog.isPending, isFetching: catalog.isFetching, isError: catalog.isError, error: catalog.error, refetch: catalog.refetch };
}
