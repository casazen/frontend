import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { usePayment } from '@/queries/use-payments';
import { formatDate, formatCurrency } from '@/lib/utils';
import { PAYMENT_STATUS_VARIANTS } from './schemas/payment.schema';
import { getPaymentStatusLabel, getPaymentMethodLabel } from '@/lib/i18n-labels';
import { Edit } from 'lucide-react';

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: payment, isLoading } = usePayment(id!);

  if (isLoading) {
    return <LoadingScreen message={t('payment.detail.loading')} />;
  }

  if (!payment) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">{t('payment.detail.notFound')}</h2>
          <p className="text-muted-foreground">{t('payment.detail.notFoundDescription')}</p>
        </div>
      </AppShell>
    );
  }

  const statusLabel = getPaymentStatusLabel(payment.status, t);
  const statusVariant = PAYMENT_STATUS_VARIANTS[payment.status] || PAYMENT_STATUS_VARIANTS.Pending;
  const methodLabel = getPaymentMethodLabel(payment.method, t);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={`${t('payment.detail.title')}${payment.id.slice(0, 8)}`}
          description={t('payment.detail.description')}
          action={
            <Button onClick={() => navigate(`/payments/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              {t('payment.detail.editPayment')}
            </Button>
          }
        />

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Details */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('payment.detail.paymentInformation')}</CardTitle>
                  <Badge variant={statusVariant} className="text-base px-3 py-1">
                    {statusLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">{t('payment.detail.amount')}</div>
                  <div className="text-3xl font-bold">
                    {formatCurrency(payment.amount, payment.currency)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div>
                    <div className="text-sm text-muted-foreground">{t('payment.detail.paymentMethod')}</div>
                    <div className="font-medium">{methodLabel}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t('payment.detail.date')}</div>
                    <div className="font-medium">{formatDate(payment.createdAt, 'PPp')}</div>
                  </div>
                </div>

                {payment.description && (
                  <div className="pt-3 border-t">
                    <div className="text-sm text-muted-foreground mb-1">{t('payment.detail.description')}</div>
                    <p className="text-sm">{payment.description}</p>
                  </div>
                )}

                {payment.refundedAmount && payment.refundedAmount > 0 && (
                  <div className="pt-3 border-t">
                    <div className="text-sm text-muted-foreground mb-1">{t('payment.detail.refundedAmount')}</div>
                    <div className="text-lg font-medium text-destructive">
                      -{formatCurrency(payment.refundedAmount, payment.currency)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t('payment.detail.net')} {formatCurrency(payment.amount - payment.refundedAmount, payment.currency)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {(payment.stripePaymentIntentId || payment.stripeChargeId) && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('payment.detail.stripeInformation')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {payment.stripePaymentIntentId && (
                    <div>
                      <div className="text-sm text-muted-foreground">{t('payment.detail.paymentIntentId')}</div>
                      <div className="font-mono text-sm">{payment.stripePaymentIntentId}</div>
                    </div>
                  )}
                  {payment.stripeChargeId && (
                    <div>
                      <div className="text-sm text-muted-foreground">{t('payment.detail.chargeId')}</div>
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
                <CardTitle>{t('payment.detail.bookingDetails')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <div className="text-sm text-muted-foreground">{t('payment.detail.bookingId')}</div>
                  <div className="font-medium">{payment.bookingId}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('payment.detail.timeline')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <div className="text-muted-foreground">{t('payment.detail.created')}</div>
                  <div>{formatDate(payment.createdAt, 'PPp')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('payment.detail.lastUpdated')}</div>
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
