import { describe, expect, it } from 'vitest';
import type { OrgRole } from '@/types/org-team.types';
import type { PersonRow } from '../people-rows';
import { personActions } from '../person-actions-model';

function row(over: Partial<PersonRow>): PersonRow {
  return {
    key: 'm-1',
    kind: 'member',
    id: '1',
    name: 'Marta Esposito',
    email: 'marta@example.com',
    role: 'Collaborator',
    areas: ['short-rent'],
    propertyScope: 'All',
    status: 'Active',
    isMe: false,
    since: '2026-10-01T10:00:00Z',
    deactivatedAt: null,
    expiresAt: null,
    invitedByName: null,
    propertyCount: 0,
    ...over,
  };
}

const owner: OrgRole = 'Owner';
const admin: OrgRole = 'Admin';

/** The rules the backend enforces (`OrgTeamRules`): the screen must not offer what it will refuse, and must offer what it will accept. */
describe('personActions', () => {
  it('personActions_Owner_IsNeverTouchedByAnyone', () => {
    for (const caller of [owner, admin]) {
      const actions = personActions(row({ role: 'Owner' }), caller);
      expect(Object.values({ ...actions, locked: null }).some(Boolean)).toBe(false);
      expect(actions.locked).toBe('owner');
    }
  });

  it('personActions_Oneself_HasNoActions', () => {
    const actions = personActions(row({ role: 'Admin', isMe: true }), owner);
    expect(actions.changeRole || actions.deactivate || actions.editAccess).toBe(false);
    expect(actions.locked).toBe('me');
  });

  it('personActions_AdministratorWhenTheCallerIsNotTheOwner_IsLockedForMembersAndInvitations', () => {
    const member = personActions(row({ role: 'Admin' }), admin);
    expect(member).toMatchObject({ changeRole: false, deactivate: false, editAccess: false, locked: 'admin' });

    const invitation = personActions(row({ kind: 'invitation', role: 'Admin', status: 'Pending' }), admin);
    expect(invitation).toMatchObject({ resend: false, revoke: false, copyLink: false, locked: 'admin' });
  });

  it('personActions_AdministratorWhenTheCallerIsTheOwner_CanBeChangedAndSwitchedOffButHasNoAreasToChoose', () => {
    expect(personActions(row({ role: 'Admin' }), owner)).toMatchObject({ changeRole: true, deactivate: true, editAccess: false, locked: null });
    expect(personActions(row({ kind: 'invitation', role: 'Admin', status: 'Pending' }), owner)).toMatchObject({ resend: true, revoke: true });
  });

  it('personActions_ActiveCollaboratorOrAccountant_CanBeChangedWithAreasAndSwitchedOff', () => {
    for (const role of ['PropertyManager', 'Collaborator', 'Accountant'] as const) {
      expect(personActions(row({ role }), admin)).toMatchObject({ changeRole: true, editAccess: true, deactivate: true, reactivate: false });
    }
  });

  it('personActions_DeactivatedMember_CanOnlyBeBroughtBack', () => {
    expect(personActions(row({ status: 'Deactivated' }), admin)).toMatchObject({
      reactivate: true,
      changeRole: false,
      editAccess: false,
      deactivate: false,
    });
  });

  it('personActions_Invitation_CanBeSentAgainAndWithdrawnAndItsLinkCopiedOnlyWhileOpen', () => {
    expect(personActions(row({ kind: 'invitation', status: 'Pending' }), admin)).toMatchObject({ resend: true, copyLink: true, revoke: true, changeRole: false });
    expect(personActions(row({ kind: 'invitation', status: 'Expired' }), admin)).toMatchObject({ resend: true, copyLink: false, revoke: true });
  });

  it('personActions_UnknownCaller_IsTreatedAsAnAdministrator', () => {
    expect(personActions(row({ role: 'Admin' }), null)).toMatchObject({ changeRole: false, locked: 'admin' });
  });
});
