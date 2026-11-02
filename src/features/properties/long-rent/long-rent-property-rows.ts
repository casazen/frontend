import { useContext, useMemo } from 'react';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { parseStayDate, todayInRome } from '@/lib/stay-dates';
import type { LongRentPropertyStatus } from '@/lib/status-dictionary';
import { useLeases } from '@/queries/use-leases';
import { useLongRentPropertyAggregate } from '@/queries/use-long-rent-properties';
import { useProperties } from '@/queries/use-properties';
import type { LeaseSummary, LongRentPropertyAggregate, Property } from '@/types';

/** A property of Affitti lunghi with what its leases say about it. */
export interface LongRentPropertyRow {
  property: Property;
  /** `null` when the leases are not known (the person may not read them, or they did not load): then nothing is said of it. */
  status: LongRentPropertyStatus | null;
  /** The lease that holds the property now: registered and not ended. Its tenant is who lives there. */
  current: LeaseSummary | null;
  /** A lease on its way (not registered yet) of a property that has none in force: it is free, and this is who is coming. */
  preparing: LeaseSummary | null;
  /**
   * What the server says that the two lists do not (LR-07a): the APE, the cadastral data, the day the property is free again and the change of
   * mode programmed. `null` when it did not answer: the page then works without those words.
   */
  aggregate: LongRentPropertyAggregate | null;
}

/** Registered and not ended, the last day included: the same rule as the view `Active` of `GET /leases` (LR-01). */
export function isInForce(lease: LeaseSummary, today: string): boolean {
  return lease.status === 'Registered' && parseStayDate(lease.endDate) >= today;
}

/** Not registered yet and not rejected: draft, in signature, signed and waiting for the registration (the view `InPreparation`). */
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
      // A property the server says is let, whose lease this list does not have (read a moment apart): the rule below decides.
      if (aggregate.status !== 'Rented' || current) {
        return { property, status: aggregate.status === 'Rented' ? 'Rented' : 'Free', current, preparing, aggregate };
      }
    }

    const inForce = own.filter((lease) => isInForce(lease, today)).sort(startedLast);
    // A lease registered ahead (a renewal that starts next month) does not hold the property yet: the one that is running does.
    const current = inForce.find((lease) => parseStayDate(lease.startDate) <= today) ?? inForce[inForce.length - 1] ?? null;
    const preparing = current ? null : (own.filter(isInPreparation).sort(touchedLast)[0] ?? null);
    return { property, status: current ? 'Rented' : 'Free', current, preparing, aggregate };
  });
}

/**
 * The properties of Affitti lunghi with their state, from the lists the API has (`GET /properties?mode=long`, `GET /leases` and
 * `GET /long-rent/properties`, each one request: nothing is asked for each row). The leases are asked only of who may read them; if they are
 * missing or fail the properties are still shown, without a state (`leasesKnown` tells, `leasesFailed` says it is a failure). If the third one
 * fails the page works without the APE, the cadastral data and the "then free" it brings.
 * `fresh`: read again when the screen opens (the page of the list; the drawer reads what the list has just read).
 */
export function useLongRentPropertyRows({ fresh = false }: { fresh?: boolean } = {}) {
  // Read without `useWorkspace`, which refuses to run outside its provider: a drawer drawn on its own sees no leases.
  const workspace = useContext(WorkspaceContext);
  const canReadLeases = workspace?.hasPermission('long-rent', 'lease.read') ?? false;
  const properties = useProperties({ mode: 'long' }, { fresh });
  // The plain list of leases: the same request as the guide of the first steps, so it is one.
  const leases = useLeases(undefined, { refetchOnMount: fresh ? 'always' : undefined, enabled: canReadLeases });
  const aggregate = useLongRentPropertyAggregate({ fresh });
  // An answer that is not a list (the page of the app where an API answer should be) is a failed load, never an empty list.
  const loaded = Array.isArray(properties.data) ? properties.data : undefined;

  const rows = useMemo(
    () => (loaded ? longRentPropertyRows(loaded, leases.data, todayInRome(), aggregate.data) : undefined),
    [loaded, leases.data, aggregate.data],
  );

  return {
    rows,
    isLoading: properties.isLoading || leases.isLoading || aggregate.isLoading,
    isError: !loaded && (properties.isError || properties.data !== undefined),
    error: properties.error,
    refetch: () => void properties.refetch(),
    leasesKnown: leases.data !== undefined,
    leasesFailed: leases.isError && leases.data === undefined,
    refetchLeases: () => void leases.refetch(),
  };
}
