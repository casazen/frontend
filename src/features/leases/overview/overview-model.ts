import type { LongRentDeadline, LongRentLeaseCounters } from '@/types';

/**
 * What the overview (LR-05) reads from the numbers of the server, and nothing it works out: the leases by group, as the quick
 * filters of the list of leases name them, and the dates that are not rents.
 */

/** Dates shown in the overview: a few, because the whole agenda is one click away. */
const UPCOMING_LIMIT = 4;

export interface ContractGroup {
  /** The id of the quick filter of the list of leases that shows these leases (`?chip=`). */
  chip: 'active' | 'preparing' | 'expiring' | 'ended';
  count: number;
  /** The key of its name (the one the list of leases gives its quick filter). */
  labelKey: string;
}

/**
 * The four groups of leases, in the order of the quick filters of the list: the active ones (the ones about to end are among
 * them), those still in preparation, those about to end, and the ended ones.
 */
export function contractGroups(leases: LongRentLeaseCounters): ContractGroup[] {
  return [
    { chip: 'active', count: leases.active, labelKey: 'leaseList.chips.active' },
    { chip: 'preparing', count: leases.inPreparation, labelKey: 'leaseList.chips.preparing' },
    { chip: 'expiring', count: leases.expiring, labelKey: 'leaseList.chips.expiring' },
    { chip: 'ended', count: leases.ended, labelKey: 'leaseList.chips.ended' },
  ];
}

/** How many leases there are in all: the groups that do not overlap (those about to end are already among the active ones). */
export function contractsTotal(leases: LongRentLeaseCounters): number {
  return leases.active + leases.inPreparation + leases.ended;
}

/** The dates for the overview: the rents are in its numbers, so they are left out; the earliest first, the late ones with them. */
export function upcomingDeadlines(items: readonly LongRentDeadline[]): LongRentDeadline[] {
  return items.filter((item) => item.type !== 'Rent').slice(0, UPCOMING_LIMIT);
}
