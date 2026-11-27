import type { RentLedgerComponent } from '@/types';

const EXTRAORDINARY_KINDS = new Set(['Extraordinary', 'ExtraordinaryExpense', 'CondominiumExtraordinary']);

/** Extraordinary condominium charges stay out until a person accepts them. */
export function extraordinaryKept(part: { kind: string; accepted?: boolean | null }): boolean {
  if (!EXTRAORDINARY_KINDS.has(part.kind)) return true;
  return part.accepted === true;
}

/** Drops extraordinary lines that nobody has accepted. Amounts stay the ones the API sent. */
export function withoutUnacceptedExtraordinary<T extends { components: RentLedgerComponent[] | null }>(due: T): T {
  if (!due.components) return due;
  const components = due.components.filter((part) => extraordinaryKept(part));
  if (components.length === due.components.length) return due;
  return { ...due, components };
}
