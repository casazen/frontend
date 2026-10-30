import { useContext, useMemo } from 'react';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { todayInRome } from '@/lib/stay-dates';
import { useLeases } from '@/queries/use-leases';
import { useOrgMemberProperties, useOrgMembers, useOrgMembersProperties } from '@/queries/use-org-team';
import { useProperties } from '@/queries/use-properties';
import type { OrgMember } from '@/types/org-team.types';
import {
  accountPropertyRows,
  grantedIds,
  isLimitedCollaborator,
  modeOf,
  peopleCounts,
  type AccountPropertyRights,
} from './account-properties-model';

/**
 * What the person may do in each area, as plain booleans. Read without `useWorkspace`, which refuses to run outside its provider:
 * a drawer drawn on its own offers no action.
 */
export function useAccountPropertyRights(): AccountPropertyRights {
  const workspace = useContext(WorkspaceContext);

  return useMemo(() => {
    const can = (area: 'short-rent' | 'long-rent', permission: string) => workspace?.hasPermission(area, permission) ?? false;
    return {
      shortRead: can('short-rent', 'property.read'),
      shortWrite: can('short-rent', 'property.write'),
      longRead: can('long-rent', 'property.read'),
      longWrite: can('long-rent', 'property.write'),
    };
  }, [workspace]);
}

/**
 * What the collaborators limited to some properties were given, by member (a request each, kept for a minute): the only people
 * whose reach is not the same for every property. Without them nobody can say who opens a property or who may be put in charge of it.
 * `isPending` while one is still to come, `isError` if one failed (`retry` asks again).
 */
export function useMemberAccess(members: readonly OrgMember[] | undefined, enabled = true) {
  const limited = useMemo(() => (members ?? []).filter(isLimitedCollaborator), [members]);
  const { byMember, isPending, isError, retry } = useOrgMembersProperties(
    limited.map((member) => member.id),
    enabled && members !== undefined,
  );
  const granted = useMemo(() => {
    const byId = new Map<string, ReadonlySet<string>>();
    for (const member of limited) {
      const ids = grantedIds(byMember[member.id]);
      if (ids) byId.set(member.id, ids);
    }
    return byId;
  }, [limited, byMember]);

  return { granted, isPending: members === undefined || isPending, isError, retry };
}

/**
 * The properties of the account with what the list of the page says about each: five reads, whatever the number of rows (the
 * properties, the leases of the long-term ones, the members, and the access of one member, which counts the people of every
 * property). The properties are what the page cannot do without; the others fill their columns when they arrive, and a column
 * whose answer failed says nothing (`membersKnown`, `peopleKnown`, `leasesKnown`) instead of a wrong "nobody".
 * `fresh`: read again when the screen opens (the page; the drawer reads what the page has just read).
 */
export function useAccountPropertyRows({ fresh = false }: { fresh?: boolean } = {}) {
  // Read without `useWorkspace`, which refuses to run outside its provider: a drawer drawn on its own sees no leases.
  const workspace = useContext(WorkspaceContext);
  const canReadLeases = workspace?.hasPermission('long-rent', 'lease.read') ?? false;

  // `view=overview` (SR-07a) adds to each short-term row what it still lacks, worked out by the server: the list never works it out again.
  const properties = useProperties({ view: 'overview' }, { fresh });
  // An answer that is not a list (the page of the app where an API answer should be) is a failed load, never an empty list.
  const loaded = Array.isArray(properties.data) ? properties.data : undefined;
  const hasLongTerm = loaded?.some((property) => modeOf(property) === 'Long') ?? false;

  const leases = useLeases(undefined, { refetchOnMount: fresh ? 'always' : undefined, enabled: canReadLeases && hasLongTerm });

  const members = useOrgMembers(true, { fresh });
  const memberItems = members.data?.items;
  const loadedMembers = Array.isArray(memberItems) ? memberItems : undefined;
  // The count of people is the same whoever is asked: the first active member answers for the whole org.
  const probe = loadedMembers?.find((member) => member.status === 'Active');
  const access = useOrgMemberProperties(probe?.id ?? '', probe !== undefined, { fresh });
  const accessItems = access.data?.properties;
  const loadedAccess = Array.isArray(accessItems) ? accessItems : undefined;
  const peopleByProperty = useMemo(() => (loadedAccess ? peopleCounts(loadedAccess) : undefined), [loadedAccess]);

  const rows = useMemo(
    () =>
      loaded
        ? accountPropertyRows({ properties: loaded, leases: leases.data, members: loadedMembers, peopleByProperty, today: todayInRome() })
        : undefined,
    [loaded, leases.data, loadedMembers, peopleByProperty],
  );

  return {
    rows,
    members: loadedMembers,
    isLoading: properties.isLoading || leases.isLoading,
    isError: !loaded && (properties.isError || properties.data !== undefined),
    error: properties.error,
    refetch: () => void properties.refetch(),
    /** The secondary reads are still on their way: a column that is not there yet is not "unavailable". */
    othersLoading: members.isLoading || access.isLoading || leases.isLoading,
    /** Asks again for the members, the access and the leases (the properties have their own `refetch`). */
    retryOthers: () => {
      void members.refetch();
      void access.refetch();
      void leases.refetch();
    },
    membersKnown: loadedMembers !== undefined,
    peopleKnown: peopleByProperty !== undefined,
    leasesKnown: !hasLongTerm || leases.data !== undefined,
  };
}
