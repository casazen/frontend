import type { SupplierAgendaHoursDay, SupplierHoursBand } from '@/types/supplier';
import { WEEKDAYS, hmToMinutes, minutesToHm, type WeekdayName } from './supplier-agenda';

export const MAX_BANDS_PER_DAY = 3;

const FIRST_START = '09:00';
const FIRST_END = '18:00';

export interface BandDraft {
  key: number;
  start: string;
  end: string;
}

/** A day as it is edited: open (with its bands) or a rest day. The bands of a rest day are kept, so that opening it again gives them back. */
export interface DayDraft {
  open: boolean;
  bands: BandDraft[];
}

export type WeekDraft = Record<WeekdayName, DayDraft>;

let nextKey = 1;

function newBand(start: string, end: string): BandDraft {
  return { key: nextKey++, start, end };
}

export function toDraft(days: readonly SupplierAgendaHoursDay[] | undefined): WeekDraft {
  const draft = {} as WeekDraft;
  for (const weekday of WEEKDAYS) {
    const bands = days?.find((day) => day.weekday === weekday)?.bands ?? [];
    draft[weekday] =
      bands.length > 0
        ? {
            open: true,
            bands: [...bands]
              .sort((a, b) => a.startMinute - b.startMinute)
              .map((band) => newBand(minutesToHm(band.startMinute), minutesToHm(band.endMinute))),
          }
        : { open: false, bands: [newBand(FIRST_START, FIRST_END)] };
  }
  return draft;
}

/** The band that "Aggiungi una fascia" adds: an hour after the one before and three hours long, so that a lunch break is one edit away. */
export function bandAfter(previous: BandDraft | undefined): BandDraft {
  const end = previous ? hmToMinutes(previous.end) : null;
  if (end === null) return newBand(FIRST_START, FIRST_END);
  const start = Math.min(end + 60, 22 * 60);
  return newBand(minutesToHm(start), minutesToHm(Math.min(start + 180, 24 * 60 - 1)));
}

export type DayProblem = 'order' | 'overlap';

export function toPayload(draft: WeekDraft): { days: SupplierAgendaHoursDay[]; problems: Partial<Record<WeekdayName, DayProblem>> } {
  const days: SupplierAgendaHoursDay[] = [];
  const problems: Partial<Record<WeekdayName, DayProblem>> = {};
  for (const weekday of WEEKDAYS) {
    const day = draft[weekday];
    if (!day.open) {
      days.push({ weekday, bands: [] });
      continue;
    }
    const bands: SupplierHoursBand[] = [];
    for (const band of day.bands) {
      const startMinute = hmToMinutes(band.start);
      const endMinute = hmToMinutes(band.end);
      if (startMinute === null || endMinute === null || endMinute <= startMinute) {
        problems[weekday] = 'order';
        break;
      }
      bands.push({ startMinute, endMinute });
    }
    bands.sort((a, b) => a.startMinute - b.startMinute);
    if (!problems[weekday] && bands.some((band, index) => index > 0 && band.startMinute < bands[index - 1].endMinute)) {
      problems[weekday] = 'overlap';
    }
    days.push({ weekday, bands });
  }
  return { days, problems };
}
