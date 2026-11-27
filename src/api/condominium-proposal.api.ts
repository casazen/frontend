import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { ProposeTenantExpense, TenantExpenseProposal, TenantExpenseSource } from '@/types/condominium-proposal.types';
import { ApiClient } from './client';

/**
 * The condominium expense of a draft lease.
 * `POST /leases/:leaseId/draft/condominium-expense`.
 * An empty body asks for the fiscal year already on the property.
 * 422 `tenant_expense_proposal_invalid` means nothing is loaded yet.
 */
export function condominiumExpensePath(leaseId: string): string {
  return `/leases/${encodeURIComponent(leaseId)}/draft/condominium-expense`;
}

const SOURCES: readonly TenantExpenseSource[] = ['FixedContract', 'ConfirmedBudget', 'Statements', 'Manual'];

export const condominiumProposalApi = {
  saved: async (leaseId: string): Promise<TenantExpenseProposal | null> => {
    const result = await ApiClient.get<unknown>(condominiumExpensePath(leaseId));
    return result == null ? null : parseProposal(result);
  },
  propose: async (leaseId: string, body: ProposeTenantExpense): Promise<TenantExpenseProposal> =>
    parseProposal(await ApiClient.post<unknown>(condominiumExpensePath(leaseId), body)),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function money(value: unknown, allowZero: boolean): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return Number.NaN;
  if (allowZero ? value < 0 : value <= 0) return Number.NaN;
  return value;
}

function parseProposal(data: unknown): TenantExpenseProposal {
  const path = '/leases/:leaseId/draft/condominium-expense';
  if (!isRecord(data)) throw new UnexpectedApiResponseError(path);
  const source = data.source;
  if (typeof source !== 'string' || !SOURCES.includes(source as TenantExpenseSource)) throw new UnexpectedApiResponseError(path);
  const installmentAmount = money(data.installmentAmount, false);
  const lastInstallmentAmount = money(data.lastInstallmentAmount, false);
  const annualAmount = money(data.annualAmount, false);
  const installments = data.installments;
  if (
    installmentAmount === null ||
    Number.isNaN(installmentAmount) ||
    lastInstallmentAmount === null ||
    Number.isNaN(lastInstallmentAmount) ||
    annualAmount === null ||
    Number.isNaN(annualAmount) ||
    typeof installments !== 'number' ||
    !Number.isInteger(installments) ||
    installments <= 0 ||
    typeof data.settledAtConsuntivo !== 'boolean'
  ) {
    throw new UnexpectedApiResponseError(path);
  }
  const previous = money(data.previousConsuntivo, true);
  const preventivo = money(data.preventivo, false);
  if (Number.isNaN(previous) || Number.isNaN(preventivo)) throw new UnexpectedApiResponseError(path);
  const periodId = data.periodId;
  const periodLabel = data.periodLabel;
  return {
    source: source as TenantExpenseSource,
    installmentAmount,
    lastInstallmentAmount,
    installments,
    annualAmount,
    previousConsuntivo: previous,
    preventivo,
    settledAtConsuntivo: data.settledAtConsuntivo,
    periodId: typeof periodId === 'string' && periodId.trim() !== '' ? periodId : null,
    periodLabel: typeof periodLabel === 'string' && periodLabel.trim() !== '' ? periodLabel : null,
  };
}
