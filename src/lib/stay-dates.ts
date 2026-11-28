/**
 * Stay dates are calendar dates without a time (`YYYY-MM-DD`). "Today" is the calendar date in
 * Europe/Rome, whatever the time zone of the guest's browser.
 *
 * This is the only place that turns the clock or a `Date` into a calendar date (QA-CLOCK-FE). Never use
 * `toISOString().slice(0, 10)` or `.split('T')[0]`: they give the UTC date, which is yesterday in Rome between
 * midnight and 02:00 and the day before for a local midnight. ESLint forbids them in the application code.
 */
const STAY_TIME_ZONE = 'Europe/Rome';
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ROME_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: STAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const ZURICH_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Zurich',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function calendarDate(format: Intl.DateTimeFormat, now: Date): string {
  const parts = format.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((piece) => piece.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function toUtcDate(value: string): Date | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const sameDay = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return sameDay ? date : null;
}

export function isStayDate(value: string): boolean {
  return toUtcDate(value) !== null;
}

export function todayInRome(now: Date = new Date()): string {
  return calendarDate(ROME_DATE_FORMAT, now);
}

export function todayInZurich(now: Date = new Date()): string {
  return calendarDate(ZURICH_DATE_FORMAT, now);
}

/**
 * Calendar date of `date` as the browser shows it (local year, month and day): what a date picker or
 * `new Date(year, month, day)` stands for. A local midnight never moves to the day before, whatever the time zone.
 * An empty string for an invalid date. For "today" use {@link todayInRome}.
 */
export function toStayDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  return formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function utcStayDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  return formatDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(date: string, days: number): string {
  const utc = toUtcDate(date);
  if (!utc) return '';
  return utcStayDate(new Date(utc.getTime() + days * MS_PER_DAY));
}

export function startOfMonth(date: string): string {
  const utc = toUtcDate(date);
  return utc ? formatDateParts(utc.getUTCFullYear(), utc.getUTCMonth() + 1, 1) : '';
}

export function endOfMonth(date: string): string {
  const utc = toUtcDate(date);
  return utc ? utcStayDate(new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth() + 1, 0))) : '';
}

export function startOfWeek(date: string, weekStartsOn: number = 1): string {
  const utc = toUtcDate(date);
  if (!utc) return '';
  return addDays(date, -((utc.getUTCDay() - weekStartsOn + 7) % 7));
}

const API_STAY_DATE = /^(\d{4}-\d{2}-\d{2})(?:T|$)/;

/**
 * Stay date (`YYYY-MM-DD`) of a date sent by the API: a stay date (`2026-09-30`), a stay date without time zone
 * (`2026-09-30T00:00:00`, host calendar MO-06) or the stored UTC midnight of the day (`2026-09-30T00:00:00Z`, FD-06).
 * The day is read as written, never as an instant in the browser's time zone (`new Date('2026-09-30')` is the 29th in
 * America). An empty string when the value is missing or not a date.
 */
export function parseStayDate(value: string | null | undefined): string {
  const match = value ? API_STAY_DATE.exec(value) : null;
  return match && isStayDate(match[1]) ? match[1] : '';
}

export function stayDateToLocalDate(date: string): Date | null {
  const utc = toUtcDate(date);
  return utc ? new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()) : null;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = toUtcDate(checkIn);
  const end = toUtcDate(checkOut);
  if (!start || !end) return 0;
  const nights = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  return nights > 0 ? nights : 0;
}

export function formatRomeDateTime(
  instant: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' },
): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: STAY_TIME_ZONE }).format(date);
}

const ROME_WALL_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: STAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function romeWallParts(instant: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = ROME_WALL_PARTS.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute') };
}

export function romeWallTimeToUtc(date: string, time: string): string {
  if (!isStayDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return '';
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shown = romeWallParts(new Date(utc));
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    if (shownAsUtc === wanted) break;
    utc += wanted - shownAsUtc;
  }
  const check = romeWallParts(new Date(utc));
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute) {
    return '';
  }
  return new Date(utc).toISOString();
}

export function romeWallClock(instant: string | Date): { date: string; hour: number; minute: number } | null {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return null;
  const parts = romeWallParts(date);
  if (![parts.year, parts.month, parts.day, parts.hour, parts.minute].every(Number.isFinite)) return null;
  if (parts.hour === 24) {
    const next = addDays(formatDateParts(parts.year, parts.month, parts.day), 1);
    return isStayDate(next) ? { date: next, hour: 0, minute: parts.minute } : null;
  }
  return {
    date: formatDateParts(parts.year, parts.month, parts.day),
    hour: parts.hour,
    minute: parts.minute,
  };
}

export function romeDateOf(instant: string | null | undefined): string {
  if (!instant) return '';
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? '' : todayInRome(date);
}

const STAY_DATE_FORMATS = new Map<string, Intl.DateTimeFormat>();

function stayDateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = STAY_DATE_FORMATS.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    STAY_DATE_FORMATS.set(key, format);
  }
  return format;
}

export function formatStayDate(
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
): string {
  const utc = toUtcDate(date);
  return utc ? stayDateFormat(locale, options).format(utc) : '';
}
