import { createContext } from 'react';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';

export const FEATURE_FLAGS_QUERY_KEY = ['feature-flags'] as const;

export interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  isLoading: boolean;
  /**
   * True when the first read of the flags failed and no value of them is known: they are all off then, but only because nothing is known, so a screen whose content depends on a flag says so
   * instead of showing what the flag-off page shows. Absent without a provider (tests, isolated renders).
   */
  isError?: boolean;
  live?: boolean;
}

export const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: DEFAULT_FEATURE_FLAGS,
  isLoading: false,
});
