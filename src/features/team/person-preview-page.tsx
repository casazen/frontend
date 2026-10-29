import { useId, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import type { PageHeaderMenuItem } from '@/components/layout/page-header-actions';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Disclosure } from '@/features/leases/guide/disclosure';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getNavLabel } from '@/lib/nav-labels';
import { useOrgMemberProperties, useOrgRoles } from '@/queries/use-org-team';
import type { OrgRole, OrgRoleInfo } from '@/types/org-team.types';
import { orgRoleLabel } from '../account/account-roles';
import { ACCOUNT_PEOPLE_PATH } from '../account/account-home-model';
import { AccessPreview } from './access-preview';
import { buildAreaMenus, type AreaMenu } from './access-menu-model';
import { ChangeRoleDialog } from './change-role-dialog';
import { MemberAccessDialog } from './member-access-dialog';
import { personActions } from './person-actions-model';
import { usePeopleRows, type PersonRow } from './people-rows';
import { areaName } from './team-labels';
import { ACCOUNT_ROLES_PATH } from './team-paths';

/** One area of the preview: the pages the person finds in its menu (the main ones, and those of «Altro» behind a click), or why it cannot enter. */
function AreaBlock({ menu }: { menu: AreaMenu }) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-2" data-testid={`preview-area-${menu.area}`}>
      <h3 id={titleId} className="break-words font-semibold">
        {areaName(menu.area, t)}
      </h3>
      {menu.enters ? (
        <>
          <p className="text-sm text-foreground/70">{t('team.access.canEnter')}</p>
          {menu.main.length === 0 && menu.more.length === 0 ? (
            <p className="text-sm text-foreground/70">{t('team.access.noPages')}</p>
          ) : (
            <ul role="list" className="space-y-1 text-sm" data-testid={`preview-menu-${menu.area}`}>
              {menu.main.map((entry) => (
                <li key={entry.path} className="break-words">
                  {getNavLabel(entry, t)}
                </li>
              ))}
            </ul>
          )}
          {menu.more.length > 0 ? (
            <Disclosure summary={t('team.access.more', { count: menu.more.length })}>
              <ul role="list" className="space-y-1">
                {menu.more.map((entry) => (
                  <li key={entry.path} className="break-words">
                    {getNavLabel(entry, t)}
                  </li>
                ))}
              </ul>
            </Disclosure>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-foreground/70" data-testid={`preview-cannot-${menu.area}`}>
          {menu.area === 'account' ? t('team.access.noAdminArea') : t('team.access.notGiven')}
        </p>
      )}
    </section>
  );
}

/** The properties the person reaches with the role shown: every one of them, or the ones it was given (named when the list of the member can be read). */
function ReachedProperties({
  row,
  allOfThem,
  granted,
  loading,
}: {
  row: PersonRow;
  allOfThem: boolean;
  granted: string[] | null;
  loading: boolean;
}) {
  const { t } = useTranslation();

  if (allOfThem) return <p className="text-sm">{t('team.drawer.allProperties')}</p>;
  if (row.kind === 'invitation') {
    return <p className="text-sm">{row.propertyCount > 0 ? t('team.drawer.someProperties', { total: row.propertyCount }) : t('team.drawer.noProperties')}</p>;
  }
  if (loading) return <SkeletonLine lines={1} />;
  if (granted === null) return <p className="text-sm">{t('team.drawer.someOfThem')}</p>;
  return <p className="break-words text-sm">{granted.length > 0 ? granted.join(', ') : t('team.drawer.noProperties')}</p>;
}

/**
 * The preview itself, once the person and the matrix are known. The role shown is the one of the person, or the one tried in
 * «E se fosse…» (`?role=` in the address): nothing is changed until «Rendi … » opens the dialog of the role and the person saves it.
 */
function PersonPreview({ row, callerRole, roles }: { row: PersonRow; callerRole: OrgRole | null; roles: OrgRoleInfo[] }) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialog, setDialog] = useState<'role' | 'access' | null>(null);

  const current = roles.find((candidate) => candidate.role === row.role);
  // The roles worth trying: the person's own and the ones the caller may give (never the owner's); the owner has nothing to try.
  const tryable = roles.filter((candidate) => candidate.role === row.role || (candidate.assignable && candidate.role !== 'Owner'));
  const asked = searchParams.get('role');
  const trying = asked === row.role ? undefined : tryable.find((candidate) => candidate.role === asked);
  const shown = trying ?? current;

  // Another role reaches the whole org (only the collaborator can be limited to some properties); the areas stay the person's own.
  const scope = shown?.scopeSupported ? row.propertyScope : 'All';
  const own = useOrgMemberProperties(row.id, row.kind === 'member' && scope === 'Selected');
  const granted = own.data ? own.data.properties.filter((property) => property.granted).map((property) => property.name) : null;

  const may = personActions(row, callerRole);

  if (!shown) {
    return (
      <div role="alert" className="space-y-2 text-sm" data-testid="preview-unavailable">
        <p>{t('team.preview.unavailable')}</p>
      </div>
    );
  }

  const menus = buildAreaMenus(shown, row.areas, flags);
  const entersNothing = menus.every((menu) => !menu.enters);
  const deactivated = row.status === 'Deactivated';
  const noProperties = scope === 'Selected' && (row.kind === 'invitation' ? row.propertyCount === 0 : granted !== null && granted.length === 0);

  const choose = (role: OrgRole) => setSearchParams(role === row.role ? {} : { role }, { replace: true });
  const backToToday = () => setSearchParams({}, { replace: true });

  // The one main action is the change of the role; whoever may not change it is offered the roles page instead, and the rest is in «⋯».
  const secondary: PageHeaderMenuItem[] = [];
  if (may.editAccess) secondary.push({ label: t('team.actions.access.label'), onClick: () => setDialog('access'), testId: 'preview-edit-access' });
  if (may.changeRole) secondary.push({ label: t('team.roles.title'), to: ACCOUNT_ROLES_PATH, testId: 'preview-roles-link' });

  return (
    <div className="min-w-0 space-y-6" data-testid="person-preview">
      <PageHeader
        title={row.kind === 'invitation' ? t('team.access.titleInvited', { name: row.name }) : t('team.access.title', { name: row.name })}
        description={t('team.access.description', { role: orgRoleLabel(shown.role, t) })}
        crumbs="auto"
        primary={
          may.changeRole
            ? { label: t('team.actions.role.label'), icon: UserCog, onClick: () => setDialog('role'), testId: 'preview-change-role' }
            : { label: t('team.roles.title'), icon: ShieldCheck, to: ACCOUNT_ROLES_PATH, testId: 'preview-roles' }
        }
        secondary={secondary}
      />

      {tryable.length > 1 && !deactivated ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2" data-testid="preview-try">
          <span className="text-sm font-medium">{t('team.access.tryRole')}</span>
          <Segmented<OrgRole>
            label={t('team.access.tryLabel')}
            value={shown.role}
            onValueChange={choose}
            options={tryable.map((candidate) => ({
              value: candidate.role,
              label: orgRoleLabel(candidate.role, t),
              testId: `preview-role-${candidate.role}`,
            }))}
          />
        </div>
      ) : null}

      {trying ? (
        <Alert
          variant="info"
          title={t('team.access.trying', { name: row.name, role: orgRoleLabel(trying.role, t) })}
          data-testid="preview-trying"
          action={
            <div className="flex flex-wrap gap-2">
              {may.changeRole ? (
                <Button type="button" size="sm" className="min-h-11" onClick={() => setDialog('role')} data-testid="preview-make-role">
                  {t('team.access.make', { name: row.name, role: orgRoleLabel(trying.role, t) })}
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="ghost" className="min-h-11" onClick={backToToday} data-testid="preview-back-today">
                {t('team.access.backToToday')}
              </Button>
            </div>
          }
        >
          {t('team.access.tryingBody', { name: row.name, current: orgRoleLabel(row.role, t) })}
        </Alert>
      ) : null}

      {deactivated ? (
        <AccessPreview role={shown} areas={row.areas} deactivated />
      ) : (
        <>
          {entersNothing ? (
            <Alert
              variant="warning"
              title={t('team.access.noAreasTitle')}
              data-testid="preview-no-areas"
              action={
                may.editAccess ? (
                  <Button type="button" size="sm" className="min-h-11" onClick={() => setDialog('access')}>
                    {t('team.access.pickAreas')}
                  </Button>
                ) : undefined
              }
            >
              {t('team.access.noAreasBody')}
            </Alert>
          ) : null}
          {noProperties && !entersNothing ? (
            <Alert
              variant="warning"
              title={t('team.access.noPropertiesTitle')}
              data-testid="preview-no-properties"
              action={
                may.editAccess ? (
                  <Button type="button" size="sm" className="min-h-11" onClick={() => setDialog('access')}>
                    {t('team.access.pickProperties')}
                  </Button>
                ) : undefined
              }
            >
              {t('team.access.noPropertiesBody')}
            </Alert>
          ) : null}

          <PlainSection title={t('team.access.menuTitle')}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="preview-areas">
              {menus.map((menu) => (
                <AreaBlock key={menu.area} menu={menu} />
              ))}
            </div>
          </PlainSection>

          <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
            <PlainSection title={t('team.access.propertiesTitle')}>
              <ReachedProperties row={row} allOfThem={scope === 'All'} granted={granted} loading={own.isPending && own.fetchStatus !== 'idle'} />
            </PlainSection>
            <PlainSection title={t('team.access.canTitle')}>
              <AccessPreview role={shown} areas={row.areas} />
            </PlainSection>
          </div>
        </>
      )}

      <ChangeRoleDialog row={row} initialRole={trying?.role} open={dialog === 'role'} onOpenChange={(open) => setDialog(open ? 'role' : null)} />
      <MemberAccessDialog row={row} open={dialog === 'access'} onOpenChange={(open) => setDialog(open ? 'access' : null)} />
    </div>
  );
}

/**
 * «Cosa vede» (AM-04b-FU2), in the Amministrazione: what one person of the team finds in CasaZen: for each area, whether it can enter
 * and the pages of its menu (read from the route manifest with the permissions of its role, the way the menus themselves decide), the
 * properties it reaches, and what it can do there. «E se fosse…» tries another role without changing anything; «Rendi … » then opens
 * the dialog of the role on that choice. It reads what the page of the people reads (`GET /orgs/me/members`, `/invitations`, `/roles`).
 */
export function PersonPreviewPage() {
  const { t } = useTranslation();
  const { key = '' } = useParams<{ key: string }>();
  const { rows, isLoading, isError, error, refetch } = usePeopleRows({ fresh: true });
  const rolesQuery = useOrgRoles();

  const row = rows?.find((candidate) => candidate.key === key);
  // The one who looks is the row that is itself: the owner or an administrator, which decides what it may do to the others.
  const callerRole = rows?.find((candidate) => candidate.isMe && candidate.kind === 'member')?.role ?? null;
  const roles = Array.isArray(rolesQuery.data?.roles) ? rolesQuery.data.roles : undefined;

  if (isLoading || rolesQuery.isPending) {
    return (
      <div className="min-w-0 space-y-6" data-testid="person-preview-loading">
        <PageHeader title={t('team.preview.title')} crumbs="auto" />
        <SkeletonLine lines={5} />
      </div>
    );
  }

  if (isError && !row) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader title={t('team.preview.title')} crumbs="auto" />
        <ErrorState title={t('team.loadError')} error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="min-w-0 space-y-6" data-testid="person-preview-not-found">
        <PageHeader title={t('team.drawer.notFound')} crumbs="auto" />
        <div role="status" className="space-y-3">
          <p className="text-sm text-foreground/70">{t('team.drawer.notFoundDescription')}</p>
          <Link to={ACCOUNT_PEOPLE_PATH} className="inline-flex min-h-11 items-center font-medium text-primary-text underline underline-offset-2">
            {t('team.access.openPeople')}
          </Link>
        </div>
      </div>
    );
  }

  if (!roles) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader title={t('team.access.title', { name: row.name })} crumbs="auto" />
        <ErrorState title={t('team.preview.unavailable')} error={rolesQuery.error} onRetry={() => void rolesQuery.refetch()} />
      </div>
    );
  }

  return <PersonPreview row={row} callerRole={callerRole} roles={roles} />;
}
