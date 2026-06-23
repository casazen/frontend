import { PageHeader } from '@/components/layout/page-header';
import { AdminKpiCard } from './components/admin-kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats } from '@/queries/use-admin';
import { useTranslation } from 'react-i18next';
import { Building2, Calendar, DollarSign, FileCheck, Wifi } from 'lucide-react';

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useAdminStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.dashboard.title')}
        description={t('admin.dashboard.description')}
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
              title={t('admin.dashboard.kpi.totalProperties')}
              value={stats.totalProperties}
              icon={Building2}
            />
            <AdminKpiCard
              title={t('admin.dashboard.kpi.activeProperties')}
              value={stats.activeProperties}
              icon={Building2}
            />
            <AdminKpiCard
              title={t('admin.dashboard.kpi.totalBookings')}
              value={stats.totalBookings}
              icon={Calendar}
            />
            <AdminKpiCard
              title={t('admin.dashboard.kpi.bookingsThisMonth')}
              value={stats.bookingsThisMonth}
              icon={Calendar}
            />
            <AdminKpiCard
              title={t('admin.dashboard.kpi.upcomingCheckIns')}
              value={stats.upcomingCheckIns}
              icon={Calendar}
            />
            <AdminKpiCard
              title={t('admin.dashboard.kpi.totalRevenue')}
              value={`€ ${stats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck className="h-4 w-4" />
                  {t('admin.dashboard.cin.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('admin.dashboard.cin.total')}</span>
                  <span className="font-medium">{stats.cinCompliance.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">{t('admin.dashboard.cin.valid')}</span>
                  <span className="font-medium">{stats.cinCompliance.valid}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-600">{t('admin.dashboard.cin.missing')}</span>
                  <span className="font-medium">{stats.cinCompliance.missing}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">{t('admin.dashboard.cin.invalid')}</span>
                  <span className="font-medium">{stats.cinCompliance.invalid}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wifi className="h-4 w-4" />
                  {t('admin.dashboard.ota.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">{t('admin.dashboard.ota.synced')}</span>
                  <span className="font-medium">{stats.otaSyncHealth.synced}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">{t('admin.dashboard.ota.failed')}</span>
                  <span className="font-medium">{stats.otaSyncHealth.failed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('admin.dashboard.ota.neverSynced')}</span>
                  <span className="font-medium">{stats.otaSyncHealth.neverSynced}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">{t('admin.dashboard.loadError')}</p>
      )}
    </div>
  );
}
