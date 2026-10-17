import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Wrench } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { complianceActionRoute } from '@/lib/compliance-routes';
import { formatStayDate } from '@/lib/stay-dates';
import { useHostThreads } from '@/queries/use-booking-messages';
import { useDashboardIcalFeeds, useDashboardOverview, useDashboardToday } from '@/queries/use-dashboard';
import { useProperties } from '@/queries/use-properties';
import { useCurrentUser } from '@/queries/use-users';
import type { DashboardList, DashboardToday } from '@/types/dashboard.types';
import { HomeFilterBar } from './components/home-filter-bar';
import { HomeNextStep } from './components/home-next-step';
import { HomeNumbers } from './components/home-numbers';
import { OtaStatusCard } from './components/ota-status-card';
import { RevenueChart } from './components/revenue-chart';
import { TodayCard } from './components/today-card';
import { TodoSection } from './components/todo-section';
import { buildTodayRows, buildTodoRows } from './lib/home-model';
import { overviewQueryFor, parseHomePeriod, type HomePeriod } from './lib/home-period';

/** Two columns from a wide screen: the thing that matters on the left (60 %), the one beside it on the right. */
const TWO_COLUMNS = 'grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start';

/**
 * The Home of Affitti brevi: "in 5 secondi capisco cosa devo fare oggi". The day in one block ("Oggi"), the things to do in
 * order of urgency ("Da fare"), the four numbers against the period before, one chart and the next step of the setup. The
 * property and the period are in the address; every number and every row comes from the server (`dashboard/today`,
 * `dashboard/overview`, `dashboard/ical-feeds`), none is worked out here.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [params, setParams] = useSearchParams();
  const { hasPermission } = useWorkspace();
  const { user } = useCurrentUser();
  // OTA partner API in freeze (D10): no widget and no request while the flag is off.
  const otaEnabled = useFeatureFlags().flags.otaPartnerApi;
  const canWrite = hasPermission('short-rent', 'booking.write');
  const canWriteProperty = hasPermission('short-rent', 'property.write');

  const properties = useProperties({ mode: 'short' });
  const propertyList = useMemo(() => (Array.isArray(properties.data) ? properties.data : []), [properties.data]);
  const requested = params.get('propertyId') ?? '';
  // An address with a property that is not the host's (an old link) is the whole scope, not an error.
  const propertyId = properties.isSuccess && !propertyList.some((property) => property.id === requested) ? '' : requested;
  const period = parseHomePeriod(params.get('period'));
  const showAllTodo = params.get('todo') === 'all';

  const today = useDashboardToday();
  const overview = useDashboardOverview(overviewQueryFor(period, propertyId));
  const feeds = useDashboardIcalFeeds(hasPermission('short-rent', 'property.read'));
  const feedList = useMemo(() => (Array.isArray(feeds.data) ? feeds.data : []), [feeds.data]);
  // The guests who wrote and wait for an answer (SR-12): a row of "Da fare" each. Without the permission to read bookings, no request.
  const threads = useHostThreads({ needsReply: true, pageSize: 20 }, hasPermission('short-rent', 'booking.read'));
  const threadList = useMemo(() => threads.data?.items ?? [], [threads.data]);

  const setQuery = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const todayRows = useMemo(
    () => (today.data ? buildTodayRows(today.data, { propertyId, canWrite }, { t, locale }) : []),
    [today.data, propertyId, canWrite, t, locale],
  );
  const todoRows = useMemo(
    () => (today.data ? buildTodoRows(today.data, feedList, { propertyId, canWrite, hasPermission, threads: threadList }, { t, locale }) : []),
    [today.data, feedList, threadList, propertyId, canWrite, hasPermission, t, locale],
  );

  const firstName = user?.firstName?.trim();
  const noActiveProperty = overview.data?.propertyCount === 0 && !propertyId && canWriteProperty;
  const pendingActivation = today.data?.todo.items.find((item) => item.action === 'ActivateProperty');
  const activationRoute = pendingActivation
    ? complianceActionRoute({ action: 'ActivateProperty', propertyId: pendingActivation.propertyId, bookingId: null }, hasPermission)
    : null;

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="sr-home">
        <PageHeader
          title={firstName ? t('dashboard.title', { name: firstName }) : t('dashboard.titleNoName')}
          description={today.data && !noActiveProperty ? purposeOf(today.data, propertyId, t, locale) : undefined}
          primary={canWrite ? { label: t('dashboard.actions.createBooking'), icon: Plus, to: '/app/short-rent/bookings/create', testId: 'home-create-booking' } : undefined}
          secondary={[
            ...(canWriteProperty ? [{ label: t('dashboard.actions.addProperty'), icon: Building2, to: '/app/short-rent/properties/create' }] : []),
            { label: t('dashboard.actions.requestService'), icon: Wrench, to: '/app/short-rent/marketplace' },
          ]}
          mobilePrimary="fab"
        />

        {noActiveProperty ? null : (
          <HomeFilterBar
            properties={propertyList}
            propertyId={propertyId}
            period={period}
            onPropertyChange={(value) => setQuery({ propertyId: value || null })}
            onPeriodChange={(value: HomePeriod) => setQuery({ period: value === 'month' ? null : value })}
          />
        )}

        {noActiveProperty ? (
          <FocusBlock
            kicker={t('dashboard.first.kicker')}
            title={t(activationRoute ? 'dashboard.first.titleResume' : 'dashboard.first.titleNew')}
            body={t('dashboard.first.body')}
            primary={{
              label: t(activationRoute ? 'dashboard.first.ctaResume' : 'dashboard.first.ctaNew'),
              href: activationRoute ?? '/app/short-rent/properties/create',
              testId: 'home-first-property-cta',
            }}
          />
        ) : (
          <>
            <div className={TWO_COLUMNS}>
              {today.data ? (
                <>
                  <TodayCard rows={todayRows} day={today.data.today} more={propertyId ? 0 : hiddenItems(today.data)} />
                  <TodoSection rows={todoRows} showAll={showAllTodo} onToggleAll={() => setQuery({ todo: showAllTodo ? null : 'all' })} />
                </>
              ) : today.isError ? (
                <div className="xl:col-span-2">
                  <ErrorState title={t('dashboard.error.today')} error={today.error} onRetry={() => void today.refetch()} testId="dashboard-error" />
                </div>
              ) : (
                <>
                  <SkeletonCard lines={5} />
                  <SkeletonCard lines={4} />
                </>
              )}
            </div>

            {overview.data ? (
              <HomeNumbers overview={overview.data} period={period} />
            ) : overview.isError ? (
              <ErrorState title={t('dashboard.error.overview')} error={overview.error} onRetry={() => void overview.refetch()} />
            ) : (
              <SkeletonLine lines={3} />
            )}
          </>
        )}

        <div className={TWO_COLUMNS}>
          {!noActiveProperty && overview.data ? (
            overview.data.series && overview.data.revenue ? (
              <RevenueChart series={overview.data.series} currency={overview.data.revenue.currency} />
            ) : (
              <Alert variant="info" title={t('dashboard.chart.locked.title')} data-testid="home-chart-locked">
                {t('dashboard.chart.locked.text')}
              </Alert>
            )
          ) : null}
          <HomeNextStep />
        </div>

        {otaEnabled ? <OtaStatusCard /> : null}
      </div>
    </AppShell>
  );
}

/** "mercoledì 7 ottobre · 2 arrivi, 1 partenza, 1 richiesta da approvare": only what the filter lets the host see. */
function purposeOf(today: DashboardToday, propertyId: string, t: ReturnType<typeof useTranslation>['t'], locale: string): string {
  const total = (list: DashboardList<{ propertyId: string }>) => (propertyId ? list.items.filter((item) => item.propertyId === propertyId).length : list.count);
  const arrivals = total(today.arrivals);
  const departures = total(today.departures);
  const requests = total(today.approvals);
  const parts = [
    arrivals > 0 ? t('dashboard.summary.arrivals', { count: arrivals }) : null,
    departures > 0 ? t('dashboard.summary.departures', { count: departures }) : null,
    requests > 0 ? t('dashboard.summary.requests', { count: requests }) : null,
  ].filter(Boolean);
  const day = formatStayDate(today.today, locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day} · ${parts.length > 0 ? parts.join(', ') : t('dashboard.summary.quiet')}`;
}

/** What the server counts for the day and does not list (it sends the first ones). */
function hiddenItems(today: DashboardToday): number {
  return [today.arrivals, today.departures, today.services].reduce((sum, list) => sum + Math.max(0, list.count - list.items.length), 0);
}
