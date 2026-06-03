import { PageHeader } from '@/components/layout/page-header';
import { AdminKpiCard } from './components/admin-kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats } from '@/queries/use-admin';
import { Building2, Calendar, DollarSign, FileCheck, Wifi } from 'lucide-react';

export function AdminDashboardPage() {
  const { data: stats, isLoading } = useAdminStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Amministratore"
        description="Panoramica del sistema CasaZen"
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <AdminKpiCard
              title="Proprietà totali"
              value={stats.totalProperties}
              icon={Building2}
            />
            <AdminKpiCard
              title="Proprietà attive"
              value={stats.activeProperties}
              icon={Building2}
            />
            <AdminKpiCard
              title="Prenotazioni totali"
              value={stats.totalBookings}
              icon={Calendar}
            />
            <AdminKpiCard
              title="Prenotazioni del mese"
              value={stats.bookingsThisMonth}
              icon={Calendar}
            />
            <AdminKpiCard
              title="Check-in imminenti"
              value={stats.upcomingCheckIns}
              icon={Calendar}
            />
            <AdminKpiCard
              title="Ricavi totali"
              value={`€ ${stats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck className="h-4 w-4" />
                  Conformità CIN
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Totale</span>
                  <span className="font-medium">{stats.cinCompliance.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Validi</span>
                  <span className="font-medium">{stats.cinCompliance.valid}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-600">Mancanti</span>
                  <span className="font-medium">{stats.cinCompliance.missing}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Non validi</span>
                  <span className="font-medium">{stats.cinCompliance.invalid}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wifi className="h-4 w-4" />
                  Salute OTA Sync
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Sincronizzati</span>
                  <span className="font-medium">{stats.otaSyncHealth.synced}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Falliti</span>
                  <span className="font-medium">{stats.otaSyncHealth.failed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mai sincronizzati</span>
                  <span className="font-medium">{stats.otaSyncHealth.neverSynced}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Impossibile caricare le statistiche.</p>
      )}
    </div>
  );
}
