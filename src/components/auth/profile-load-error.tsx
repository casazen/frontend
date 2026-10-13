import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { AuthTokenUnavailableError, getHttpStatus, getProblemMessage } from '@/lib/api-errors';

interface ProfileLoadErrorProps {
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
}

/**
 * The caller's profile could not be loaded (A1-19). Distinct from "not onboarded": the account is untouched, so the
 * user retries instead of being sent to the onboarding wizard, where they could redo it and change their roles.
 */
export function ProfileLoadError({ error, onRetry, isRetrying = false }: ProfileLoadErrorProps) {
  const { t } = useTranslation();
  const { forceReauth } = useAuth();
  const isSessionProblem = error instanceof AuthTokenUnavailableError || getHttpStatus(error) === 401;
  const reason = getProblemMessage(error, t);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4" data-testid="profile-load-error">
      <Card className="w-full max-w-lg text-center" role="alert">
        <CardHeader>
          <div className="flex items-center justify-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            <CardTitle>{t('shared.profileLoadError.title')}</CardTitle>
          </div>
          <CardDescription>{reason ?? t('shared.profileLoadError.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason ? <p className="text-sm text-muted-foreground">{t('shared.profileLoadError.description')}</p> : null}
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={onRetry} disabled={isRetrying} data-testid="profile-load-retry">
              {isRetrying ? t('shared.profileLoadError.retrying') : t('shared.profileLoadError.retry')}
            </Button>
            {isSessionProblem ? (
              <Button type="button" variant="outline" onClick={() => forceReauth()}>
                {t('shared.profileLoadError.signInAgain')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
