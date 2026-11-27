import type { SupplierServiceRequest } from '@/types/service-request';
import type { SupplierChecklist, SupplierOverview, SupplierOverviewFigures, SupplierOverviewPeriod, SupplierToday } from '@/types/supplier';
import { INBOX_PATH, phaseOf } from '../requests/request-model';
import { NEW_SERVICE_PATH, SHOWCASE_PATH } from '../services/lib/service-paths';

export const AVAILABILITY_PATH = '/app/supplier/availability';
export const PROFILE_PATH = '/app/supplier/profile';

export const HOME_DAYS = 7;
const MAX_REQUESTS = 3;
const MAX_ROWS = 7;
const MIN_JOBS = 3;

export interface TodayRows {
  requests: SupplierServiceRequest[];
  jobs: SupplierServiceRequest[];
  moreRequests: number;
}

export function todayRows(today: SupplierToday, inboxToAnswer = 0): TodayRows {
  const requests = (today.newRequests ?? []).slice(0, MAX_REQUESTS);
  const jobs = (today.jobs ?? [])
    .filter((job) => {
      const phase = phaseOf(job);
      return phase === 'scheduled' || phase === 'inProgress' || phase === 'completed';
    })
    .slice(0, Math.max(MIN_JOBS, MAX_ROWS - requests.length));
  return { requests, jobs, moreRequests: Math.max(0, Math.max(today.newRequestsTotal ?? 0, inboxToAnswer) - requests.length) };
}

export function jobsToDoToday(today: SupplierToday): number {
  return (today.jobs ?? []).filter((job) => {
    const phase = phaseOf(job);
    return (phase === 'scheduled' || phase === 'inProgress') && job.scheduledFor === today.date;
  }).length;
}

export const PERIOD_PARAM = 'periodo';
export const PERIODS: readonly { param: string | null; value: SupplierOverviewPeriod; labelKey: string }[] = [
  { param: null, value: 'current-month', labelKey: 'supplier.home.numbers.periods.currentMonth' },
  { param: '30g', value: 'last-30-days', labelKey: 'supplier.home.numbers.periods.last30Days' },
  { param: '3m', value: 'last-3-months', labelKey: 'supplier.home.numbers.periods.last3Months' },
];

export function periodOf(param: string | null) {
  return PERIODS.find((period) => period.param !== null && period.param === param) ?? PERIODS[0];
}

export interface HomeNumbers {
  quiet: boolean;
  acceptancePercent: number | null;
  acceptancePoints: number | null;
  responseMinutes: number | null;
  responseChange: number | null;
  money: boolean;
  third: number;
  thirdChange: number;
}

const percent = (rate: number | null) => (rate === null ? null : Math.round(rate * 100));
const difference = (now: number | null, before: number | null) => (now === null || before === null ? null : now - before);

export function numbersOf(overview: SupplierOverview): HomeNumbers {
  const { current, previous } = overview;
  const money = overview.onlinePayments;
  const third = (figures: SupplierOverviewFigures) => (money ? figures.paidNetCents : figures.completedJobs);
  const now = percent(current.acceptanceRate);
  return {
    quiet: current.received === 0 && previous.received === 0 && current.completedJobs === 0,
    acceptancePercent: now,
    acceptancePoints: difference(now, percent(previous.acceptanceRate)),
    responseMinutes: current.averageResponseMinutes,
    responseChange: difference(current.averageResponseMinutes, previous.averageResponseMinutes),
    money,
    third: third(current),
    thirdChange: third(current) - third(previous),
  };
}

export interface ChecklistStep {
  id: 'profile' | 'services' | 'hours' | 'showcase' | 'firstRequest';
  done: boolean;
  titleKey: string;
  to: string;
}

export function checklistSteps(checklist: SupplierChecklist): ChecklistStep[] {
  return [
    { id: 'profile', done: checklist.profileComplete, titleKey: 'supplier.home.steps.profile', to: PROFILE_PATH },
    { id: 'services', done: checklist.activeServices > 0, titleKey: 'supplier.home.steps.services', to: NEW_SERVICE_PATH },
    { id: 'hours', done: checklist.hoursConfigured, titleKey: 'supplier.home.steps.hours', to: AVAILABILITY_PATH },
    { id: 'showcase', done: checklist.showcasePublished, titleKey: 'supplier.home.steps.showcase', to: SHOWCASE_PATH },
    { id: 'firstRequest', done: checklist.firstRequestAnswered, titleKey: 'supplier.home.steps.firstRequest', to: INBOX_PATH },
  ];
}

/** A supplier with no service published and no working hours saved has not begun: the home invites to begin instead of saying "giornata libera". */
export function hasNotBegun(checklist: SupplierChecklist | undefined): boolean {
  return checklist !== undefined && !checklist.hoursConfigured && checklist.activeServices === 0;
}
