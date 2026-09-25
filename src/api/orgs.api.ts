import { ApiClient } from '@/api/client';
import type { Entitlement, OrgSettings, PlanCatalogEntry, UpdateOrgSettingsRequest } from '@/types';

export const OrgsApi = {
  getPlans: (): Promise<PlanCatalogEntry[]> =>
    ApiClient.get<PlanCatalogEntry[]>('/orgs/plans'),

  getMyEntitlement: (): Promise<Entitlement> =>
    ApiClient.get<Entitlement>('/orgs/me/entitlement'),

  /** A1-22, A1-23: name, public slug and contact email opt-in. Org billing admin only. */
  getSettings: (): Promise<OrgSettings> =>
    ApiClient.get<OrgSettings>('/orgs/me/settings'),

  updateSettings: (payload: UpdateOrgSettingsRequest): Promise<OrgSettings> =>
    ApiClient.put<OrgSettings>('/orgs/me/settings', payload),
};
