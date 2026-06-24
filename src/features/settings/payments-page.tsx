import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CONNECT_STATUS_KEY, useConnectStatus, useStartConnectOnboarding } from '@/queries/use-connect';
import { resolveConnectUiStatus } from '@/types/connect.types';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

export function ConnectPaymentsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const stripeReturn = searchParams.get('stripe_return') === '1' || searchParams.get('stripe_refresh') === '1';

  const { data: status, isLoading, isError } = useConnectStatus(stripeReturn);
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

        {!status?.chargesEnabled && (
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
                onClick={() => void startOnboarding.mutateAsync()}
                disabled={startOnboarding.isPending || isLoading}
                data-testid="connect-stripe-cta"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {uiStatus === 'disconnected' ? t('settings.connectStripe') : t('settings.completeVerification')}
              </Button>
            )}
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">{t('settings.loadingPayments')}</p>}
          {isError && (
            <p className="text-sm text-destructive">{t('settings.stripeStatusError')}</p>
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
