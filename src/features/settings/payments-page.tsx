import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { FocusBlock } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { isRetryableConnectError, type ConnectUiStatus } from '@/types/connect.types';
import { AlertCircle, CheckCircle2, Clock, ExternalLink, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useConnectPayments, type ConnectPayments } from './use-connect-payments';

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
    <Alert
      variant="danger"
      data-testid={testId}
      action={
        retryable ? (
          <Button type="button" variant="outline" size="sm" loading={retrying} onClick={onRetry}>
            {t('settings.connectRetry')}
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
}

/** What the status badge says, and how: an icon always goes with the color. */
const STATUS_VIEW: Record<ConnectUiStatus, { labelKey: string; variant: 'secondary' | 'warning' | 'success'; Icon: LucideIcon }> = {
  disconnected: { labelKey: 'settings.connectStatusDisconnected', variant: 'secondary', Icon: AlertCircle },
  pending: { labelKey: 'settings.connectStatusPending', variant: 'warning', Icon: Clock },
  active: { labelKey: 'settings.connectStatusActive', variant: 'success', Icon: CheckCircle2 },
};

function OnboardingError({ payments }: { payments: ConnectPayments }) {
  const { t } = useTranslation();
  const { startOnboarding } = payments;

  return (
    <ConnectErrorAlert
      testId="connect-onboarding-error"
      message={getProblemMessage(startOnboarding.error, t) ?? t('toast.connectOnboardingFailed')}
      retryable={isRetryableConnectError(startOnboarding.error)}
      retrying={startOnboarding.isPending}
      onRetry={() => startOnboarding.mutate()}
    />
  );
}

/**
 * The one block to look at when the account cannot take payments yet: the booking site does not take them either, and the button
 * that connects Stripe or finishes the verification is here. Nothing while the status is not known (a failed read is never "not
 * connected") or when the account is active. A failed attempt is told under the block, next to the button.
 */
export function PaymentsFocus({ payments }: { payments: ConnectPayments }) {
  const { t } = useTranslation();
  const { status, uiStatus, startOnboarding } = payments;

  if (!status || uiStatus === 'active') return null;

  return (
    <div className="min-w-0 space-y-3">
      <FocusBlock
        data-testid="connect-checkout-gate-banner"
        tone="warning"
        kicker={t('accountSettings.focus.kicker')}
        title={t('settings.bookingSiteNotActive')}
        body={t('settings.bookingSiteNotActiveDescription')}
        primary={{
          label: uiStatus === 'disconnected' ? t('settings.connectStripe') : t('settings.completeVerification'),
          onClick: () => startOnboarding.mutate(),
          loading: startOnboarding.isPending,
          testId: 'connect-stripe-cta',
        }}
      />
      {startOnboarding.isError ? <OnboardingError payments={payments} /> : null}
    </div>
  );
}

interface PaymentsBodyProps {
  payments: ConnectPayments;
  /**
   * The button that connects Stripe or finishes the verification. Not when {@link PaymentsFocus} is on the page: the page has one
   * button for it, in the block that asks for it.
   */
  showAction: boolean;
}

/** Where the Stripe account stands: its state in a word, what it means, the account, and the way to go on when the page does not show another. */
export function PaymentsBody({ payments, showAction }: PaymentsBodyProps) {
  const { t } = useTranslation();
  const { status, uiStatus, isLoading, isError, error, isFetching, refetch, startOnboarding } = payments;
  const view = STATUS_VIEW[uiStatus];
  const hasRequirements = (status?.requirementsDue?.length ?? 0) > 0;
  const needsAction = uiStatus !== 'active';

  return (
    <div className="min-w-0 space-y-4" data-testid="connect-payments">
      {isLoading ? <SkeletonLine lines={2} label={t('settings.loadingPayments')} /> : null}

      {isError ? (
        <ConnectErrorAlert
          testId="connect-status-error"
          message={getProblemMessage(error, t) ?? t('settings.stripeStatusError')}
          retryable={isRetryableConnectError(error)}
          retrying={isFetching}
          onRetry={() => void refetch()}
        />
      ) : null}

      {status ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm text-foreground/70">{t('settings.stripeConnectionStatus')}</span>
            <Badge variant={view.variant} className="gap-1" data-testid="connect-status-badge">
              <view.Icon className="size-3.5 shrink-0" aria-hidden="true" />
              {t(view.labelKey)}
            </Badge>
          </div>

          {uiStatus === 'active' ? <p className="text-sm text-foreground/70">{t('settings.accountActiveMessage')}</p> : null}

          {hasRequirements && needsAction ? (
            <div className="space-y-0.5 text-sm" data-testid="connect-requirements-alert">
              <p className="font-medium">{t('settings.verificationIncomplete')}</p>
              <p className="text-foreground/70">{t('settings.verificationIncompleteDescription')}</p>
            </div>
          ) : null}

          {status.connectedAccountId ? (
            <p className="break-all text-xs text-foreground/70">
              {t('settings.stripeAccount')} <code>{status.connectedAccountId}</code>
            </p>
          ) : null}
        </div>
      ) : null}

      {showAction && status && needsAction ? (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          loading={startOnboarding.isPending}
          iconRight={<ExternalLink />}
          onClick={() => startOnboarding.mutate()}
          data-testid="connect-stripe-cta"
        >
          {uiStatus === 'disconnected' ? t('settings.connectStripe') : t('settings.completeVerification')}
        </Button>
      ) : null}

      {showAction && startOnboarding.isError ? <OnboardingError payments={payments} /> : null}
    </div>
  );
}

/** Online payments of the org in the short-rent shell: connect the Stripe account that receives what the guests pay. */
export function ConnectPaymentsPage() {
  const { t } = useTranslation();
  const payments = useConnectPayments();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('settings.connectPaymentsTitle')} description={t('settings.connectDescription')} crumbs="auto" />

        <div className={cn(FOCUS_COLUMN, 'space-y-6')}>
          <PaymentsFocus payments={payments} />
          <PaymentsBody payments={payments} showAction={false} />

          <p className="text-sm text-foreground/70">
            {t('settings.managePlanIn')}{' '}
            <Link to="/app/short-rent/settings/plan" className="underline">
              {t('settings.planSettings')}
            </Link>
            .
          </p>
        </div>
      </div>
    </AppShell>
  );
}
