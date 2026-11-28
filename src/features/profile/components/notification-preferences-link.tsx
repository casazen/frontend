import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NOTIFICATION_PREFERENCES_PATH } from '../notification-preferences-model';

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
