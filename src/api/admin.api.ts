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

export interface CinCompliancePagedResult {
  items: CinComplianceItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface DemoEnvironmentStatus {
  available: boolean;
  enabled: boolean;
  templateVersion: string;
  lastResetAt: string | null;
  showcaseProperties: number;
  scenarios: string[];
}

export interface DemoOrgListItem {
  id: string;
  name: string;
  slug: string;
}

export interface DemoComplianceResult {
  propertiesSeen: number;
  published: number;
  alreadyComplete: number;
  filled: number;
}

export interface DemoResetResult {
  removed: number;
  created: number;
  unpublishedRemoved: number;
}

export const AdminApi = {
  getStats: (): Promise<AdminStats> =>
    ApiClient.get<AdminStats>('/admin/stats'),

  getCinCompliance: (params?: CinComplianceQuery): Promise<CinCompliancePagedResult> =>
    ApiClient.get<BackendPagedResult<CinComplianceItem>>('/admin/cin-compliance', params).then(
      (res) => ({
        items: res.items ?? [],
        totalCount: res.totalCount ?? 0,
        page: res.page ?? 1,
        pageSize: res.pageSize ?? 20,
      }),
    ),

  getJobs: (): Promise<JobStatus[]> =>
    ApiClient.get<JobStatus[]>('/admin/jobs'),

  updateOrgPlan: (orgId: string, planTier: string): Promise<Entitlement> =>
    ApiClient.patch<Entitlement>(`/admin/orgs/${orgId}/plan`, { planTier }),

  getDemoStatus: (): Promise<DemoEnvironmentStatus> =>
    ApiClient.get<DemoEnvironmentStatus>('/admin/demo'),

  listDemoOrgs: (): Promise<DemoOrgListItem[]> =>
    ApiClient.get<DemoOrgListItem[]>('/admin/demo/orgs'),

  setDemoEnabled: (enabled: boolean): Promise<DemoEnvironmentStatus> =>
    ApiClient.put<DemoEnvironmentStatus>('/admin/demo/enabled', { enabled }),

  applyDemoCompliance: (orgId: string): Promise<DemoComplianceResult> =>
    ApiClient.post<DemoComplianceResult>(`/admin/demo/orgs/${orgId}/compliance`),

  resetDemoShowcase: (orgId: string, confirmation: string, removeUnpublished: boolean): Promise<DemoResetResult> =>
    ApiClient.post<DemoResetResult>(`/admin/demo/orgs/${orgId}/reset`, { confirmation, removeUnpublished }),
};
