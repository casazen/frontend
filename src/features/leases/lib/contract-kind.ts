import type { TFunction } from 'i18next';
import type { LeaseContractType, LongRentRules } from '@/types';

export const CONTRACT_KINDS = ['concordato', 'libero', 'transitorio'] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

export function kindTitle(kind: ContractKind, rules: LongRentRules | undefined, t: TFunction): string {
  if (kind === 'transitorio' && rules) {
    return t('leaseRound.kind.transitorio.title', { min: rules.transitoryTermMonths.min, max: rules.transitoryTermMonths.max });
  }
  return t(`leaseWizard.start.kind.${kind}.title`);
}

export type StartWay = 'casazen' | 'documenti' | 'zero';

export const TYPE_OF_KIND: Record<ContractKind, LeaseContractType> = {
  concordato: 'Concordato',
  libero: 'Libero',
  transitorio: 'Transitorio',
};

export function waysOf(kind: ContractKind): readonly StartWay[] {
  return kind === 'concordato' ? ['documenti', 'zero'] : ['casazen', 'documenti'];
}

export function contractKindOf(value: string | null): ContractKind | null {
  if (value === 'altro') return 'libero';
  return CONTRACT_KINDS.find((kind) => kind === value) ?? null;
}

export function startWayOf(kind: ContractKind, come: string | null, origine: string | null): StartWay | null {
  const wanted = come ?? (origine === 'importato' ? 'documenti' : null);
  return waysOf(kind).find((way) => way === wanted) ?? null;
}
