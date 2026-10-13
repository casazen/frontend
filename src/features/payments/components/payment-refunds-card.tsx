import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';
import { usePaymentRefunds } from '@/queries/use-payments';
import { RefundStatusBadge } from './refund-outcome';

interface PaymentRefundsCardProps {
  paymentId: string;
  currency?: string;
}

/**
 * Refunds of a payment with their Stripe status (BK-02). Refunds still waiting for Stripe are
 * refreshed until Stripe confirms or fails them.
 */
export function PaymentRefundsCard({ paymentId, currency = 'EUR' }: PaymentRefundsCardProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = usePaymentRefunds(paymentId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('payment.refund.listTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && <p className="text-muted-foreground">{t('payment.refund.loading')}</p>}
        {isError && (
          <p role="alert" className="text-destructive">
            {getProblemMessage(error, t) ?? t('payment.refund.listLoadError')}
          </p>
        )}
        {data && data.refunds.length === 0 && <p className="text-muted-foreground">{t('payment.refund.listEmpty')}</p>}
        {data?.refunds.map((refund) => (
          <div key={refund.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
            <div>
              <div className="font-medium">{formatCurrency(refund.amount, currency)}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(refund.createdAt, 'PPp')} · {t(`payment.refund.origin.${refund.origin}`)}
              </div>
              {refund.failureReason && (
                <div className="text-xs text-destructive">
                  {t('payment.refund.result.failedReason', { reason: refund.failureReason })}
                </div>
              )}
            </div>
            <RefundStatusBadge status={refund.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
