import { ApiClient } from '@/api/client';
import type { Entitlement, PlanCatalogEntry } from '@/types';

export const OrgsApi = {
  getPlans: (): Promise<PlanCatalogEntry[]> =>
    ApiClient.get<PlanCatalogEntry[]>('/orgs/plans'),

  getMyEntitlement: (): Promise<Entitlement> =>
    ApiClient.get<Entitlement>('/orgs/me/entitlement'),
};
