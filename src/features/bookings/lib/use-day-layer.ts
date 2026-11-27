import { useMemo } from 'react';
import { getHttpStatus } from '@/lib/api-errors';
import { useCalendarDays } from '@/queries/use-calendar-days';
import type { CalendarDaysQuery } from '@/types/calendar-days.types';
import { toDayLayer, type DayLayer } from './day-layer';

export interface DayLayerRead {
  layer: DayLayer | undefined;
  failed: boolean;
  retry: () => void;
}

export function useDayLayer(query: CalendarDaysQuery | undefined, canRead: boolean): DayLayerRead {
  const days = useCalendarDays(query, { enabled: canRead });
  const { data, isError, error, refetch } = days;
  const layer = useMemo(() => (isError ? undefined : toDayLayer(data)), [isError, data]);
  const failed = isError && getHttpStatus(error) !== 403;
  return { layer: canRead ? layer : undefined, failed: canRead && failed, retry: () => void refetch() };
}
