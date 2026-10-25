import type { TFunction } from 'i18next';
import { getPlanTierLabel } from '@/lib/i18n-labels';
import type { OrgActivityEntry } from '@/types/org-team.types';
import { orgRoleLabel } from './account-roles';

export interface PhraseContext {
  t: TFunction;
  /** The name of the member with this account id, or `undefined` when the person is not (any more) in the team. */
  memberName: (userId: string) => string | undefined;
}

/**
 * The sentence of one line of the activity log, without who did it (the list shows the person under it). The log holds codes and
 * ids and never a name, so the sentence is composed here from the type of the event and what its ids and details say. The events
 * of the people have their words; every other one gets the generic sentence until the page that shows it (the log) writes its own.
 */
export function activityPhrase(entry: OrgActivityEntry, { t, memberName }: PhraseContext): string {
  const { details } = entry;
  const member = () => memberName(entry.subjectId) ?? t('account.activity.formerMember');
  const role = (code: string | undefined) => orgRoleLabel(code, t);

  switch (entry.type) {
    case 'MemberInvited':
      return t('account.activity.memberInvited', { role: role(details.role) });
    case 'InvitationRevoked':
      return t('account.activity.invitationRevoked', { role: role(details.role) });
    case 'InvitationAccepted':
      return t('account.activity.invitationAccepted', { role: role(details.role) });
    case 'MemberRoleChanged':
      return t('account.activity.memberRoleChanged', { member: member(), from: role(details.fromRole), to: role(details.toRole) });
    case 'MemberDeactivated':
      return t('account.activity.memberDeactivated', { member: member() });
    case 'MemberReactivated':
      return t('account.activity.memberReactivated', { member: member() });
    case 'MemberRemoved':
      return t('account.activity.memberRemoved', { member: member() });
    case 'MemberPropertyAccessChanged':
      return t('account.activity.memberPropertyAccessChanged', { member: member() });
    case 'MemberAreasChanged':
      return t('account.activity.memberAreasChanged', { member: member() });
    case 'AccessRequested':
      return t('account.activity.accessRequested');
    case 'PlanChanged':
      return t('account.activity.planChanged', { from: getPlanTierLabel(details.fromTier ?? '', t), to: getPlanTierLabel(details.toTier ?? '', t) });
    case 'AdminGrantedConcordatoFacileGift':
      // The administrator of the platform gave the org a complimentary practice of the guided contract (CF-END): no name of the supplier.
      return t('leaseRound.activity.adminGrantedGift');
    default:
      return t('account.activity.other');
  }
}
