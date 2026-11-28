import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertyCleaningApi } from '@/api/property-cleaning.api';
import { fetchSuppliersByProperty } from '@/api/service-requests.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { CLEANING_CATEGORY } from '@/features/properties/lib/property-cleaning-model';
import type { BulkSaveCleaningSetupDto, SaveCleaningSetupDto } from '@/types';

const PROPERTY_CLEANING_KEY = 'property-cleaning';

const SETUP_STALE_TIME = 30 * 1000;

function setupQuery(propertyId: string) {
  return {
    queryKey: [PROPERTY_CLEANING_KEY, propertyId],
    queryFn: () => propertyCleaningApi.get(propertyId),
    staleTime: SETUP_STALE_TIME,
    refetchOnMount: 'always' as const,
  };
}

export function usePropertyCleaningSetup(propertyId: string) {
  return useQuery({ ...setupQuery(propertyId), enabled: propertyId !== '' });
}

export function usePropertyCleaningSetups(propertyIds: readonly string[]) {
  return useQueries({ queries: propertyIds.map((propertyId) => setupQuery(propertyId)) });
}

/**
 * Saves the whole setup of a property. The body holds the id of a person of the staff, so the mutation is not kept once nothing observes it (`gcTime: 0`) and a refusal is kept
 * without the request that was sent (`withoutRequest`): the status and the body of the answer stay, the body of the request does not. No toast here: the card says how it went.
 * Whatever the answer the setup is read again: the card shows what the server holds, never what the person hoped.
 */
export function useSavePropertyCleaningSetup(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationKey: [PROPERTY_CLEANING_KEY, 'save', propertyId],
    mutationFn: async (dto: SaveCleaningSetupDto) => {
      try {
        return await propertyCleaningApi.save(propertyId, dto);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData([PROPERTY_CLEANING_KEY, propertyId], saved);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [PROPERTY_CLEANING_KEY, propertyId] }),
  });
}

export function useSaveBulkCleaningSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationKey: [PROPERTY_CLEANING_KEY, 'bulk'],
    mutationFn: async (dto: BulkSaveCleaningSetupDto) => {
      try {
        return await propertyCleaningApi.saveBulk(dto);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [PROPERTY_CLEANING_KEY] }),
  });
}

/**
 * The suppliers that clean, for each property given (`GET api/suppliers?propertyId=&category=cleaning`, one read for each): the dialog for many properties reads each property’s assignments
 * and puts the lists together. The same key as the list a request asks for (`useSuppliersByProperty`), so a list read by one is the other's. `enabled` is false while a member of the staff
 * is chosen: nothing is asked then. Read again whenever it is asked for, also when it was read a moment ago: the picker never offers a supplier that was available minutes ago (a read that
 * fails is not used by the caller, which tells it is not read).
 */
export function useCleaningSuppliers(propertyIds: readonly string[], enabled: boolean) {
  return useQueries({
    queries: propertyIds.map((propertyId) => ({
      queryKey: ['suppliers', 'property', propertyId, CLEANING_CATEGORY],
      queryFn: () => fetchSuppliersByProperty(propertyId, CLEANING_CATEGORY),
      enabled,
      staleTime: 0,
      refetchOnMount: 'always' as const,
    })),
  });
}
