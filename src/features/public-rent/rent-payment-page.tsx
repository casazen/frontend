import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import {
  clientStatusFromRedirect,
  type ClientPaymentStatus,
} from '@/features/public-booking/checkout-outcome';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useCreateRentPaymentSession, usePublicRentPayment } from '@/queries/use-rent';
import type { PublicRentPayment } from '@/types';

/**
 * The tenant pays a rent installment (LT-06), `/rent/pay/:installmentId?token=…` from the payment request email. The
 * payment goes to the landlord's Stripe connected account with the Stripe Payment Element; the page shows "paid" only
 * when the backend says so (Stripe webhook), never from the browser's own result. Also the Stripe `return_url` of
 * redirect methods.
 */
export function RentPaymentPage() {
  const { t } = useTranslation();
  const { installmentId = '' } = useParams<{ installmentId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [clientStatus, setClientStatus] = useState<ClientPaymentStatus | null>(
    clientStatusFromRedirect(searchParams.get('redirect_status')),
  );
  const awaitingStripe = clientStatus === 'succeeded' || clientStatus === 'processing';
  const { data: payment, isLoading, isError, error, refetch, isFetching } = usePublicRentPayment(
    installmentId,
    token,
    awaitingStripe,
  );

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Card data-testid="rent-payment-page">
          <CardHeader>
            <CardTitle>{t('rentPayment.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!token ? (
              <InvalidLink />
            ) : isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="rent-payment-loading">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('rentPayment.loading')}
              </p>
            ) : isError ? (
              getHttpStatus(error) === 404 ? (
                <InvalidLink />
              ) : (
                <div className="space-y-2" role="alert" data-testid="rent-payment-error">
                  <p className="text-sm text-destructive">{getProblemMessage(error, t) ?? t('rentPayment.loadError')}</p>
                  <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                    {t('rentPayment.retry')}
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

function InvalidLink() {
  const { t } = useTranslation();
  return (
    <p className="flex items-start gap-2 text-sm" role="alert" data-testid="rent-payment-invalid-link">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      {t('rentPayment.invalidLink')}
    </p>
  );
}

interface PaymentContentProps {
  payment: PublicRentPayment;
  token: string;
  clientStatus: ClientPaymentStatus | null;
  onSubmitted: (status: ClientPaymentStatus) => void;
}

function PaymentContent({ payment, token, clientStatus, onSubmitted }: PaymentContentProps) {
  const { t } = useTranslation();
  const session = useCreateRentPaymentSession(payment.installmentId, token);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const summary = (
    <dl className="grid grid-cols-2 gap-2 text-sm" data-testid="rent-payment-summary">
      <dt className="text-muted-foreground">{t('rentPayment.property')}</dt>
      <dd className="font-medium">{payment.propertyName}</dd>
      <dt className="text-muted-foreground">{t('rentPayment.landlord')}</dt>
      <dd className="font-medium">{payment.landlordName}</dd>
      <dt className="text-muted-foreground">{t('rentPayment.period')}</dt>
      <dd className="font-medium">
        {formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)}
      </dd>
      <dt className="text-muted-foreground">{t('rentPayment.dueDate')}</dt>
      <dd className="font-medium">{formatDate(payment.dueDate)}</dd>
      <dt className="text-muted-foreground">{t('rentPayment.amount')}</dt>
      <dd className="text-lg font-semibold">{formatCurrency(payment.amount, payment.currency)}</dd>
    </dl>
  );

  if (payment.state === 'Paid') {
    return (
      <div className="space-y-4">
        {summary}
        <p className="flex items-center gap-2 text-sm text-green-700" data-testid="rent-payment-paid">
          <CheckCircle2 className="h-4 w-4" />
          {t('rentPayment.paid')}
        </p>
      </div>
    );
  }

  if (payment.state === 'Processing' || (payment.state === 'Payable' && (clientStatus === 'succeeded' || clientStatus === 'processing'))) {
    return (
      <div className="space-y-4">
        {summary}
        <p className="flex items-center gap-2 text-sm" data-testid="rent-payment-processing">
          <Clock className="h-4 w-4" />
          {t('rentPayment.processing')}
        </p>
      </div>
    );
  }

  if (payment.state === 'Unavailable') {
    return (
      <div className="space-y-4">
        {summary}
        <p className="text-sm text-muted-foreground" data-testid="rent-payment-unavailable">
          {t('rentPayment.unavailable')}
        </p>
      </div>
    );
  }

  const failed = payment.lastPaymentFailed || clientStatus === 'failed';
  return (
    <div className="space-y-4">
      {summary}
      {failed && (
        <p className="text-sm text-destructive" role="alert" data-testid="rent-payment-failed">
          {t('rentPayment.failed')}
        </p>
      )}
      {paymentError && (
        <p className="text-sm text-destructive" role="alert">
          {paymentError}
        </p>
      )}
      {session.data ? (
        <StripeIntentPayment
          mode="payment"
          publishableKey={session.data.publishableKey}
          stripeAccountId={session.data.stripeAccountId}
          clientSecret={session.data.clientSecret}
          returnUrl={window.location.href}
          onSubmitted={(status) => {
            setPaymentError(null);
            onSubmitted(status);
          }}
          onError={setPaymentError}
        />
      ) : (
        <div className="space-y-2">
          {session.isError && (
            <p className="text-sm text-destructive" role="alert" data-testid="rent-payment-session-error">
              {getProblemMessage(session.error, t) ?? t('rentPayment.sessionError')}
            </p>
          )}
          <Button className="w-full" onClick={() => session.mutate()} disabled={session.isPending} data-testid="rent-payment-start">
            {session.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('rentPayment.payNow', { amount: formatCurrency(payment.amount, payment.currency) })}
          </Button>
          <p className="text-xs text-muted-foreground">{t('rentPayment.stripeNotice')}</p>
        </div>
      )}
    </div>
  );
}
