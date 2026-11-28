import type { TFunction } from 'i18next';
import type { CalmTone, DayListItem } from '@/components/shared/calm';
import { buildCsv } from '@/components/shared/list-view/list-csv';
import { addDays, endOfMonth } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import type { LongRentDeadline, LongRentDeadlinesParams } from '@/types';
import { leaseTenantName } from '../lib/lease-list-format';
import { leaseSheetPath } from '../lib/lease-next-step';
import { monthName, monthOfDate, rentRegisterPath, shiftMonth } from '../lib/rent-register';

export interface DeadlineContext {
  t: TFunction;
  today: string;
}

// The keys are written out so that the i18n test finds a missing translation (`*Key:` properties are scanned).
const TYPE_TITLES = [
  { type: 'RliRegistration', titleKey: 'longRentDeadlines.type.RliRegistration' },
  { type: 'Questura', titleKey: 'longRentDeadlines.type.Questura' },
  { type: 'LeaseEnd', titleKey: 'longRentDeadlines.type.LeaseEnd' },
  { type: 'Notice', titleKey: 'longRentDeadlines.type.Notice' },
  { type: 'Rent', titleKey: 'longRentDeadlines.type.Rent' },
] as const;
const UNKNOWN_TYPE_TITLE = { titleKey: 'longRentDeadlines.type.unknown' } as const;

function typeTitle(item: LongRentDeadline, t: TFunction): string {
  const { titleKey } = TYPE_TITLES.find((entry) => entry.type === item.type) ?? UNKNOWN_TYPE_TITLE;
  return t(titleKey, { amount: formatCurrency(item.amount ?? 0) });
}

const FILTERS = [
  { id: 'all', labelKey: 'longRentDeadlines.filters.all', types: null },
  { id: 'registrations', labelKey: 'longRentDeadlines.filters.registrations', types: ['RliRegistration'] },
  { id: 'renewals', labelKey: 'longRentDeadlines.filters.renewals', types: ['LeaseEnd', 'Notice'] },
  { id: 'questura', labelKey: 'longRentDeadlines.filters.questura', types: ['Questura'] },
  { id: 'rents', labelKey: 'longRentDeadlines.filters.rents', types: ['Rent'] },
] as const;

export type DeadlineFilterId = (typeof FILTERS)[number]['id'];

export const DEADLINE_FILTER_OPTIONS: ReadonlyArray<{ id: DeadlineFilterId; labelKey: string }> = FILTERS;

export function deadlineFilterOf(chip: string | null): DeadlineFilterId {
  return FILTERS.find((filter) => filter.id === chip)?.id ?? 'all';
}

export function filterDeadlines(items: readonly LongRentDeadline[], filterId: DeadlineFilterId): LongRentDeadline[] {
  const types: readonly string[] | null = FILTERS.find((filter) => filter.id === filterId)?.types ?? null;
  return types ? items.filter((item) => types.includes(item.type)) : [...items];
}

export type DeadlineWindow = Required<Pick<LongRentDeadlinesParams, 'from' | 'to'>>;

const WINDOW_DAYS = [90, 180, 366] as const;

export const FIRST_WINDOW_DAYS: number = WINDOW_DAYS[0];

export function agendaWindow(today: string, days: number): DeadlineWindow {
  return { from: today, to: addDays(today, days) };
}

export function longerWindowDays(days: number): number | null {
  return WINDOW_DAYS.find((step) => step > days) ?? null;
}

const OVERVIEW_MONTHS = 4;

export function overviewWindow(today: string): DeadlineWindow {
  const month = shiftMonth(monthOfDate(today), OVERVIEW_MONTHS);
  const lastDay = Number(endOfMonth(`${month}-01`).slice(8, 10));
  const day = Math.min(Number(today.slice(8, 10)), lastDay);
  return { from: today, to: `${month}-${String(day).padStart(2, '0')}` };
}

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

const NEXT_RENTS_ON_THE_SHEET = 2;

export interface LeaseDeadlineRows {
  rows: DayListItem[];
  moreRents: number;
}

/**
 * The dates on the sheet of one lease (LR-03c): the ones the server gives for it, in its order. No tenant and no property under a row (the
 * sheet is that lease's), and no link to a page of the area for a date this very tab deals with. `renews`: the lease goes on by itself if
 * nobody gives notice (its type renews and no notice or early termination is recorded), so the end of the period is told as that and says it:
 * in words only, no number of months or days of the law (decision LR-D29).
 */
export function leaseDeadlineRows(items: readonly LongRentDeadline[], { t }: Pick<DeadlineContext, 't'>, { renews }: { renews: boolean }): LeaseDeadlineRows {
  const rents = items.filter((item) => item.type === 'Rent');
  const kept = new Set([...rents.filter((item) => item.isOverdue), ...rents.filter((item) => !item.isOverdue).slice(0, NEXT_RENTS_ON_THE_SHEET)]);
  const shown = items.filter((item) => item.type !== 'Rent' || kept.has(item));

  const rows = shown.map((item): DayListItem => {
    const when = whenText(item, t);
    const row: DayListItem = {
      id: `${item.type}:${item.installmentId ?? item.date}`,
      day: item.date,
      title: item.type === 'LeaseEnd' && renews ? t('leaseSheet.deadlines.periodEnd') : typeTitle(item, t),
      meta: when.text,
      tone: when.tone,
    };
    switch (item.type) {
      case 'LeaseEnd':
        return renews ? { ...row, subtitle: t('leaseLifecycle.facts.renewsValue'), href: leaseSheetPath(item.leaseId, 'dati') } : { ...row, href: leaseSheetPath(item.leaseId, 'dati') };
      case 'Notice':
        return { ...row, href: leaseSheetPath(item.leaseId, 'dati') };
      case 'Rent':
        return { ...row, href: leaseSheetPath(item.leaseId, 'pagamenti') };
      default:
        // The registration and the Questura communication are done on this tab, a few lines down: nothing to open.
        return row;
    }
  });
  return { rows, moreRents: rents.length - kept.size };
}

export interface DeadlineMonth {
  month: string;
  title: string;
  items: LongRentDeadline[];
}

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

export function deadlinesCsvName(from: string, to: string): string {
  return `scadenze-${from}-${to}.csv`;
}

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
