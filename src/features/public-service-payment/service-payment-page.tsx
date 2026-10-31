import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import type { PublicServicePayment } from '@/api/service-payments.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { clientStatusFromRedirect, type ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { formatMoney } from '@/features/supplier/services/lib/service-money';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useSeoMeta } from '@/lib/seo-meta';
import { stripeLocale } from '@/lib/stripe-appearance';
import { formatDate } from '@/lib/utils';
import { useCreateServicePaymentSession, usePublicServicePayment } from '@/queries/use-service-payment';

function InvalidLink() {
  const { t } = useTranslation();
  return (
    <p className="flex items-start gap-2 text-sm" role="alert" data-testid="service-payment-invalid-link">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      {t('servicePayment.invalidLink')}
    </p>
  );
}

interface PaymentContentProps {
  payment: PublicServicePayment;
  token: string;
  clientStatus: ClientPaymentStatus | null;
  onSubmitted: (status: ClientPaymentStatus) => void;
}

function PaymentContent({ payment, token, clientStatus, onSubmitted }: PaymentContentProps) {
  const { t, i18n } = useTranslation();
  const session = useCreateServicePaymentSession(payment.id, token);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const amount = formatMoney(payment.amountCents, i18n.language);

  const summary = (
    <div className="space-y-3" data-testid="service-payment-summary">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">{t('servicePayment.supplier')}</dt>
        <dd className="font-medium">{payment.supplierName}</dd>
        <dt className="text-muted-foreground">{t('servicePayment.service')}</dt>
        <dd className="font-medium">{payment.serviceName}</dd>
        {payment.propertyName ? (
          <>
            <dt className="text-muted-foreground">{t('servicePayment.property')}</dt>
            <dd className="font-medium">{payment.propertyName}</dd>
          </>
        ) : null}
        {payment.completedAt ? (
          <>
            <dt className="text-muted-foreground">{t('servicePayment.completed')}</dt>
            <dd className="font-medium">{formatDate(payment.completedAt)}</dd>
          </>
        ) : null}
      </dl>
      {payment.lines.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {payment.lines.map((line, index) => (
            <li key={`${index}-${line.label}`} className="flex justify-between gap-4">
              <span>{line.label}</span>
              <span className="tabular-nums">{formatMoney(line.amountCents, i18n.language)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="flex items-baseline justify-between border-t pt-2">
        <span className="text-sm text-muted-foreground">{t('servicePayment.total')}</span>
        <span className="text-lg font-semibold tabular-nums">{amount}</span>
      </p>
    </div>
  );

  if (payment.state === 'Paid') {
    return (
      <div className="space-y-4">
        {summary}
        <p className="flex items-center gap-2 text-sm text-green-700" data-testid="service-payment-paid">
          <CheckCircle2 className="h-4 w-4" />
          {t('servicePayment.paid')}
        </p>
      </div>
    );
  }

  if (payment.state === 'Processing' || (payment.state === 'Payable' && (clientStatus === 'succeeded' || clientStatus === 'processing'))) {
    return (
      <div className="space-y-4">
        {summary}
        <p className="flex items-center gap-2 text-sm" data-testid="service-payment-processing">
          <Clock className="h-4 w-4" />
          {t('servicePayment.processing')}
        </p>
      </div>
    );
  }

  if (payment.state === 'Unavailable') {
    return (
      <div className="space-y-4">
        {summary}
        <p className="text-sm text-muted-foreground" data-testid="service-payment-unavailable">
          {t('servicePayment.unavailable')}
        </p>
      </div>
    );
  }

  const failed = payment.lastAttemptFailed || clientStatus === 'failed';
  return (
    <div className="space-y-4">
      {summary}
      {failed ? (
        <p className="text-sm text-destructive" role="alert" data-testid="service-payment-failed">
          {t('servicePayment.failed')}
        </p>
      ) : null}
      {paymentError ? (
        <p className="text-sm text-destructive" role="alert">
          {paymentError}
        </p>
      ) : null}
      {session.data ? (
        <StripeIntentPayment
          mode="payment"
          publishableKey={session.data.publishableKey}
          // Null for the money CasaZen holds: the PaymentIntent is on the platform and Stripe.js is loaded with the publishable key alone.
          stripeAccountId={session.data.stripeAccountId}
          clientSecret={session.data.clientSecret}
          locale={stripeLocale(i18n.language)}
          returnUrl={window.location.href}
          onSubmitted={(status) => {
            setPaymentError(null);
            onSubmitted(status);
          }}
          onError={setPaymentError}
        />
      ) : (
        <div className="space-y-2">
          {session.isError ? (
            <p className="text-sm text-destructive" role="alert" data-testid="service-payment-session-error">
              {getProblemMessage(session.error, t) ?? t('servicePayment.sessionError')}
            </p>
          ) : null}
          <Button className="w-full" onClick={() => session.mutate()} disabled={session.isPending} data-testid="service-payment-start">
            {session.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('servicePayment.payNow', { amount })}
          </Button>
          <p className="text-xs text-muted-foreground">{t('servicePayment.notice')}</p>
          {payment.validUntil ? <p className="text-xs text-muted-foreground">{t('servicePayment.validUntil', { date: formatDate(payment.validUntil) })}</p> : null}
        </div>
      )}
    </div>
  );
}

/**
 * The host pays a service a supplier completed, `/service/pay/:paymentId?token=…` from the link of the payment request (SP-15c-d). The
 * token is the only access check and goes in the body. The PaymentIntent is on the platform when CasaZen holds the money (no connected
 * account, so Stripe.js is loaded with the publishable key alone) and on the supplier's account for a payment made the old way: the
 * session says which. The page shows "paid" only when the backend says so (the Stripe webhook), never from the browser's own result.
 * Also the Stripe `return_url` of a redirect. Private: never indexed.
 */
export function ServicePaymentPage() {
  const { t } = useTranslation();
  const { paymentId = '' } = useParams<{ paymentId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [clientStatus, setClientStatus] = useState<ClientPaymentStatus | null>(clientStatusFromRedirect(searchParams.get('redirect_status')));
  const awaitingStripe = clientStatus === 'succeeded' || clientStatus === 'processing';
  const { data: payment, isLoading, isError, error, refetch, isFetching } = usePublicServicePayment(paymentId, token, awaitingStripe);
  useSeoMeta({ title: t('servicePayment.title'), noindex: true });

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Card data-testid="service-payment-page">
          <CardHeader>
            <CardTitle>{t('servicePayment.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!token ? (
              <InvalidLink />
            ) : isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="service-payment-loading">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('servicePayment.loading')}
              </p>
            ) : isError ? (
              getHttpStatus(error) === 404 ? (
                <InvalidLink />
              ) : (
                <div className="space-y-2" role="alert" data-testid="service-payment-error">
                  <p className="text-sm text-destructive">{getProblemMessage(error, t) ?? t('servicePayment.loadError')}</p>
                  <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                    {t('servicePayment.retry')}
                  </Button>
                </div>
              )
            ) : payment ? (
              <PaymentContent
                payment={payment}
                token={token}
                clientStatus={clientStatus}
                onSubmitted={(status) => {
                  setClientStatus(status);
                  void refetch();
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
