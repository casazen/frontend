import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export function NoAccessPage() {
  const { t } = useTranslation();
  const { forceReauth } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle>{t('shared.noAccess.title')}</CardTitle>
          <CardDescription>
            {t('shared.noAccess.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => forceReauth()}>{t('shared.noAccess.loginAgain')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
