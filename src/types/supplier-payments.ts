/**
 * The supplier's Stripe Connect account (SP-14, `GET api/supplier/payments/account`). Nothing here is bank data or the Stripe
 * account id: only what Stripe reports about what the account can do, and the names of the fields it still needs.
 */
export interface SupplierPaymentsAccount {
  /** An Express account is linked to the supplier: the onboarding was started. */
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** The supplier sent the onboarding form; Stripe may still be checking it. */
  detailsSubmitted: boolean;
  /** Names of the fields Stripe needs now (`external_account`, `individual.verification.document`, ...); empty when none. */
  requirementsDue: string[];
  /** Account linked, charges and payouts enabled: the supplier can be paid through CasaZen. */
  canReceivePayments: boolean;
  /** The "Verificato" badge (decision D11). It is not shown on this page: the profile and verification screen is a task of its own. */
  verified: boolean;
  verificationMissing: string[];
}

/** A single-use Stripe address (onboarding or Express Dashboard): a credential, opened at once and never kept. */
export interface SupplierPaymentsLink {
  url: string;
}

/**
 * Where the account stands, for the person: no account yet, something still to send to Stripe (a field it asks for, or the form
 * not finished), everything sent and Stripe still checking, or able to take payments. It follows what the server says about the
 * capabilities (`canReceivePayments`): a state the server did not report is never made up.
 */
export type SupplierPaymentsState = 'notConnected' | 'toComplete' | 'verifying' | 'active';

export function resolveSupplierPaymentsState(account: SupplierPaymentsAccount): SupplierPaymentsState {
  if (!account.hasAccount) return 'notConnected';
  if (account.canReceivePayments) return 'active';
  if (account.requirementsDue.length > 0 || !account.detailsSubmitted) return 'toComplete';
  return 'verifying';
}
