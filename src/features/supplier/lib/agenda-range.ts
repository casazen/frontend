import { addDays, endOfMonth, formatStayDate, startOfMonth, startOfWeek, utcStayDate } from '@/lib/stay-dates';

/** The three ways the agenda shows the same days (SP-07a). */
export const AGENDA_VIEWS = ['day', 'week', 'month'] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

/** The page of the agenda: "Disponibilità" in the menu. */
export const AGENDA_PATH = '/app/supplier/availability';

/** Most days the API gives for one request (`GET api/supplier/calendar`). */
const MAX_DAYS = 62;

// The words of `?vista=` in the address: Italian, as in the demo of the portal.
const VIEW_PARAMS: Record<AgendaView, string> = { day: 'giorno', week: 'settimana', month: 'mese' };

/** The view `?vista=` names, or null when the address names none (or one that does not exist). */
export function readAgendaView(value: string | null): AgendaView | null {
  return AGENDA_VIEWS.find((view) => VIEW_PARAMS[view] === value) ?? null;
}

/** The query of the address for `view` around `date` (`?vista=` and `?data=`); today is the default date, so it is not written. */
export function agendaParams(view: AgendaView, date: string, today: string): URLSearchParams {
  const params = new URLSearchParams({ vista: VIEW_PARAMS[view] });
  if (date !== today) params.set('data', date);
  return params;
}

/** The address of the agenda in `view` around `date`. */
export function agendaHref(view: AgendaView, date: string, today: string): string {
  return `${AGENDA_PATH}?${agendaParams(view, date, today).toString()}`;
}

/** The days asked to the API for `view` around `date`, both ends included: the day, the week (Monday to Sunday) or the month. */
export function agendaRange(view: AgendaView, date: string): { from: string; to: string } {
  switch (view) {
    case 'day':
      return { from: date, to: date };
    case 'week': {
      const from = startOfWeek(date, 1);
      return { from, to: addDays(from, 6) };
    }
    default:
      return { from: startOfMonth(date), to: endOfMonth(date) };
  }
}

/** Every day from `from` to `to`, both included. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day !== '' && day <= to && days.length < MAX_DAYS; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Where an arrow of the toolbar leads: one day, one week or one month (its first day) back (`-1`) or forward (`1`). */
export function shiftAgendaDate(view: AgendaView, date: string, direction: -1 | 1): string {
  switch (view) {
    case 'day':
      return addDays(date, direction);
    case 'week':
      return addDays(date, direction * 7);
    default: {
      const [year, month] = date.split('-').map(Number);
      return utcStayDate(new Date(Date.UTC(year, month - 1 + direction, 1)));
    }
  }
}

/** What the toolbar says is on show: "giovedì 16 ottobre 2026", "12–18 ottobre 2026" or "ottobre 2026". */
export function agendaLabel(view: AgendaView, date: string, language: string): string {
  if (view === 'day') return formatStayDate(date, language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (view === 'month') return formatStayDate(date, language, { month: 'long', year: 'numeric' });

  // The language writes the range as it likes it: "12–18 ottobre 2026", "October 12 – 18, 2026", "28 settembre – 4 ottobre 2026".
  const { from, to } = agendaRange('week', date);
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).formatRange(
    new Date(`${from}T00:00:00Z`),
    new Date(`${to}T00:00:00Z`),
  );
}
