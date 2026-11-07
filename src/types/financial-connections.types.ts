/** A bank account the signed-in person linked through Stripe Financial Connections. */
export interface FinancialConnectionsAccount {
  id: string;
  institutionName: string;
  last4: string;
  displayName: string | null;
}

/**
 * `POST /stripe/financial-connections/session`. Stripe.js opens its own consent screen with `clientSecret`
 * (`collectFinancialConnectionsAccounts`). CasaZen does not rebuild that screen.
 */
export interface FinancialConnectionsSession {
  clientSecret: string;
  publishableKey: string;
}

/**
 * `POST /leases/:leaseId/dues/:dueId/stripe-transfer`. Starting it does not mean the due is paid: only a later read of
 * the due, after Stripe confirms, can say so.
 */
export interface StripeRentTransfer {
  id: string | null;
  /** Whatever the API answered. `Paid` here is not applied to the due. */
  status: string;
}

export interface StripeRentTransferInput {
  financialConnectionsAccountId: string;
  amount: number;
  reference: string;
}
