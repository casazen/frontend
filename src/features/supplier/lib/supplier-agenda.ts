import { addDays, romeWallClock } from '@/lib/stay-dates';
import type {
  SupplierAgendaBlock,
  SupplierAgendaClosedDay,
  SupplierAgendaHoursDay,
  SupplierAgendaRequest,
  SupplierAgendaTimeOff,
  SupplierConflictSeverity,
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
  /**
   * What the supplier or the calendar called it; the service category (its code) for a request. Empty when it has no name:
   * the page names the kind then.
   */
  label: string;
  /** Rome wall clock range, or null for an all-day item. */
  timeRange: string | null;
  /** A request: where to open it and how it stands (the status of the API). */
  requestId?: string;
  status?: string;
  /** A request: the service of the catalog it is for (none: the category is its name), who asks and where (SP-03b). */
  serviceName?: string | null;
  clientLabel?: string | null;
  comune?: string | null;
  /** A request booked from the public page of the supplier. */
  fromShowcase?: boolean;
  /** A request with something wrong in its time (the conflicts of the next 30 days): how serious the worst is. */
  conflict?: SupplierConflictSeverity;
  /** Time off: why (`Vacation`, `Holiday`, `Illness`, `Other`). */
  reason?: string;
}

/** How a day stands for the customers: bookable, a rest day of the week, closed by the supplier or by the calendar, or time off. */
export type DayState = 'open' | 'rest' | 'closed' | 'closedByCalendar' | 'timeOff';

/** The words of each state (keys of the locale files). */
export const DAY_STATE_LABEL_KEYS: Record<DayState, string> = {
  open: 'supplier.available',
  rest: 'supplier.agenda.state.rest',
  closed: 'supplier.agenda.state.closed',
  closedByCalendar: 'supplier.agenda.state.closedByCalendar',
  timeOff: 'supplier.notAvailable',
};

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
  /** How serious the worst conflict of a request is, by request id (the next 30 days). */
  conflicts?: ReadonlyMap<string, SupplierConflictSeverity>;
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
        label: entry.label ?? '',
        timeRange: null,
        reason: entry.reason,
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
        label: block.label ?? '',
        timeRange: timeRangeOnDay(day, block.startUtc, block.endUtc),
      });
    }
  }

  for (const request of input.requests) {
    // What the supplier reads of a job besides its hours: the service, who asks and where, and whether its time is in trouble.
    const about = {
      kind: 'request' as const,
      label: request.category,
      requestId: request.id,
      status: request.status,
      serviceName: request.serviceName,
      clientLabel: request.clientLabel,
      comune: request.comune,
      fromShowcase: request.source === 'showcase',
      conflict: input.conflicts?.get(request.id),
    };
    if (request.startUtc && request.endUtc) {
      for (const day of datesTouched(request.startUtc, request.endUtc)) {
        push(day, {
          ...about,
          id: `req-${request.id}-${day}`,
          timeRange: timeRangeOnDay(day, request.startUtc, request.endUtc),
        });
      }
    } else {
      push(request.date, { ...about, id: `req-${request.id}`, timeRange: null });
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

/** The bands of a day as the supplier reads them: `09:00–13:00, 14:00–18:00`. */
export function formatBands(bands: SupplierHoursBand[]): string {
  return bands.map((band) => `${minutesToHm(band.startMinute)}–${minutesToHm(band.endMinute)}`).join(', ');
}

/** How a day stands. Time off comes first (it is why the day is not bookable), then a closed day, then a rest day of the week. */
export function dayStateOf(day: Pick<WorkingDayView, 'bands' | 'closed' | 'events'>): DayState {
  if (day.events.some((event) => event.kind === 'timeOff')) return 'timeOff';
  if (day.closed) return day.closed.source === 'ICalFeed' ? 'closedByCalendar' : 'closed';
  return day.bands.length === 0 ? 'rest' : 'open';
}

export function emptyWeekHours(): SupplierAgendaHoursDay[] {
  return WEEKDAYS.map((weekday) => ({ weekday, bands: [] }));
}
