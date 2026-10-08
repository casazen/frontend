import { useEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/** A new page is looked at for its heading this often, and for this long (a lazy chunk or a slow request may delay it). */
const POLL_INTERVAL_MS = 100;
const MAX_WAIT_MS = 5000;
/** The live region is emptied and filled again, so that two pages with the same title are both announced. */
const ANNOUNCE_DELAY_MS = 50;
/** The text does not stay in the page for a screen reader that reads it line by line. */
const ANNOUNCE_CLEAR_MS = 4000;

interface RouteFocusProps {
  /** The content region of the shell: the `h1` of the new page takes the focus, the region itself if there is none. */
  mainRef: RefObject<HTMLElement | null>;
}

/**
 * Focus and announcement at every change of page of the shell (UI-03, a11y): a single-page app has no page load to tell
 * a keyboard or screen reader user that the content changed. When the pathname changes the focus goes to the `h1` of
 * the new page (to the content region when it has none) and a polite live region says its title.
 *
 * The first page shown does nothing: the browser's own starting point (the skip link) is the right one on a load. The
 * focus is not taken from the page when it has put it inside its content (autofocus), and a heading is waited for while
 * a modal (the mobile menu) still hides the page from assistive technology.
 */
export function RouteFocus({ mainRef }: RouteFocusProps) {
  const { pathname } = useLocation();
  const liveRef = useRef<HTMLDivElement>(null);
  const shownPathname = useRef(pathname);

  useEffect(() => {
    if (shownPathname.current === pathname) return;
    shownPathname.current = pathname;

    const main = mainRef.current;
    if (!main) return;

    const timers = new Set<ReturnType<typeof setTimeout>>();
    let poll: ReturnType<typeof setInterval> | undefined;

    const announce = (text: string) => {
      const region = liveRef.current;
      if (!region || !text) return;
      region.textContent = '';
      timers.add(
        setTimeout(() => {
          region.textContent = text;
        }, ANNOUNCE_DELAY_MS),
      );
      timers.add(
        setTimeout(() => {
          region.textContent = '';
        }, ANNOUNCE_CLEAR_MS),
      );
    };

    const settle = (heading: HTMLElement | null) => {
      const active = document.activeElement;
      const pageHasTheFocus = active !== null && active !== main && main.contains(active);
      if (!pageHasTheFocus) {
        const target = heading ?? main;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
      announce(heading?.textContent?.trim() || document.title);
    };

    const attempt = (): boolean => {
      if (main.closest('[aria-hidden="true"]')) return false;
      const heading = main.querySelector('h1');
      if (!heading) return false;
      settle(heading);
      return true;
    };

    if (!attempt()) {
      let waited = 0;
      poll = setInterval(() => {
        waited += POLL_INTERVAL_MS;
        if (attempt()) {
          clearInterval(poll);
        } else if (waited >= MAX_WAIT_MS) {
          clearInterval(poll);
          settle(null);
        }
      }, POLL_INTERVAL_MS);
    }

    return () => {
      clearInterval(poll);
      timers.forEach(clearTimeout);
    };
  }, [pathname, mainRef]);

  return <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" data-testid="route-announcer" />;
}
