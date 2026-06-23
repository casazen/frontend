import { AxiosError } from 'axios';

// Re-exported from i18n-labels.ts — canonical home for i18n-aware label functions
export { getPlanLimitMessage, getPlanUpgradeCta } from './i18n-labels';

/** Target route for plan management (MVP until Stripe billing). */
export const PLAN_UPGRADE_PATH = '/app/short-rent/settings/plan';

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
