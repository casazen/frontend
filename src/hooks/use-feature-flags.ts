import { useContext } from 'react';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
