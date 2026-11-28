import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { publicOrgApi } from '@/api/public-org.api';
import { getProblemMessage, isTransientRequestError } from '@/lib/api-errors';
import { addDays, parseStayDate, todayInRome } from '@/lib/stay-dates';
import type { CalendarDay } from './stay-calendar-model';

export interface StayCalendarData {
  status: 'loading' | 'error' | 'ready';
  days: readonly CalendarDay[];
  today: string;
  end: string;
  currency: string | null;
  errorMessage?: string;
  onRetry: () => void;
}

const DEFAULT_MONTHS_AHEAD = 12;

export function usePublicPropertyCalendar(
  orgSlug: string | undefined,
  property: string | undefined,
  options: { from?: string; to?: string } = {},
): StayCalendarData {
  const { t } = useTranslation();
  const { from, to } = options;
  const query = useQuery({
    queryKey: ['public-calendar', orgSlug, property, from ?? '', to ?? ''] as const,
    queryFn: () => publicOrgApi.getOrgPropertyCalendar(orgSlug!, property!, from, to),
    enabled: Boolean(orgSlug && property),
    staleTime: 30_000,
    refetchOnMount: true,
    retry: (failureCount, error) => isTransientRequestError(error) && failureCount < 2,
  });
  const { data, isError, error, refetch } = query;

  return useMemo<StayCalendarData>(() => {
    const today = parseStayDate(data?.today) || todayInRome();
    const retry = () => void refetch();
    if (isError) {
      return {
        status: 'error',
        days: [],
        today,
        end: addDays(today, DEFAULT_MONTHS_AHEAD * 31),
        currency: null,
        errorMessage: getProblemMessage(error, t),
        onRetry: retry,
      };
    }
    if (!data) {
      return { status: 'loading', days: [], today, end: today, currency: null, onRetry: retry };
    }
    return {
      status: 'ready',
      days: data.days.map((day) => ({
        date: parseStayDate(day.date),
        available: day.available,
        priceCents: day.nightlyPriceCents,
        minNights: day.minNights,
        maxNights: day.maxNights ?? null,
        closedToArrival: day.closedToArrival ?? false,
        closedToDeparture: day.closedToDeparture ?? false,
        minAdvanceDays: day.minAdvanceDays ?? null,
        maxAdvanceDays: day.maxAdvanceDays ?? null,
      })),
      today,
      end: parseStayDate(data.endDate) || addDays(today, DEFAULT_MONTHS_AHEAD * 31),
      currency: data.currency,
      onRetry: retry,
    };
  }, [data, isError, error, refetch, t]);
}
