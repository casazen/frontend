import type { TFunction } from 'i18next';
import type { CalmTone, DayListItem } from '@/components/shared/calm';
import { buildCsv } from '@/components/shared/list-view/list-csv';
import { addDays, endOfMonth } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { LongRentDeadline, LongRentDeadlinesParams } from '@/types';
import { leaseTenantName } from '../lib/lease-list-format';
import { leaseSheetPath } from '../lib/lease-next-step';
import { monthName, monthOfDate, rentRegisterPath, shiftMonth } from '../lib/rent-register';

/**
 * The dates of the agenda of the long-term area (LR-05) as the pages show them: a row for each, the quick filters, the months
 * they are grouped in, the windows of time and the file. It reads what the server sends for a date (`LongRentDeadline`): which
 * dates there are, and which are late, is the server's; the page works none out.
 */

export interface DeadlineContext {
  t: TFunction;
  /** Today in Europe/Rome (`YYYY-MM-DD`). */
  today: string;
}

// ------------------------------------------------------------------------------------------------ the kinds of date

// The keys are written out so that the i18n test finds a missing translation (`*Key:` properties are scanned).
const TYPE_TITLES = [
  { type: 'RliRegistration', titleKey: 'longRentDeadlines.type.RliRegistration' },
  { type: 'Questura', titleKey: 'longRentDeadlines.type.Questura' },
  { type: 'LeaseEnd', titleKey: 'longRentDeadlines.type.LeaseEnd' },
  { type: 'Notice', titleKey: 'longRentDeadlines.type.Notice' },
  { type: 'Rent', titleKey: 'longRentDeadlines.type.Rent' },
] as const;
const UNKNOWN_TYPE_TITLE = { titleKey: 'longRentDeadlines.type.unknown' } as const;

/** What the date is, in a few words: «Registrazione del contratto», «Canone di 600,00 €». A kind this version does not know (a newer backend) is told neutrally. */
function typeTitle(item: LongRentDeadline, t: TFunction): string {
  const { titleKey } = TYPE_TITLES.find((entry) => entry.type === item.type) ?? UNKNOWN_TYPE_TITLE;
  return t(titleKey, { amount: formatCurrency(item.amount ?? 0) });
}

// ----------------------------------------------------------------------------------------------- the quick filters

/**
 * The quick filters of the agenda (`?chip=`), each one the kinds of date it holds. «Firme e registrazioni» and «Rinnovi e
 * disdette» also hold, in the design, the start of a lease and the return of the deposit: the server does not list them yet.
 */
const FILTERS = [
  { id: 'all', labelKey: 'longRentDeadlines.filters.all', types: null },
  { id: 'registrations', labelKey: 'longRentDeadlines.filters.registrations', types: ['RliRegistration'] },
  { id: 'renewals', labelKey: 'longRentDeadlines.filters.renewals', types: ['LeaseEnd', 'Notice'] },
  { id: 'questura', labelKey: 'longRentDeadlines.filters.questura', types: ['Questura'] },
  { id: 'rents', labelKey: 'longRentDeadlines.filters.rents', types: ['Rent'] },
] as const;

export type DeadlineFilterId = (typeof FILTERS)[number]['id'];

/** The filters as the page offers them: their id (in the address) and the key of their name. */
export const DEADLINE_FILTER_OPTIONS: ReadonlyArray<{ id: DeadlineFilterId; labelKey: string }> = FILTERS;

/** The filter an address asks for; anything else is every kind. */
export function deadlineFilterOf(chip: string | null): DeadlineFilterId {
  return FILTERS.find((filter) => filter.id === chip)?.id ?? 'all';
}

export function filterDeadlines(items: readonly LongRentDeadline[], filterId: DeadlineFilterId): LongRentDeadline[] {
  const types: readonly string[] | null = FILTERS.find((filter) => filter.id === filterId)?.types ?? null;
  return types ? items.filter((item) => types.includes(item.type)) : [...items];
}

// ------------------------------------------------------------------------------------------------ the windows of time

/** How far the agenda looks: ninety days, then half a year, then a year (366 days, the most the server answers for). */
const WINDOW_DAYS = [90, 180, 366] as const;

export const FIRST_WINDOW_DAYS: number = WINDOW_DAYS[0];

/** The window of `days` days from today. */
export function agendaWindow(today: string, days: number): Required<LongRentDeadlinesParams> {
  return { from: today, to: addDays(today, days) };
}

/** The next longer window, or `null` when the year is already there. */
export function longerWindowDays(days: number): number | null {
  return WINDOW_DAYS.find((step) => step > days) ?? null;
}

const OVERVIEW_MONTHS = 4;

/** The window the overview looks at: from today to the same day four months later (or the last day of that month). */
export function overviewWindow(today: string): Required<LongRentDeadlinesParams> {
  const month = shiftMonth(monthOfDate(today), OVERVIEW_MONTHS);
  const lastDay = Number(endOfMonth(`${month}-01`).slice(8, 10));
  const day = Math.min(Number(today.slice(8, 10)), lastDay);
  return { from: today, to: `${month}-${String(day).padStart(2, '0')}` };
}

// --------------------------------------------------------------------------------------------------------- the rows

/** When it is, next to the date: «Scaduta da 3 giorni» in red when it is past and still open, «tra 5 giorni» otherwise. */
function whenText(item: LongRentDeadline, t: TFunction): { text: string; tone?: CalmTone } {
  if (item.isOverdue) return { text: t('longRentDeadlines.row.overdue', { count: Math.abs(item.daysFromToday) }), tone: 'danger' };
  if (item.daysFromToday <= 0) return { text: t('longRentDeadlines.row.today') };
  if (item.daysFromToday === 1) return { text: t('longRentDeadlines.row.tomorrow') };
  return { text: t('longRentDeadlines.row.dueIn', { count: item.daysFromToday }) };
}

/**
 * Where a date is dealt with: the registration and the Questura communication on the tab of the dates of the lease, the end of the
 * lease and the notice on its data, a rent in the register of its month (the late ones first). No page is made up for them.
 */
function deadlineHref(item: LongRentDeadline, today: string): string {
  switch (item.type) {
    case 'RliRegistration':
    case 'Questura':
      return leaseSheetPath(item.leaseId, 'scadenze');
    case 'LeaseEnd':
    case 'Notice':
      return leaseSheetPath(item.leaseId, 'dati');
    case 'Rent':
      return rentRegisterPath(monthOfDate(item.date), monthOfDate(today), item.isOverdue ? 'overdue' : undefined);
    default:
      return leaseSheetPath(item.leaseId);
  }
}

function tenantOf(item: LongRentDeadline, t: TFunction): string {
  return leaseTenantName({ tenantFirstName: item.tenantFirstName, tenantLastName: item.tenantLastName }, t);
}

/** A date as a row of the agenda: the day, what it is, whose lease and which property, how far it is, and the page that deals with it. */
export function deadlineRow(item: LongRentDeadline, { t, today }: DeadlineContext): DayListItem {
  const when = whenText(item, t);
  return {
    id: `${item.type}:${item.leaseId}:${item.installmentId ?? item.date}`,
    day: item.date,
    title: typeTitle(item, t),
    subtitle: `${tenantOf(item, t)} · ${item.propertyName}`,
    meta: when.text,
    tone: when.tone,
    href: deadlineHref(item, today),
  };
}

// ---------------------------------------------------------------------------------------------------------- months

export interface DeadlineMonth {
  /** `yyyy-MM`. */
  month: string;
  /** «Novembre 2026». */
  title: string;
  items: LongRentDeadline[];
}

/** The dates grouped by the month they fall in, the months in order. */
export function groupByMonth(items: readonly LongRentDeadline[], language: string): DeadlineMonth[] {
  const months = new Map<string, LongRentDeadline[]>();
  for (const item of items) {
    const month = monthOfDate(item.date);
    months.set(month, [...(months.get(month) ?? []), item]);
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => {
      const name = monthName(month, language);
      return { month, title: name.charAt(0).toLocaleUpperCase(language) + name.slice(1), items: list };
    });
}

// ------------------------------------------------------------------------------------------------------------- file

/** `scadenze-2026-10-24-2027-01-22.csv`: the window the file holds. */
export function deadlinesCsvName(from: string, to: string): string {
  return `scadenze-${from}-${to}.csv`;
}

/**
 * The file of the dates on the screen: one line each, `;` between the cells, a name that starts with a sign of a formula
 * written with a quote in front (`buildCsv` does it, as for every list). Nothing leaves the page.
 */
export function deadlinesCsv(items: readonly LongRentDeadline[], { t }: DeadlineContext): string {
  const header = [
    t('longRentDeadlines.csv.columns.date'),
    t('longRentDeadlines.csv.columns.type'),
    t('longRentDeadlines.csv.columns.tenant'),
    t('longRentDeadlines.csv.columns.property'),
    t('longRentDeadlines.csv.columns.amount'),
    t('longRentDeadlines.csv.columns.status'),
  ];
  const lines = items.map((item) => [
    item.date,
    typeTitle(item, t),
    tenantOf(item, t),
    item.propertyName,
    item.amount,
    item.isOverdue ? t('longRentDeadlines.csv.overdue') : t('longRentDeadlines.csv.upcoming'),
  ]);
  return buildCsv(header, lines, ';');
}
