import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ListView } from '@/components/shared/list-view/list-view';
import { Button } from '@/components/ui/button';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { usePeopleList } from './people-list';
import { usePeopleRows } from './people-rows';
import { ACCOUNT_INVITE_PATH } from './team-paths';

/**
 * Persone, in the Amministrazione (AM-04b): the people who work with the owner, in the unified list. One row for each member and for
 * each invitation that waits for an answer, with its role, the areas and the state; the name opens the drawer that says what the
 * person can see. Everything is read from the endpoints that are there (`GET /orgs/me/members`, `/invitations`, `/roles`). The one
 * main action of the page is «Invita» (AM-04c): the wizard that brings a new person in.
 */
export function PeoplePage() {
  const { t } = useTranslation();
  const viewsScope = useListViewsScope();
  const { rows, isLoading, isError, error, refetch, invitationsFailed, refetchInvitations } = usePeopleRows({ fresh: true });
  const list = usePeopleList();

  return (
    <div className="min-w-0 space-y-6" data-testid="people-page">
      <PageHeader
        title={t('team.title')}
        description={t('team.description')}
        crumbs="auto"
        primary={{ label: t('team.invite.cta'), icon: UserPlus, to: ACCOUNT_INVITE_PATH, testId: 'people-invite' }}
      />

      {/* The members are there without their invitations: it is said, never guessed (nobody is "not invited" because a list failed). */}
      {invitationsFailed && !isError ? (
        <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-foreground/70" data-testid="people-invitations-note">
          <p className="min-w-0 break-words">{t('team.invitationsUnavailable')}</p>
          <Button type="button" variant="outline" size="sm" onClick={refetchInvitations}>
            {t('team.retry')}
          </Button>
        </div>
      ) : null}

      <ListView
        list={list}
        rows={rows ?? []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        errorTitle={t('team.loadError')}
        onRetry={refetch}
        viewsScope={viewsScope}
        testId="people-list"
      />
    </div>
  );
}
