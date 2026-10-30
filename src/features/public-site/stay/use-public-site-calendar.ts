import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import { getProblemMessage, isTransientRequestError } from '@/lib/api-errors';
import { addDays, parseStayDate, todayInRome } from '@/lib/stay-dates';
import type { StayCalendarData } from './use-public-calendar';

/** The range asked when nothing else is: a year from today (the endpoint takes 13 months at most). */
const DEFAULT_MONTHS_AHEAD = 12;

/**
 * The nights of the whole site, for the «Quando» field of the home and of the results (DB-07a, DB-20-FU1): each night is free when
 * some home that sleeps the party is, and it costs what the cheapest of those homes asks. Same shape as the calendar of a single
 * home, so it is the same `StayCalendar`. The party counts: a night is not free for twelve people if no home takes twelve.
 *
 * With `platform` it is the calendar of ALL the booking sites (the public `/search`), and `where` narrows it to the homes of the place
 * chosen; `orgSlug` is then not used.
 */
export function usePublicSiteCalendar(
  orgSlug: string | undefined,
  party: { adults: number; children: number },
  platform?: { where: string },
): StayCalendarData {
  const { t } = useTranslation();
  const { adults, children } = party;
  const where = platform?.where.trim() ?? '';
  const query = useQuery({
    queryKey: ['public-site-calendar', platform ? `platform:${where}` : orgSlug, adults, children] as const,
    queryFn: () =>
      platform
        ? publicSiteSearchApi.getPlatformCalendar({ adults, children, ...(where ? { where } : {}) })
        : publicSiteSearchApi.getSiteCalendar(orgSlug!, { adults, children }),
    enabled: Boolean(platform) || Boolean(orgSlug),
    staleTime: 30_000,
    refetchOnMount: true,
    // Changing the guests asks for the nights again: the calendar that is open keeps the ones it has until the new ones arrive.
    placeholderData: keepPreviousData,
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
        available: day.anyAvailable,
        priceCents: day.fromPriceCents ?? null,
        minNights: day.minNights ?? 1,
      })),
      today,
      end: parseStayDate(data.to) || addDays(today, DEFAULT_MONTHS_AHEAD * 31),
      currency: data.currency,
      onRetry: retry,
    };
  }, [data, isError, error, refetch, t]);
}
