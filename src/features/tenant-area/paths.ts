export const TENANT_AREA_PATH = '/portale-conduttore';

export function tenantContractPath(leaseId: string): string {
  return `${TENANT_AREA_PATH}/contratti/${encodeURIComponent(leaseId)}`;
}

export function tenantDuesPath(leaseId: string, dueId?: string): string {
  const base = `${tenantContractPath(leaseId)}/scadenze`;
  return dueId ? `${base}/${encodeURIComponent(dueId)}` : base;
}

export function tenantDocumentsPath(leaseId: string): string {
  return `${tenantContractPath(leaseId)}/documenti`;
}

export function tenantMaintenancePath(leaseId: string, requestId?: string): string {
  const base = `${tenantContractPath(leaseId)}/manutenzione`;
  if (!requestId) return base;
  return requestId === 'nuova' ? `${base}/nuova` : `${base}/${encodeURIComponent(requestId)}`;
}
