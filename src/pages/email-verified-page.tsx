import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, LogIn, MailWarning } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export type EmailVerificationOutcome = 'verified' | 'failed' | 'unknown';

/**
 * Auth0 appends `success` and `code` to the Redirect To URL of the verification email.
 * `code=success` is not an OAuth code: this page is not the login redirect (`window.location.origin`).
 */
export function emailVerificationOutcome(params: URLSearchParams): EmailVerificationOutcome {
  const success = params.get('success');
  if (success === 'false') return 'failed';
  if (success === 'true' || params.get('code') === 'success') return 'verified';
  return 'unknown';
}

/**
 * Landing page of the Auth0 verification email (Redirect To). Stays outside the login callback so Auth0's
 * `code=success` is not treated as an authorization code.
 */
export function EmailVerifiedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoading, isAuthenticated, login } = useAuth();
  const outcome = emailVerificationOutcome(searchParams);
  const failed = outcome === 'failed';

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md" data-testid="email-verified-page" data-outcome={outcome}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {failed ? <MailWarning className="h-8 w-8" aria-hidden /> : <Home className="h-8 w-8" aria-hidden />}
          </div>
          <CardTitle className="text-2xl">
            {t(failed ? 'emailVerified.failedTitle' : outcome === 'verified' ? 'emailVerified.title' : 'emailVerified.unknownTitle')}
          </CardTitle>
          <CardDescription>
            {t(
              failed
                ? 'emailVerified.failedDescription'
                : outcome === 'verified'
                  ? 'emailVerified.description'
                  : 'emailVerified.unknownDescription',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" size="lg" disabled={isLoading} onClick={() => login()} data-testid="email-verified-sign-in">
            <LogIn className="mr-2 h-5 w-5" />
            {t('emailVerified.signIn')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
