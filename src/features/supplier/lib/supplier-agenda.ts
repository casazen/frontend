import { addDays, romeWallClock } from '@/lib/stay-dates';
import type {
  SupplierAgendaBlock,
  SupplierAgendaClosedDay,
  SupplierAgendaHoursDay,
  SupplierAgendaRequest,
  SupplierAgendaTimeOff,
  SupplierHoursBand,
} from '@/types/supplier';

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type WeekdayName = (typeof WEEKDAYS)[number];

const WEEKDAY_INDEX: Record<WeekdayName, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

/** Minutes after midnight (0–1440) as `HH:mm` on the Rome wall clock. */
export function minutesToHm(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) return '';
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** `HH:mm` to minutes after midnight, or null when the value is not a valid time. */
export function hmToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Europe/Rome weekday of a stay date (`YYYY-MM-DD`), Monday first. */
export function weekdayOf(date: string): WeekdayName {
  // UTC noon of the stay date is always the same weekday as that calendar day in Rome.
  const [year, month, day] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  const names: WeekdayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return names[utc.getUTCDay()];
}

export function bandsForDay(hours: SupplierAgendaHoursDay[] | undefined, date: string): SupplierHoursBand[] {
  const weekday = weekdayOf(date);
  return hours?.find((day) => day.weekday === weekday)?.bands ?? [];
}

export type DayEventKind = 'calendar' | 'block' | 'extra' | 'request' | 'timeOff';

export interface DayEvent {
  id: string;
  kind: DayEventKind;
  label: string;
  /** Rome wall clock range, or null for an all-day item. */
  timeRange: string | null;
}

export interface WorkingDayView {
  date: string;
  weekday: WeekdayName;
  bands: SupplierHoursBand[];
  closed: SupplierAgendaClosedDay | null;
  events: DayEvent[];
  /** Manual override: true = available, false = closed by hand / feed. */
  available: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatClock(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

/** Inclusive Rome dates touched by a UTC window `[start, end)`. */
function datesTouched(startUtc: string, endUtc: string): string[] {
  const start = romeWallClock(startUtc);
  const end = romeWallClock(endUtc);
  if (!start || !end) return [];

  // Exclusive end at midnight: the day that is ending is the last day touched.
  let last = end.date;
  if (end.hour === 0 && end.minute === 0) {
    const previous = addDays(end.date, -1);
    if (previous) last = previous;
  }

  const days: string[] = [];
  for (let day = start.date; day && day <= last; day = addDays(day, 1)) {
    days.push(day);
    if (days.length > 366) break;
  }
  return days;
}

function timeRangeOnDay(date: string, startUtc: string, endUtc: string): string | null {
  const start = romeWallClock(startUtc);
  const end = romeWallClock(endUtc);
  if (!start || !end) return null;

  const startsMidnight = start.hour === 0 && start.minute === 0 && start.date === date;
  const endsMidnight = end.hour === 0 && end.minute === 0;
  const endDay = endsMidnight ? addDays(end.date, -1) : end.date;
  if (startsMidnight && endsMidnight && endDay === date && start.date === date) {
    return null; // whole day on the Rome clock
  }

  const from = start.date === date ? formatClock(start.hour, start.minute) : '00:00';
  const to =
    end.date === date && !(end.hour === 0 && end.minute === 0)
      ? formatClock(end.hour, end.minute)
      : end.date === addDays(date, 1) && end.hour === 0 && end.minute === 0
        ? '24:00'
        : end.date > date
          ? '24:00'
          : formatClock(end.hour, end.minute);
  if (from === '00:00' && to === '24:00') return null;
  return `${from}–${to}`;
}

/**
 * Builds the working-day cards for the supplier availability page: weekly hours, closed days,
 * calendar engagements, manual blocks and requests that fall in the range.
 */
export function buildWorkingDays(input: {
  dates: string[];
  workingHours: SupplierAgendaHoursDay[];
  closedDays: SupplierAgendaClosedDay[];
  timeOff: SupplierAgendaTimeOff[];
  blocks: SupplierAgendaBlock[];
  requests: SupplierAgendaRequest[];
  /** Fallback when the calendar API is not loaded yet: the day grid from GET /availability. */
  availability?: Record<string, boolean>;
}): WorkingDayView[] {
  const closedByDate = new Map(input.closedDays.map((day) => [day.date, day]));

  const eventsByDate = new Map<string, DayEvent[]>();
  const push = (date: string, event: DayEvent) => {
    const list = eventsByDate.get(date) ?? [];
    list.push(event);
    eventsByDate.set(date, list);
  };

  for (const entry of input.timeOff) {
    for (let day = entry.fromDate; day && day <= entry.toDate; day = addDays(day, 1)) {
      push(day, {
        id: `timeoff-${entry.id}`,
        kind: 'timeOff',
        label: entry.label || entry.reason,
        timeRange: null,
      });
    }
  }

  for (const block of input.blocks) {
    const kind: DayEventKind =
      block.kind === 'ExtraOpening' ? 'extra' : block.source === 'ICalFeed' || block.kind === 'External' ? 'calendar' : 'block';
    for (const day of datesTouched(block.startUtc, block.endUtc)) {
      push(day, {
        id: `block-${block.id}-${day}`,
        kind,
        label: block.label || kind,
        timeRange: timeRangeOnDay(day, block.startUtc, block.endUtc),
      });
    }
  }

  for (const request of input.requests) {
    if (request.startUtc && request.endUtc) {
      for (const day of datesTouched(request.startUtc, request.endUtc)) {
        push(day, {
          id: `req-${request.id}-${day}`,
          kind: 'request',
          label: request.category,
          timeRange: timeRangeOnDay(day, request.startUtc, request.endUtc),
        });
      }
    } else {
      push(request.date, {
        id: `req-${request.id}`,
        kind: 'request',
        label: request.category,
        timeRange: null,
      });
    }
  }

  return input.dates.map((date) => {
    const closed = closedByDate.get(date) ?? null;
    const available = closed ? false : (input.availability?.[date] ?? true);
    const bands = bandsForDay(input.workingHours, date);
    const events = (eventsByDate.get(date) ?? []).sort((a, b) => (a.timeRange ?? '').localeCompare(b.timeRange ?? ''));
    return {
      date,
      weekday: weekdayOf(date),
      bands,
      closed,
      events,
      available,
    };
  });
}

export function emptyWeekHours(): SupplierAgendaHoursDay[] {
  return WEEKDAYS.map((weekday) => ({ weekday, bands: [] }));
}

export function weekdayIndex(weekday: WeekdayName): number {
  return WEEKDAY_INDEX[weekday];
}
