import type { LongRentDeadline, LongRentLeaseCounters } from '@/types';

/** Dates shown in the overview: a few, because the whole agenda is one click away. */
const UPCOMING_LIMIT = 4;

export interface ContractGroup {
  chip: 'active' | 'preparing' | 'expiring' | 'ended';
  count: number;
  labelKey: string;
}

export function contractGroups(leases: LongRentLeaseCounters): ContractGroup[] {
  return [
    { chip: 'active', count: leases.active, labelKey: 'leaseList.chips.active' },
    { chip: 'preparing', count: leases.inPreparation, labelKey: 'leaseList.chips.preparing' },
    { chip: 'expiring', count: leases.expiring, labelKey: 'leaseList.chips.expiring' },
    { chip: 'ended', count: leases.ended, labelKey: 'leaseList.chips.ended' },
  ];
}

export function contractsTotal(leases: LongRentLeaseCounters): number {
  return leases.active + leases.inPreparation + leases.ended;
}

export function upcomingDeadlines(items: readonly LongRentDeadline[]): LongRentDeadline[] {
  return items.filter((item) => item.type !== 'Rent').slice(0, UPCOMING_LIMIT);
}
