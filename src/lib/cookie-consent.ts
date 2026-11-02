/**
 * The choice of the visitor about cookies and the memory of the device (DB-02b), kept in the browser under the key the banner
 * has always used. What the code that measures asks is `hasConsent(category)`: nothing that is not strictly needed to do what
 * the visitor asked for (booking, the language they chose, the homes they saved) runs before they say yes.
 *
 * Two categories today:
 * - `necessary`: always on (the booking itself, the language, the favourites kept on the device because the visitor asked);
 * - `statistics`: the anonymous counts of the SEO pages and the source of a host signup. Off until the visitor accepts.
 *
 * The stored value is `accepted` (every optional category) or `rejected` (only the necessary ones), as it always was; a
 * "Scegli tu" with the statistics on is `accepted`, with them off `rejected`. The day a third optional category exists the
 * value grows (an older browser keeps reading `accepted` and `rejected` as before).
 */

export const CONSENT_STORAGE_KEY = 'casazen_cookie_consent';

/** Fired on `window` when the choice changes in this tab, so that what shows it and what depends on it follow. */
export const CONSENT_CHANGED_EVENT = 'casazen:consent-changed';

export type ConsentChoice = 'accepted' | 'rejected';
export type ConsentCategory = 'necessary' | 'statistics';

/** What the visitor chose, or null while they have not (the banner is then on the page). */
export function readConsentChoice(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'accepted' || value === 'rejected' ? value : null;
  } catch {
    // Storage unavailable (private mode): no choice kept, so nothing optional runs.
    return null;
  }
}

/** Keeps the choice of the visitor and tells this tab. A browser that cannot store it asks again next time, and nothing optional runs. */
export function writeConsentChoice(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Not kept: the banner comes back, the optional categories stay off.
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
}

/** True when what belongs to `category` may run. The necessary ones always may; the others only after an explicit yes. */
export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  return readConsentChoice() === 'accepted';
}
