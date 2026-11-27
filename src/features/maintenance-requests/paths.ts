export function tenantMaintenanceRequestPath(leaseId: string): string {
  return `/portale-conduttore/contratti/${encodeURIComponent(leaseId)}/richiesta-manutenzione`;
}

export function landlordMaintenancePath(leaseId: string): string {
  return `/app/long-rent/leases/${encodeURIComponent(leaseId)}/manutenzione`;
}
