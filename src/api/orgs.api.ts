import { ApiClient } from '@/api/client';
import type { Entitlement } from '@/types';

export const OrgsApi = {
  /** GET /api/orgs/me/entitlement — resolved plan limits + usage for the caller's org (#202, AC8). */
  getMyEntitlement: (): Promise<Entitlement> =>
    ApiClient.get<Entitlement>('/orgs/me/entitlement'),
};
