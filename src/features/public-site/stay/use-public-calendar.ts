import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { publicOrgApi } from '@/api/public-org.api';
import { getProblemMessage, isTransientRequestError } from '@/lib/api-errors';
import { addDays, parseStayDate, todayInRome } from '@/lib/stay-dates';
import type { CalendarDay } from './stay-calendar-model';

/** What a calendar of the stay pickers is given to draw: the days, or why there are none yet. */
export interface StayCalendarData {
  status: 'loading' | 'error' | 'ready';
  /** The nights of the loaded range; empty until `status` is `ready`. */
  days: readonly CalendarDay[];
  /** Today in Europe/Rome. */
  today: string;
  /** End of the loaded range (excluded). */
  end: string;
  currency: string;
  /** Why the days could not be loaded (a translated problem message), when `status` is `error`. */
  errorMessage?: string;
  onRetry: () => void;
}

/** The range asked when nothing else is: a year from today (the endpoint takes 13 months at most). */
const DEFAULT_MONTHS_AHEAD = 12;

/**
 * The public calendar of a property of a site (DB-03b): the price of every night and the nights that are taken, as the
 * stay pickers draw them. `property` is the slug or the id of the property. Read again when it is older than half a minute;
 * a failed read is tried again twice when it looks like the network and not like a wrong request. While the property or the site is
 * not known yet the status is `loading`.
 */
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
        currency: 'EUR',
        errorMessage: getProblemMessage(error, t),
        onRetry: retry,
      };
    }
    if (!data) {
      return { status: 'loading', days: [], today, end: today, currency: 'EUR', onRetry: retry };
    }
    return {
      status: 'ready',
      days: data.days.map((day) => ({
        date: parseStayDate(day.date),
        available: day.available,
        priceCents: day.nightlyPriceCents,
        minNights: day.minNights,
      })),
      today,
      end: parseStayDate(data.endDate) || addDays(today, DEFAULT_MONTHS_AHEAD * 31),
      currency: data.currency,
      onRetry: retry,
    };
  }, [data, isError, error, refetch, t]);
}
