import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { usePayment } from '@/queries/use-payments';
import { formatDate, formatCurrency } from '@/lib/utils';
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from './schemas/payment.schema';
import { Edit } from 'lucide-react';

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: payment, isLoading } = usePayment(id!);

  if (isLoading) {
    return <LoadingScreen message="Loading payment..." />;
  }

  if (!payment) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Payment not found</h2>
          <p className="text-muted-foreground">The payment you're looking for doesn't exist.</p>
        </div>
      </AppShell>
    );
  }

  const statusConfig = PAYMENT_STATUS_LABELS[payment.status] || PAYMENT_STATUS_LABELS.PENDING;
  const methodLabel = PAYMENT_METHOD_LABELS[payment.method] || payment.method;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={`Payment #${payment.id.slice(0, 8)}`}
          description="Payment transaction details"
          action={
            <Button onClick={() => navigate(`/payments/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Payment
            </Button>
          }
        />

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Details */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Payment Information</CardTitle>
                  <Badge variant={statusConfig.variant} className="text-base px-3 py-1">
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Amount</div>
                  <div className="text-3xl font-bold">
                    {formatCurrency(payment.amount, payment.currency)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div>
                    <div className="text-sm text-muted-foreground">Payment Method</div>
                    <div className="font-medium">{methodLabel}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Date</div>
                    <div className="font-medium">{formatDate(payment.createdAt, 'PPp')}</div>
                  </div>
                </div>

                {payment.description && (
                  <div className="pt-3 border-t">
                    <div className="text-sm text-muted-foreground mb-1">Description</div>
                    <p className="text-sm">{payment.description}</p>
                  </div>
                )}

                {payment.refundedAmount && payment.refundedAmount > 0 && (
                  <div className="pt-3 border-t">
                    <div className="text-sm text-muted-foreground mb-1">Refunded Amount</div>
                    <div className="text-lg font-medium text-destructive">
                      -{formatCurrency(payment.refundedAmount, payment.currency)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Net: {formatCurrency(payment.amount - payment.refundedAmount, payment.currency)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {(payment.stripePaymentIntentId || payment.stripeChargeId) && (
              <Card>
                <CardHeader>
                  <CardTitle>Stripe Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {payment.stripePaymentIntentId && (
                    <div>
                      <div className="text-sm text-muted-foreground">Payment Intent ID</div>
                      <div className="font-mono text-sm">{payment.stripePaymentIntentId}</div>
                    </div>
                  )}
                  {payment.stripeChargeId && (
                    <div>
                      <div className="text-sm text-muted-foreground">Charge ID</div>
                      <div className="font-mono text-sm">{payment.stripeChargeId}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Booking Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <div className="text-sm text-muted-foreground">Booking ID</div>
                  <div className="font-medium">{payment.bookingId}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <div className="text-muted-foreground">Created</div>
                  <div>{formatDate(payment.createdAt, 'PPp')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Last Updated</div>
                  <div>{formatDate(payment.updatedAt, 'PPp')}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
