import { useId, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, LockKeyhole, ShieldCheck, UserCog } from 'lucide-react';
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

function AreaBlock({ menu }: { menu: AreaMenu }) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={menu.enters ? "min-w-0 rounded-2xl border border-primary/25 bg-card p-5 shadow-sm" : "min-w-0 rounded-2xl border border-dashed border-border bg-muted/40 p-5"} data-testid={`preview-area-${menu.area}`}>
      <h3 id={titleId} className="flex flex-wrap items-center gap-3 break-words font-semibold">
        {menu.enters ? <CheckCircle2 className="size-9 shrink-0 rounded-xl bg-success-soft p-2 text-success-foreground" aria-hidden /> : <LockKeyhole className="size-9 shrink-0 rounded-xl bg-muted p-2 text-muted-foreground" aria-hidden />}
        {areaName(menu.area, t)}
      </h3>
      {menu.enters ? (
        <>
          <p className="mt-2 text-sm text-foreground/70">{t('team.access.available')}</p>
          {menu.main.length === 0 && menu.more.length === 0 ? (
            <p className="text-sm text-foreground/70">{t('team.access.noPages')}</p>
          ) : (
            <Disclosure summary={t('team.access.showPages', { count: menu.main.length + menu.more.length })} testId={`preview-pages-${menu.area}`}>
            <ul role="list" className="grid gap-2 text-sm" data-testid={`preview-menu-${menu.area}`}>
              {menu.main.map((entry) => (
                <li key={entry.path} className="break-words border-l-2 border-border pl-3">
                  {getNavLabel(entry, t)}
                </li>
              ))}
            </ul>
            {menu.more.length > 0 ? <div className="space-y-2 border-t border-border pt-3">
              <p className="font-medium text-muted-foreground">{t('team.access.more', { count: menu.more.length })}</p>
              <ul role="list" className="grid gap-2">
                {menu.more.map((entry) => (
                  <li key={entry.path} className="break-words">
                    {getNavLabel(entry, t)}
                  </li>
                ))}
              </ul>
            </div> : null}
            </Disclosure>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-foreground/70" data-testid={`preview-cannot-${menu.area}`}>
          {menu.area === 'account' ? t('team.access.noAdminArea') : t('team.access.notGiven')}
        </p>
      )}
    </section>
  );
}

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
  return granted.length > 0 ? <ul role="list" className="grid gap-2 text-sm">{granted.map((name, index) => <li key={index} className="break-words border-l-2 border-border pl-3">{name}</li>)}</ul> : <p className="text-sm">{t('team.drawer.noProperties')}</p>;
}

function PersonPreview({ row, callerRole, roles }: { row: PersonRow; callerRole: OrgRole | null; roles: OrgRoleInfo[] }) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialog, setDialog] = useState<'role' | 'access' | null>(null);

  const current = roles.find((candidate) => candidate.role === row.role);
  const tryable = roles.filter((candidate) => candidate.role === row.role || (candidate.assignable && candidate.role !== 'Owner'));
  const asked = searchParams.get('role');
  const trying = asked === row.role ? undefined : tryable.find((candidate) => candidate.role === asked);
  const shown = trying ?? current;

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

  const secondary: PageHeaderMenuItem[] = [];
  if (may.editAccess) secondary.push({ label: t('team.actions.access.label'), onClick: () => setDialog('access'), testId: 'preview-edit-access' });
  if (may.changeRole) secondary.push({ label: t('team.roles.title'), to: ACCOUNT_ROLES_PATH, testId: 'preview-roles-link' });

  return (
    <div className="workspace-page space-y-8" data-testid="person-preview">
      <PageHeader
        title={row.kind === 'invitation' ? t('team.access.titleInvited', { name: row.name }) : t('team.access.title', { name: row.name })}
        description={t('team.access.description', { role: orgRoleLabel(shown.role, t) })}
        crumbs="auto"
        mobilePrimary="none"
        primary={
          may.changeRole
            ? { label: t('team.actions.role.label'), icon: UserCog, onClick: () => setDialog('role'), testId: 'preview-change-role' }
            : { label: t('team.roles.title'), icon: ShieldCheck, to: ACCOUNT_ROLES_PATH, testId: 'preview-roles' }
        }
        secondary={secondary}
      />

      {tryable.length > 1 && !deactivated ? (
        <section className="grid min-w-0 items-center gap-4 rounded-3xl border border-primary/20 bg-card p-5 shadow-sm xl:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)] xl:p-6" aria-label={t('team.access.tryLabel')} data-testid="preview-try">
          <div className="space-y-1">
            <h2 className="font-semibold">{t('team.access.tryRole')}</h2>
            <p className="text-sm text-muted-foreground">{t('team.access.previewHint')}</p>
          </div>
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
        </section>
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="preview-areas">
              {menus.map((menu) => (
                <AreaBlock key={menu.area} menu={menu} />
              ))}
            </div>
          </PlainSection>

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
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

export function PersonPreviewPage() {
  const { t } = useTranslation();
  const { key = '' } = useParams<{ key: string }>();
  const { rows, isLoading, isError, error, refetch } = usePeopleRows({ fresh: true });
  const rolesQuery = useOrgRoles();

  const row = rows?.find((candidate) => candidate.key === key);
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
