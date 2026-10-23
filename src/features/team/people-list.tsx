import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Building2, Mail, Users } from 'lucide-react';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListCardContent } from '@/components/shared/list-view/list-types';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { orgRoleLabel } from '../account/account-roles';
import type { PersonRow } from './people-rows';
// The drawer registers its kind when its module is loaded: the list is what opens it.
import { PERSON_DRAWER_KIND } from './person-drawer';
import { PersonAvatar } from './person-avatar';
import { areaName, ORG_ROLES } from './team-labels';

/** The areas of a person's work, as the options of the filter: the ones a role is given (the Amministrazione comes with the role). */
const RENTAL_AREAS = ['short-rent', 'long-rent'] as const;

/** The states in the order the team has to look at them: who is in first, then who was invited, then who is out. */
const STATUS_RANK: Record<string, number> = { Active: 0, Pending: 1, Expired: 2, Deactivated: 3 };

/** «Affitti brevi, Affitti lunghi»: the areas the person works in, by name. */
function areasText(row: PersonRow, t: TFunction): string {
  return row.areas.length > 0 ? row.areas.map((area) => areaName(area, t)).join(', ') : t('team.list.noAreas');
}

/** «Tutti gli immobili» or «Solo alcuni immobili»; nothing for a person who is out. */
function propertiesText(row: PersonRow, t: TFunction): string | null {
  if (row.status === 'Deactivated') return null;
  return row.propertyScope === 'Selected' ? t('team.list.someProperties') : t('team.list.allProperties');
}

/**
 * The list of the people of the org, in the words of the person: the unified list (UI-14) with one row for each member and each
 * invitation that waits, one state each (in, invited, out) and the role. The name opens the drawer of the person, which says what
 * that person can see. All the rows are in the page (`GET /orgs/me/members` and `/invitations`), so the list searches, filters and
 * sorts them itself.
 *
 * The design also has the last access of each person. The backend does not keep it, so it is not here and not made up.
 */
export function usePeopleList() {
  const { t } = useTranslation();

  return useMemo(
    () =>
      defineList<PersonRow>({
        key: 'org-people',
        title: t('team.title'),
        rowKey: (row) => row.key,
        rowLabel: (row) => row.name,
        columns: [
          {
            id: 'person',
            label: t('team.list.columns.person'),
            always: true,
            default: true,
            rowHeader: true,
            sort: (row) => row.name,
            render: (row, cell) => (
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar name={row.name} />
                <div className="min-w-0">
                  {cell.open(row.name)}
                  <span className="block break-words text-sm font-normal text-foreground/70">
                    {row.email}
                    {row.isMe ? ` · ${t('team.list.you')}` : ''}
                  </span>
                </div>
              </div>
            ),
          },
          {
            id: 'role',
            label: t('team.list.columns.role'),
            default: true,
            sort: (row) => ORG_ROLES.indexOf(row.role),
            render: (row) => <span className="break-words">{orgRoleLabel(row.role, t)}</span>,
          },
          {
            id: 'access',
            label: t('team.list.columns.access'),
            default: true,
            render: (row) => (
              <>
                <span className="block break-words">{areasText(row, t)}</span>
                {propertiesText(row, t) ? <span className="block break-words text-sm font-normal text-foreground/70">{propertiesText(row, t)}</span> : null}
              </>
            ),
          },
          {
            id: 'status',
            label: t('team.list.columns.status'),
            default: true,
            sort: (row) => STATUS_RANK[row.status] ?? 9,
            render: (row) => <StatusBadge kind="member" status={row.status} />,
          },
        ],
        search: {
          label: t('team.list.search'),
          placeholder: t('team.list.searchPlaceholder'),
          text: (row) => [row.name, row.email, orgRoleLabel(row.role, t)].join(' '),
        },
        chips: [
          { id: 'all', label: t('team.list.chips.all'), test: () => true },
          { id: 'active', label: t('team.list.chips.active'), test: (row) => row.status === 'Active' },
          { id: 'invited', label: t('team.list.chips.invited'), hint: t('team.list.chips.invitedHint'), test: (row) => row.kind === 'invitation' },
          { id: 'deactivated', label: t('team.list.chips.deactivated'), test: (row) => row.status === 'Deactivated' },
        ],
        filters: [
          {
            id: 'role',
            type: 'select',
            label: t('team.list.filters.role'),
            allLabel: t('team.list.filters.allRoles'),
            options: ORG_ROLES.map((role) => ({ value: role, label: orgRoleLabel(role, t) })),
            test: (row, value) => row.role === value,
          },
          {
            id: 'area',
            type: 'select',
            label: t('team.list.filters.area'),
            allLabel: t('team.list.filters.allAreas'),
            options: RENTAL_AREAS.map((area) => ({ value: area, label: areaName(area, t) })),
            test: (row, value) => row.areas.includes(value),
          },
        ],
        card: (row): ListCardContent => ({
          lead: <PersonAvatar name={row.name} />,
          title: row.name,
          sub: orgRoleLabel(row.role, t),
          status: <StatusBadge kind="member" status={row.status} />,
          meta: [
            { icon: Mail, text: row.isMe ? `${row.email} · ${t('team.list.you')}` : row.email, label: t('team.drawer.email') },
            { icon: Building2, text: [areasText(row, t), propertiesText(row, t)].filter(Boolean).join(' · '), label: t('team.list.columns.access') },
          ],
        }),
        // The name opens the drawer of the person: what it can see. There is no page of its own.
        detail: { drawerKind: PERSON_DRAWER_KIND },
        rowTone: (row) => (row.status === 'Deactivated' || row.status === 'Expired' ? 'done' : undefined),
        cardsUntil: 'lg',
        csv: false,
        empty: {
          icon: Users,
          title: t('team.list.emptyTitle'),
          description: t('team.list.emptyDescription'),
        },
        noResults: { title: t('team.list.noResults.title'), description: t('team.list.noResults.description') },
        countLabel: (count) => t('team.list.count', { count }),
      }),
    [t],
  );
}
