import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { featuresApi } from '@/api/features.api';
import { DEFAULT_FEATURE_FLAGS, parseFeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext, type FeatureFlagsContextValue } from './feature-flags-context';

const FEATURE_FLAGS_QUERY_KEY = ['feature-flags'] as const;

/**
 * Loads the backend feature flags once per session. On error the flags stay off (fail closed): a hidden feature
 * never shows up because the flags could not be read.
 */
export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery({
    queryKey: FEATURE_FLAGS_QUERY_KEY,
    queryFn: featuresApi.getFeatures,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      flags: query.data === undefined ? DEFAULT_FEATURE_FLAGS : parseFeatureFlags(query.data),
      isLoading: query.isLoading,
    }),
    [query.data, query.isLoading],
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}
