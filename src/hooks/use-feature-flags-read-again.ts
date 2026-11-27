import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { featuresApi } from '@/api/features.api';
import { parseFeatureFlags, type FeatureFlags } from '@/config/feature-flags';
import { FEATURE_FLAGS_QUERY_KEY, FeatureFlagsContext } from '@/contexts/feature-flags-context';

/**
 * The flags as the server says them when the screen opens, for a decision that cannot be undone. The provider reads them once a session (`staleTime: Infinity`), so a tab opened before a
 * flag was switched on still holds the old value: this reads them again every time the screen that uses it mounts, and the same read refreshes the flags of the whole app.
 *
 * `settled` is false until that read is over, so the screen waits instead of acting on the old value while the new one is on its way; it is true after a read that failed too (the flags it
 * has are then the ones it can know, as without this hook). Without the provider (tests, isolated renders) there is nothing to read: the flags of the context, settled.
 */
export function useFeatureFlagsReadAgain(): { flags: FeatureFlags; settled: boolean } {
  const context = useContext(FeatureFlagsContext);
  const live = context.live === true;
  const read = useQuery({
    queryKey: FEATURE_FLAGS_QUERY_KEY,
    queryFn: featuresApi.getFeatures,
    enabled: live,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    flags: live && read.data !== undefined ? parseFeatureFlags(read.data) : context.flags,
    settled: !live || read.isFetchedAfterMount,
  };
}
