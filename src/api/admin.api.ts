import { ApiClient } from '@/api/client';
import type { AdminStats, CinComplianceItem, JobStatus } from '@/types';

export const AdminApi = {
  getStats: (): Promise<AdminStats> =>
    ApiClient.get<AdminStats>('/admin/stats'),

  getCinCompliance: (): Promise<CinComplianceItem[]> =>
    ApiClient.get<CinComplianceItem[]>('/admin/cin-compliance'),

  getJobs: (): Promise<JobStatus[]> =>
    ApiClient.get<JobStatus[]>('/admin/jobs'),
};
