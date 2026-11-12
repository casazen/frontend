import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { BankLinkAccount, BankLinkPaymentStarted, BankLinkSession, StartOrgBankLinkPayment } from '@/types';
import { ApiClient } from './client';

const ORG = '/orgs/me/bank-links';

/**
 * Stripe Financial Connections on the paths the API actually exposes. The base URL already ends in `/api`.
 * Starting a payment does not mark a due paid (`dueSettled` is false until a later read of the due).
 */
export const bankLinkApi = {
  /** Landlord: Financial Connections client secret. */
  createOrgSession: async (): Promise<BankLinkSession> => parseSession(await ApiClient.post<unknown>(`${ORG}/sessions`, {})),

  /** Landlord: the account stored on the org, or `linked: false`. */
  getOrgAccount: async (): Promise<BankLinkAccount> => parseAccount(await ApiClient.get<unknown>(ORG)),

  /** Landlord: stores `fca_…` after Stripe.js returns it. */
  attachOrgAccount: async (accountId: string): Promise<BankLinkAccount> =>
    parseAccount(await ApiClient.post<unknown>(ORG, { accountId })),

  /**
   * Landlord: SEPA debit in euros from the linked Italian bank. The same `Idempotency-Key` is sent again for a retry
   * of this attempt. A non-euro due is refused with 422 `bank_link_debit_unavailable` and is not marked paid.
   * Leave `installmentId` empty when the debit is the condominium, not a rent due.
   */
  startOrgPayment: async (input: StartOrgBankLinkPayment, idempotencyKey: string): Promise<BankLinkPaymentStarted> =>
    parsePayment(
      await ApiClient.post<unknown>(`${ORG}/payments`, input, { headers: { 'Idempotency-Key': idempotencyKey } }),
    ),

  /** Tenant of the payment link: Financial Connections client secret. The token is the access check. */
  createRentSession: async (installmentId: string, token: string): Promise<BankLinkSession> =>
    parseSession(
      await ApiClient.post<unknown>(rentPath(installmentId, 'session'), { token }, { public: true }),
    ),

  /** Tenant: stores `fca_…` on that lease only. */
  attachRentAccount: async (installmentId: string, token: string, accountId: string): Promise<BankLinkAccount> =>
    parseAccount(
      await ApiClient.post<unknown>(rentPath(installmentId), { token, accountId }, { public: true }),
    ),

  /** Tenant: debit of this installment. The amount is the due's. Starting it does not mark the due paid. */
  startRentPayment: async (installmentId: string, token: string, idempotencyKey: string): Promise<BankLinkPaymentStarted> =>
    parsePayment(
      await ApiClient.post<unknown>(rentPath(installmentId, 'payment'), { token }, {
        public: true,
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    ),

  /**
   * Signed-in tenant of a due: Financial Connections client secret.
   * `POST /tenant-area/contracts/:leaseId/dues/:dueId/bank-link/session`.
   * This is the tenant paying the landlord, not the landlord paying the rent.
   */
  createTenantSession: async (leaseId: string, dueId: string): Promise<BankLinkSession> =>
    parseSession(await ApiClient.post<unknown>(tenantDueBankLinkPath(leaseId, dueId, 'session'), {})),

  /** Stores `fca_…` for this tenant due. */
  attachTenantAccount: async (leaseId: string, dueId: string, accountId: string): Promise<BankLinkAccount> =>
    parseAccount(await ApiClient.post<unknown>(tenantDueBankLinkPath(leaseId, dueId), { accountId })),

  /** Debit of this due from the tenant's linked account. Starting it does not mark the due paid. */
  startTenantPayment: async (leaseId: string, dueId: string, idempotencyKey: string): Promise<BankLinkPaymentStarted> =>
    parsePayment(
      await ApiClient.post<unknown>(tenantDueBankLinkPath(leaseId, dueId, 'payment'), {}, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    ),
};

/** Tenant due bank link: the tenant pays the landlord. */
export function tenantDueBankLinkPath(leaseId: string, dueId: string, action?: 'session' | 'payment'): string {
  const base = `/tenant-area/contracts/${encodeURIComponent(leaseId)}/dues/${encodeURIComponent(dueId)}/bank-link`;
  return action ? `${base}/${action}` : base;
}

export function rentBankLinkPath(installmentId: string, action?: 'session' | 'payment'): string {
  return rentPath(installmentId, action);
}

function rentPath(installmentId: string, action?: 'session' | 'payment'): string {
  const base = `/public/rent-payments/${encodeURIComponent(installmentId)}/bank-link`;
  return action ? `${base}/${action}` : base;
}

/**
 * The debit was accepted by the API. The due itself stays unpaid until a later read says Stripe confirmed it,
 * including when `dueSettled` is unexpectedly true or the intent status is already `succeeded`.
 */
export function transferAwaitingConfirmation(started: Pick<BankLinkPaymentStarted, 'stripeStatus'>): boolean {
  const status = started.stripeStatus;
  return status !== 'canceled' && status !== 'requires_payment_method';
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

function parseSession(data: unknown): BankLinkSession {
  if (!isRecord(data)) fail(ORG);
  return {
    sessionId: text(data, 'sessionId', ORG),
    clientSecret: text(data, 'clientSecret', ORG),
    publishableKey: optionalText(data, 'publishableKey'),
  };
}

function parseAccount(data: unknown): BankLinkAccount {
  if (!isRecord(data) || typeof data.linked !== 'boolean') fail(ORG);
  return {
    linked: data.linked,
    accountId: optionalText(data, 'accountId'),
    institutionName: optionalText(data, 'institutionName'),
    last4: optionalText(data, 'last4'),
    displayName: optionalText(data, 'displayName'),
  };
}

function parsePayment(data: unknown): BankLinkPaymentStarted {
  if (!isRecord(data) || typeof data.dueSettled !== 'boolean') fail(`${ORG}/payments`);
  return {
    paymentId: text(data, 'paymentId', `${ORG}/payments`),
    paymentIntentId: text(data, 'paymentIntentId', `${ORG}/payments`),
    clientSecret: optionalText(data, 'clientSecret'),
    stripeStatus: text(data, 'stripeStatus', `${ORG}/payments`),
    paymentMethodType: text(data, 'paymentMethodType', `${ORG}/payments`),
    dueSettled: data.dueSettled,
  };
}
