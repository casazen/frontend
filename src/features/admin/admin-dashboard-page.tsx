import { Link, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '@/hooks/use-workspace';
import { AdminOtaReport } from './admin-ota-report';
import { PageHeader } from '@/components/layout/page-header';
import { AdminKpiCard } from './components/admin-kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats } from '@/queries/use-admin';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Building2, Calendar, Wallet, FileCheck, Wifi, ChevronRight } from 'lucide-react';

export function AdminDashboardPage() {
  const [params] = useSearchParams();
  const filter = params.get('otaStatus');
  return filter === 'failed' || filter === 'neverSynced' || filter === 'synced'
    ? <AdminOtaReport status={filter} /> : <AdminOverview />;
}

function CounterRow({ label, count, to, tone }: { label: string; count: number; to?: string; tone: string }) {
  const content = <><span className={tone}>{label}</span><span className="inline-flex items-center gap-2 font-semibold tabular-nums">{count}{to && <ChevronRight className="size-4" aria-hidden="true" />}</span></>;
  const layout = 'flex min-h-11 items-center justify-between gap-4 text-sm';
  return to
    ? <Link to={to} className={layout + ' rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring'}>{content}</Link>
    : <div className={layout}>{content}</div>;
}

function AdminOverview() {
  const { hasPermission } = useWorkspace();
  const canReadCin = hasPermission('admin', 'admin.cin.read');
  const { t, i18n } = useTranslation();
  const { data: stats, isLoading, error, refetch } = useAdminStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.dashboard.title')}
        description={t('admin.dashboard.description')}
      />

      {isLoading ? (
        // The six numbers below, three across from a laptop (two rows of three, not four and two alone).
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              value={`€ ${stats.totalRevenue.toLocaleString(i18n.language, { minimumFractionDigits: 2 })}`}
              icon={Wallet}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck aria-hidden="true" className="size-5 text-primary-text" />
                  {t('admin.dashboard.cin.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {(['total', 'valid', 'missing', 'invalid'] as const).map(status => (
                  <CounterRow key={status} label={t(`admin.dashboard.cin.${status}`)} count={stats.cinCompliance[status]}
                    tone={{ total: 'text-muted-foreground', valid: 'text-success-foreground', missing: 'text-warning-foreground', invalid: 'text-danger-foreground' }[status]}
                    to={canReadCin ? (status === 'total' ? '/app/admin/cin' : `/app/admin/cin?cinStatus=${status}`) : undefined} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wifi aria-hidden="true" className="size-5 text-primary-text" />
                  {t('admin.dashboard.ota.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {(['synced', 'failed', 'neverSynced'] as const).map(status => (
                  <CounterRow key={status} label={t(`admin.dashboard.ota.${status}`)} count={stats.otaSyncHealth[status]}
                    tone={{ synced: 'text-success-foreground', failed: 'text-danger-foreground', neverSynced: 'text-muted-foreground' }[status]}
                    to={`/app/admin?otaStatus=${status}`} />
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <ErrorState title={t('admin.dashboard.loadError')} error={error} onRetry={() => void refetch()} />
      )}
    </div>
  );
}
