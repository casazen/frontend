import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupplierDashboard, useSupplierProfile, useSupplierActivation } from '@/queries/use-supplier';
import { AlertTriangle, Briefcase, CalendarCheck, CheckCircle2, Link2, TrendingUp, User } from 'lucide-react';

export function SupplierDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: dashboard, isLoading: dashboardLoading } = useSupplierDashboard();
  const { isLoading: profileLoading } = useSupplierProfile();
  const { isLoading: activationLoading } = useSupplierActivation();

  const isLoading = dashboardLoading || profileLoading || activationLoading;

  if (isLoading) {
    return (
      <div>
        <PageHeader title={t('supplier.dashboardTitle')} description={t('supplier.dashboardDescription')} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const isActive = dashboard?.status === 'Active';
  const hasSync = dashboard?.calendarSyncStatus?.calendarSyncType !== 'None';

  return (
    <div>
      <PageHeader
        title={t('supplier.dashboardTitle')}
        description={t('supplier.dashboardDescription')}
      />

      {/* Incomplete profile compact warning */}
      {!isLoading && dashboard && dashboard.profileCompletionPercent < 100 && (
        <Card className="mb-4 border-amber-300 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                {t('supplier.profileCompletion', { percent: dashboard.profileCompletionPercent })}
              </p>
            </div>
            <Button size="sm" variant="outline" className="border-amber-400 text-amber-900 shrink-0"
                    onClick={() => navigate('/app/supplier/profile')}>
              {t('supplier.completeNow')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Jobs completed */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dashboard?.completedJobs ?? 0}</p>
              <p className="text-xs text-muted-foreground">{t('supplier.completedJobs')}</p>
            </div>
          </div>
          {dashboard && dashboard.totalJobs > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('supplier.totalJobsCount', { total: dashboard.totalJobs })}
            </p>
          )}
        </Card>

        {/* Upcoming jobs */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <CalendarCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dashboard?.upcomingJobs ?? 0}</p>
              <p className="text-xs text-muted-foreground">{t('supplier.upcomingJobs')}</p>
            </div>
          </div>
        </Card>

        {/* Availability rate */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {dashboard ? `${Math.round(dashboard.availabilityRate * 100)}%` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{t('supplier.availabilityRate')}</p>
            </div>
          </div>
        </Card>

        {/* Profile completion */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <User className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dashboard?.profileCompletionPercent ?? 0}%</p>
              <p className="text-xs text-muted-foreground">{t('supplier.profileCompleted')}</p>
            </div>
          </div>
          {dashboard && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-amber-500 transition-all"
                style={{ width: `${dashboard.profileCompletionPercent}%` }}
              />
            </div>
          )}
        </Card>
      </div>

      {/* Second row: Status & Calendar Sync */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Activation status */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground">{t('supplier.activationStatus')}</h3>
          <div className="mt-3 flex items-center gap-3">
            {isActive ? (
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            )}
            <div>
              <p className={`text-lg font-semibold ${isActive ? 'text-green-700' : 'text-amber-700'}`}>
                {isActive ? t('supplier.statusActive') : t('supplier.statusPending')}
              </p>
              <p className="text-xs text-muted-foreground">
                {isActive ? t('supplier.visibleToHosts') : t('supplier.completeActivationHint')}
              </p>
            </div>
          </div>
          {!isActive && (
            <Button className="mt-3 w-full" size="sm" onClick={() => navigate('/app/supplier/activation')}>
              {t('supplier.goToActivation')}
            </Button>
          )}
        </Card>

        {/* Calendar sync */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground">{t('supplier.calendarSyncStatus')}</h3>
          <div className="mt-3 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${hasSync ? 'bg-green-100' : 'bg-muted'}`}>
              <Link2 className={`h-5 w-5 ${hasSync ? 'text-green-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-medium">
                {hasSync ? dashboard?.calendarSyncStatus.calendarSyncType : t('supplier.notConnected')}
              </p>
              {hasSync && dashboard?.calendarSyncStatus.calendarLastSyncAt && (
                <p className="text-xs text-muted-foreground">
                  {t('supplier.lastSync')}: {new Date(dashboard.calendarSyncStatus.calendarLastSyncAt).toLocaleString()}
                </p>
              )}
              {hasSync && dashboard?.calendarSyncStatus.calendarSyncError && (
                <p className="text-xs text-red-600">{dashboard.calendarSyncStatus.calendarSyncError}</p>
              )}
            </div>
          </div>
          <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => navigate('/app/supplier/calendar')}>
            {hasSync ? t('supplier.manageSync') : t('supplier.connectCalendar')}
          </Button>
        </Card>
      </div>

      {/* Guided CTAs for new suppliers */}
      {dashboard && dashboard.totalJobs === 0 && dashboard.profileCompletionPercent < 80 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold">{t('supplier.gettingStarted')}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="cursor-pointer p-4 transition hover:shadow-md" onClick={() => navigate('/app/supplier/profile')}>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t('supplier.completeProfileCTA')}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t('supplier.completeProfileCTAHint')}</p>
            </Card>
            <Card className="cursor-pointer p-4 transition hover:shadow-md" onClick={() => navigate('/app/supplier/calendar')}>
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t('supplier.setupCalendarCTA')}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t('supplier.setupCalendarCTAHint')}</p>
            </Card>
            <Card className="cursor-pointer p-4 transition hover:shadow-md" onClick={() => navigate('/app/supplier/availability')}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t('supplier.setAvailabilityCTA')}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t('supplier.setAvailabilityCTAHint')}</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
