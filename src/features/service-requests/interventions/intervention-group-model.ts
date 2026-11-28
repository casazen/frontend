import type { ServiceRequestGroup, ServiceRequestGroupMember } from '@/types/service-request';

export type GroupStage = 'primaryWindow' | 'backupWindow' | 'primaryTookIt' | 'backupTookIt' | 'nobody' | 'cancelled' | 'over';

const CANCEL_STATES: Readonly<Record<string, MemberState>> = {
  NoResponse: 'noResponse',
  PrimaryTookIt: 'primaryTookIt',
  TakenByBackup: 'takenByBackup',
  RequestCancelledByHost: 'cancelledByHost',
  BackupSlotUnavailable: 'slotUnavailable',
  BackupRaceClosed: 'raceClosed',
};

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
  | 'raceClosed'
  | 'cancelled'
  | 'unknown';

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

export function chosenSupplierOf(group: ServiceRequestGroup): ServiceRequestGroupMember | null {
  return group.members.find((member) => member.role === 'Primary' || member.role === 'ReplacedPrimary') ?? null;
}

export function takerOf(group: ServiceRequestGroup): ServiceRequestGroupMember | null {
  return group.members.find((member) => member.tookTheJob) ?? null;
}

export function groupDueAt(group: ServiceRequestGroup): string | null {
  if (group.phase === 'PrimaryWindow') return group.primaryDueAt;
  return group.phase === 'BackupWindow' ? (group.backupDueAt ?? null) : null;
}
