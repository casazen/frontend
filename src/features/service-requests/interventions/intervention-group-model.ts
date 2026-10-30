import type { ServiceRequestGroup, ServiceRequestGroupMember } from '@/types/service-request';

/**
 * Where the group of backup suppliers of a request stands, for its host (SP-BKP), in the words the locale files use
 * (`interventions.group.stage.<stage>`): the chosen supplier has its hour (`primaryWindow`), the job is free for whoever accepts first
 * (`backupWindow`), the chosen supplier took it (`primaryTookIt`), a backup took it (`backupTookIt`), nobody did (`nobody`), the host
 * cancelled (`cancelled`), or the group is over for a reason this version does not know (`over`).
 */
export type GroupStage = 'primaryWindow' | 'backupWindow' | 'primaryTookIt' | 'backupTookIt' | 'nobody' | 'cancelled' | 'over';

/** What a backup request closed by CasaZen says (`cancellationReason`), by the word of the locale files. */
const CANCEL_STATES: Readonly<Record<string, MemberState>> = {
  NoResponse: 'noResponse',
  PrimaryTookIt: 'primaryTookIt',
  TakenByBackup: 'takenByBackup',
  RequestCancelledByHost: 'cancelledByHost',
  BackupSlotUnavailable: 'slotUnavailable',
};

/** What one supplier of the group is doing (`interventions.group.state.<state>`). */
export type MemberState =
  | 'tookTheJob'
  | 'accepted'
  | 'waiting'
  | 'refused'
  | 'noResponse'
  | 'primaryTookIt'
  | 'takenByBackup'
  | 'cancelledByHost'
  | 'slotUnavailable'
  | 'cancelled'
  | 'unknown';

/** The roles the host is told in words (`interventions.group.role.<role>`); a role this version does not know is shown with no role. */
export const KNOWN_ROLES: ReadonlySet<string> = new Set(['Primary', 'Backup', 'ReplacedPrimary', 'PromotedBackup']);

export function groupStageOf(group: ServiceRequestGroup): GroupStage {
  if (group.phase === 'PrimaryWindow') return 'primaryWindow';
  if (group.phase === 'BackupWindow') return 'backupWindow';
  if (group.phase !== 'Closed') return 'over';

  const taker = group.members.find((member) => member.tookTheJob);
  if (taker) return taker.role === 'PromotedBackup' ? 'backupTookIt' : 'primaryTookIt';
  if (group.members.some((member) => member.cancellationReason === 'RequestCancelledByHost')) return 'cancelled';
  return group.members.some((member) => member.cancellationReason === 'NoResponse') ? 'nobody' : 'over';
}

/** What a supplier of the group is doing now: it took the job, said it would take it, waits, refused, or was closed (and why). */
export function memberStateOf(member: Pick<ServiceRequestGroupMember, 'tookTheJob' | 'status' | 'acceptedAt' | 'cancellationReason'>): MemberState {
  if (member.tookTheJob) return 'tookTheJob';
  switch (member.status) {
    case 'Richiesto':
      return member.acceptedAt ? 'accepted' : 'waiting';
    case 'Rifiutato':
      return 'refused';
    case 'Annullato': {
      const reason = member.cancellationReason ?? '';
      return Object.prototype.hasOwnProperty.call(CANCEL_STATES, reason) ? CANCEL_STATES[reason] : 'cancelled';
    }
    default:
      return 'unknown';
  }
}

/** The supplier the host chose (still the one even when it was replaced), or null for a group that has no such member. */
export function chosenSupplierOf(group: ServiceRequestGroup): ServiceRequestGroupMember | null {
  return group.members.find((member) => member.role === 'Primary' || member.role === 'ReplacedPrimary') ?? null;
}

/** The supplier that has the job, or null while nobody has it. */
export function takerOf(group: ServiceRequestGroup): ServiceRequestGroupMember | null {
  return group.members.find((member) => member.tookTheJob) ?? null;
}

/** Until when the window the group is in lasts: the chosen supplier's hour, or the second window; null once the group is over. */
export function groupDueAt(group: ServiceRequestGroup): string | null {
  if (group.phase === 'PrimaryWindow') return group.primaryDueAt;
  return group.phase === 'BackupWindow' ? (group.backupDueAt ?? null) : null;
}
