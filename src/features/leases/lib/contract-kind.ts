import type { TFunction } from 'i18next';
import type { LeaseContractType, LongRentRules } from '@/types';

/** The type of contract that is asked first (`?tipo=`): what is asked next, and how the contract is made, depend on it. */
export const CONTRACT_KINDS = ['concordato', 'libero', 'transitorio'] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/**
 * The name of a kind on its card and under the title of the page. The transitory one says its term, and the term is the server's
 * (`transitoryTermMonths` of `GET /long-rent/rules`): it is not written in the interface. While the rules are not there (they load, or
 * they could not be read) it is the bare name.
 */
export function kindTitle(kind: ContractKind, rules: LongRentRules | undefined, t: TFunction): string {
  if (kind === 'transitorio' && rules) {
    return t('leaseRound.kind.transitorio.title', { min: rules.transitoryTermMonths.min, max: rules.transitoryTermMonths.max });
  }
  return t(`leaseWizard.start.kind.${kind}.title`);
}

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
