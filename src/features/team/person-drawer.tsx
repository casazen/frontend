import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { MarketingError } from '@/components/campaigns/MarketingInputs';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { PlainSection } from '@/components/shared/calm';
import {
  registerDetail,
  type DetailContentProps,
  type DetailTitleProps,
} from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { StatusExplainer } from '@/components/shared/status/status-explainer';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useOrgMemberProperties, useOrgRoles } from '@/queries/use-org-team';
import type { OrgRole } from '@/types/org-team.types';
import { orgRoleLabel } from '../account/account-roles';
import { AccessPreview } from './access-preview';
import { usePeopleRows, type PersonRow } from './people-rows';
import { PersonActions } from './person-actions';
import { orgRoleDescription } from './team-labels';
import { personPreviewPath } from './team-paths';
import { dayOf } from './team-dates';

export const PERSON_DRAWER_KIND = 'org-person';

function useRowOfTheList(key: string) {
  const { rows, isLoading, isError, error, refetch } = usePeopleRows();
  const callerRole = rows?.find((candidate) => candidate.isMe && candidate.kind === 'member')?.role ?? null;
  return { row: rows?.find((candidate) => candidate.key === key), callerRole, isLoading, isError, error, refetch };
}

export function PersonDrawerTitle({ id }: DetailTitleProps) {
  const { row } = useRowOfTheList(id);
  return <>{row?.name ?? ''}</>;
}

function PropertiesValue({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  const someOfThem = row.propertyScope === 'Selected';
  const own = useOrgMemberProperties(row.id, row.kind === 'member' && someOfThem);

  if (!someOfThem) return <>{t('team.drawer.allProperties')}</>;
  if (row.kind === 'invitation') {
    return <>{row.propertyCount > 0 ? t('team.drawer.someProperties', { total: row.propertyCount }) : t('team.drawer.someOfThem')}</>;
  }
  if (own.isPending) return <SkeletonLine lines={1} />;
  if (own.isError) return <>{t('team.drawer.someOfThem')}</>;

  const granted = own.data.properties.filter((property) => property.granted).map((property) => property.name);
  return <>{granted.length > 0 ? granted.join(', ') : t('team.drawer.noProperties')}</>;
}

function PreviewBody({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  const roles = useOrgRoles();
  const role = roles.data?.roles.find((candidate) => candidate.role === row.role);

  if (roles.isPending) return <SkeletonLine lines={3} />;
  if (!role) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>{t('team.preview.unavailable')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void roles.refetch()}>
          {t('team.retry')}
        </Button>
      </div>
    );
  }
  return <AccessPreview role={role} areas={row.areas} deactivated={row.status === 'Deactivated'} />;
}

function MemberMarketingPermission({id}: {id:string}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const path = '/orgs/me/members/' + id + '/marketing';
  const queryKey = ['member-marketing', id];
  const read = useQuery({queryKey, queryFn: () => ApiClient.get<{enabled:boolean}>(path)});
  const change = useMutation({
    mutationFn: (enabled:boolean) => ApiClient.put<{enabled:boolean}>(path, {enabled}),
    onSuccess: (data) => cache.setQueryData(queryKey,data),
  });
  return <div>
    <label className="flex min-h-11 items-center gap-2">
      <input type="checkbox" checked={read.data?.enabled ?? false} disabled={!read.data || change.isPending} onChange={e=>change.mutate(e.target.checked)}/>
      {t('marketingStudio.delegate')}
    </label>
    <MarketingError error={read.error ?? change.error}/>
  </div>;
}

function PersonDetails({ row, callerRole, close }: { row: PersonRow; callerRole: OrgRole | null; close: () => void }) {
  const { flags } = useFeatureFlags();
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  // The dates that say where the person is in its story: in the team since, or invited on and until.
  const dates: { label: string; value: string }[] =
    row.kind === 'invitation'
      ? [
          { label: t('team.drawer.sent'), value: dayOf(row.since, language) },
          { label: t('team.drawer.expires'), value: row.expiresAt ? dayOf(row.expiresAt, language) : '' },
        ]
      : [
          { label: t('team.drawer.since'), value: dayOf(row.since, language) },
          { label: t('team.drawer.deactivatedOn'), value: row.deactivatedAt ? dayOf(row.deactivatedAt, language) : '' },
        ];

  return (
    <div className="space-y-6 pb-2" data-testid="person-drawer">
      <StatusExplainer kind="member" status={row.status} />

      <PersonActions row={row} callerRole={callerRole} close={close} />
      {flags.crmMarketing && callerRole === 'Owner' && row.kind === 'member' && row.role === 'Collaborator' && row.status === 'Active' && <MemberMarketingPermission id={row.id}/>}

      <PlainSection title={t('team.drawer.data')}>
        <dl className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] gap-x-3 gap-y-3 rounded-xl border bg-surface-2 p-4 text-sm">
          <dt className="text-foreground/70">{t('team.drawer.email')}</dt>
          <dd className="break-words">{row.email}</dd>
          <dt className="text-foreground/70">{t('team.drawer.role')}</dt>
          <dd className="break-words">
            <span className="font-medium">{orgRoleLabel(row.role, t)}</span>
            <span className="block text-foreground/70">{orgRoleDescription(row.role, t)}</span>
          </dd>
          {row.status === 'Deactivated' ? null : (
            <>
              <dt className="text-foreground/70">{t('team.drawer.properties')}</dt>
              <dd className="break-words">
                <PropertiesValue row={row} />
              </dd>
            </>
          )}
          {row.invitedByName ? (
            <>
              <dt className="text-foreground/70">{t('team.drawer.invitedBy')}</dt>
              <dd className="break-words">{row.invitedByName}</dd>
            </>
          ) : null}
          {dates
            .filter((date) => date.value !== '')
            .map((date) => (
              <div key={date.label} className="contents">
                <dt className="text-foreground/70">{date.label}</dt>
                <dd className="break-words">{date.value}</dd>
              </div>
            ))}
        </dl>
      </PlainSection>

      <PlainSection
        title={row.kind === 'invitation' ? t('team.preview.titleInvited') : t('team.preview.title')}
        actionLabel={t('team.preview.detail')}
        href={personPreviewPath(row.key)}
        actionTestId="person-preview-link"
      >
        <PreviewBody row={row} />
      </PlainSection>
    </div>
  );
}

export function PersonDrawerContent({ id, close }: DetailContentProps) {
  const { t } = useTranslation();
  const { row, callerRole, isLoading, isError, error, refetch } = useRowOfTheList(id);

  if (isLoading) return <SkeletonLine lines={4} />;

  if (isError && !row) {
    return <ErrorState title={t('team.drawer.loadError')} error={error} onRetry={refetch} />;
  }

  if (!row) {
    return (
      <div role="status" className="space-y-1 py-4" data-testid="person-drawer-not-found">
        <p className="font-semibold">{t('team.drawer.notFound')}</p>
        <p className="text-sm text-foreground/70">{t('team.drawer.notFoundDescription')}</p>
      </div>
    );
  }

  return <PersonDetails row={row} callerRole={callerRole} close={close} />;
}

registerDetail(PERSON_DRAWER_KIND, {
  title: PersonDrawerTitle,
  Content: PersonDrawerContent,
});
