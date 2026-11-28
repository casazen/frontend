import type { RentLedgerComponent } from '@/types';

const EXTRAORDINARY_KINDS = new Set(['Extraordinary', 'ExtraordinaryExpense', 'CondominiumExtraordinary']);

export function extraordinaryKept(part: { kind: string; accepted?: boolean | null }): boolean {
  if (!EXTRAORDINARY_KINDS.has(part.kind)) return true;
  return part.accepted === true;
}

export function withoutUnacceptedExtraordinary<T extends { components: RentLedgerComponent[] | null }>(due: T): T {
  if (!due.components) return due;
  const components = due.components.filter((part) => extraordinaryKept(part));
  if (components.length === due.components.length) return due;
  return { ...due, components };
}
