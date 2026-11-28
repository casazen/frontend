export interface SupplierPaymentsAccount {
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
  canReceivePayments: boolean;
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
type SupplierPaymentsState = 'notConnected' | 'toComplete' | 'verifying' | 'active';

export function resolveSupplierPaymentsState(account: SupplierPaymentsAccount): SupplierPaymentsState {
  if (!account.hasAccount) return 'notConnected';
  if (account.canReceivePayments) return 'active';
  if (account.requirementsDue.length > 0 || !account.detailsSubmitted) return 'toComplete';
  return 'verifying';
}
