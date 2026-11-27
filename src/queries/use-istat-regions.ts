import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { istatApi } from '@/api/istat.api';
import type { IstatRegionRule, SaveIstatRegionRequest } from '@/types/istat.types';

/** Root of the query key of the ISTAT region table of the staff. */
const ISTAT_REGIONS_KEY = ['admin', 'istat-regions'] as const;

/** Root of the query key of the ISTAT coverage of a property: one key for each property. */
const ISTAT_COVERAGE_KEY = 'istat-coverage';

/** The same territory: the region code and, for the two autonomous provinces of Trentino-Alto Adige, the plate code. */
const sameTerritory = (first: Pick<IstatRegionRule, 'regionIstatCode' | 'provinceCode'>, second: Pick<IstatRegionRule, 'regionIstatCode' | 'provinceCode'>): boolean =>
  first.regionIstatCode === second.regionIstatCode && (first.provinceCode ?? null) === (second.provinceCode ?? null);

/**
 * The whole ISTAT region table (platform admin only). Another member of the staff may have saved a row since, so every visit of the page reads it again (`'always'`) and a read less
 * than half a minute old is fresh.
 */
export function useIstatRegions() {
  return useQuery({
    queryKey: ISTAT_REGIONS_KEY,
    queryFn: () => istatApi.listRegions(),
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
}

/**
 * Reads the whole table again now, whatever the age of what the page holds (`staleTime: 0`), and puts the answer in the table of the page. It fails when the read fails: the answer of the server
 * or nothing, never the older rows. A save replaces a whole row and the API has no version, so the form of a row starts from this read and is saved only after another one.
 */
export function useRereadIstatRegions() {
  const queryClient = useQueryClient();

  return useCallback(() => queryClient.fetchQuery({ queryKey: ISTAT_REGIONS_KEY, queryFn: () => istatApi.listRegions(), staleTime: 0 }), [queryClient]);
}

/**
 * Saves the row of a territory. The row the server answers replaces the one of the table at once and the table is read again (the audit stamp and the date are the server's); the coverage
 * of every property is read again too, because the table is what they answer from. What is sent is the staff's own text about a region: no credential and no personal data.
 */
export function useSaveIstatRegion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SaveIstatRegionRequest) => istatApi.saveRegion(request),
    onSuccess: (saved: IstatRegionRule) => {
      queryClient.setQueryData<IstatRegionRule[]>(ISTAT_REGIONS_KEY, (rows) => rows?.map((row) => (sameTerritory(row, saved) ? saved : row)));
      void queryClient.invalidateQueries({ queryKey: ISTAT_REGIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: [ISTAT_COVERAGE_KEY] });
    },
  });
}

/**
 * What the table says about the ISTAT communication of a property: its region, system, deadline, whether the channel manager covers it and what to do next. It changes when the staff
 * verifies a row and on other screens, so every visit reads it again (`'always'`) and a read less than half a minute old is fresh. The endpoint answers 404 while the backend flag
 * `OctorateOnboarding` is off, so a screen that may be drawn with the flag off passes `enabled: false` and asks nothing. What an error leaves in the cache is not an answer: the screens look at
 * the error first.
 */
export function useIstatCoverage(propertyId: string, enabled = true) {
  return useQuery({
    queryKey: [ISTAT_COVERAGE_KEY, propertyId],
    queryFn: () => istatApi.getCoverage(propertyId),
    enabled: enabled && propertyId !== '',
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
}
