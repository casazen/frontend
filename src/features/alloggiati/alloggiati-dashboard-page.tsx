import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useAlloggiatiSummary } from '@/queries/use-alloggiati';
import { AlloggiatiStatusBadge } from './components/alloggiati-status-badge';
import { formatDate } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

export function AlloggiatiDashboardPage() {
  const { data: rows, isLoading } = useAlloggiatiSummary();

  if (isLoading) {
    return <LoadingScreen message="Caricamento Alloggiati…" />;
  }

  const items = rows ?? [];

  return (
    <AppShell>
      <div className="space-y-6" data-testid="alloggiati-dashboard">
        <PageHeader
          title="Alloggiati Web"
          description="Stato delle comunicazioni alla Questura (Art. 109 TULPS)"
        />

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nessuna prenotazione con comunicazione Alloggiati in sospeso.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Prenotazioni</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Ospite</th>
                      <th className="pb-3 pr-4 font-medium">Proprietà</th>
                      <th className="pb-3 pr-4 font-medium">Check-in</th>
                      <th className="pb-3 pr-4 font-medium">Stato</th>
                      <th className="pb-3 pr-4 font-medium">Scadenza</th>
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
                            <span className="ml-2 text-xs text-muted-foreground">Dati incompleti</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {row.isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Oltre 24h
                            </span>
                          ) : (
                            <span>{Math.round(row.hoursUntilDeadline)}h rimanenti</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            to={`/app/short-rent/bookings/${row.bookingId}`}
                            className="text-primary hover:underline"
                          >
                            Dettagli
                          </Link>
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
