import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useOwnerStatements, downloadStatement } from '@/queries/ownerPortal';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';

/**
 * Owner portal statements (ADR-011-R2): published statements with PDF and CSV download.
 * Only published statements are visible (AC-NF16-3).
 */
export function OwnerStatements() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { data: statements, isLoading, error } = useOwnerStatements();

  const handleDownload = async (statementId: string, format: 'pdf' | 'csv') => {
    setDownloadingId(statementId);
    try {
      await downloadStatement(statementId, format);
      toast.success(t('ownerPortal.statements.downloadSuccess'));
    } catch (err) {
      const message = getProblemMessage(err);
      toast.error(message || t('ownerPortal.statements.downloadError'));
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl p-6 space-y-6">
        <h1 className="text-3xl font-bold text-[#1f3a3d]">{t('ownerPortal.statements.title')}</h1>
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
      <div className="container mx-auto max-w-6xl p-6">
        <ErrorState
          title={t('ownerPortal.statements.error')}
          message={t('ownerPortal.statements.errorMessage')}
        />
      </div>
    );
  }

  const groupedByYear = statements?.reduce((acc, statement) => {
    const year = statement.year;
    if (!acc[year]) acc[year] = [];
    acc[year].push(statement);
    return acc;
  }, {} as Record<number, typeof statements>) ?? {};

  const years = Object.keys(groupedByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/portale-proprietari')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold text-[#1f3a3d]">{t('ownerPortal.statements.title')}</h1>
      </div>

      <p className="text-muted-foreground">{t('ownerPortal.statements.description')}</p>

      {!statements || statements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('ownerPortal.statements.noStatements')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {years.map((year) => (
            <div key={year} className="space-y-4">
              <h2 className="text-2xl font-semibold text-[#1f3a3d]">{year}</h2>
              <div className="grid gap-4">
                {groupedByYear[year]
                  ?.sort((a, b) => b.month - a.month)
                  .map((statement) => (
                    <Card key={statement.statementId}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-[#1f3a3d]" />
                            <span>
                              {t('ownerPortal.statements.monthYear', {
                                month: new Date(statement.year, statement.month - 1).toLocaleDateString('it-IT', {
                                  month: 'long',
                                }),
                                year: statement.year,
                              })}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(statement.statementId, 'pdf')}
                              disabled={downloadingId === statement.statementId}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              PDF
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(statement.statementId, 'csv')}
                              disabled={downloadingId === statement.statementId}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              CSV
                            </Button>
                          </div>
                        </CardTitle>
                        <CardDescription>{statement.propertyName}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <dl className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <dt className="text-muted-foreground">{t('ownerPortal.statements.totalRevenue')}</dt>
                            <dd className="font-semibold text-lg">{formatCurrency(statement.totalRevenue, 'EUR')}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">{t('ownerPortal.statements.agencyCommission')}</dt>
                            <dd className="font-semibold text-lg">{formatCurrency(statement.agencyCommission, 'EUR')}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">{t('ownerPortal.statements.netAmount')}</dt>
                            <dd className="font-semibold text-lg text-green-700">{formatCurrency(statement.netAmount, 'EUR')}</dd>
                          </div>
                        </dl>
                        <p className="text-xs text-muted-foreground mt-4">
                          {t('ownerPortal.statements.publishedAt', {
                            date: new Date(statement.publishedAt).toLocaleDateString('it-IT', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            }),
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
