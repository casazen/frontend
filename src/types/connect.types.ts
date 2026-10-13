import { isAxiosError } from 'axios';
import { getProblemCode, isTransientRequestError } from '@/lib/api-errors';

export interface ConnectStatus {
  connectedAccountId?: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
}

export interface OnboardingLinkResponse {
  url: string;
}

export type ConnectUiStatus = 'disconnected' | 'pending' | 'active';

export function resolveConnectUiStatus(status: ConnectStatus | undefined): ConnectUiStatus {
  if (!status?.connectedAccountId)
    return 'disconnected';
  if (!status.chargesEnabled)
    return 'pending';
  return 'active';
}

/**
 * Error codes of `/api/connect/*` (BK-09). A failed Stripe call never unlinks the account: `stripe_connect_unavailable`
 * (503, Stripe busy or unreachable) and `stripe_connect_account_unavailable` (409, the next attempt links a new account)
 * are worth a retry; the configuration errors are not.
 */
export const CONNECT_ERROR_CODES = {
  unavailable: 'stripe_connect_unavailable',
  accountUnavailable: 'stripe_connect_account_unavailable',
  notConfigured: 'stripe_connect_not_configured',
  returnUrlNotConfigured: 'connect_return_url_not_configured',
} as const;

const NOT_RETRYABLE_CODES = new Set<string>([
  CONNECT_ERROR_CODES.notConfigured,
  CONNECT_ERROR_CODES.returnUrlNotConfigured,
]);

/** True when retrying a failed Connect call may succeed: Stripe temporarily unavailable, network error, generic 5xx. */
export function isRetryableConnectError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const code = getProblemCode(error.response?.data);
  if (code === CONNECT_ERROR_CODES.unavailable || code === CONNECT_ERROR_CODES.accountUnavailable) return true;
  if (code && NOT_RETRYABLE_CODES.has(code)) return false;
  return isTransientRequestError(error);
}
