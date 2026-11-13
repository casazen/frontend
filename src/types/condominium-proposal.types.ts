/**
 * Condominium expense the contract wizard proposes.
 * `POST /leases/:leaseId/draft/condominium-expense`.
 * A fiscal year already on the property answers from the confirmed budget.
 * With nothing loaded the same call returns 422 `tenant_expense_proposal_invalid`
 * until the previous consuntivo and the new preventivo, or a manual amount, are sent.
 * The call does not start a payment and does not rewrite issued installments.
 */

export type TenantExpenseSource = 'FixedContract' | 'ConfirmedBudget' | 'Statements' | 'Manual';

export type RentExpenseCadence = 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Semiannual';

export interface TenantExpenseProposal {
  source: TenantExpenseSource;
  /** One installment, in euros. */
  installmentAmount: number;
  lastInstallmentAmount: number;
  installments: number;
  annualAmount: number;
  previousConsuntivo: number | null;
  preventivo: number | null;
  /** True when the amount waits for the consuntivo. A later call must keep the same request. */
  settledAtConsuntivo: boolean;
  periodId: string | null;
  periodLabel: string | null;
}

/** Body of the proposal. Omit a field rather than sending null. */
export interface ProposeTenantExpense {
  settlementRequired?: boolean;
  advanceMode?: 'FixedContractAmount' | 'BudgetAllocation' | 'None' | 'NeedsReview';
  contractualAdvance?: number;
  cadence?: RentExpenseCadence;
  previousConsuntivo?: number;
  preventivo?: number;
  manualAmount?: number;
}
