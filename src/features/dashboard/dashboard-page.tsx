import { useAppShell } from '@/components/layout/app-shell-context';
import { useUiStore } from '@/store/ui-store';
import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, ChartNoAxesColumn, Plus, Workflow, Wrench } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { useCommercialRouteAccess } from '@/hooks/use-commercial-profile';
import { useRoutines } from '@/queries/routines';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select } from '@/components/ui/select';
import { useWorkspace } from '@/hooks/use-workspace';
import { requestInterventionPath } from '@/features/service-requests/interventions/paths';
import { complianceActionRoute } from '@/lib/compliance-routes';
import { formatStayDate } from '@/lib/stay-dates';
import { useMessageHubThreads } from '@/queries/use-message-hub';
import { useDashboardIcalFeeds, useDashboardOverview, useDashboardToday } from '@/queries/use-dashboard';
import { useProperties } from '@/queries/use-properties';
import { useCurrentUser } from '@/queries/use-users';
import type { DashboardList, DashboardToday } from '@/types/dashboard.types';
import { planResumeHref } from '@/features/onboarding/plan-resume';
import { usePlanResume } from '@/features/onboarding/use-plan-resume';
import { HomeFilterBar } from './components/home-filter-bar';
import { HomeNumbers } from './components/home-numbers';
import { OtaStatusCard } from './components/ota-status-card';
import { RevenueChart } from './components/revenue-chart';
import { TodayCard } from './components/today-card';
import { TodoSection } from './components/todo-section';
import { buildTodayRows, buildTodoRows } from './lib/home-model';
import { HOME_PERIODS, overviewQueryFor, parseHomePeriod } from './lib/home-period';

function ResumeOnboardingLink({ userId, orgId }: { userId?: string; orgId?: string }) {
  const { t } = useTranslation();
  const { step } = usePlanResume(userId, orgId);
  return step ? (
    <Link className="inline-flex items-center py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      data-testid="home-resume-onboarding" to={planResumeHref(step)}>
      {t('commercial.resume')}
    </Link>
  ) : null;
}

/** Two columns from a wide screen: the thing that matters on the left (60 %), the one beside it on the right. */
const TWO_COLUMNS = 'grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start';

/** The daily workspace shows today's stays and pending operations. Analytics open separately from the page menu. */
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const phone = useMediaQuery(PHONE_QUERY);
  const [params, setParams] = useSearchParams();
  const { hasPermission } = useWorkspace();
  const { user } = useCurrentUser();
  const viewKey = useAppShell()?.viewKey;
  const tasksFirst = useUiStore(state => Boolean(viewKey && state.workspaceViews[viewKey]?.tasksFirst));
  // OTA partner API in freeze (D10): no widget and no request while the flag is off.
  const { flags } = useFeatureFlags();
  const otaEnabled = flags.otaPartnerApi;
  const canWrite = hasPermission('short-rent', 'booking.write');
  const canReadBookings = hasPermission('short-rent', 'booking.read');
  const canWriteProperty = hasPermission('short-rent', 'property.write');
  const canRequestService = hasPermission('short-rent', 'servicerequest.write');
  const canOpenPath = useCommercialRouteAccess();
  const showRoutineStatus = flags.routines && canWriteProperty && canOpenPath('/app/short-rent/automations');
  const routines = useRoutines(showRoutineStatus);
  const activeRoutineCount = showRoutineStatus && routines.isSuccess
    ? routines.data.filter(routine => routine.active && !routine.testMode).length
    : 0;

  const canReadProperties = hasPermission('short-rent', 'property.read');
  const properties = useProperties({ mode: 'short' }, { enabled: canReadProperties });
  const propertyList = useMemo(() => (Array.isArray(properties.data) ? properties.data : []), [properties.data]);
  // Keep the scope of a deep link even if the property was removed or the caller cannot read its name.
  const propertyId = params.get('propertyId') ?? '';
  const analytics = params.get('view') === 'analytics' || (!params.has('view') && params.has('period'));
  const period = parseHomePeriod(params.get('period'));
  const showAllTodo = params.get('todo') === 'all';

  const today = useDashboardToday(canReadBookings);
  const overview = useDashboardOverview(overviewQueryFor(period, propertyId), canReadBookings);
  const feeds = useDashboardIcalFeeds(canReadProperties && canReadBookings);
  const feedList = useMemo(() => (Array.isArray(feeds.data) ? feeds.data : []), [feeds.data]);
  // The guests who wrote and wait for an answer (SR-12): a row of "Da fare" each, the ones of the channels included (NF-61). Without the
  // permission to read bookings, no request.
  const threads = useMessageHubThreads({ needsReply: true, pageSize: 20 }, hasPermission('short-rent', 'booking.read'));
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

  const createBooking = canWrite
    ? { label: t('dashboard.actions.createBooking'), icon: Plus, to: '/app/short-rent/bookings/create', testId: 'home-create-booking' }
    : undefined;
  const firstName = user?.firstName?.includes('@') ? undefined : user?.firstName?.trim();
  const noActiveProperty = canReadBookings && overview.data?.propertyCount === 0 && !propertyId && canWriteProperty;
  const pendingActivation = today.data?.todo.items.find((item) => item.action === 'ActivateProperty');
  const activationRoute = pendingActivation
    ? complianceActionRoute({ action: 'ActivateProperty', propertyId: pendingActivation.propertyId, bookingId: null }, hasPermission)
    : null;

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8" data-testid="sr-home">
        <div className="space-y-6">
          <PageHeader
            title={firstName ? t('dashboard.title', { name: firstName }) : t('dashboard.titleNoName')}
            description={canReadBookings && today.data && !today.isError && !noActiveProperty ? purposeOf(today.data, propertyId, t, locale) : undefined}
            primary={phone ? undefined : createBooking}
            action={showRoutineStatus && routines.isSuccess ? (
              <Link to={routines.data.length ? '/app/short-rent/automations' : '/app/short-rent/automations?view=library'} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium text-primary-text hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring">
                <Workflow aria-hidden="true" className="size-4" />
                {activeRoutineCount > 0 ? t('routines.dashboardActive', { count: activeRoutineCount }) : t(routines.data.length ? 'nav.routines' : 'aiSettings.firstRoutine')}
              </Link>
            ) : undefined}
            secondary={[
              ...(canReadBookings ? [{ label: t(analytics ? 'nav.dashboard' : 'dashboard.numbers.label'), icon: ChartNoAxesColumn, onClick: () => setQuery({ view: analytics ? null : 'analytics', period: null }) }] : []),
              ...(phone && createBooking ? [createBooking] : []),
              ...(canWriteProperty ? [{ label: t('dashboard.actions.addProperty'), icon: Building2, to: '/app/short-rent/properties/create' }] : []),
              // «Richiedi un intervento» (SR-08b): the guided request, on the property the Home is filtered to; for who may ask for one.
              ...(canRequestService
                ? [{ label: t('dashboard.actions.requestService'), icon: Wrench, to: requestInterventionPath(propertyId || undefined), testId: 'home-request-service' }]
                : []),
            ]}
            mobilePrimary="none"
          />
          {flags.octorateOnboarding && <ResumeOnboardingLink userId={user?.id} orgId={user?.org?.id} />}
        </div>

        {canReadBookings && !noActiveProperty && (propertyList.length > 1 || propertyId) ? (
          <HomeFilterBar
            properties={propertyList}
            propertyId={propertyId}
            onPropertyChange={(value) => setQuery({ propertyId: value || null })}
            onReset={() => setQuery({ propertyId: null, period: null, today: null })}
          />
        ) : null}

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
        ) : canReadBookings && !analytics ? (
          <div className={TWO_COLUMNS}>
            {today.data && !today.isError ? (
              (tasksFirst ? ['tasks', 'today'] : ['today', 'tasks']).map(section => section === 'today' ?
                <TodayCard key="today" rows={todayRows} today={today.data} propertyId={propertyId} /> :
                <TodoSection key="tasks" rows={todoRows} incomplete={threads.isError || (canReadProperties && feeds.isError)} loading={threads.isLoading || (canReadProperties && feeds.isLoading)} showAll={showAllTodo} onToggleAll={() => setQuery({ todo: showAllTodo ? null : 'all' })} />
              )
            ) : today.isError ? (
              <div className="xl:col-span-2">
                <ErrorState
                  title={t('dashboard.error.today')}
                  error={today.error}
                  onRetry={() => {
                    void today.refetch();
                    if (overview.isError) void overview.refetch();
                  }}
                  testId="dashboard-error"
                />
              </div>
            ) : (
              <>
                <SkeletonCard lines={5} />
                <SkeletonCard lines={4} />
              </>
            )}
          </div>
        ) : null}

        {canReadBookings && !noActiveProperty && (
          <Accordion type="single" collapsible key={analytics ? 'analytics' : 'daily'} defaultValue={analytics ? 'performance' : undefined}
            className="rounded-2xl border bg-card px-5 md:px-6" data-testid="home-performance">
            <AccordionItem value="performance">
              <AccordionTrigger>
                <span className="flex items-center gap-3">
                  <ChartNoAxesColumn aria-hidden="true" className="size-5 text-primary-text" />
                  {t('dashboard.numbers.label')}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-5 border-t py-5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span className="text-sm font-medium">{t('dashboard.filter.period')}</span>
                <Select
                  size="sm"
                  aria-label={t('dashboard.filter.period')}
                  wrapperClassName="w-auto max-w-full"
                  data-testid="dashboard-period"
                  value={period}
                  onChange={event => setQuery({ period: event.target.value === 'month' ? null : event.target.value })}
                >
                  {HOME_PERIODS.map(value => <option key={value} value={value}>{t(`dashboard.period.${value}`)}</option>)}
                </Select>
              </div>
              {overview.data && !overview.isError && !overview.isPlaceholderData ? (
                <HomeNumbers overview={overview.data} period={period} />
              ) : overview.isError ? (
                // One error is enough when the day failed too: its retry reloads both.
                today.isError ? null : (
                  <ErrorState title={t('dashboard.error.overview')} error={overview.error} onRetry={() => void overview.refetch()} />
                )
              ) : (
                <SkeletonLine lines={3} />
              )}
              {overview.data && !overview.isError && !overview.isPlaceholderData ? (
                overview.data.series && overview.data.revenue ? (
                  <RevenueChart series={overview.data.series} currency={overview.data.revenue.currency} />
                ) : (
                  <Alert variant="info" title={t('dashboard.chart.locked.title')} data-testid="home-chart-locked">
                    {t('dashboard.chart.locked.text')}
                  </Alert>
                )
              ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {analytics && otaEnabled ? <OtaStatusCard /> : null}
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
  if (propertyId && [today.arrivals, today.departures, today.approvals].some(list => list.count > list.items.length)) return day;
  return `${day} · ${parts.length > 0 ? parts.join(', ') : t('dashboard.summary.quiet')}`;
}
