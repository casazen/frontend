import { useQuery } from '@tanstack/react-query';
import { AdminApi, type AdminOtaStatus } from '@/api/admin.api';

const ADMIN_KEY = 'admin';

export function useAdminStats() {
  return useQuery({
    queryKey: [ADMIN_KEY, 'stats'],
    queryFn: () => AdminApi.getStats(),
  });
}

export function useCinCompliance(
  page = 1,
  pageSize = 20,
  cinStatus?: 'valid' | 'missing' | 'invalid',
) {
  return useQuery({
    queryKey: [ADMIN_KEY, 'cin-compliance', page, pageSize, cinStatus ?? 'all'],
    queryFn: () =>
      AdminApi.getCinCompliance({
        page,
        pageSize,
        ...(cinStatus ? { cinStatus } : {}),
      }),
  });
}

export function useAdminOtaSync(status: AdminOtaStatus, page: number, pageSize: number) {
  return useQuery({
    queryKey: [ADMIN_KEY, 'ota-sync', status, page, pageSize],
    queryFn: () => AdminApi.getOtaSync(status, page, pageSize),
  });
}

export function useAdminJobs() {
  return useQuery({
    queryKey: [ADMIN_KEY, 'jobs'],
    queryFn: () => AdminApi.getJobs(),
    refetchInterval: 30_000,
  });
}
