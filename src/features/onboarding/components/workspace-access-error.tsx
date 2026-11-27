import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function WorkspaceAccessError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="mx-auto max-w-xl text-left" role="alert" data-testid="onboarding-access-error">
      <CardHeader>
        <CardTitle>{t('onboardingAccess.title')}</CardTitle>
        <CardDescription>{t('onboardingAccess.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={onRetry} data-testid="onboarding-access-retry">{t('onboardingAccess.retry')}</Button>
      </CardContent>
    </Card>
  );
}
