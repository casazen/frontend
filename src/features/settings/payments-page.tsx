import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { CONNECT_STATUS_KEY, useConnectStatus, useStartConnectOnboarding } from '@/queries/use-connect';
import { isRetryableConnectError, resolveConnectUiStatus } from '@/types/connect.types';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

interface ConnectErrorAlertProps {
  message: string;
  retryable: boolean;
  retrying: boolean;
  onRetry: () => void;
  testId: string;
}

/**
 * A failed Connect call. The account linked on Stripe is never changed by a failure (BK-09): the page says what went
 * wrong and offers "Riprova" when retrying may help, never a "not connected" state it did not read.
 */
function ConnectErrorAlert({ message, retryable, retrying, onRetry, testId }: ConnectErrorAlertProps) {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      data-testid={testId}
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
    >
      <p className="text-destructive">{message}</p>
      {retryable && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          {t('settings.connectRetry')}
        </Button>
      )}
    </div>
  );
}

export function ConnectPaymentsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const stripeReturn = searchParams.get('stripe_return') === '1' || searchParams.get('stripe_refresh') === '1';

  const { data: status, isLoading, isError, error, refetch, isFetching } = useConnectStatus(stripeReturn);
  const startOnboarding = useStartConnectOnboarding();

  useEffect(() => {
    if (!stripeReturn)
      return;

    void queryClient.invalidateQueries({ queryKey: CONNECT_STATUS_KEY });
    setSearchParams({}, { replace: true });
  }, [stripeReturn, queryClient, setSearchParams]);

  const uiStatus = resolveConnectUiStatus(status);
  const hasRequirements = (status?.requirementsDue?.length ?? 0) > 0;

  const STATUS_LABEL: Record<ReturnType<typeof resolveConnectUiStatus>, string> = {
    disconnected: t('settings.connectStatusDisconnected'),
    pending: t('settings.connectStatusPending'),
    active: t('settings.connectStatusActive'),
  };

  const STATUS_VARIANT: Record<ReturnType<typeof resolveConnectUiStatus>, 'secondary' | 'outline' | 'default'> = {
    disconnected: 'secondary',
    pending: 'outline',
    active: 'default',
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={t('settings.connectPaymentsTitle')}
          description={t('settings.connectDescription')}
        />

        {status && !status.chargesEnabled && (
          <div
            role="alert"
            data-testid="connect-checkout-gate-banner"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm space-y-1"
          >
            <p className="font-medium text-destructive">{t('settings.bookingSiteNotActive')}</p>
            <p className="text-muted-foreground">
              {t('settings.bookingSiteNotActiveDescription')}
            </p>
          </div>
        )}

        <div className="rounded-lg border bg-card p-6 space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">{t('settings.loadingPayments')}</p>}

          {isError && (
            <ConnectErrorAlert
              testId="connect-status-error"
              message={getProblemMessage(error, t) ?? t('settings.stripeStatusError')}
              retryable={isRetryableConnectError(error)}
              retrying={isFetching}
              onRetry={() => void refetch()}
            />
          )}

          {status && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t('settings.stripeConnectionStatus')}</p>
                <div className="mt-1 flex items-center gap-2">
                  {uiStatus === 'active' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
                  ) : uiStatus === 'pending' ? (
                    <Clock className="h-5 w-5 text-amber-600" aria-hidden />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-muted-foreground" aria-hidden />
                  )}
                  <Badge variant={STATUS_VARIANT[uiStatus]} data-testid="connect-status-badge">
                    {STATUS_LABEL[uiStatus]}
                  </Badge>
                </div>
              </div>

              {uiStatus !== 'active' && (
                <Button
                  onClick={() => startOnboarding.mutate()}
                  disabled={startOnboarding.isPending}
                  data-testid="connect-stripe-cta"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {uiStatus === 'disconnected' ? t('settings.connectStripe') : t('settings.completeVerification')}
                </Button>
              )}
            </div>
          )}

          {startOnboarding.isError && (
            <ConnectErrorAlert
              testId="connect-onboarding-error"
              message={getProblemMessage(startOnboarding.error, t) ?? t('toast.connectOnboardingFailed')}
              retryable={isRetryableConnectError(startOnboarding.error)}
              retrying={startOnboarding.isPending}
              onRetry={() => startOnboarding.mutate()}
            />
          )}

          {status?.connectedAccountId && (
            <p className="text-xs text-muted-foreground">
              {t('settings.stripeAccount')} <code>{status.connectedAccountId}</code>
            </p>
          )}

          {hasRequirements && uiStatus !== 'active' && (
            <div
              role="alert"
              data-testid="connect-requirements-alert"
              className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm space-y-1"
            >
              <p className="font-medium">{t('settings.verificationIncomplete')}</p>
              <p className="text-muted-foreground">
                {t('settings.verificationIncompleteDescription')}
              </p>
            </div>
          )}

          {uiStatus === 'active' && (
            <p className="text-sm text-muted-foreground">
              {t('settings.accountActiveMessage')}
            </p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {t('settings.managePlanIn')}{' '}
          <Link to="/app/short-rent/settings/plan" className="underline">
            {t('settings.planSettings')}
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
