import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { PAGE_MAIN_ASIDE } from '@/components/layout/page-columns';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useNotificationPreferences } from '@/queries/use-notification-preferences';
import { NotificationChannelsSection } from './components/notification-channels-section';
import { QuietHoursSection } from './components/quiet-hours-section';

/**
 * «Notifiche», the second tab of the profile (E05/F03/US02, NF-65, ADR-025): the user chooses, for each kind of event, which channels alert
 * them (phone, browser, email, the bell) and from when to when the phone and the email stay quiet. The settings are the user's own, so the
 * page asks for no permission; the API (`GET` and `PUT api/me/notification-preferences`) takes the user from the token.
 */
export function NotificationPreferencesPage() {
  const { t } = useTranslation();
  const { data, isError, error, refetch } = useNotificationPreferences();

  return (
    <div className="space-y-6" data-testid="notification-preferences-page">
      <PageHeader title={t('notificationPreferences.title')} description={t('notificationPreferences.description')} crumbs="auto" />

      {data ? (
        <div className={PAGE_MAIN_ASIDE}>
          <NotificationChannelsSection preferences={data} />
          <QuietHoursSection quietHours={data.quietHours} />
        </div>
      ) : isError ? (
        <ErrorState title={t('notificationPreferences.loadFailed')} error={error} onRetry={() => void refetch()} />
      ) : (
        <SkeletonTable rows={8} columns={5} label={t('notificationPreferences.loading')} />
      )}
    </div>
  );
}
