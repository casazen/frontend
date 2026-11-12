import type { RentLedgerComponent } from '@/types';

/** The four parts a rent-ledger row shows. An unknown kind is counted with the other charges. */
export const RENT_COMPONENT_KINDS = ['Rent', 'CondominiumAdvance', 'CondominiumSettlement', 'Other'] as const;

export type RentComponentKindName = (typeof RENT_COMPONENT_KINDS)[number];

/** What a row needs for the breakdown. `components` is optional: without it only the total is known. */
export interface RentMoneySource {
  amount?: number | null;
  status?: string | null;
  components?: ReadonlyArray<Pick<RentLedgerComponent, 'kind' | 'amount'>> | null;
  amountPaid?: number | null;
  residual?: number | null;
}

export interface RentBreakdown {
  /** The API sent at least one part. Without it the part columns stay empty and `total` is `amount`. */
  hasComponents: boolean;
  rent: number | null;
  condominiumAdvance: number | null;
  condominiumSettlement: number | null;
  other: number | null;
  total: number;
  paid: number;
  residual: number;
}

function cents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

function euros(value: number): number {
  return value / 100;
}

function finiteAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Rent, condominium advance, settlement, other charges, total, paid and residual of one ledger row.
 * Parts are read only from `components`. When that array is missing, the current `amount` is the total and the parts
 * stay empty, so a ledger the API has not split yet still renders.
 */
export function rentBreakdown(row: RentMoneySource): RentBreakdown {
  const components = (row.components ?? []).filter(
    (part): part is { kind: string; amount: number } =>
      typeof part?.kind === 'string' && finiteAmount(part.amount) !== null,
  );
  const hasComponents = components.length > 0;

  const sumKind = (kind: RentComponentKindName) =>
    components.filter((part) => part.kind === kind).reduce((total, part) => total + cents(part.amount), 0);

  const known = new Set<string>(RENT_COMPONENT_KINDS);
  const unknown = components
    .filter((part) => !known.has(part.kind))
    .reduce((total, part) => total + cents(part.amount), 0);

  const componentTotal = components.reduce((total, part) => total + cents(part.amount), 0);
  const stated = finiteAmount(row.amount);
  const totalCents = stated !== null ? cents(stated) : componentTotal;

  const paidStated = finiteAmount(row.amountPaid);
  const paidCents = paidStated !== null ? cents(paidStated) : row.status === 'Paid' ? totalCents : 0;

  const residualStated = finiteAmount(row.residual);
  const residualCents = residualStated !== null ? cents(residualStated) : totalCents - paidCents;

  return {
    hasComponents,
    rent: hasComponents ? euros(sumKind('Rent')) : null,
    condominiumAdvance: hasComponents ? euros(sumKind('CondominiumAdvance')) : null,
    condominiumSettlement: hasComponents ? euros(sumKind('CondominiumSettlement')) : null,
    other: hasComponents ? euros(sumKind('Other') + unknown) : null,
    total: euros(totalCents),
    paid: euros(paidCents),
    residual: euros(residualCents),
  };
}
