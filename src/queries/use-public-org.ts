import { useQuery } from '@tanstack/react-query';
import { publicOrgApi } from '@/api/public-org.api';
import { publicBookingApi } from '@/api/public-booking.api';

export function usePublicOrg(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-org', slug],
    queryFn: () => publicOrgApi.getPublicOrg(slug!),
    enabled: Boolean(slug),
    retry: false,
  });
}

export function useOrgProperties(slug: string | undefined) {
  return useQuery({
    queryKey: ['public-org-properties', slug],
    queryFn: () => publicOrgApi.getOrgProperties(slug!),
    enabled: Boolean(slug),
  });
}

export function useOrgPublicProperty(slug: string | undefined, propertyId: string | undefined) {
  return useQuery({
    queryKey: ['public-org-property', slug, propertyId],
    queryFn: () => publicOrgApi.getOrgProperty(slug!, propertyId!),
    enabled: Boolean(slug && propertyId),
    retry: false,
  });
}

export function usePropertyAvailability(propertyId: string | undefined, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['property-availability', propertyId, startDate, endDate],
    queryFn: () => publicBookingApi.getPropertyAvailability(propertyId!, startDate, endDate),
    enabled: Boolean(propertyId),
    retry: false,
  });
}
