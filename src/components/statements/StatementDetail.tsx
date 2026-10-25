import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import {
  useApproveStatement,
  usePublishStatement,
  useDownloadStatementPdf,
  useDownloadStatementCsv,
} from '@/queries/statements';
import type { OwnerStatement } from '@/types';

interface StatementDetailProps {
  statement: OwnerStatement;
  onBack: () => void;
}

export function StatementDetail({ statement, onBack }: StatementDetailProps) {
  const { t } = useTranslation();
  const approveStatement = useApproveStatement();
  const publishStatement = usePublishStatement();
  const downloadPdf = useDownloadStatementPdf();
  const downloadCsv = useDownloadStatementCsv();

  const handleApprove = () => {
    approveStatement.mutate(statement.id);
  };

  const handlePublish = () => {
    publishStatement.mutate(statement.id);
  };

  const handleDownloadPdf = () => {
    const fileName = `statement-${statement.year}-${statement.month}-${statement.propertyName}.pdf`;
    downloadPdf.mutate({ id: statement.id, fileName });
  };

  const handleDownloadCsv = () => {
    const fileName = `statement-${statement.year}-${statement.month}-${statement.propertyName}.csv`;
    downloadCsv.mutate({ id: statement.id, fileName });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('shared.back')}
        </Button>

        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">{statement.propertyName}</h1>
            <p className="text-lg text-muted-foreground mt-1">
              {t('statement.detailSubtitle', {
                month: statement.month,
                year: statement.year,
                owner: statement.ownerName,
              })}
            </p>
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              statement.status === 'Draft'
                ? 'bg-gray-100 text-gray-800'
                : statement.status === 'Approved'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-green-100 text-green-800'
            }`}
          >
            {t(`statement.status.${statement.status.toLowerCase()}`)}
          </span>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Summary Section */}
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">{t('statement.summary')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('statement.revenue')}</p>
              <p className="text-2xl font-bold">
                {statement.currency} {statement.totalRevenue.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('statement.commission')}</p>
              <p className="text-2xl font-bold text-orange-600">
                -{statement.currency} {statement.commission.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('statement.expenses')}</p>
              <p className="text-2xl font-bold text-red-600">
                -{statement.currency} {statement.expenses.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('statement.withholdingTax')}</p>
              <p className="text-2xl font-bold text-red-600">
                -{statement.currency} {statement.withholdingTax.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t">
            <div className="flex justify-between items-center">
              <p className="text-lg font-semibold">{t('statement.netPayable')}</p>
              <p className="text-3xl font-bold text-green-600">
                {statement.currency} {statement.netPayable.toFixed(2)}
              </p>
            </div>
            {statement.ownershipPercent < 100 && (
              <p className="text-sm text-muted-foreground mt-2">
                {t('statement.ownershipPercent', {
                  percent: statement.ownershipPercent.toFixed(2),
                })}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          {statement.status === 'Draft' && (
            <Button
              onClick={handleApprove}
              disabled={approveStatement.isPending}
            >
              {t('statement.approve')}
            </Button>
          )}
          {statement.status === 'Approved' && (
            <Button
              onClick={handlePublish}
              disabled={publishStatement.isPending}
            >
              {t('statement.publish')}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={downloadPdf.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            {t('statement.download.pdf')}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadCsv}
            disabled={downloadCsv.isPending}
          >
            <Download className="w-4 h-4 mr-2" />
            {t('statement.download.csv')}
          </Button>
        </div>

        {/* Additional Info */}
        {statement.publishedAt && (
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-sm">
              <span className="font-medium">{t('statement.publishedAt')}:</span>{' '}
              {new Date(statement.publishedAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
