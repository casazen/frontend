import { useTranslation } from 'react-i18next';
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
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useOrgMemberProperties, useOrgRoles } from '@/queries/use-org-team';
import { orgRoleLabel } from '../account/account-roles';
import { AccessPreview } from './access-preview';
import { usePeopleRows, type PersonRow } from './people-rows';
import { orgRoleDescription } from './team-labels';

/** What the address calls the drawer of a person of the page: `?detail=org-person:<key of the row>`. */
export const PERSON_DRAWER_KIND = 'org-person';

const DAY = { day: 'numeric', month: 'long', year: 'numeric' } as const;

/** The backend sends UTC instants; one without a zone mark would be read as local time. */
function asInstant(when: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(when) ? when : `${when}Z`;
}

const dayOf = (when: string, language: string) => formatRomeDateTime(asInstant(when), language, DAY);

/**
 * The person of the drawer, read from the list of the people: the same queries as the page, so there is no second request, and what
 * changes in one changes in both.
 */
function useRowOfTheList(key: string) {
  const { rows, isLoading, isError, error, refetch } = usePeopleRows();
  return { row: rows?.find((candidate) => candidate.key === key), isLoading, isError, error, refetch };
}

export function PersonDrawerTitle({ id }: DetailTitleProps) {
  const { row } = useRowOfTheList(id);
  return <>{row?.name ?? ''}</>;
}

/** Which properties the person reaches: all of them, or the ones it was given (named when the member's own list can be read). */
function PropertiesValue({ row }: { row: PersonRow }) {
  const { t } = useTranslation();
  const someOfThem = row.propertyScope === 'Selected';
  // Only a member with «Solo alcuni» has a list of its own to read; an invitation carries the ids, not the names.
  const own = useOrgMemberProperties(row.id, row.kind === 'member' && someOfThem);

  if (!someOfThem) return <>{t('team.drawer.allProperties')}</>;
  if (row.kind === 'invitation') {
    return <>{row.propertyCount > 0 ? t('team.drawer.someProperties', { count: row.propertyCount }) : t('team.drawer.someOfThem')}</>;
  }
  if (own.isPending) return <SkeletonLine lines={1} />;
  if (own.isError) return <>{t('team.drawer.someOfThem')}</>;

  const granted = own.data.properties.filter((property) => property.granted).map((property) => property.name);
  return <>{granted.length > 0 ? granted.join(', ') : t('team.drawer.noProperties')}</>;
}

/** «Cosa vede»: the matrix of the roles tells what the role does, the areas of the person tell where. */
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

function PersonDetails({ row }: { row: PersonRow }) {
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

      <PlainSection title={t('team.drawer.data')}>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
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

      <PlainSection title={row.kind === 'invitation' ? t('team.preview.titleInvited') : t('team.preview.title')}>
        <PreviewBody row={row} />
      </PlainSection>
    </div>
  );
}

export function PersonDrawerContent({ id }: DetailContentProps) {
  const { t } = useTranslation();
  const { row, isLoading, isError, error, refetch } = useRowOfTheList(id);

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

  return <PersonDetails row={row} />;
}

// Registered when this module is loaded, which the list of the people does (it imports this file): the drawer opens from the list and
// from a shared address (`?detail=org-person:<key>`) on that page.
registerDetail(PERSON_DRAWER_KIND, {
  title: PersonDrawerTitle,
  Content: PersonDrawerContent,
});
