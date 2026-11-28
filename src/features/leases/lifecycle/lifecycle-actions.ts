import { todayInRome } from '@/lib/stay-dates';
import type { LeaseDetail, LeaseStage } from '@/types';
import { leaseNotBegun } from './lifecycle-format';

export const LEASE_ACTION_PARAM = 'azione';

export const LEASE_ACTIONS = [
  'elimina-bozza',
  'annulla-firma',
  'disdetta',
  'togli-disdetta',
  'termina',
  'passa-a-breve',
  'cancellazione-dati',
] as const;
export type LeaseAction = (typeof LEASE_ACTIONS)[number];

export function leaseActionOf(param: string | null): LeaseAction | null {
  return param !== null && (LEASE_ACTIONS as readonly string[]).includes(param) ? (param as LeaseAction) : null;
}

export interface LeaseActionContext {
  stage: LeaseStage | undefined;
  canManage: boolean;
  canChangeMode: boolean;
  today?: string;
}

export type LeaseActionAvailability = Readonly<Record<LeaseAction, boolean>>;

/**
 * What can be done to a lease now. The stage is the server's (the menu follows it, it does not work it out), and the dates and the notice
 * come from the lease itself; the server is the last word on every action and says no with a code the interface turns into a sentence.
 *
 * - a draft (in progress or in review) can be deleted; once downloaded for the signature on paper it can first be taken back;
 * - a lease in force (active or in expiry) can receive a notice while it has none and its type renews by itself, and can be ended early
 *   while it is not ended already and has begun (a lease whose first day has not come cannot be ended early, only a consensual
 *   resolution cancels it: LR-TERM); a lease in expiry can move on to short rent, and the notice it has can be taken back (the server
 *   allows it while the period has not ended, which is what "in expiry" with a notice means: after it the lease is concluded);
 * - a lease that has concluded has no action that destroys anything; the data of its parties can be erased at any stage.
 */
export function availableLeaseActions(
  lease: LeaseDetail,
  { stage, canManage, canChangeMode, today = todayInRome() }: LeaseActionContext,
): LeaseActionAvailability {
  const isDraft = lease.status === 'Draft';
  const inForce = stage === 'Active' || stage === 'Expiring';

  return {
    'elimina-bozza': canManage && isDraft && (stage === 'Draft' || stage === 'InReview'),
    'annulla-firma': canManage && isDraft && stage === 'SentForSignature' && Boolean(lease.sentForSignatureAt),
    disdetta: canManage && inForce && !lease.noticeOn && !lease.terminatedOn && lease.renewalMonths !== 0,
    'togli-disdetta': canManage && stage === 'Expiring' && Boolean(lease.noticeOn) && !lease.terminatedOn,
    termina: canManage && inForce && !lease.terminatedOn && !leaseNotBegun(lease, today),
    'passa-a-breve': canChangeMode && stage === 'Expiring',
    'cancellazione-dati': canManage,
  };
}
