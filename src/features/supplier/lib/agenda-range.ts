import { addDays, endOfMonth, formatStayDate, startOfMonth, startOfWeek, utcStayDate } from '@/lib/stay-dates';

export const AGENDA_VIEWS = ['day', 'week', 'month'] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export const AGENDA_PATH = '/app/supplier/availability';

const MAX_DAYS = 62;

const VIEW_PARAMS: Record<AgendaView, string> = { day: 'giorno', week: 'settimana', month: 'mese' };

export function readAgendaView(value: string | null): AgendaView | null {
  return AGENDA_VIEWS.find((view) => VIEW_PARAMS[view] === value) ?? null;
}

export function agendaParams(view: AgendaView, date: string, today: string): URLSearchParams {
  const params = new URLSearchParams({ vista: VIEW_PARAMS[view] });
  if (date !== today) params.set('data', date);
  return params;
}

export function agendaHref(view: AgendaView, date: string, today: string): string {
  return `${AGENDA_PATH}?${agendaParams(view, date, today).toString()}`;
}

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

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day !== '' && day <= to && days.length < MAX_DAYS; day = addDays(day, 1)) days.push(day);
  return days;
}

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

export function agendaLabel(view: AgendaView, date: string, language: string): string {
  if (view === 'day') return formatStayDate(date, language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (view === 'month') return formatStayDate(date, language, { month: 'long', year: 'numeric' });

  const { from, to } = agendaRange('week', date);
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).formatRange(
    new Date(`${from}T00:00:00Z`),
    new Date(`${to}T00:00:00Z`),
  );
}
