import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listingDataApi } from '@/api/listing-data.api';
import type { PropertyRoomInput, StayDiscountTier } from '@/types';

const PROPERTIES_KEY = 'properties';

const roomsKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'rooms'] as const;
const stayDiscountsKey = (propertyId: string | undefined) => [PROPERTIES_KEY, propertyId, 'stay-discounts'] as const;

export function usePropertyRooms(propertyId: string | undefined, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: roomsKey(propertyId),
    queryFn: () => listingDataApi.getRooms(propertyId!),
    enabled: Boolean(propertyId),
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

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

export function useStayDiscounts(propertyId: string | undefined, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: stayDiscountsKey(propertyId),
    queryFn: () => listingDataApi.getStayDiscounts(propertyId!),
    enabled: Boolean(propertyId),
    ...(options.fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

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
