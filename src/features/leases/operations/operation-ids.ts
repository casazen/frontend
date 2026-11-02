/**
 * The operations of a lease in force (LR-OPS-1), as the address names them: `?operazione=disdetta` opens the window of the operation on the
 * sheet, from the advice of the guide, from the step «Cosa devi fare ora» or from a link anywhere. A name never changes (a link may point
 * at it), it is only added to. This file has no import on purpose: the catalogue of the advice and the table of the steps both name an
 * operation, and neither may pull the windows in.
 */
export const LEASE_OPERATION_PARAM = 'operazione';

export const LEASE_OPERATIONS = ['disdetta', 'recesso', 'rinnovo', 'conferma-esigenza', 'istat', 'cedolare', 'riconsegna', 'cauzione'] as const;
export type LeaseOperationId = (typeof LEASE_OPERATIONS)[number];

/** The operation an address asks for, or `null` for none and for a name this version does not know. */
export function leaseOperationOf(param: string | null): LeaseOperationId | null {
  return param !== null && (LEASE_OPERATIONS as readonly string[]).includes(param) ? (param as LeaseOperationId) : null;
}
