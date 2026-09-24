import { createContext } from 'react';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';

export interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  /** True until the first answer (or failure) of `GET /api/public/features`. */
  isLoading: boolean;
}

/** Without a provider (tests, isolated renders) every flag is off and nothing is loading. */
export const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: DEFAULT_FEATURE_FLAGS,
  isLoading: false,
});
