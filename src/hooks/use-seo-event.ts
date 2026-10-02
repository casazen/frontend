import { useCallback } from 'react';
import { trackSeoEvent } from '@/lib/seo-events';
import type { SeoEventName } from '@/types/seo.types';

/** `track(event)` for the SEO page of a comune (slug or ISTAT code): sends a funnel event, never throws (SE-04, AC8). */
export function useSeoEvent(comune: string | null | undefined): (event: SeoEventName) => void {
  return useCallback(
    (event: SeoEventName) => {
      trackSeoEvent(event, comune);
    },
    [comune],
  );
}
