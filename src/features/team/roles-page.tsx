import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Disclosure } from '@/features/leases/guide/disclosure';
import { useOrgMembers, useOrgRoles } from '@/queries/use-org-team';
import { orgRoleLabel } from '../account/account-roles';
import { ACCOUNT_PEOPLE_PATH } from '../account/account-home-model';
import { RoleMatrix } from './role-matrix';
import { countPeopleByRole } from './roles-matrix-model';
import { orgRoleDescription } from './team-labels';
import { ACCOUNT_INVITE_PATH } from './team-paths';

/**
 * «Ruoli e permessi» (AM-04b-FU2), in the Amministrazione: what each of the five roles is for, in a sentence and with the people who
 * have it, and the matrix of what each one can do, area by area. All of it from the answer of `GET /api/orgs/me/roles` (the same one
 * that gives the cards of the invitation); the words are the product's. Nothing here changes anything: the role of a person is changed
 * from its own drawer, and «Cosa vede» tells what a person finds with the role and the areas it has.
 */
export function RolesPage() {
  const { t } = useTranslation();
  const rolesQuery = useOrgRoles();
  const membersQuery = useOrgMembers(true);

  // An answer that is not a list (the page of the app where an API answer should be) is a failed load, never an empty matrix.
  const roles = Array.isArray(rolesQuery.data?.roles) ? rolesQuery.data.roles : undefined;
  const members = Array.isArray(membersQuery.data?.items) ? membersQuery.data.items : undefined;
  // Without the people the roles are still worth reading: only the numbers are left out.
  const counts = members ? countPeopleByRole(members) : null;

  return (
    <div className="min-w-0 space-y-8" data-testid="roles-page">
      <PageHeader
        title={t('team.roles.title')}
        description={t('team.roles.description')}
        crumbs="auto"
        primary={{ label: t('team.invite.cta'), icon: UserPlus, to: ACCOUNT_INVITE_PATH, testId: 'roles-invite' }}
      />

      {rolesQuery.isPending ? (
        <SkeletonLine lines={6} />
      ) : !roles ? (
        <ErrorState title={t('team.roles.loadError')} error={rolesQuery.error} onRetry={() => void rolesQuery.refetch()} />
      ) : (
        <>
          <PlainSection title={t('team.roles.listTitle')}>
            <ul role="list" className="divide-y divide-border" data-testid="roles-list">
              {roles.map((info) => (
                <li key={info.role} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3" data-testid={`roles-item-${info.role}`}>
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="font-medium">{orgRoleLabel(info.role, t)}</p>
                    <p className="break-words text-sm text-foreground/70">{orgRoleDescription(info.role, t)}</p>
                  </div>
                  {counts ? <p className="text-sm tabular-nums text-foreground/70">{t('team.roles.people', { count: counts[info.role] ?? 0 })}</p> : null}
                </li>
              ))}
            </ul>
          </PlainSection>

          <PlainSection title={t('team.roles.matrixTitle')}>
            <RoleMatrix roles={roles} />
            <p className="break-words text-sm text-foreground/70">
              {t('team.roles.narrowing')}{' '}
              <Link to={ACCOUNT_PEOPLE_PATH} className="font-medium text-primary-text underline underline-offset-2">
                {t('team.roles.openPeople')}
              </Link>
            </p>
          </PlainSection>

          <Disclosure summary={t('team.roles.notYetTitle')} testId="roles-not-yet">
            <p className="break-words text-foreground/80">{t('team.roles.notYetBody')}</p>
          </Disclosure>
        </>
      )}
    </div>
  );
}
