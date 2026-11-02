import { useQuery } from '@tanstack/react-query';
import { longRentPropertiesApi } from '@/api/long-rent-properties.api';

/** Under the key of the properties: whatever refreshes them (a property edited, created, paused) reads this again too. */
export const LONG_RENT_PROPERTY_AGGREGATE_KEY = ['properties', 'long-rent-aggregate'] as const;

/**
 * What the lists of properties and of leases do not say of the properties of the long-term area (LR-07a): the APE, the cadastral data, the
 * lease that holds each one and when it is free again, the change of mode programmed. `fresh`: read again every time the page of the list
 * opens (a lease is made or ended on other pages). A failure is not fatal for the page: it works without these extras.
 */
export function useLongRentPropertyAggregate({ fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: LONG_RENT_PROPERTY_AGGREGATE_KEY,
    queryFn: () => longRentPropertiesApi.getAll(),
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}
