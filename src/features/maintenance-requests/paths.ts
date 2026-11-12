/** Phone wizard of the tenant. Separate from the existing portal list at `.../manutenzione`. */
export function tenantMaintenanceRequestPath(leaseId: string): string {
  return `/portale-conduttore/contratti/${encodeURIComponent(leaseId)}/richiesta-manutenzione`;
}

/** Landlord or agency decision screen for one lease. */
export function landlordMaintenancePath(leaseId: string): string {
  return `/app/long-rent/leases/${encodeURIComponent(leaseId)}/manutenzione`;
}
