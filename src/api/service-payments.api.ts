import { ApiClient } from './client';

/**
 * The payment page of a service a supplier completed (`/service/pay/:paymentId?token=…`, SP-15a/15c-b), reached from the link of the
 * e-mail: the token of the link is the only access check, sent in the body and never in the URL of the API. Anonymous; no personal data
 * in the answers.
 */

/** Where the payment stands for the person with the link. */
export type PublicServicePaymentState = 'Payable' | 'Processing' | 'Paid' | 'Unavailable';

export interface PublicServicePayment {
  id: string;
  /** The supplier that is paid. */
  supplierName: string;
  serviceName: string;
  /** The payer's own property the work was done at. */
  propertyName: string;
  completedAt?: string | null;
  /** What the payer pays, in cents. */
  amountCents: number;
  currency: string;
  /** The lines that add up to `amountCents`: the agreed price and the extras. */
  lines: { kind: string; label: string; amountCents: number }[];
  state: PublicServicePaymentState;
  /** The last online attempt failed: the payer can try again. */
  lastAttemptFailed: boolean;
  /** When the link stops working; only while the payment is `Payable`. */
  validUntil?: string | null;
}

/** What Stripe.js needs to confirm the payment. `stripeAccountId` is null for the money CasaZen holds: the PaymentIntent is on the platform. */
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
  /** 404 `service_payment_link_invalid` for a wrong id, a wrong token and a link past its validity: the same answer. */
  getPayment: (paymentId: string, token: string) => ApiClient.post<PublicServicePayment>(`/public/service-payments/${enc(paymentId)}`, { token }, { public: true }),

  /** 409 `service_payment_not_payable` (paid or withdrawn), `service_payment_in_flight` (being processed), `service_payment_supplier_not_ready`. */
  createSession: (paymentId: string, token: string) =>
    ApiClient.post<ServicePaymentSession>(`/public/service-payments/${enc(paymentId)}/payment-session`, { token }, { public: true }),
};
