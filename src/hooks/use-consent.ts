import { useCallback, useSyncExternalStore } from 'react';
import {
  CONSENT_CHANGED_EVENT,
  readConsentChoice,
  writeConsentChoice,
  type ConsentChoice,
} from '@/lib/cookie-consent';
import { forgetVisitMarketing, keepDeferredLandingTouch } from '@/lib/signup-attribution';

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  // Another tab of the same browser chose.
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * What the visitor chose about cookies (null while they have not) and the way to choose (DB-02b). Choosing writes the
 * choice, and the statistics follow it: yes keeps the source of the visit that was only held in memory, no forgets whatever was
 * kept of it (the source of a host signup waiting to be sent included).
 */
export function useConsent() {
  const choice = useSyncExternalStore(subscribe, readConsentChoice, () => null);

  const choose = useCallback((next: ConsentChoice) => {
    writeConsentChoice(next);
    if (next === 'accepted') keepDeferredLandingTouch();
    else forgetVisitMarketing();
  }, []);

  return { choice, statistics: choice === 'accepted', choose };
}
