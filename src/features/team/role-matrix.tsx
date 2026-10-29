import { useTranslation } from 'react-i18next';
import { Check, Eye, Minus, type LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/utils';
import type { OrgCapabilityLevel, OrgRoleInfo } from '@/types/org-team.types';
import { orgRoleLabel } from '../account/account-roles';
import { buildRoleMatrix, capabilitiesByLevel } from './roles-matrix-model';
import { areaName, capabilityLabel } from './team-labels';

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation. Each level has an icon and a word:
// the color alone never says it.
const LEVEL_MARKS: Record<OrgCapabilityLevel, { icon: LucideIcon; labelKey: string; explainKey: string; tone: string }> = {
  Yes: {
    icon: Check,
    labelKey: 'team.roles.level.Yes',
    explainKey: 'team.roles.legend.Yes',
    tone: 'text-[color:var(--color-success-foreground,#166534)]',
  },
  Read: { icon: Eye, labelKey: 'team.roles.level.Read', explainKey: 'team.roles.legend.Read', tone: 'text-foreground/80' },
  No: { icon: Minus, labelKey: 'team.roles.level.No', explainKey: 'team.roles.legend.No', tone: 'text-foreground/70' },
};

const LEVELS: readonly OrgCapabilityLevel[] = ['Yes', 'Read', 'No'];

/** The name of a group of the matrix: the rental areas are named as the area switcher names them; `both` is the suppliers' interventions. */
function groupName(group: string, t: TFunction): string {
  return group === 'both' ? t('team.roles.groups.both') : areaName(group, t);
}

function LevelMark({ level }: { level: OrgCapabilityLevel }) {
  const { t } = useTranslation();
  const { icon: Icon, labelKey, tone } = LEVEL_MARKS[level];
  return (
    <span className={cn('inline-flex items-start gap-1.5 break-words', tone)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{t(labelKey)}</span>
    </span>
  );
}

/** The three levels in words, so that nobody has to guess what «Sola lettura» means. */
function Legend() {
  const { t } = useTranslation();
  return (
    <ul role="list" className="flex flex-wrap gap-x-6 gap-y-1 text-sm" data-testid="role-matrix-legend">
      {LEVELS.map((level) => (
        <li key={level} className="min-w-0 break-words text-foreground/80">
          <LevelMark level={level} />
          <span className="text-foreground/70">{`: ${t(LEVEL_MARKS[level].explainKey)}`}</span>
        </li>
      ))}
    </ul>
  );
}

/** From `md`: one row for each capability, one column for each role. */
function MatrixTable({ roles }: { roles: readonly OrgRoleInfo[] }) {
  const { t } = useTranslation();
  const groups = buildRoleMatrix(roles);

  return (
    <div className="hidden min-w-0 md:block">
      <table className="w-full table-fixed border-collapse text-sm" data-testid="role-matrix-table">
        <caption className="sr-only">{t('team.roles.matrixCaption')}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[26%] py-2 pr-3 text-left font-semibold">
              {t('team.roles.capability')}
            </th>
            {roles.map((info) => (
              <th key={info.role} scope="col" className="break-words px-2 py-2 text-left align-bottom font-semibold">
                {orgRoleLabel(info.role, t)}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.group}>
            <tr>
              <th scope="colgroup" colSpan={roles.length + 1} className="pb-1 pt-5 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
                {groupName(group.group, t)}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr key={row.id} className="border-t border-border" data-testid={`role-matrix-row-${row.id}`}>
                <th scope="row" className="break-words py-2.5 pr-3 text-left font-normal">
                  {capabilityLabel(row.id, t) ?? row.id}
                </th>
                {roles.map((info) => (
                  <td key={info.role} className="px-2 py-2.5 align-top">
                    <LevelMark level={row.levels[info.role] ?? 'No'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/** Under `md`: one block for each role, with what it can manage, only look at, and not do. */
function MatrixCards({ roles }: { roles: readonly OrgRoleInfo[] }) {
  const { t } = useTranslation();
  const groups = buildRoleMatrix(roles);

  return (
    <ul role="list" className="min-w-0 space-y-5 md:hidden" data-testid="role-matrix-cards">
      {roles.map((info) => {
        const byLevel = capabilitiesByLevel(groups, info.role);
        return (
          <li key={info.role} className="min-w-0 space-y-2 border-t border-border pt-4" data-testid={`role-matrix-card-${info.role}`}>
            <h3 className="break-words font-semibold">{orgRoleLabel(info.role, t)}</h3>
            {LEVELS.filter((level) => byLevel[level].length > 0).map((level) => (
              <p key={level} className="break-words text-sm text-foreground/80">
                <LevelMark level={level} />
                <span>{`: ${byLevel[level].map((id) => capabilityLabel(id, t) ?? id).join(', ')}`}</span>
              </p>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * «Chi può fare cosa»: the matrix of the roles as the backend gives it (`GET /api/orgs/me/roles`), in words that need no explaining.
 * A table from `md` (a row for each capability, a column for each role) and, on a phone, one block for each role; the legend of the
 * three levels above them. Nothing here is a list of permissions: it is what a role does, in the words of the product.
 */
export function RoleMatrix({ roles }: { roles: readonly OrgRoleInfo[] }) {
  return (
    <div className="min-w-0 space-y-4" data-testid="role-matrix">
      <Legend />
      <MatrixTable roles={roles} />
      <MatrixCards roles={roles} />
    </div>
  );
}
