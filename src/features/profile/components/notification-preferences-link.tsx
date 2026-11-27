import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NOTIFICATION_PREFERENCES_PATH } from '../notification-preferences-model';

/**
 * The way from the profile to the settings of the alerts (E05/F03/US02): the page is also the second tab of the profile, and this is the same
 * way in for the phone, where the tabs are a menu, and for whoever looks for it in the page and not above it.
 */
export function NotificationPreferencesLink() {
  const { t } = useTranslation();

  return (
    <Card data-testid="notification-preferences-link">
      <CardHeader>
        <CardTitle>{t('notificationPreferences.profileLink.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <p className="min-w-0 max-w-prose break-words text-sm text-foreground/70">{t('notificationPreferences.profileLink.description')}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to={NOTIFICATION_PREFERENCES_PATH}>{t('notificationPreferences.profileLink.action')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
