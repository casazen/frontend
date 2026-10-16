import type { SupplierServiceRequest } from '@/types/service-request';
import type { SupplierChecklist, SupplierOverview, SupplierOverviewFigures, SupplierOverviewPeriod, SupplierToday } from '@/types/supplier';
import { INBOX_PATH, phaseOf } from '../requests/request-model';
import { NEW_SERVICE_PATH, SHOWCASE_PATH } from '../services/lib/service-paths';

/** Where the home sends the supplier (the real routes, which are in English). */
export const AVAILABILITY_PATH = '/app/supplier/availability';
export const PROFILE_PATH = '/app/supplier/profile';

/** The home looks at today and the six days after: the most `GET today` gives is seven. */
export const HOME_DAYS = 7;
/** The new requests the block of the days shows (the rest is in the list), the rows it shows in all and the jobs it always has room for. */
const MAX_REQUESTS = 3;
const MAX_ROWS = 7;
const MIN_JOBS = 3;

export interface TodayRows {
  /** The new requests to answer, the most urgent first. */
  requests: SupplierServiceRequest[];
  /** The jobs of the days, in the order of the server (the first in time first). */
  jobs: SupplierServiceRequest[];
  /** How many new requests wait beyond the ones shown. */
  moreRequests: number;
}

/**
 * What the block of the days shows: the new requests first (at most three, the server puts the one to answer first on top), then
 * the jobs still to do or to be paid. A job already paid is over and says nothing to the supplier today.
 */
export function todayRows(today: SupplierToday): TodayRows {
  const requests = today.newRequests.slice(0, MAX_REQUESTS);
  const jobs = today.jobs
    .filter((job) => {
      const phase = phaseOf(job);
      return phase === 'scheduled' || phase === 'inProgress' || phase === 'completed';
    })
    .slice(0, Math.max(MIN_JOBS, MAX_ROWS - requests.length));
  return { requests, jobs, moreRequests: Math.max(0, today.newRequestsTotal - requests.length) };
}

/** How many jobs are still to do today (taken or in progress): the "1 lavoro oggi" of the line under the title. */
export function jobsToDoToday(today: SupplierToday): number {
  return today.jobs.filter((job) => {
    const phase = phaseOf(job);
    return (phase === 'scheduled' || phase === 'inProgress') && job.scheduledFor === today.date;
  }).length;
}

/* ------------------------------------------------------------------------------------------------------ numbers */

/** `?periodo=` of the address, the period of the overview it asks for and the words of the menu. The first is the default and is not written. */
export const PERIOD_PARAM = 'periodo';
export const PERIODS: readonly { param: string | null; value: SupplierOverviewPeriod; labelKey: string }[] = [
  { param: null, value: 'current-month', labelKey: 'supplier.home.numbers.periods.currentMonth' },
  { param: '30g', value: 'last-30-days', labelKey: 'supplier.home.numbers.periods.last30Days' },
  { param: '3m', value: 'last-3-months', labelKey: 'supplier.home.numbers.periods.last3Months' },
];

/** The period an address asks for; a value that is not one is the default (the address is typed and shared). */
export function periodOf(param: string | null) {
  return PERIODS.find((period) => period.param !== null && period.param === param) ?? PERIODS[0];
}

export interface HomeNumbers {
  /** Nothing arrived in this period nor in the one before, and nothing was completed: there is nothing to count yet. */
  quiet: boolean;
  /** Percent of the requests answered that were accepted; null when none was answered. */
  acceptancePercent: number | null;
  /** The change against the period before, in points; null when one of the two does not exist (no comparison is drawn). */
  acceptancePoints: number | null;
  responseMinutes: number | null;
  /** The change in minutes: below 0 is faster. */
  responseChange: number | null;
  /** The third number is the net money paid (cents) when the supplier has payments through CasaZen, else the jobs completed. */
  money: boolean;
  third: number;
  thirdChange: number;
}

const percent = (rate: number | null) => (rate === null ? null : Math.round(rate * 100));
const difference = (now: number | null, before: number | null) => (now === null || before === null ? null : now - before);

/** The three numbers of the home, from the figures of the server: nothing is worked out beyond the rounding and the difference. */
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

/* ------------------------------------------------------------------------------------------------------ next step */

export interface ChecklistStep {
  id: 'profile' | 'services' | 'hours' | 'showcase' | 'firstRequest';
  done: boolean;
  titleKey: string;
  /** Where the supplier does it. */
  to: string;
}

/**
 * The steps of the activation checklist in the order to take them. `paymentsActive` is not one of them: the server says it is not
 * available yet (`null`), and the page for connecting an account does not exist.
 */
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
