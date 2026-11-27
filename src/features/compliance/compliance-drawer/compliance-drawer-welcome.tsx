import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { clearArrival, getArrival, subscribeArrival, takeArrival } from './compliance-drawer-return';

/** How long a return that never reached its page (the route led somewhere else) is kept before it is forgotten. */
const UNREACHED_MS = 10_000;

/**
 * The return from the Cassetto Compliance (CHK-15, E03/F05/US02), mounted once by the shell. When CasaZen is loaded again with a record of a
 * handoff in the tab (the browser's back, or a normal navigation) it takes that record ONCE: the host is put back on the route they left, with
 * its filters, the control that started the handoff takes the focus (`useReturnFocus`), and the page says «Bentornato nel Cassetto Compliance»
 * and that the result stays in the connected area. It never asks whether anything was sent, records no result and changes no compliance state:
 * the return is only a way back to where the host was.
 *
 * The notice belongs to that page: it goes when the host moves on or closes it, and a later visit to the same page is not a return.
 */
export function ComplianceDrawerReturn() {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const arrival = useSyncExternalStore(subscribeArrival, getArrival, getArrival);
  const returning = arrival !== null;
  const origin = arrival?.origin;
  const route = arrival?.route;
  const filters = arrival?.filters;
  const reached = useRef(false);
  const restored = useRef<string | null>(null);

  // Once when the shell is mounted, and again when the browser brings the page back from its memory (the back button of a page that left in the same tab).
  useEffect(() => {
    takeArrival();
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) takeArrival();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  // A new return starts from the beginning: the page is not reached yet, and a return that never reaches it is forgotten.
  useEffect(() => {
    reached.current = false;
    if (!returning) return undefined;
    const timer = window.setTimeout(() => {
      if (!reached.current) clearArrival();
    }, UNREACHED_MS);
    return () => window.clearTimeout(timer);
  }, [returning, origin, route, filters]);

  // Back on the page, with its filters: once for each return (moving on to another page afterwards must not bring the host back), and only
  // when the host is not already there.
  useEffect(() => {
    if (route === undefined || filters === undefined) {
      restored.current = null;
      return;
    }
    const key = `${origin}|${route}|${filters}`;
    if (restored.current === key) return;
    restored.current = key;
    if (pathname !== route || search !== filters) navigate(`${route}${filters}`, { replace: true });
  }, [origin, route, filters, pathname, search, navigate]);

  // The host has moved on from the page they were put back on: the return is over.
  useEffect(() => {
    if (route === undefined) return;
    if (pathname === route) reached.current = true;
    else if (reached.current) clearArrival();
  }, [route, pathname]);

  if (arrival === null || pathname !== arrival.route) return null;

  return (
    <div className="mb-4" data-testid="compliance-drawer-welcome-region">
      <Alert
        variant="info"
        title={t('compliance.drawer.welcome.title')}
        action={
          <Button type="button" size="sm" variant="outline" onClick={clearArrival} data-testid="compliance-drawer-welcome-dismiss">
            {t('compliance.drawer.welcome.dismiss')}
          </Button>
        }
        data-testid="compliance-drawer-welcome"
      >
        {t('compliance.drawer.welcome.body')}
      </Alert>
    </div>
  );
}
