import { useEffect } from 'react';
import { useBlocker, type Blocker } from 'react-router-dom';

/**
 * Asks before the person leaves a page that holds something that cannot be found again once they have left: closing the tab or reloading (`beforeunload`, which
 * the browser asks about with its own words) and a link of the app to another page (a blocker, which the page answers with a dialog of its own: `proceed` lets the
 * person go, `reset` keeps them here). Nothing is asked while `active` is false, and a change of the address on the same page (a query string) is never stopped.
 */
export function useLeaveGuard(active: boolean): Blocker {
  useEffect(() => {
    if (!active) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);

  return useBlocker(({ currentLocation, nextLocation }) => active && currentLocation.pathname !== nextLocation.pathname);
}
