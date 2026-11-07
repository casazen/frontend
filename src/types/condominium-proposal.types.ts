/**
 * What the contract wizard reads and writes for condominium expenses.
 * One resource: `GET` and `POST /long-rent/properties/:propertyId/condominium-proposal`.
 * A fiscal year that can name an amount is `ready`. Nothing loaded is `empty`.
 */

export type CondominiumProposalState = 'ready' | 'empty';

export interface CondominiumProposal {
  state: CondominiumProposalState;
  /** Label of the fiscal year, such as `2025/2026`, when the property has one. */
  fiscalYearLabel: string | null;
  /** Monthly condominium expense in euros. Null while nothing can be proposed. */
  amount: number | null;
  currency: 'EUR';
}

/** A hand-typed advance. The settlement waits for the consuntivo. */
export interface CondominiumManualProposal {
  mode: 'manual';
  leaseId: string;
  amount: number;
  settleAtConsuntivo: true;
}

/** The amount the fiscal year already proposed, accepted onto this contract. */
export interface CondominiumAcceptedProposal {
  mode: 'proposed';
  leaseId: string;
  amount: number;
}
