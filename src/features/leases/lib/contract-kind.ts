import type { LeaseContractType } from '@/types';

/** The type of contract that is asked first (`?tipo=`): what is asked next, and how the contract is made, depend on it. */
export const CONTRACT_KINDS = ['concordato', 'libero', 'transitorio'] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/**
 * How the contract comes to be (`?come=`): prepared in CasaZen with the wizard (`casazen`), from documents the person already has
 * (`documenti`, a contract already signed), or, for a canone concordato only, from zero with the partner (`zero`, ConcordatoFacile).
 */
export type StartWay = 'casazen' | 'documenti' | 'zero';

/** The type as the server names it. */
export const TYPE_OF_KIND: Record<ContractKind, LeaseContractType> = {
  concordato: 'Concordato',
  libero: 'Libero',
  transitorio: 'Transitorio',
};

/** The ways each kind offers, in the order they are shown: a canone concordato is never prepared in the wizard, the others are not made from zero. */
export function waysOf(kind: ContractKind): readonly StartWay[] {
  return kind === 'concordato' ? ['documenti', 'zero'] : ['casazen', 'documenti'];
}

/** The kind named in the address (`?tipo=`), or null when the question was not answered yet. `altro`, the old name of the libero, opens it. */
export function contractKindOf(value: string | null): ContractKind | null {
  if (value === 'altro') return 'libero';
  return CONTRACT_KINDS.find((kind) => kind === value) ?? null;
}

/**
 * The way named in the address (`?come=`; the old `?origine=importato` means `documenti`) if it is one the kind offers, else null:
 * the question was not answered yet.
 */
export function startWayOf(kind: ContractKind, come: string | null, origine: string | null): StartWay | null {
  const wanted = come ?? (origine === 'importato' ? 'documenti' : null);
  return waysOf(kind).find((way) => way === wanted) ?? null;
}
