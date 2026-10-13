import { useContext } from 'react';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';

/** Backend feature flags; all off while loading, on error and outside `FeatureFlagsProvider`. */
export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
