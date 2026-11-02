import { useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, ChevronRight, CircleCheck, Expand, UserCheck } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { registerDetail, type DetailContentProps, type DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';
import { ErrorState } from '@/components/shared/error-state';
import { StatusExplainer } from '@/components/shared/status/status-explainer';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { ScheduledChangeNotice } from '@/features/properties/mode/components/scheduled-change-notice';
import { propertyDetailPath, propertyModePath } from '@/features/properties/mode/paths';
import { propertyActivationPath } from '@/features/properties/properties-paths';
import { formatPropertyLocation } from '@/features/properties/property-location';
import { PERSON_DRAWER_KIND } from '@/features/team/person-drawer';
import { memberName } from '@/features/team/people-rows';
import type { OrgMember } from '@/types/org-team.types';
import { ACCOUNT_PEOPLE_PATH } from '../account-home-model';
import { orgRoleLabel } from '../account-roles';
import { areaKeyOf, missingLabel, reachesProperty, type AccountPropertyRow } from './account-properties-model';
import { ResponsiblePicker } from './responsible-picker';
import { useAccountPropertyRights, useAccountPropertyRows, useMemberAccess } from './use-account-property-rows';

/** What the address calls the drawer of a property of the account: `?detail=account-property:<id>`. */
export const ACCOUNT_PROPERTY_DRAWER_KIND = 'account-property';

/**
 * The property of the drawer, read from the list of the account: the same queries as the page, so there is no second request, and
 * what changes in one changes in both.
 */
function useRowOfTheList(id: string) {
  const data = useAccountPropertyRows();
  return { ...data, row: data.rows?.find((candidate) => candidate.property.id === id) };
}

export function AccountPropertyDrawerTitle({ id }: DetailTitleProps) {
  const { row } = useRowOfTheList(id);
  return <>{row?.property.name ?? ''}</>;
}

/** The people who can open the property, by name and role, each one leading to what that person sees. */
function WhoCanOpen({ row, members }: { row: AccountPropertyRow; members: readonly OrgMember[] | undefined }) {
  const { t } = useTranslation();
  const { granted, isPending, isError, retry } = useMemberAccess(members);
  const people = useMemo(() => (members ?? []).filter((member) => reachesProperty(member, row, granted.get(member.id))), [members, row, granted]);

  if (!members) return <p className="text-sm text-foreground/70">{t('accountProperties.drawer.whoUnavailable')}</p>;
  if (isPending) return <SkeletonLine lines={3} label={t('accountProperties.drawer.loading')} />;

  return (
    <div className="space-y-3">
      {isError ? (
        <Alert
          variant="warning"
          action={
            <Button type="button" size="sm" variant="outline" onClick={retry}>
              {t('accountProperties.drawer.retry')}
            </Button>
          }
        >
          {t('accountProperties.drawer.whoIncomplete')}
        </Alert>
      ) : null}
      <ul role="list" className="divide-y divide-border border-y border-border" data-testid="account-property-who-list">
        {people.map((member) => (
          <li key={member.id}>
            <Link
              to={`${ACCOUNT_PEOPLE_PATH}?detail=${PERSON_DRAWER_KIND}:m-${member.id}`}
              className="flex min-h-11 items-center justify-between gap-3 py-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block break-words font-medium">{memberName(member)}</span>
                <span className="block break-words text-sm text-foreground/70">{orgRoleLabel(member.role, t)}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Details({ row, membersKnown, canWrite, onAssign }: { row: AccountPropertyRow; membersKnown: boolean; canWrite: boolean; onAssign: () => void }) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t('accountProperties.drawer.data')}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-foreground/70">{t('accountProperties.list.columns.mode')}</dt>
        <dd className="break-words">{t(row.mode === 'Long' ? 'accountProperties.mode.long' : 'accountProperties.mode.short')}</dd>
        <dt className="text-foreground/70">{t('accountProperties.drawer.address')}</dt>
        <dd className="break-words">{formatPropertyLocation(row.property)}</dd>
        <dt className="text-foreground/70">{t('accountProperties.list.columns.responsible')}</dt>
        <dd className="break-words">
          {membersKnown ? <span className="font-medium">{row.responsible ? row.responsible.name : t('accountProperties.list.nobody')}</span> : t('accountProperties.list.unknown')}
          {membersKnown && canWrite ? (
            <div className="mt-2">
              <Button type="button" size="sm" variant="outline" className="max-md:min-h-11" onClick={onAssign} data-testid="account-property-drawer-assign">
                <UserCheck aria-hidden="true" className="size-4" />
                {t('accountProperties.drawer.assign')}
              </Button>
            </div>
          ) : null}
        </dd>
        {row.missing.length > 0 ? (
          <>
            <dt className="text-foreground/70">{t('accountProperties.drawer.missing')}</dt>
            <dd className="break-words">{row.missing.map((item) => missingLabel(item, t)).join(', ')}</dd>
          </>
        ) : null}
        {row.advice.length > 0 ? (
          <>
            <dt className="text-foreground/70">{t('accountProperties.drawer.advice')}</dt>
            <dd className="break-words">{row.advice.map((item) => missingLabel(item, t)).join(', ')}</dd>
          </>
        ) : null}
      </dl>
    </PlainSection>
  );
}

export function AccountPropertyDrawerContent({ id }: DetailContentProps) {
  const { t } = useTranslation();
  const rights = useAccountPropertyRights();
  const { row, members, membersKnown, isLoading, isError, error, refetch } = useRowOfTheList(id);
  const [assigning, setAssigning] = useState(false);

  if (isLoading) return <SkeletonLine lines={4} />;

  if (isError && !row) {
    return <ErrorState title={t('accountProperties.drawer.loadError')} error={error} onRetry={refetch} />;
  }

  if (!row) {
    return (
      <div role="status" className="space-y-1 py-4" data-testid="account-property-drawer-not-found">
        <p className="font-semibold">{t('accountProperties.drawer.notFound')}</p>
        <p className="text-sm text-foreground/70">{t('accountProperties.drawer.notFoundDescription')}</p>
      </div>
    );
  }

  const area = areaKeyOf(row.mode);
  const canRead = row.mode === 'Long' ? rights.longRead : rights.shortRead;
  const canWrite = row.mode === 'Long' ? rights.longWrite : rights.shortWrite;

  const completing = row.needsCompleting && rights.shortWrite;
  const openPage = (quiet: boolean) =>
    canRead ? (
      <Button key="open" asChild variant={quiet ? 'outline' : 'default'} size={quiet ? 'sm' : 'default'} className={quiet ? 'max-md:min-h-11' : undefined}>
        <Link to={propertyDetailPath(area, row.property.id)} data-testid="account-property-drawer-open">
          <Expand aria-hidden="true" className="size-4" />
          {t('accountProperties.drawer.open')}
        </Link>
      </Button>
    ) : null;

  // The one thing to do now: complete a short-term property that cannot work yet, otherwise open its page in its section.
  const mainAction = completing ? (
    <Button asChild>
      <Link to={propertyActivationPath(row.property.id)} data-testid="account-property-drawer-complete">
        <CircleCheck aria-hidden="true" className="size-4" />
        {t('accountProperties.drawer.complete')}
      </Link>
    </Button>
  ) : (
    openPage(false)
  );
  const moreActions = [
    completing ? openPage(true) : null,
    canWrite ? (
      <Button key="mode" asChild variant="outline" size="sm" className="max-md:min-h-11">
        <Link to={propertyModePath(area, row.property.id, 'account')} data-testid="account-property-drawer-mode">
          <ArrowRightLeft aria-hidden="true" className="size-4" />
          {t(row.mode === 'Long' ? 'accountProperties.list.actions.toShort' : 'accountProperties.list.actions.toLong')}
        </Link>
      </Button>
    ) : null,
  ].filter((action): action is ReactElement => action !== null);

  return (
    <div className="space-y-6 pb-2" data-testid="account-property-drawer">
      {row.state?.kind === 'property' ? <StatusExplainer kind="property" status={row.state.status} actions={mainAction} /> : null}
      {row.state?.kind === 'longRentProperty' ? <StatusExplainer kind="longRentProperty" status={row.state.status} actions={mainAction} /> : null}
      {row.state === null && mainAction ? <div className="flex flex-wrap gap-2">{mainAction}</div> : null}

      {/* A change of mode that waits for its day, with "Annulla il passaggio": read when the drawer opens, nothing if there is none. */}
      {canRead ? <ScheduledChangeNotice area={area} propertyId={row.property.id} /> : null}

      <Details row={row} membersKnown={membersKnown} canWrite={canWrite} onAssign={() => setAssigning(true)} />

      <PlainSection title={t('accountProperties.drawer.who')}>
        <WhoCanOpen row={row} members={members} />
      </PlainSection>

      {moreActions.length > 0 ? (
        <PlainSection title={t('accountProperties.drawer.moreActions')}>
          <div className="flex flex-wrap gap-2">{moreActions}</div>
        </PlainSection>
      ) : null}

      {/* Over the drawer: a dialog of its own, so the person puts somebody in charge without leaving the property. */}
      <ResponsiblePicker rows={assigning ? [row] : null} members={members ?? []} onClose={() => setAssigning(false)} />
    </div>
  );
}

// Registered when this module is loaded, which the list of the account does (it imports this file): the drawer opens from the list and
// from a shared address (`?detail=account-property:<id>`) on that page. No `pageHref`: the page of a property depends on its mode,
// which only the content knows ("Apri la scheda" is its button).
registerDetail(ACCOUNT_PROPERTY_DRAWER_KIND, {
  title: AccountPropertyDrawerTitle,
  Content: AccountPropertyDrawerContent,
});
