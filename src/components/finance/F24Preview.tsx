import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/utils';
import type { F24Preview as F24PreviewData } from '@/types';

interface F24PreviewProps {
  data: F24PreviewData;
  onDownload: () => void;
  isDownloading?: boolean;
}

/**
 * F24 preview component (ADR-018-R8, ADR-018-R9).
 * Displays pre-filled F24 form preview with tax code 1919, reference month/year,
 * total amount, and due date. Shows reminder if past due.
 * Covers AC-NF18-8: F24 preview and AC-NF18-9: Due date reminder.
 */
export function F24Preview({ data, onDownload, isDownloading = false }: F24PreviewProps) {
  const { t } = useTranslation();

  const monthName = new Date(data.referenceYear, data.referenceMonth - 1).toLocaleDateString(
    'it-IT',
    { month: 'long' }
  );

  const dueDateFormatted = new Date(data.dueDate).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('withholding.f24.title')}</CardTitle>
        <CardDescription>
          {t('withholding.f24.description', {
            month: monthName,
            year: data.referenceYear,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.isPastDue && (
          <Alert variant="danger">
            {t('withholding.f24.pastDue', { date: dueDateFormatted })}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">{t('withholding.f24.taxCode')}</dt>
            <dd className="font-mono font-semibold text-lg">{data.taxCode}</dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">{t('withholding.f24.reference')}</dt>
            <dd className="font-semibold text-lg">
              {monthName} {data.referenceYear}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">{t('withholding.f24.totalAmount')}</dt>
            <dd className="font-semibold text-lg text-[#1f3a3d]">
              {formatCurrency(data.totalAmount, 'EUR')}
            </dd>
          </div>

          <div>
            <dt className="text-sm text-muted-foreground">{t('withholding.dueDate')}</dt>
            <dd className={`font-semibold text-lg ${data.isPastDue ? 'text-red-600' : ''}`}>
              {dueDateFormatted}
            </dd>
          </div>
        </div>

        <Button
          onClick={onDownload}
          disabled={isDownloading}
          className="w-full sm:w-auto"
        >
          <Download className="mr-2 h-4 w-4" />
          {t('withholding.f24.download')}
        </Button>
      </CardContent>
    </Card>
  );
}
