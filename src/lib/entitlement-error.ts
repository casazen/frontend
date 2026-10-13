import { AxiosError } from 'axios';
import { planPagePath, type BillingContextKey } from './billing-routes';

// Re-exported from i18n-labels.ts — canonical home for i18n-aware label functions
export { getPlanLimitMessage, getPlanUpgradeCta } from './i18n-labels';

/**
 * Plan page (plans and Stripe checkout, PL-12) a plan limit error links to: the one of the shell the user is in
 * (PL-16), so a long-term landlord is never sent to the short-rent shell. Components shared by several shells (the
 * header badge) use `usePlanPagePath()`.
 */
export function getPlanUpgradePath(context: BillingContextKey): string {
  return planPagePath(context);
}

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
