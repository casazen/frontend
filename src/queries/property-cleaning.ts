import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertyCleaningApi } from '@/api/property-cleaning.api';
import { fetchSuppliersByProperty } from '@/api/service-requests.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { CLEANING_CATEGORY } from '@/features/properties/lib/property-cleaning-model';
import type { BulkSaveCleaningSetupDto, SaveCleaningSetupDto } from '@/types';

/** Root of the cleaner of the properties: a change to one setup, or to many, reads them again. */
const PROPERTY_CLEANING_KEY = 'property-cleaning';

/** How long the setup of a property is fresh: it changes by what the host does, here, in the bulk dialog and in the routines page, so a card that opens reads it again. */
const SETUP_STALE_TIME = 30 * 1000;

/** The read of the setup of one property: the card and the dialog for many properties ask for it with the same key, so what one reads the other finds. */
function setupQuery(propertyId: string) {
  return {
    queryKey: [PROPERTY_CLEANING_KEY, propertyId],
    queryFn: () => propertyCleaningApi.get(propertyId),
    staleTime: SETUP_STALE_TIME,
    refetchOnMount: 'always' as const,
  };
}

/**
 * The cleaner of one property (`GET api/properties/{id}/cleaning-setup`). It holds a price, so it asks for `property.write`: the card that reads it is shown only to who holds it.
 * Read again every time the card opens (`refetchOnMount: 'always'`), and a read that fails is not the old answer: the card says it does not know.
 */
export function usePropertyCleaningSetup(propertyId: string) {
  return useQuery({ ...setupQuery(propertyId), enabled: propertyId !== '' });
}

/**
 * The setup of each property given (`GET api/properties/{id}/cleaning-setup`, one read for each): the dialog for many properties takes the currency of every property from here. The list of the
 * properties does not carry one (`PropertyResponse` has no currency), and the setup is where the server says the currency of the property, the one a price is in. The same key and the same
 * freshness as the card's read.
 */
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

/**
 * Saves the same setup for many properties (`PUT api/properties/cleaning-setup/bulk`): 200 with one result for each property, also when some could not be saved. Not kept once nothing
 * observes it and a refusal is kept without the request, as for one property. Whatever the answer every setup is read again: some may have been saved even when the answer was lost.
 */
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
 * The suppliers that clean, for each property given (`GET api/suppliers?propertyId=&category=cleaning`, one read for each): the dialog for many properties asks once for each comune
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
