import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { F24Preview } from '@/components/finance/F24Preview';
import {
  useWithholdingSummary,
  useF24Preview,
  useRecordPayment,
  downloadWithholdingStatement,
  downloadF24,
} from '@/queries/withholding';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';

/**
 * Withholding tax page (ADR-018).
 * Displays withholding summary by month/owner/apartment, F24 preview,
 * and allows downloading statements and recording payments.
 * Covers AC-NF18-6 through AC-NF18-10.
 */
export function WithholdingPage() {
  const { t } = useTranslation();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [paymentDate, setPaymentDate] = useState('');
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading, error: summaryError } =
    useWithholdingSummary(selectedMonth, selectedYear);

  const { data: f24, isLoading: f24Loading, error: f24Error } =
    useF24Preview(selectedMonth, selectedYear);

  const recordPayment = useRecordPayment();

  const handleDownloadStatement = async (format: 'pdf' | 'excel') => {
    setIsDownloading(`statement-${format}`);
    try {
      await downloadWithholdingStatement(selectedMonth, selectedYear, format);
      toast.success(t('withholding.summary.downloadSuccess'));
    } catch (err) {
      const message = getProblemMessage(err, t);
      toast.error(message || t('withholding.summary.downloadError'));
    } finally {
      setIsDownloading(null);
    }
  };

  const handleDownloadF24 = async () => {
    setIsDownloading('f24');
    try {
      await downloadF24(selectedMonth, selectedYear);
      toast.success(t('withholding.f24.downloadSuccess'));
    } catch (err) {
      const message = getProblemMessage(err, t);
      toast.error(message || t('withholding.f24.downloadError'));
    } finally {
      setIsDownloading(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentDate) {
      toast.error(t('withholding.payment.dateRequired'));
      return;
    }

    try {
      await recordPayment.mutateAsync({
        month: selectedMonth,
        year: selectedYear,
        paidAt: new Date(paymentDate).toISOString(),
      });
      toast.success(t('withholding.payment.recordSuccess'));
      setPaymentDate('');
    } catch (err) {
      const message = getProblemMessage(err, t);
      toast.error(message || t('withholding.payment.recordError'));
    }
  };

  const isLoading = summaryLoading || f24Loading;
  const error = summaryError || f24Error;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        <h1 className="text-3xl font-bold text-[#1f3a3d]">{t('withholding.title')}</h1>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl p-6">
        <ErrorState
          title={t('withholding.error')}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-[#1f3a3d]">{t('withholding.title')}</h1>

        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="month" className="sr-only">
              {t('withholding.month')}
            </Label>
            <select
              id="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleDateString('it-IT', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="year" className="sr-only">
              {t('withholding.year')}
            </Label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground">{t('withholding.description')}</p>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('withholding.summary.title')}</CardTitle>
          <CardDescription>{t('withholding.summary.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <dt className="text-sm text-muted-foreground">{t('withholding.summary.total')}</dt>
              <dd className="font-semibold text-2xl text-[#1f3a3d]">
                {formatCurrency(summary?.totalWithheld ?? 0, 'EUR')}
              </dd>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadStatement('pdf')}
                disabled={isDownloading === 'statement-pdf'}
              >
                <Download className="mr-2 h-4 w-4" />
                {t('withholding.downloadPdf')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadStatement('excel')}
                disabled={isDownloading === 'statement-excel'}
              >
                <Download className="mr-2 h-4 w-4" />
                {t('withholding.downloadExcel')}
              </Button>
            </div>
          </div>

          {/* Owner breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">{t('withholding.summary.byOwner')}</h3>
            {summary?.owners.map((owner) => (
              <Card key={owner.ownerId} className="border-l-4 border-l-[#1f3a3d]">
                <CardHeader>
                  <CardTitle className="text-base">{owner.ownerName}</CardTitle>
                  <CardDescription>
                    {t('withholding.summary.ownerTotal', {
                      amount: formatCurrency(owner.totalWithheld, 'EUR'),
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {owner.apartments.map((apt) => (
                      <div
                        key={apt.propertyId}
                        className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-4"
                      >
                        <div>
                          <dt className="text-muted-foreground">{t('withholding.summary.property')}</dt>
                          <dd className="font-medium">{apt.propertyName}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('withholding.summary.grossBase')}</dt>
                          <dd className="font-medium">{formatCurrency(apt.grossBase, 'EUR')}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('withholding.summary.commission')}</dt>
                          <dd className="font-medium">{formatCurrency(apt.commission, 'EUR')}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('withholding.summary.withheld')}</dt>
                          <dd className="font-semibold text-[#1f3a3d]">
                            {formatCurrency(apt.withholdingAmount, 'EUR')}
                          </dd>
                        </div>
                        {apt.cashYear !== apt.stayYear && (
                          <div className="col-span-2 sm:col-span-4">
                            <dt className="text-xs text-muted-foreground">
                              {t('withholding.summary.crossYear', {
                                cashYear: apt.cashYear,
                                stayYear: apt.stayYear,
                              })}
                            </dt>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {!summary?.owners?.length && (
              <p className="text-center text-muted-foreground py-8">
                {t('withholding.summary.noData')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* F24 Preview */}
      {f24 && (
        <F24Preview
          data={f24}
          onDownload={handleDownloadF24}
          isDownloading={isDownloading === 'f24'}
        />
      )}

      {/* Payment Reconciliation */}
      <Card>
        <CardHeader>
          <CardTitle>{t('withholding.payment.title')}</CardTitle>
          <CardDescription>{t('withholding.payment.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="paymentDate">{t('withholding.payment.date')}</Label>
              <div className="relative mt-2">
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="pl-10"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <Button
              onClick={handleRecordPayment}
              disabled={!paymentDate || recordPayment.isPending}
            >
              {t('withholding.payment.record')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
