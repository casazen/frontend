import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAlloggiatiSummary } from '@/queries/use-alloggiati';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { AlloggiatiStatusBadge } from './components/alloggiati-status-badge';
import { formatDate } from '@/lib/utils';
import { AlertTriangle, Send, Loader2 } from 'lucide-react';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';

const ALLOGGIATI_KEY = 'alloggiati';

function canSendToAlloggiati(status: AlloggiatiWebStatus): boolean {
  return status !== 'Confirmed';
}

export function AlloggiatiDashboardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: rows, isLoading } = useAlloggiatiSummary();

  const sendMutation = useMutation({
    mutationFn: (bookingId: string) => alloggiatiApi.sendReport(bookingId),
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY] });
      queryClient.invalidateQueries({ queryKey: [ALLOGGIATI_KEY, 'status', bookingId] });
      toast.success('Comunicazione inviata');
    },
    onError: () => {
      toast.error('Invio non riuscito. Riprova più tardi.');
    },
  });

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

        {items.length === 0 ? (
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
                        <td className="py-3 pr-4">{formatDate(row.checkInDate)}</td>
                        <td className="py-3 pr-4">
                          <AlloggiatiStatusBadge status={row.status} isOverdue={row.isOverdue} />
                          {!row.dataComplete && (
                            <span className="ml-2 text-xs text-muted-foreground">{t('alloggiati.incompleteData')}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {row.isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {t('alloggiati.over24h')}
                            </span>
                          ) : (
                            <span>{t('alloggiati.hoursRemaining', { hours: Math.round(row.hoursUntilDeadline) })}</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canSendToAlloggiati(row.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => sendMutation.mutate(row.bookingId)}
                                disabled={sendMutation.isPending}
                              >
                                {sendMutation.isPending && sendMutation.variables === row.bookingId ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="mr-1 h-3.5 w-3.5" />
                                )}
                                Invia
                              </Button>
                            )}
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
