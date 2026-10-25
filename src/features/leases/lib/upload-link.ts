/** The page where the documents of a contract are uploaded (`LeaseDocumentsUploadPage`), for that contract. */
export function documentsUploadPath(leaseId: string): string {
  return `/app/long-rent/documents/upload?leaseId=${encodeURIComponent(leaseId)}`;
}

/**
 * What a link of the app, or the confirmation itself, leaves in the state of the history entry (CF-FIX-FU4): the person chose THIS
 * contract (the sheet, its Documents tab, the list of contracts of the page) or has confirmed it. A link from outside (the button of the
 * e-mail of the service, an old link with only `leaseId`) arrives without it, and the page asks first: the link says which contract, the
 * person has not. The history entry keeps it through a reload.
 */
export const LEASE_CONFIRMED_STATE = { leaseConfirmed: true } as const;

/** True when the history entry says the contract was chosen or confirmed by the person. */
export function isLeaseConfirmed(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { leaseConfirmed?: unknown }).leaseConfirmed === true;
}
