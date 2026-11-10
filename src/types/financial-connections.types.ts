/**
 * Bank link through Stripe Financial Connections.
 * Landlord: `/orgs/me/bank-links` (condominium, not a rent due).
 * Tenant of a payment link: `/public/rent-payments/:id/bank-link`.
 * Signed-in tenant of a due: `/tenant-area/contracts/:leaseId/dues/:dueId/bank-link` (the tenant pays the landlord).
 * A due is paid only when a later read says Stripe confirmed it.
 */

/** `POST .../sessions`. Stripe.js opens its own screen with `clientSecret`. */
export interface BankLinkSession {
  sessionId: string;
  clientSecret: string;
  /** Present only when the API sends it. The session contract is the id and the client secret. */
  publishableKey?: string | null;
}

/** `GET /orgs/me/bank-links` and the body of `POST /orgs/me/bank-links`. No IBAN. */
export interface BankLinkAccount {
  linked: boolean;
  accountId: string | null;
  institutionName: string | null;
  last4: string | null;
  displayName: string | null;
}

/**
 * `POST /orgs/me/bank-links/payments` or the public `.../bank-link/payment`.
 * `dueSettled` is false here: starting the debit does not pay the due.
 */
export interface BankLinkPaymentStarted {
  paymentId: string;
  paymentIntentId: string;
  clientSecret: string | null;
  stripeStatus: string;
  paymentMethodType: string;
  dueSettled: boolean;
}

export interface StartOrgBankLinkPayment {
  amountCents: number;
  currency: string;
  /** Set for a rent due. Omitted when the debit pays the condominium. */
  leaseId?: string;
  installmentId?: string;
}
