import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RolesPendingPanelProps {
  onRetry: () => void;
  onRenewSession: () => void;
  isRetrying?: boolean;
  isRenewing?: boolean;
}

/**
 * Onboarding saved, Auth0 roles not applied (`rolesSynced: false`, FD-14). The workspace already works through the
 * backend memberships; the new roles reach the access token at the next sign-in or after a successful retry.
 * Both actions lead out of the page: no dead end.
 */
export function RolesPendingPanel({ onRetry, onRenewSession, isRetrying = false, isRenewing = false }: RolesPendingPanelProps) {
  const { t } = useTranslation();
  const busy = isRetrying || isRenewing;

  return (
    <Card className="mx-auto max-w-xl text-left" role="status" data-testid="onboarding-roles-pending">
      <CardHeader>
        <CardTitle>{t('onboarding.rolesPending.title')}</CardTitle>
        <CardDescription>{t('onboarding.rolesPending.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('onboarding.rolesPending.hint')}</p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={onRetry} disabled={busy} data-testid="onboarding-roles-retry">
            {isRetrying ? t('onboarding.rolesPending.retrying') : t('onboarding.rolesPending.retry')}
          </Button>
          <Button type="button" variant="outline" onClick={onRenewSession} disabled={busy} data-testid="onboarding-roles-renew">
            {isRenewing ? t('onboarding.rolesPending.renewing') : t('onboarding.rolesPending.renewAndContinue')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
