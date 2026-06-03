import { useQuery } from '@tanstack/react-query';
import { AdminApi } from '@/api/admin.api';

const ADMIN_KEY = 'admin';

export function useAdminStats() {
  return useQuery({
    queryKey: [ADMIN_KEY, 'stats'],
    queryFn: () => AdminApi.getStats(),
  });
}

export function useCinCompliance() {
  return useQuery({
    queryKey: [ADMIN_KEY, 'cin-compliance'],
    queryFn: () => AdminApi.getCinCompliance(),
  });
}

export function useAdminJobs() {
  return useQuery({
    queryKey: [ADMIN_KEY, 'jobs'],
    queryFn: () => AdminApi.getJobs(),
    refetchInterval: 30_000,
  });
}
