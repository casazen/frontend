/**
 * Bank link through Stripe Financial Connections.
 * Landlord: `/orgs/me/bank-links` (condominium, not a rent due).
 * Tenant of a payment link: `/public/rent-payments/:id/bank-link`.
 * Signed-in tenant of a due: `/tenant-area/contracts/:leaseId/dues/:dueId/bank-link` (the tenant pays the landlord).
 * A due is paid only when a later read says Stripe confirmed it.
 */

export interface BankLinkSession {
  sessionId: string;
  clientSecret: string;
  publishableKey?: string | null;
}

export interface BankLinkAccount {
  linked: boolean;
  accountId: string | null;
  institutionName: string | null;
  last4: string | null;
  displayName: string | null;
}

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
  leaseId?: string;
  installmentId?: string;
}
