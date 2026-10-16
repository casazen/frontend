import { useContext, useMemo } from 'react';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { parseStayDate, todayInRome } from '@/lib/stay-dates';
import type { LongRentPropertyStatus } from '@/lib/status-dictionary';
import { useAllLeases } from '@/queries/use-leases';
import { useProperties } from '@/queries/use-properties';
import type { LeaseSummary, Property } from '@/types';

/**
 * A row of `GET /leases`. Since LR-01 it carries the first and the last name of the first tenant (never the fiscal code or the
 * e-mail); the shared `LeaseSummary` type names them with LR-02, until then they are named here.
 */
export type LeaseRow = LeaseSummary & {
  tenantFirstName?: string | null;
  tenantLastName?: string | null;
  tenantAnonymized?: boolean;
};

/** A property of Affitti lunghi with what its leases say about it. */
export interface LongRentPropertyRow {
  property: Property;
  /** `null` when the leases are not known (the person may not read them, or they did not load): then nothing is said of it. */
  status: LongRentPropertyStatus | null;
  /** The lease that holds the property now: registered and not ended. Its tenant is who lives there. */
  current: LeaseRow | null;
  /** A lease on its way (not registered yet) of a property that has none in force: it is free, and this is who is coming. */
  preparing: LeaseRow | null;
}

/** Registered and not ended, the last day included: the same rule as the view `Active` of `GET /leases` (LR-01). */
export function isInForce(lease: LeaseRow, today: string): boolean {
  return lease.status === 'Registered' && parseStayDate(lease.endDate) >= today;
}

/** Not registered yet and not rejected: draft, in signature, signed and waiting for the registration (the view `InPreparation`). */
export function isInPreparation(lease: LeaseRow): boolean {
  return lease.status !== 'Registered' && lease.status !== 'Rejected';
}

const startedLast = (a: LeaseRow, b: LeaseRow) => parseStayDate(b.startDate).localeCompare(parseStayDate(a.startDate));
const touchedLast = (a: LeaseRow, b: LeaseRow) => b.updatedAt.localeCompare(a.updatedAt);

/**
 * The properties with their state: let when a registered lease is in force, free otherwise (a lease still being prepared does not
 * make it let). Without the leases (`undefined`) no property has a state.
 */
export function longRentPropertyRows(properties: readonly Property[], leases: readonly LeaseRow[] | undefined, today: string): LongRentPropertyRow[] {
  if (!leases) return properties.map((property) => ({ property, status: null, current: null, preparing: null }));

  const byProperty = new Map<string, LeaseRow[]>();
  for (const lease of leases) byProperty.set(lease.propertyId, [...(byProperty.get(lease.propertyId) ?? []), lease]);

  return properties.map((property) => {
    const own = byProperty.get(property.id) ?? [];
    const inForce = own.filter((lease) => isInForce(lease, today)).sort(startedLast);
    // A lease registered ahead (a renewal that starts next month) does not hold the property yet: the one that is running does.
    const current = inForce.find((lease) => parseStayDate(lease.startDate) <= today) ?? inForce[inForce.length - 1] ?? null;
    const preparing = current ? null : (own.filter(isInPreparation).sort(touchedLast)[0] ?? null);
    return { property, status: current ? 'Rented' : 'Free', current, preparing };
  });
}

/**
 * The properties of Affitti lunghi with their state, from the two lists the API has (`GET /properties?mode=long` and
 * `GET /leases`, each one request: nothing is asked for each row). The leases are asked only of who may read them; if they are
 * missing or fail the properties are still shown, without a state (`leasesKnown` tells, `leasesFailed` says it is a failure).
 * `fresh`: read again when the screen opens (the page of the list; the drawer reads what the list has just read).
 */
export function useLongRentPropertyRows({ fresh = false }: { fresh?: boolean } = {}) {
  // Read without `useWorkspace`, which refuses to run outside its provider: a drawer drawn on its own sees no leases.
  const workspace = useContext(WorkspaceContext);
  const canReadLeases = workspace?.hasPermission('long-rent', 'lease.read') ?? false;
  const properties = useProperties({ mode: 'long' }, { fresh });
  const leases = useAllLeases({ fresh, enabled: canReadLeases });
  // An answer that is not a list (the page of the app where an API answer should be) is a failed load, never an empty list.
  const loaded = Array.isArray(properties.data) ? properties.data : undefined;

  const rows = useMemo(() => (loaded ? longRentPropertyRows(loaded, leases.data, todayInRome()) : undefined), [loaded, leases.data]);

  return {
    rows,
    isLoading: properties.isLoading || leases.isLoading,
    isError: !loaded && (properties.isError || properties.data !== undefined),
    error: properties.error,
    refetch: () => void properties.refetch(),
    leasesKnown: leases.data !== undefined,
    leasesFailed: leases.isError && leases.data === undefined,
    refetchLeases: () => void leases.refetch(),
  };
}
