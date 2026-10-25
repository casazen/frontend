import { useQuery } from '@tanstack/react-query';
import { CrmApi } from '@/api/crm.api';
import type { GuestCrmListParams } from '@/types/crm.types';

const CRM_KEY = 'crm';

/**
 * Query CRM guest profiles (NF-23, ADR-021), filtered by the caller's HostScope:
 * only profiles with stays at properties the caller reaches.
 */
export function useGuestCrmProfiles(params?: GuestCrmListParams) {
  return useQuery({
    queryKey: [CRM_KEY, 'guests', params],
    queryFn: () => CrmApi.getGuests(params),
  });
}

/**
 * Query a single guest CRM profile by ID.
 */
export function useGuestCrmProfile(id: string | undefined) {
  return useQuery({
    queryKey: [CRM_KEY, 'guest', id],
    queryFn: () => CrmApi.getGuest(id!),
    enabled: !!id,
  });
}
