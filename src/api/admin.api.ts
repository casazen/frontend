import { ApiClient } from '@/api/client';
import type { AdminStats, CinComplianceItem, JobStatus, Entitlement } from '@/types';

/** Backend PagedResultDto<T> (camelCase JSON) */
interface BackendPagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CinComplianceQuery {
  page?: number;
  pageSize?: number;
  cinStatus?: 'valid' | 'missing' | 'invalid';
}

export const AdminApi = {
  getStats: (): Promise<AdminStats> =>
    ApiClient.get<AdminStats>('/admin/stats'),

  getCinCompliance: (params?: CinComplianceQuery): Promise<CinComplianceItem[]> =>
    ApiClient.get<BackendPagedResult<CinComplianceItem>>('/admin/cin-compliance', params).then(
      (res) => res.items ?? [],
    ),

  getJobs: (): Promise<JobStatus[]> =>
    ApiClient.get<JobStatus[]>('/admin/jobs'),

  updateOrgPlan: (orgId: string, planTier: string): Promise<Entitlement> =>
    ApiClient.patch<Entitlement>(`/admin/orgs/${orgId}/plan`, { planTier }),
};
