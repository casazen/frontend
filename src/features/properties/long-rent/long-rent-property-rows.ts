import { useMemo } from 'react';
import { parseStayDate, todayInRome } from '@/lib/stay-dates';
import type { LongRentPropertyStatus } from '@/lib/status-dictionary';
import { useLeases } from '@/queries/use-leases';
import { useLongRentPropertyAggregate } from '@/queries/use-long-rent-properties';
import { useProperties } from '@/queries/use-properties';
import type { LeaseSummary, LongRentPropertyAggregate, Property } from '@/types';

export interface LongRentPropertyRow {
  property: Property;
  status: LongRentPropertyStatus | null;
  current: LeaseSummary | null;
  preparing: LeaseSummary | null;
  aggregate: LongRentPropertyAggregate | null;
}

export function isInForce(lease: LeaseSummary, today: string): boolean {
  return lease.status === 'Registered' && parseStayDate(lease.endDate) >= today;
}

export function isInPreparation(lease: LeaseSummary): boolean {
  return lease.status !== 'Registered' && lease.status !== 'Rejected';
}

const startedLast = (a: LeaseSummary, b: LeaseSummary) => parseStayDate(b.startDate).localeCompare(parseStayDate(a.startDate));
const touchedLast = (a: LeaseSummary, b: LeaseSummary) => b.updatedAt.localeCompare(a.updatedAt);

/**
 * The properties with their state: let when a registered lease is in force, free otherwise (a lease still being prepared does not
 * make it let). Without the leases (`undefined`) no property has a state.
 *
 * The server decides which lease holds a property when it answers (`aggregates`, LR-07a: a lease that renewed by itself still holds it, which
 * the first end date of its contract does not say); the lease it names is found in the list of leases. Without its answer, or with a lease the
 * list does not have, the rule of the list of leases is applied as it always was.
 */
export function longRentPropertyRows(
  properties: readonly Property[],
  leases: readonly LeaseSummary[] | undefined,
  today: string,
  aggregates?: readonly LongRentPropertyAggregate[],
): LongRentPropertyRow[] {
  const aggregateOf = new Map((aggregates ?? []).map((aggregate) => [aggregate.id, aggregate]));
  if (!leases) {
    return properties.map((property) => ({ property, status: null, current: null, preparing: null, aggregate: aggregateOf.get(property.id) ?? null }));
  }

  const byProperty = new Map<string, LeaseSummary[]>();
  for (const lease of leases) byProperty.set(lease.propertyId, [...(byProperty.get(lease.propertyId) ?? []), lease]);

  return properties.map((property) => {
    const aggregate = aggregateOf.get(property.id) ?? null;
    const own = byProperty.get(property.id) ?? [];

    if (aggregate?.status) {
      const current = own.find((lease) => lease.id === aggregate.currentLease?.leaseId) ?? null;
      const preparing = current ? null : (own.find((lease) => lease.id === aggregate.preparingLease?.leaseId) ?? null);
      if (aggregate.status !== 'Rented' || current) {
        return { property, status: aggregate.status === 'Rented' ? 'Rented' : 'Free', current, preparing, aggregate };
      }
    }

    const inForce = own.filter((lease) => isInForce(lease, today)).sort(startedLast);
    const current = inForce.find((lease) => parseStayDate(lease.startDate) <= today) ?? inForce[inForce.length - 1] ?? null;
    const preparing = current ? null : (own.filter(isInPreparation).sort(touchedLast)[0] ?? null);
    return { property, status: current ? 'Rented' : 'Free', current, preparing, aggregate };
  });
}

export function useLongRentPropertyRows({ canReadLeases, fresh = false }: { canReadLeases: boolean; fresh?: boolean }) {
  const properties = useProperties({ mode: 'long' }, { fresh });
  const leases = useLeases(undefined, { refetchOnMount: fresh ? 'always' : undefined, enabled: canReadLeases });
  const aggregate = useLongRentPropertyAggregate({ fresh, canReadLeases });
  const visibleLeases = canReadLeases ? leases.data : undefined;
  const loaded = Array.isArray(properties.data) ? properties.data : undefined;

  const rows = useMemo(
    () => (loaded ? longRentPropertyRows(loaded, visibleLeases, todayInRome(), aggregate.data) : undefined),
    [loaded, visibleLeases, aggregate.data],
  );

  return {
    rows,
    isLoading: properties.isLoading || leases.isLoading || aggregate.isLoading,
    isError: !loaded && (properties.isError || properties.data !== undefined),
    error: properties.error,
    refetch: () => void properties.refetch(),
    leasesKnown: visibleLeases !== undefined,
    leasesFailed: canReadLeases && leases.isError && leases.data === undefined,
    refetchLeases: () => void leases.refetch(),
  };
}
