import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { MemberStatus } from '@/lib/status-dictionary';
import { useOrgInvitations, useOrgMembers } from '@/queries/use-org-team';
import type { OrgInvitation, OrgMember, OrgPropertyScope, OrgRole } from '@/types/org-team.types';

export interface PersonRow {
  key: string;
  kind: 'member' | 'invitation';
  id: string;
  name: string;
  email: string;
  role: OrgRole;
  areas: string[];
  propertyScope: OrgPropertyScope;
  status: MemberStatus;
  isMe: boolean;
  since: string;
  deactivatedAt: string | null;
  expiresAt: string | null;
  invitedByName: string | null;
  propertyCount: number;
}

export function memberName(member: Pick<OrgMember, 'firstName' | 'lastName' | 'email'>): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;
}

export function personRows(members: readonly OrgMember[], invitations: readonly OrgInvitation[], myEmail: string | undefined): PersonRow[] {
  const me = myEmail?.trim().toLowerCase();
  const nameOf = new Map(members.map((member) => [member.userId, memberName(member)]));

  const joined = members.map<PersonRow>((member) => ({
    key: `m-${member.id}`,
    kind: 'member',
    id: member.id,
    name: memberName(member),
    email: member.email,
    role: member.role,
    areas: member.areas,
    propertyScope: member.propertyScope,
    status: member.status,
    isMe: me !== undefined && member.email.toLowerCase() === me,
    since: member.createdAt,
    deactivatedAt: member.deactivatedAt,
    expiresAt: null,
    invitedByName: null,
    propertyCount: 0,
  }));

  const invited = invitations
    .filter((invitation) => invitation.status === 'Pending' || invitation.status === 'Expired')
    .map<PersonRow>((invitation) => ({
      key: `i-${invitation.id}`,
      kind: 'invitation',
      id: invitation.id,
      name: invitation.name || invitation.email,
      email: invitation.email,
      role: invitation.role,
      areas: invitation.areas,
      propertyScope: invitation.propertyScope,
      status: invitation.status,
      isMe: false,
      since: invitation.createdAt,
      deactivatedAt: null,
      expiresAt: invitation.expiresAt,
      invitedByName: nameOf.get(invitation.invitedByUserId) ?? null,
      propertyCount: invitation.propertyIds.length,
    }));

  return [...joined, ...invited];
}

/**
 * The people of the org with what each one is: two requests (`GET /orgs/me/members` and `GET /orgs/me/invitations`), whatever the
 * number of rows. The members are what the page cannot do without; the invitations that fail leave the members on the screen with
 * a note (`invitationsFailed`), never an empty list passed off as "nobody was invited".
 * `fresh`: read again when the screen opens (the page; the drawer reads what the page has just read).
 */
export function usePeopleRows({ fresh = false }: { fresh?: boolean } = {}) {
  const { user } = useAuth();
  const members = useOrgMembers(true, { fresh });
  const invitations = useOrgInvitations({ fresh });
  const myEmail = user?.email;

  const memberItems = members.data?.items;
  const loadedMembers = Array.isArray(memberItems) ? memberItems : undefined;
  const loadedInvitations = Array.isArray(invitations.data) ? invitations.data : undefined;

  const rows = useMemo(
    () => (loadedMembers ? personRows(loadedMembers, loadedInvitations ?? [], myEmail) : undefined),
    [loadedMembers, loadedInvitations, myEmail],
  );

  return {
    rows,
    isLoading: members.isLoading || invitations.isLoading,
    isError: !loadedMembers && (members.isError || members.data !== undefined),
    error: members.error,
    refetch: () => void members.refetch(),
    invitationsFailed: !loadedInvitations && (invitations.isError || invitations.data !== undefined),
    refetchInvitations: () => void invitations.refetch(),
  };
}
