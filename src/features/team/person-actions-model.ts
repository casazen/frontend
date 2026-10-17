import type { OrgRole } from '@/types/org-team.types';
import type { PersonRow } from './people-rows';

/** Why a person has no actions for the one who looks, when it is worth a line: the owner, the person itself, an administrator. */
export type ActionsLockedBy = 'owner' | 'me' | 'admin';

/** What the one who looks may do to a person of the list. */
export interface PersonActions {
  changeRole: boolean;
  /** Areas and properties. */
  editAccess: boolean;
  deactivate: boolean;
  reactivate: boolean;
  resend: boolean;
  copyLink: boolean;
  revoke: boolean;
  locked: ActionsLockedBy | null;
}

const NONE: PersonActions = {
  changeRole: false,
  editAccess: false,
  deactivate: false,
  reactivate: false,
  resend: false,
  copyLink: false,
  revoke: false,
  locked: null,
};

/**
 * What `callerRole` (the owner or an administrator: the page is behind `org.members.manage`) may do to `row`. The backend decides
 * (`OrgTeamRules`, with a stable code for each refusal); this only keeps the screen from offering what it will refuse:
 *  - the owner is never touched (409 `org_last_owner`), and nobody touches themselves from here (an administrator would be refused, the
 *    owner too, and the others cannot be there);
 *  - an administrator, a member or an invitation, is in the hands of the owner alone (403 `org_owner_required`);
 *  - a deactivated member can only be brought back; an invitation can be sent again or withdrawn, and its link copied while it is open;
 *  - the areas and properties of an administrator are not chosen (it sees everything): to limit it, change the role first;
 *  - `callerRole` unknown (the list has not been read yet) is treated as an administrator: nothing that needs the owner is offered.
 */
export function personActions(row: PersonRow, callerRole: OrgRole | null): PersonActions {
  const callerIsOwner = callerRole === 'Owner';
  const needsOwner = row.role === 'Admin' && !callerIsOwner;

  if (row.kind === 'invitation') {
    if (needsOwner) return { ...NONE, locked: 'admin' };
    return { ...NONE, resend: true, copyLink: row.status === 'Pending', revoke: true };
  }

  if (row.role === 'Owner') return { ...NONE, locked: 'owner' };
  if (row.isMe) return { ...NONE, locked: 'me' };
  if (needsOwner) return { ...NONE, locked: 'admin' };

  if (row.status === 'Deactivated') return { ...NONE, reactivate: true };
  return { ...NONE, changeRole: true, editAccess: row.role !== 'Admin', deactivate: true };
}
