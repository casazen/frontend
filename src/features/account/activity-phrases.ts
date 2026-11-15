import type { TFunction } from 'i18next';
import { getPlanTierLabel } from '@/lib/i18n-labels';
import type { OrgActivityEntry } from '@/types/org-team.types';
import { orgRoleLabel } from './account-roles';

/** The credentials of the support vault a line of the log can name (`SupportVaultRules.CodeOf`), and the statuses support gives a request: closed lists, so a code this page does not know is never shown raw. */
const ASSIST_CREDENTIALS: ReadonlySet<string> = new Set(['panel', 'police', 'regionalIstat']);
const ASSIST_STATUSES: ReadonlySet<string> = new Set(['inProgress', 'done', 'cancelled']);

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
/** True when `key` has a text: the translation of a missing key is the key itself. */
function i18nHas(t: TFunction, key: string): boolean {
  return t(key, { defaultValue: '' }) !== '';
}

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
    case 'OrgSettingsChanged':
      // The data of the company changed (AM-08b-b): the log holds the fact, never what the legal name, the office, the phone or the language became.
      return t('account.activity.orgSettingsChanged');
    case 'AdminGrantedConcordatoFacileGift':
      // The administrator of the platform gave the org a complimentary practice of the guided contract (CF-END): no name of the supplier.
      return t('leaseRound.activity.adminGrantedGift');
    case 'OnboardingAssistRequested':
      // The host asked CasaZen support to do a step, or reopened a request support had closed («Non funziona», E20/F03/US01/T02): the line holds the part and the context, never the note.
      return t('account.activity.assistRequested');
    case 'OnboardingAssistUpdated': {
      // Support took, closed or cancelled a request, or OPENED A CREDENTIAL of the support vault for it (E20/F03/US01/T01): the host reads which one was used, never its value or the reason.
      const credential = details.credential ?? '';
      if (credential !== '') return ASSIST_CREDENTIALS.has(credential) ? t(`account.activity.assistCredential.${credential}`) : t('account.activity.other');
      const status = details.status ?? '';
      return ASSIST_STATUSES.has(status) ? t(`account.activity.assistStatus.${status}`) : t('account.activity.other');
    }
    case 'PropertyActivatedWithReminders': {
      // A property activated with the documents or the safety sheet still to complete, acknowledged by the host (PO decision 2026-11-01).
      // The detail is `documents`, `safety` or `documents.safety`: each has its words; anything else gets the generic sentence.
      const key = `account.activity.reminder.${(details.reminders ?? '').replace('.', '_')}`;
      return i18nHas(t, key)
        ? t('account.activity.propertyActivatedWithReminders', { reminders: t(key) })
        : t('account.activity.other');
    }
    default:
      return t('account.activity.other');
  }
}
