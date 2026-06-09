import { AxiosError } from 'axios';

/** Italian end-user copy shown when a write is blocked by the org's plan limit (#202, AC8/AC12). */
export const PLAN_LIMIT_MESSAGE = 'Hai raggiunto il limite del tuo piano';

/** Italian CTA label pointing at the (billing-spec-owned) upgrade route. */
export const PLAN_UPGRADE_CTA = 'Passa a un piano superiore';

/** Target route for the upgrade CTA. Route is owned by spec-saas-billing; we only link to it. */
export const PLAN_UPGRADE_PATH = '/app/billing/upgrade';

interface EntitlementErrorBody {
  code?: string;
  error?: string;
  planTier?: string;
  limit?: number;
}

/**
 * True when the backend rejected a write because the org hit its plan limit.
 * The server returns 403 (property create) or 409 with code "plan_limit_reached".
 */
export function isPlanLimitError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;
  const status = error.response?.status;
  const code = (error.response?.data as EntitlementErrorBody | undefined)?.code;
  return (status === 403 || status === 409) && code === 'plan_limit_reached';
}
