import { useEffect } from 'react';
import { loadGtm } from './gtm-loader';
import { useTrackingContainer } from './use-track-ecommerce';

/**
 * The agency's Google Tag Manager container on the pages of its own domain (NF-149). It renders nothing. Before the visitor allowed statistics nothing happens:
 * no script, no push on `dataLayer`, no cookie; the choice is the one of the cookie notice (the same `CONSENT_CHANGED_EVENT` that `useConsent` listens to), so a
 * visitor who accepts later, on any page, gets the container at that moment. The container loads once: a re-render, a route change or a page of the site that
 * mounts this again does nothing more.
 *
 * It does nothing on the CasaZen domain (no agency site), with the embeddable pages off for the agency (`embedEnabled`), without a valid container id, in a widget
 * (`/embed/*`), or on a page whose address is the key to a booking (the code of `/my-bookings?code=`, the token of the links of the e-mails); see `gtmContainerOf`.
 * A script cannot be unloaded: if the visitor withdraws the choice the container stays until the next load of the page, but
 * every event of the funnel stops at once (`useTrackEcommerce` checks the choice at the moment of each push).
 */
export function HostTracking(): null {
  const containerId = useTrackingContainer();

  useEffect(() => {
    if (containerId !== null) loadGtm(containerId);
  }, [containerId]);

  return null;
}
