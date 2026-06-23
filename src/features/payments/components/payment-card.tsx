import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Edit, Trash2, RefreshCw, Undo2 } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { PAYMENT_STATUS_VARIANTS } from '../schemas/payment.schema';
import { getPaymentStatusLabel, getPaymentMethodLabel } from '@/lib/i18n-labels';
import type { Payment } from '@/types';

interface PaymentCardProps {
  payment: Payment;
  onEdit?: (payment: Payment) => void;
  onDelete?: (payment: Payment) => void;
  onView?: (payment: Payment) => void;
  onProcess?: (payment: Payment) => void;
  onRefund?: (payment: Payment) => void;
}

export function PaymentCard({ payment, onEdit, onDelete, onView, onProcess, onRefund }: PaymentCardProps) {
  const { t } = useTranslation();
  const statusLabel = getPaymentStatusLabel(payment.status, t);
  const statusVariant = PAYMENT_STATUS_VARIANTS[payment.status] || PAYMENT_STATUS_VARIANTS.Pending;
  const methodLabel = getPaymentMethodLabel(payment.method, t);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Payment #{payment.id.slice(0, 8)}</span>
          </div>
          <Badge variant={statusVariant}>
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">
            {formatCurrency(payment.amount, payment.currency)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Method</p>
            <p className="font-medium">{methodLabel}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(payment.createdAt)}</p>
          </div>
        </div>

        {payment.refundedAmount && payment.refundedAmount > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">Refunded Amount</p>
            <p className="font-medium text-destructive">
              -{formatCurrency(payment.refundedAmount, payment.currency)}
            </p>
          </div>
        )}

        {payment.description && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">Description</p>
            <p className="text-sm">{payment.description}</p>
          </div>
        )}

        {payment.stripePaymentIntentId && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Stripe ID: {payment.stripePaymentIntentId}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-wrap gap-2">
        {onView && (
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onView(payment)}>
            View
          </Button>
        )}
        {onProcess && (payment.status === 'Pending' || payment.status === 'Processing') && (
          <Button variant="outline" size="sm" onClick={() => onProcess(payment)}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Process
          </Button>
        )}
        {onRefund && payment.status === 'Completed' && (
          <Button variant="outline" size="sm" onClick={() => onRefund(payment)}>
            <Undo2 className="h-4 w-4 mr-1" />
            Refund
          </Button>
        )}
        {onEdit && (
          <Button variant="outline" size="icon" onClick={() => onEdit(payment)}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {onDelete && (
          <Button variant="outline" size="icon" onClick={() => onDelete(payment)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
