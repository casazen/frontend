import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAlloggiatiSummary } from '@/queries/use-alloggiati';
import { AlloggiatiStatusBadge } from './components/alloggiati-status-badge';
import { MarkSentManuallyButton } from './components/resend-button';
import { formatRecordDate, formatRomeDateTime, isAlloggiatiSent } from './alloggiati-status.utils';
import { AlertTriangle } from 'lucide-react';

export function AlloggiatiDashboardPage() {
  const { t, i18n } = useTranslation();
  const { data: rows, isLoading, isError, refetch } = useAlloggiatiSummary();

  if (isLoading) {
    return <LoadingScreen message={t('alloggiati.loading')} />;
  }

  const items = rows ?? [];

  return (
    <AppShell>
      <div className="space-y-6" data-testid="alloggiati-dashboard">
        <PageHeader
          title={t('alloggiati.title')}
          description={t('alloggiati.description')}
        />

        <p className="text-sm text-muted-foreground" data-testid="alloggiati-manual-banner">
          {t('alloggiati.manualBanner')}
        </p>

        {isError ? (
          <Card>
            <CardContent className="space-y-3 py-12 text-center" data-testid="alloggiati-dashboard-error">
              <p className="text-destructive">{t('alloggiati.summaryError')}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t('alloggiati.guestSummary.retry')}
              </Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('alloggiati.noPendingReport')}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('alloggiati.bookings')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">{t('alloggiati.guest')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('alloggiati.property')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('alloggiati.checkIn')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('alloggiati.status')}</th>
                      <th className="pb-3 pr-4 font-medium">{t('alloggiati.deadline')}</th>
                      <th className="pb-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.bookingId}
                        className="border-b last:border-0"
                        data-testid={`alloggiati-row-${row.bookingId}`}
                      >
                        <td className="py-3 pr-4 font-medium">{row.guestName}</td>
                        <td className="py-3 pr-4">{row.propertyName}</td>
                        <td className="py-3 pr-4">{formatRecordDate(row.checkInDate)}</td>
                        <td className="py-3 pr-4">
                          <AlloggiatiStatusBadge status={row.status} isOverdue={row.isOverdue} />
                          {!row.dataComplete && (
                            <span className="ml-2 text-xs text-muted-foreground">{t('alloggiati.incompleteData')}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {isAlloggiatiSent(row.status) ? (
                            <span className="text-muted-foreground">-</span>
                          ) : row.isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {t('alloggiati.overdue')}
                            </span>
                          ) : (
                            <span>
                              {formatRomeDateTime(row.deadlineAt, i18n.language)}
                              {row.isShortStay && (
                                <span className="ml-1 text-xs text-muted-foreground">({t('alloggiati.shortStayTerm')})</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <MarkSentManuallyButton
                              bookingId={row.bookingId}
                              status={row.status}
                              checkInDate={row.checkInDate}
                            />
                            <Link
                              to={`/app/short-rent/bookings/${row.bookingId}`}
                              className="text-primary hover:underline"
                            >
                              {t('alloggiati.details')}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
