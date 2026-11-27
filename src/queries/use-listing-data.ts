import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listingDataApi } from '@/api/listing-data.api';
import type { PropertyRoomInput, StayDiscountTier } from '@/types';

const PROPERTIES_KEY = 'properties';

export const roomsKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'rooms'] as const;
export const stayDiscountsKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'stay-discounts'] as const;

/** The rooms of a unit with their beds (NF-34), in order. `fresh`: read again on mount even when cached (a form that starts from the stored rooms). */
export function usePropertyRooms(propertyId: string | undefined, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: roomsKey(propertyId),
    queryFn: () => listingDataApi.getRooms(propertyId!),
    enabled: Boolean(propertyId),
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/**
 * Replaces the rooms. The same save sets the bedrooms and the beds of the property from them, so everything that reads the property is
 * read again. Silent, like the other saves of the wizard: the step tells how it went. The property is a variable of the call: the wizard
 * saves the rooms of a property it has just created.
 */
export function useSavePropertyRooms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, rooms }: { propertyId: string; rooms: PropertyRoomInput[] }) => listingDataApi.putRooms(propertyId, rooms),
    onSuccess: (rooms, { propertyId }) => {
      queryClient.setQueryData(roomsKey(propertyId), rooms);
      void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY], predicate: (query) => query.queryKey[2] !== 'rooms' });
    },
  });
}

/** The length-of-stay discounts of a property (NF-35), in order of nights. */
export function useStayDiscounts(propertyId: string | undefined, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: stayDiscountsKey(propertyId),
    queryFn: () => listingDataApi.getStayDiscounts(propertyId!),
    enabled: Boolean(propertyId),
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/** Replaces the tiers of the discount (an empty list removes them all). */
export function useSaveStayDiscounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, discounts }: { propertyId: string; discounts: StayDiscountTier[] }) =>
      listingDataApi.putStayDiscounts(propertyId, discounts),
    onSuccess: (discounts, { propertyId }) => {
      queryClient.setQueryData(stayDiscountsKey(propertyId), discounts);
    },
  });
}
