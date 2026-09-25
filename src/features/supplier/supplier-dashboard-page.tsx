import { useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupplierDashboard, useSupplierKpis } from '@/queries/use-supplier';
import { getProblemMessage } from '@/lib/api-errors';
import { formatStayDate } from '@/lib/stay-dates';
import { SUPPLIER_KPI_PERIODS } from '@/types/supplier';
import type { SupplierKpiPeriod, SupplierKpis } from '@/types/supplier';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Hourglass,
  Inbox,
  Link2,
  TrendingUp,
  User,
  XCircle,
} from 'lucide-react';

function KpiCard({
  testId,
  value,
  label,
  hint,
  icon: Icon,
  tone,
}: {
  testId: string;
  value: number;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card className="p-4" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold" data-testid={`${testId}-value`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function KpiGrid({ kpis }: { kpis: SupplierKpis }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        testId="supplier-kpi-completed"
        value={kpis.completed}
        label={t('supplier.kpi.completed')}
        hint={t('supplier.kpi.inPeriod')}
        icon={CheckCircle2}
        tone="bg-blue-100 text-blue-600"
      />
      <KpiCard
        testId="supplier-kpi-upcoming"
        value={kpis.upcoming}
        label={t('supplier.kpi.upcoming')}
        hint={t('supplier.kpi.now')}
        icon={CalendarCheck}
        tone="bg-green-100 text-green-600"
      />
      <KpiCard
        testId="supplier-kpi-awaiting"
        value={kpis.awaitingAcceptance}
        label={t('supplier.kpi.awaitingAcceptance')}
        hint={t('supplier.kpi.now')}
        icon={Hourglass}
        tone="bg-amber-100 text-amber-600"
      />
      <KpiCard
        testId="supplier-kpi-rejected"
        value={kpis.rejected}
        label={t('supplier.kpi.rejected')}
        hint={t('supplier.kpi.inPeriod')}
        icon={XCircle}
        tone="bg-red-100 text-red-600"
      />
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="supplier-kpis-loading">
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}

function ErrorPanel({ testId, message, onRetry }: { testId: string; message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="border-destructive/40" role="alert" data-testid={testId}>
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <p className="flex-1 text-sm text-destructive">{message}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('supplier.retry')}
        </Button>
      </CardContent>
    </Card>
  );
}

/** First steps of a new supplier: shown while no request was received and the profile is incomplete. */
function GettingStarted() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="mt-4" data-testid="supplier-getting-started">
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
  );
}

/** Work KPIs from the supplier's service requests, for a Europe/Rome period (SU-11, A4-15). */
function SupplierKpiSection({ profileIncomplete }: { profileIncomplete: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<SupplierKpiPeriod>('CurrentMonth');
  const { data: kpis, isLoading, isError, error, refetch } = useSupplierKpis(period);

  let content: ReactNode;
  if (isLoading) {
    content = <KpiSkeleton />;
  } else if (isError || !kpis) {
    content = (
      <ErrorPanel
        testId="supplier-kpis-error"
        message={getProblemMessage(error, t) ?? t('supplier.kpi.loadError')}
        onRetry={() => void refetch()}
      />
    );
  } else if (kpis.totalRequests === 0) {
    content = (
      <>
        <Card data-testid="supplier-kpis-empty">
          <CardContent className="flex flex-wrap items-center gap-3 py-6">
            <Inbox className="h-6 w-6 shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('supplier.kpi.empty')}</p>
              <p className="text-xs text-muted-foreground">{t('supplier.kpi.emptyHint')}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/app/supplier/inbox')}>
              {t('supplier.kpi.openInbox')}
            </Button>
          </CardContent>
        </Card>
        {profileIncomplete && <GettingStarted />}
      </>
    );
  } else {
    content = (
      <>
        <KpiGrid kpis={kpis} />
        <p className="mt-2 text-xs text-muted-foreground" data-testid="supplier-kpis-range">
          {t('supplier.kpi.periodRange', {
            from: formatStayDate(kpis.from, i18n.language),
            to: formatStayDate(kpis.to, i18n.language),
          })}
          {' · '}
          {t('supplier.kpi.totalRequests', { count: kpis.totalRequests })}
        </p>
      </>
    );
  }

  return (
    <section className="mb-4" aria-labelledby="supplier-kpis-title" data-testid="supplier-kpis">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="supplier-kpis-title" className="text-sm font-semibold">
          {t('supplier.kpi.title')}
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('supplier.kpi.periodLabel')}</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as SupplierKpiPeriod)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="supplier-kpi-period"
          >
            {SUPPLIER_KPI_PERIODS.map((value) => (
              <option key={value} value={value}>
                {t(`supplier.kpi.periods.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {content}
    </section>
  );
}

export function SupplierDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: dashboard, isLoading, isError, error, refetch } = useSupplierDashboard();

  const header = <PageHeader title={t('supplier.dashboardTitle')} description={t('supplier.dashboardDescription')} />;

  if (isLoading) {
    return (
      <div>
        {header}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="supplier-dashboard-loading">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (isError || !dashboard) {
    return (
      <div>
        {header}
        <ErrorPanel
          testId="supplier-dashboard-error"
          message={getProblemMessage(error, t) ?? t('supplier.dashboardLoadError')}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const isActive = dashboard.status === 'Active';
  const hasSync = dashboard.calendarSyncStatus?.calendarSyncType !== 'None';

  return (
    <div>
      {header}

      {/* Incomplete profile compact warning */}
      {dashboard.profileCompletionPercent < 100 && (
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

      <SupplierKpiSection profileIncomplete={dashboard.profileCompletionPercent < 80} />

      {/* Availability & profile */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Availability rate */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{`${Math.round(dashboard.availabilityRate * 100)}%`}</p>
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
              <p className="text-2xl font-bold">{dashboard.profileCompletionPercent}%</p>
              <p className="text-xs text-muted-foreground">{t('supplier.profileCompleted')}</p>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-amber-500 transition-all"
              style={{ width: `${dashboard.profileCompletionPercent}%` }}
            />
          </div>
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
                {hasSync ? dashboard.calendarSyncStatus.calendarSyncType : t('supplier.notConnected')}
              </p>
              {hasSync && dashboard.calendarSyncStatus.lastSyncStatus === 'Syncing' && (
                <p className="text-xs text-muted-foreground">{t('supplier.syncInProgress')}</p>
              )}
              {hasSync && dashboard.calendarSyncStatus.lastSyncStatus !== 'Syncing' && dashboard.calendarSyncStatus.calendarLastSyncAt && (
                <p className="text-xs text-muted-foreground">
                  {t('supplier.lastSync')}: {new Date(dashboard.calendarSyncStatus.calendarLastSyncAt).toLocaleString()}
                </p>
              )}
              {hasSync && dashboard.calendarSyncStatus.lastSyncStatus !== 'Syncing' && dashboard.calendarSyncStatus.calendarSyncError && (
                <p className="text-xs text-red-600">{dashboard.calendarSyncStatus.calendarSyncError}</p>
              )}
            </div>
          </div>
          <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => navigate('/app/supplier/calendar')}>
            {hasSync ? t('supplier.manageSync') : t('supplier.connectCalendar')}
          </Button>
        </Card>
      </div>
    </div>
  );
}
