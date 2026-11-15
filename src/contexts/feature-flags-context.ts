import { createContext } from 'react';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';

/** The query of the flags: the provider reads it once a session, and a screen that cannot act on an old value reads it again (`useFeatureFlagsReadAgain`). */
export const FEATURE_FLAGS_QUERY_KEY = ['feature-flags'] as const;

export interface FeatureFlagsContextValue {
  flags: FeatureFlags;
  /** True until the first answer (or failure) of `GET /api/public/features`. */
  isLoading: boolean;
  /** True when the flags come from the provider, that is from the server, so they can be read again; absent without a provider (tests, isolated renders), where there is nothing to read. */
  live?: boolean;
}

/** Without a provider (tests, isolated renders) every flag is off and nothing is loading. */
export const FeatureFlagsContext = createContext<FeatureFlagsContextValue>({
  flags: DEFAULT_FEATURE_FLAGS,
  isLoading: false,
});
