import { isDate } from './page-params';
import type { EmbedLang, SearchText } from './texts';

export type Day = string;

export interface Range {
  checkIn: Day;
  checkOut: Day;
}

const DAY_MS = 86_400_000;
const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
const write = (year: number, month: number, day: number): Day => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

function utc(day: Day): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

function fromUtc(date: Date): Day {
  return write(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(day: Day, count: number): Day {
  return fromUtc(new Date(utc(day).getTime() + count * DAY_MS));
}

export function addMonths(day: Day, count: number): Day {
  const [year, month, date] = day.split('-').map(Number);
  const index = year * 12 + (month - 1) + count;
  const target = { year: Math.floor(index / 12), month: (index % 12) + 1 };
  const last = new Date(Date.UTC(target.year, target.month, 0)).getUTCDate();
  return write(target.year, target.month, Math.min(date, last));
}

export function monthStart(day: Day): Day {
  return `${day.slice(0, 8)}01`;
}

export function weekStart(day: Day): Day {
  return addDays(day, -((utc(day).getUTCDay() + 6) % 7));
}

export function nightsBetween(checkIn: Day, checkOut: Day): number {
  return Math.max(0, Math.round((utc(checkOut).getTime() - utc(checkIn).getTime()) / DAY_MS));
}

export function monthGrid(first: Day): (Day | null)[][] {
  const lead = (utc(first).getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)), 0)).getUTCDate();
  const cells: (Day | null)[] = Array.from({ length: lead }, () => null);
  for (let date = 1; date <= last; date += 1) cells.push(`${first.slice(0, 8)}${pad(date)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Day | null)[][] = [];
  for (let at = 0; at < cells.length; at += 7) weeks.push(cells.slice(at, at + 7));
  return weeks;
}

export function todayLocal(now: Date = new Date()): Day {
  return write(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export type Step = 'arrival' | 'departure' | 'past';

/**
 * The stay after `day` is picked. A past day is no choice. Without an arrival, with a whole stay already, or on a day that is not after the arrival the day
 * is a new ARRIVAL (a departure needs one night at least, so it cannot be on or before the arrival); otherwise it is the DEPARTURE.
 */
export function pickDay(range: Range, day: Day, today: Day): { range: Range; step: Step } {
  if (day < today) return { range, step: 'past' };
  if (range.checkIn === '' || range.checkOut !== '' || day <= range.checkIn) return { range: { checkIn: day, checkOut: '' }, step: 'arrival' };
  return { range: { checkIn: range.checkIn, checkOut: day }, step: 'departure' };
}

export const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];

export function moveFocus(from: Day, key: string, today: Day): Day {
  let target = from;
  switch (key) {
    case 'ArrowLeft':
      target = addDays(from, -1);
      break;
    case 'ArrowRight':
      target = addDays(from, 1);
      break;
    case 'ArrowUp':
      target = addDays(from, -7);
      break;
    case 'ArrowDown':
      target = addDays(from, 7);
      break;
    case 'Home':
      target = weekStart(from);
      break;
    case 'End':
      target = addDays(weekStart(from), 6);
      break;
    case 'PageUp':
      target = addMonths(from, -1);
      break;
    case 'PageDown':
      target = addMonths(from, 1);
      break;
  }
  return target < today ? today : target;
}

/** The writer of a day in the language of the bar (`Intl`), in UTC so that the day written is the day given: `dayFormat('it', { day: 'numeric', month: 'long' })('2026-03-12')` is `12 marzo`. */
export function dayFormat(lang: EmbedLang, options: Intl.DateTimeFormatOptions): (day: Day) => string {
  const format = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'it-IT', { ...options, timeZone: 'UTC' });
  return (day) => format.format(utc(day));
}

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, attributes: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

const A_MONDAY: Day = '2024-01-01';

export interface CalendarConfig {
  lang: EmbedLang;
  text: SearchText;
  id: string;
  /** Today: read at every open and every pick, because a page can stay open overnight. */
  today: () => Day;
  months: () => 1 | 2;
  onPick: (range: Range, step: 'arrival' | 'departure') => void;
  onSay: (message: string) => void;
  onClose: (restoreFocus: boolean) => void;
}

export interface Calendar {
  element: HTMLElement;
  isOpen: () => boolean;
  open: (range: Range) => void;
  close: (restoreFocus: boolean) => void;
  contains: (target: Node | null) => boolean;
}

export function createCalendar(config: CalendarConfig): Calendar {
  const { lang, text, id } = config;
  const fullDay = dayFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const monthName = dayFormat(lang, { month: 'long', year: 'numeric' });
  const weekdayShort = dayFormat(lang, { weekday: 'short' });
  const weekdayLong = dayFormat(lang, { weekday: 'long' });

  const dialog = node('div', 'czs-cal', { id, role: 'dialog', 'aria-modal': 'false', 'aria-label': text.calendar });
  dialog.hidden = true;
  const previous = node('button', 'czs-nav', { type: 'button', 'aria-label': text.previous });
  previous.textContent = '‹';
  const next = node('button', 'czs-nav', { type: 'button', 'aria-label': text.next });
  next.textContent = '›';
  const head = node('div', 'czs-cal-head');
  head.append(previous, next);
  const months = node('div', 'czs-months');
  dialog.append(head, months);

  let range: Range = { checkIn: '', checkOut: '' };
  let first: Day = '';
  let focus: Day = '';
  let open = false;

  const cell = (day: Day, today: Day): HTMLElement => {
    const past = day < today;
    const start = day === range.checkIn;
    const end = day === range.checkOut;
    const inside = range.checkIn !== '' && range.checkOut !== '' && day > range.checkIn && day < range.checkOut;
    const classes = ['czs-day', past && 'is-past', start && 'is-start', end && 'is-end', inside && 'is-range', day === today && 'is-today'].filter(Boolean).join(' ');
    const mark = start ? `, ${text.arrival}` : end ? `, ${text.departure}` : past ? `, ${text.pastDay}` : '';
    const element = node('td', classes, {
      role: 'gridcell',
      'data-day': day,
      tabindex: day === focus ? '0' : '-1',
      'aria-selected': String(start || end || inside),
      'aria-label': `${fullDay(day)}${mark}`,
    });
    if (past) element.setAttribute('aria-disabled', 'true');
    element.textContent = String(Number(day.slice(8)));
    return element;
  };

  const month = (start: Day, index: number, today: Day): HTMLElement => {
    const titleId = `${id}-m${index}`;
    const block = node('div', 'czs-month');
    const title = node('div', 'czs-month-title', { id: titleId });
    title.textContent = monthName(start);
    const table = node('table', 'czs-grid', { role: 'grid', 'aria-labelledby': titleId });
    const names = node('tr', 'czs-row', { role: 'row' });
    for (let at = 0; at < 7; at += 1) {
      const day = addDays(A_MONDAY, at);
      const name = node('th', 'czs-dow', { scope: 'col', abbr: weekdayLong(day) });
      name.textContent = weekdayShort(day);
      names.appendChild(name);
    }
    const header = node('thead', 'czs-head');
    header.appendChild(names);
    const body = node('tbody', 'czs-body');
    for (const week of monthGrid(start)) {
      const row = node('tr', 'czs-row', { role: 'row' });
      for (const day of week) row.appendChild(day === null ? node('td', 'czs-blank', { 'aria-hidden': 'true' }) : cell(day, today));
      body.appendChild(row);
    }
    table.append(header, body);
    block.append(title, table);
    return block;
  };

  const render = (focusCell: boolean): void => {
    const today = config.today();
    months.textContent = '';
    for (let index = 0; index < config.months(); index += 1) months.appendChild(month(addMonths(first, index), index, today));
    previous.setAttribute('aria-disabled', String(first <= monthStart(today)));
    if (focusCell) months.querySelector<HTMLElement>(`[data-day="${focus}"]`)?.focus();
  };

  const close = (restoreFocus: boolean): void => {
    if (!open) return;
    open = false;
    dialog.hidden = true;
    config.onClose(restoreFocus);
  };

  const pick = (day: Day): void => {
    const result = pickDay(range, day, config.today());
    if (result.step === 'past') return;
    range = result.range;
    focus = day;
    config.onPick(range, result.step);
    if (result.step === 'departure') close(true);
    else render(true);
  };

  const move = (from: Day, key: string): void => {
    const target = moveFocus(from, key, config.today());
    focus = target;
    if (target < first) first = monthStart(target);
    else if (target >= addMonths(first, config.months())) first = addMonths(monthStart(target), 1 - config.months());
    render(true);
    if (monthStart(from) !== monthStart(target)) config.onSay(monthName(target));
  };

  const turn = (by: -1 | 1): void => {
    const today = config.today();
    const target = addMonths(first, by);
    if (target < monthStart(today)) return;
    first = target;
    if (focus < first || focus >= addMonths(first, config.months())) focus = first < today ? today : first;
    render(false);
    config.onSay(monthName(first));
  };

  dialog.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (previous.contains(target)) turn(-1);
    else if (next.contains(target)) turn(1);
    else {
      const day = target.closest('[data-day]')?.getAttribute('data-day');
      if (day) pick(day);
    }
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    const day = (event.target as Element).closest('[data-day]')?.getAttribute('data-day');
    if (!day || !isDate(day)) return;
    if (NAV_KEYS.includes(event.key)) {
      event.preventDefault();
      move(day, event.key);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(day);
    }
  });

  return {
    element: dialog,
    isOpen: () => open,
    open: (initial) => {
      const today = config.today();
      range = { ...initial };
      focus = range.checkIn !== '' && range.checkIn >= today ? range.checkIn : today;
      first = monthStart(focus);
      open = true;
      dialog.hidden = false;
      render(true);
    },
    close,
    contains: (target) => target !== null && dialog.contains(target),
  };
}
