import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';

export type DirectService = 'alloggiati' | 'istat';
export interface DirectRoutes {
  effectiveFrom: Record<DirectService, string | null>;
  alloggiatiAvailable: boolean;
  istatAvailable: boolean;
  istatSupported: boolean;
  delegationVersion: string;
}

export const directRoutesPath = (id: string) => `/properties/${encodeURIComponent(id)}/institutional-routes`;
export const directRoutesKey = (id: string) => ['institutional-routes', id] as const;

export function useDirectRoutes(id: string) {
  return useQuery({ queryKey: directRoutesKey(id), queryFn: () => ApiClient.get<DirectRoutes>(directRoutesPath(id)) });
}
