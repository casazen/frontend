import { useQuery } from '@tanstack/react-query';
import { longRentPropertiesApi } from '@/api/long-rent-properties.api';

export const LONG_RENT_PROPERTY_AGGREGATE_KEY = ['properties', 'long-rent-aggregate'] as const;

export function useLongRentPropertyAggregate({ fresh = false, canReadLeases }: { fresh?: boolean; canReadLeases: boolean }) {
  return useQuery({
    queryKey: [...LONG_RENT_PROPERTY_AGGREGATE_KEY, canReadLeases],
    queryFn: () => longRentPropertiesApi.getAll(),
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}
