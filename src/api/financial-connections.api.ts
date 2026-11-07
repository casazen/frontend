import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type {
  FinancialConnectionsAccount,
  FinancialConnectionsSession,
  StripeRentTransfer,
  StripeRentTransferInput,
} from '@/types';
import { ApiClient } from './client';

const SESSION_PATH = '/stripe/financial-connections/session';
const ACCOUNTS_PATH = '/stripe/financial-connections/accounts';

/**
 * Stripe Financial Connections for a rent due. The base URL already ends in `/api`, so these are
 * `POST /api/stripe/financial-connections/session`, `GET /api/stripe/financial-connections/accounts` and
 * `POST /api/leases/:leaseId/dues/:dueId/stripe-transfer`.
 */
export const financialConnectionsApi = {
  /** Opens Stripe's own account-linking screen. No due is marked paid. */
  createSession: async (): Promise<FinancialConnectionsSession> => parseSession(await ApiClient.post<unknown>(SESSION_PATH, {})),

  /** Accounts already linked for the signed-in person. */
  listAccounts: async (): Promise<FinancialConnectionsAccount[]> => parseAccounts(await ApiClient.get<unknown>(ACCOUNTS_PATH)),

  /**
   * Starts a transfer for one open due. The same key again does not start a second one. The answer is not a payment:
   * the due stays unpaid until Stripe confirms it and the due is read again.
   */
  startTransfer: async (leaseId: string, dueId: string, input: StripeRentTransferInput, idempotencyKey: string): Promise<StripeRentTransfer> =>
    parseTransfer(
      await ApiClient.post<unknown>(transferPath(leaseId, dueId), input, { headers: { 'Idempotency-Key': idempotencyKey } }),
    ),
};

export function transferPath(leaseId: string, dueId: string): string {
  return `/leases/${encodeURIComponent(leaseId)}/dues/${encodeURIComponent(dueId)}/stripe-transfer`;
}

/**
 * How the screen talks about a transfer that was accepted. A `Paid` status in this answer is still "waiting": the due
 * itself is the only place that can say paid, and only after Stripe has confirmed it.
 */
export function transferAwaitingConfirmation(status: string): boolean {
  return status !== 'Failed' && status !== 'Canceled' && status !== 'Cancelled';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string): never {
  throw new UnexpectedApiResponseError(path);
}

function text(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') fail(path);
  return value;
}

function optionalText(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function parseSession(data: unknown): FinancialConnectionsSession {
  if (!isRecord(data)) fail(SESSION_PATH);
  return {
    clientSecret: text(data, 'clientSecret', SESSION_PATH),
    publishableKey: text(data, 'publishableKey', SESSION_PATH),
  };
}

function parseAccounts(data: unknown): FinancialConnectionsAccount[] {
  if (!isRecord(data) || !Array.isArray(data.accounts)) fail(ACCOUNTS_PATH);
  return data.accounts.map((item) => {
    if (!isRecord(item)) fail(ACCOUNTS_PATH);
    return {
      id: text(item, 'id', ACCOUNTS_PATH),
      institutionName: optionalText(item, 'institutionName') ?? 'Conto',
      last4: text(item, 'last4', ACCOUNTS_PATH),
      displayName: optionalText(item, 'displayName'),
    };
  });
}

function parseTransfer(data: unknown): StripeRentTransfer {
  if (!isRecord(data)) fail('stripe-transfer');
  return {
    id: optionalText(data, 'id'),
    status: optionalText(data, 'status') ?? 'Processing',
  };
}
