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

export const EXISTING_INVENTORY_KEY = ['octorate', 'existing-inventory'] as const;
const batchKey = (batchId: string) => [...EXISTING_INVENTORY_KEY, 'batch', batchId] as const;
export const INVENTORY_INTENTS_KEY = ['octorate', 'inventory-intents'] as const;

export const BATCH_POLL_MS = 4_000;

function remember(queryClient: QueryClient, batch: ExistingInventoryBatch): void {
  queryClient.setQueryData(batchKey(batch.id), batch);
}

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

export function useCreateExistingInventoryBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateExistingInventoryBatchRequest) => octorateApi.createExistingInventoryBatch(request),
    onSuccess: (batch) => remember(queryClient, batch),
  });
}

export function useStartChannelAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, channelCode }: { batchId: string; channelCode: string }) => octorateApi.startChannelAccess(batchId, channelCode),
    gcTime: 0,
    onSettled: (_started, _error, { batchId }) => void queryClient.invalidateQueries({ queryKey: batchKey(batchId) }),
  });
}

export function useConfirmChannelAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, channelCode }: { batchId: string; channelCode: string }) => octorateApi.confirmChannelAccess(batchId, channelCode),
    onSuccess: (batch) => remember(queryClient, batch),
    onError: (_error, { batchId }) => void queryClient.invalidateQueries({ queryKey: batchKey(batchId) }),
  });
}

export function useConnectChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, channelCode, accommodations }: { batchId: string; channelCode: string; accommodations: ConnectChannelAccommodation[] }) =>
      octorateApi.connectChannel(batchId, channelCode, { accommodations }),
    onSuccess: (batch) => remember(queryClient, batch),
    onError: (_error, { batchId }) => void queryClient.invalidateQueries({ queryKey: batchKey(batchId) }),
  });
}

export function useRunExistingInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, retryUnknown }: { batchId: string; retryUnknown?: readonly string[] }) =>
      octorateApi.runExistingInventoryBatch(batchId, retryUnknown),
    onSuccess: (batch) => {
      remember(queryClient, batch);
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onSettled: (_batch, _error, { batchId }) => {
      void queryClient.invalidateQueries({ queryKey: OCTORATE_LISTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: batchKey(batchId) });
    },
  });
}

export function useContinueExistingInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, leaveForLater, retryUnknown }: { batchId: string; leaveForLater?: readonly string[]; retryUnknown?: readonly string[] }) =>
      octorateApi.continueExistingInventoryBatch(batchId, { leaveForLater, retryUnknown }),
    onSuccess: (batch) => {
      remember(queryClient, batch);
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onSettled: (_batch, _error, { batchId }) => {
      void queryClient.invalidateQueries({ queryKey: OCTORATE_LISTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: batchKey(batchId) });
    },
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

export interface OtaChannelChoice {
  code: string;
  name: string;
  logoUrl: string | null;
  /** The portal needs only the id of each property on it: the host gives them in CasaZen (`connect`) instead of going through the panel. */
  connectByPropertyId: boolean;
}

export function otaChannelChoices(entries: readonly MarketplaceCatalogEntry[] | undefined): OtaChannelChoice[] {
  return (entries ?? [])
    .filter((entry) => entry.kind === 'Channel')
    .map((entry) => ({ code: entry.code, name: entry.name, logoUrl: entry.logoUrl, connectByPropertyId: entry.connectByPropertyId === true }));
}

export function useOtaChannelChoices() {
  const catalog = useMarketplaceCatalog(undefined);
  const choices = useMemo(() => otaChannelChoices(catalog.data?.groups.find((group) => group.id === 'salesChannels')?.entries), [catalog.data]);

  return { choices, isPending: catalog.isPending, isFetching: catalog.isFetching, isError: catalog.isError, error: catalog.error, refetch: catalog.refetch };
}
