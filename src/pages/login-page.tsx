import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, LogIn } from 'lucide-react';

export function LoginPage() {
  const { isAuthenticated, user, error, login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/app/choose-context', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Auth0 rejected the request (e.g. `invalid_request`, `access_denied`): the SDK error carries the OAuth code. The raw
  // `error_description` is never shown (it names client and API identifiers); only the code, to quote to support.
  const authErrorCode = error ? ((error as { error?: unknown }).error ?? error.name) : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Home className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl">{t('login.brand')}</CardTitle>
          <CardDescription>{t('login.platformDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="danger" title={t('login.errorTitle')}>
              {t('login.errorMessage')}
              {typeof authErrorCode === 'string' && authErrorCode && (
                <span className="mt-1 block text-xs">{t('login.errorCode', { code: authErrorCode })}</span>
              )}
            </Alert>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {t('login.signInMessage')}
          </p>
          <Button onClick={() => login()} className="w-full" size="lg">
            <LogIn className="mr-2 h-5 w-5" />
            {t('login.signInButton')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
