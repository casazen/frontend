import { useEffect } from 'react';
import { isDemoMode } from '@/config/demo.config';
import { syncSignupAttribution } from '@/lib/signup-attribution';

/**
 * SE-03: once the user is past the onboarding guard, sends the signup attribution that the first onboarding marked
 * ready (a retry, when the onboarding page could not send it) or forgets one that belongs to an account that was
 * already onboarded. Runs once per page load; never blocks or throws.
 */
export function useSignupAttributionSync(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || isDemoMode) return;
    void syncSignupAttribution();
  }, [enabled]);
}
