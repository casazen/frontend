import { useCallback, useSyncExternalStore } from 'react';
import {
  CONSENT_CHANGED_EVENT,
  readConsentChoice,
  writeConsentChoice,
  type ConsentChoice,
} from '@/lib/cookie-consent';
import { forgetSentPurchases } from '@/features/host-tracking/purchase-once';
import { forgetVisitMarketing, keepDeferredLandingTouch } from '@/lib/signup-attribution';

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useConsent() {
  const choice = useSyncExternalStore(subscribe, readConsentChoice, () => null);

  const choose = useCallback((next: ConsentChoice) => {
    writeConsentChoice(next);
    if (next === 'accepted') keepDeferredLandingTouch();
    else {
      forgetVisitMarketing();
      forgetSentPurchases();
    }
  }, []);

  return { choice, statistics: choice === 'accepted', choose };
}
