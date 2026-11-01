import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';

/**
 * Where a person lands with no area at all, and where a 403 on a read sends them (`setApiForbiddenHandler`). The two are told
 * apart: a person who has areas was only refused one page, so the page says so and leads back to the areas (the picker, or the
 * home of the only area), with a new sign-in as the second choice for a role just given; «no workspace, sign in again» is only
 * for a person with no area.
 */
export function NoAccessPage() {
  const { t } = useTranslation();
  const { forceReauth } = useAuth();
  const { contexts, isReady } = useWorkspace();

  if (!isReady) {
    return <LoadingScreen message={t('shared.contextPicker.loading')} />;
  }

  const hasAreas = contexts.length > 0;
  const backTo = contexts.length === 1 ? contexts[0].defaultRoute : '/app/choose-context';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle>{t(hasAreas ? 'shared.noAccess.pageTitle' : 'shared.noAccess.title')}</CardTitle>
          <CardDescription>
            {t(hasAreas ? 'shared.noAccess.pageDescription' : 'shared.noAccess.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          {hasAreas ? (
            <>
              <Button asChild>
                <Link to={backTo} replace>
                  {t(contexts.length === 1 ? 'shared.noAccess.goHome' : 'shared.noAccess.chooseArea')}
                </Link>
              </Button>
              <Button variant="ghost" onClick={() => forceReauth()}>
                {t('shared.noAccess.loginAgain')}
              </Button>
            </>
          ) : (
            <Button onClick={() => forceReauth()}>{t('shared.noAccess.loginAgain')}</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
