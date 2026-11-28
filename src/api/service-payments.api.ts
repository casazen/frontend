import { ApiClient } from './client';

/**
 * The payment page of a service a supplier completed (`/service/pay/:paymentId?token=…`, SP-15a/15c-b), reached from the link of the
 * e-mail: the token of the link is the only access check, sent in the body and never in the URL of the API. Anonymous; no personal data
 * in the answers.
 */

export type PublicServicePaymentState = 'Payable' | 'Processing' | 'Paid' | 'Unavailable';

export interface PublicServicePayment {
  id: string;
  supplierName: string;
  serviceName: string;
  propertyName: string;
  completedAt?: string | null;
  amountCents: number;
  currency: string;
  lines: { kind: string; label: string; amountCents: number }[];
  state: PublicServicePaymentState;
  lastAttemptFailed: boolean;
  validUntil?: string | null;
}

export interface ServicePaymentSession {
  paymentId: string;
  clientSecret: string;
  publishableKey: string;
  stripeAccountId?: string | null;
  amountCents: number;
  currency: string;
}

const enc = encodeURIComponent;

export const servicePaymentsApi = {
  getPayment: (paymentId: string, token: string) => ApiClient.post<PublicServicePayment>(`/public/service-payments/${enc(paymentId)}`, { token }, { public: true }),

  createSession: (paymentId: string, token: string) =>
    ApiClient.post<ServicePaymentSession>(`/public/service-payments/${enc(paymentId)}/payment-session`, { token }, { public: true }),
};
