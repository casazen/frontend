export function documentsUploadPath(leaseId: string): string {
  return `/app/long-rent/documents/upload?leaseId=${encodeURIComponent(leaseId)}`;
}

export const LEASE_CONFIRMED_STATE = { leaseConfirmed: true } as const;

export function isLeaseConfirmed(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { leaseConfirmed?: unknown }).leaseConfirmed === true;
}
