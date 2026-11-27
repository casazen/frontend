import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { PaymentRefund, PaymentRefundStatus } from '@/types';

const STATUS_VARIANT: Record<PaymentRefundStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  Succeeded: 'success',
  Pending: 'warning',
  RequiresAction: 'warning',
  Failed: 'destructive',
  Canceled: 'secondary',
};

export function RefundStatusBadge({ status }: { status: PaymentRefundStatus }) {
  const { t } = useTranslation();
  return <Badge variant={STATUS_VARIANT[status]}>{t(`payment.refund.status.${status}`)}</Badge>;
}

export function RefundOutcomeMessage({
  refund,
  currency = 'EUR',
}: {
  refund: Pick<PaymentRefund, 'amount' | 'status' | 'failureReason'>;
  currency?: string;
}) {
  const { t } = useTranslation();
  const amount = formatCurrency(refund.amount, currency);

  if (refund.status === 'Succeeded') {
    return (
      <p role="status" className="text-sm text-green-700">
        {t('payment.refund.result.succeeded', { amount })}
      </p>
    );
  }

  if (refund.status === 'Pending' || refund.status === 'RequiresAction') {
    return (
      <p role="status" className="text-sm text-yellow-700">
        {t('payment.refund.result.pending', { amount })}
      </p>
    );
  }

  return (
    <div role="alert" className="space-y-1 text-sm text-destructive">
      <p>{t('payment.refund.result.failed', { amount })}</p>
      {refund.failureReason && <p>{t('payment.refund.result.failedReason', { reason: refund.failureReason })}</p>}
    </div>
  );
}
