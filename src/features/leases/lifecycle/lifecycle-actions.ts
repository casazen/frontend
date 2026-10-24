import type { LeaseDetail, LeaseStage } from '@/types';

/** The parameter of the address that opens an action on the sheet of a lease: `?azione=disdetta`. */
export const LEASE_ACTION_PARAM = 'azione';

/**
 * The actions of the life of a lease (LR-10), as the address names them (`?azione=`). A name never changes (a link, an e-mail, another
 * page of the area may point at it), it is only added to.
 */
export const LEASE_ACTIONS = [
  'elimina-bozza',
  'annulla-firma',
  'disdetta',
  'termina',
  'passa-a-breve',
  'cancellazione-dati',
] as const;
export type LeaseAction = (typeof LEASE_ACTIONS)[number];

/** The action an address asks for, or `null` for none and for a name this version does not know. */
export function leaseActionOf(param: string | null): LeaseAction | null {
  return param !== null && (LEASE_ACTIONS as readonly string[]).includes(param) ? (param as LeaseAction) : null;
}

export interface LeaseActionContext {
  /** Where the lease stands on its path, as the server says it (`useLeaseStage`); `undefined` while it is not known. */
  stage: LeaseStage | undefined;
  /** The person may write the leases (`lease.create`): what every action asks, the server too. */
  canManage: boolean;
  /** The person may change the mode of the property (`property.write`) and the page that does it exists. */
  canChangeMode: boolean;
}

export type LeaseActionAvailability = Readonly<Record<LeaseAction, boolean>>;

/**
 * What can be done to a lease now. The stage is the server's (the menu follows it, it does not work it out), and the dates and the notice
 * come from the lease itself; the server is the last word on every action and says no with a code the interface turns into a sentence.
 *
 * - a draft (in progress or in review) can be deleted; once downloaded for the signature on paper it can first be taken back;
 * - a lease in force (active or in expiry) can receive a notice while it has none and its type renews by itself, and can be ended early
 *   while it is not ended already; a lease in expiry can move on to short rent;
 * - a lease that has concluded has no action that destroys anything; the data of its parties can be erased at any stage.
 */
export function availableLeaseActions(lease: LeaseDetail, { stage, canManage, canChangeMode }: LeaseActionContext): LeaseActionAvailability {
  const isDraft = lease.status === 'Draft';
  const inForce = stage === 'Active' || stage === 'Expiring';

  return {
    'elimina-bozza': canManage && isDraft && (stage === 'Draft' || stage === 'InReview'),
    'annulla-firma': canManage && isDraft && stage === 'SentForSignature' && Boolean(lease.sentForSignatureAt),
    disdetta: canManage && inForce && !lease.noticeOn && !lease.terminatedOn && lease.renewalMonths !== 0,
    termina: canManage && inForce && !lease.terminatedOn,
    'passa-a-breve': canChangeMode && stage === 'Expiring',
    'cancellazione-dati': canManage,
  };
}
