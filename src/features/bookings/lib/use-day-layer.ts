import { useMemo } from 'react';
import { getHttpStatus } from '@/lib/api-errors';
import { useCalendarDays } from '@/queries/use-calendar-days';
import type { CalendarDaysQuery } from '@/types/calendar-days.types';
import { toDayLayer, type DayLayer } from './day-layer';

export interface DayLayerRead {
  /** The layer to draw: `undefined` while it is not read, when the caller may not read it, and when the last read failed. */
  layer: DayLayer | undefined;
  /** The last read failed for a reason other than the right to read (which is not an error: the calendar works as it always did). */
  failed: boolean;
  retry: () => void;
}

/**
 * The day layer of a range for the calendar to draw (E08/F05/US03/T01). Without the right to read property data (`canRead`) nothing is asked; a 403 of the API is the
 * same answer, and the layer is simply not drawn, with no error state. Any other failure is not hidden: the layer is not drawn from what an earlier read left in the
 * cache (the prices could be old), and the calendar says that the days could not be read, with a way to try again.
 */
export function useDayLayer(query: CalendarDaysQuery | undefined, canRead: boolean): DayLayerRead {
  const days = useCalendarDays(query, { enabled: canRead });
  const { data, isError, error, refetch } = days;
  const layer = useMemo(() => (isError ? undefined : toDayLayer(data)), [isError, data]);
  const failed = isError && getHttpStatus(error) !== 403;
  return { layer: canRead ? layer : undefined, failed: canRead && failed, retry: () => void refetch() };
}
