import { useEffect, useMemo, useRef } from 'react';
import type { AppContextKey } from '@/config/route-manifest';
import { useCurrentUser } from '@/queries/use-users';
import { DemoBanner } from '@/components/shared/demo-banner';
import { SupplierSuspendedBanner } from '@/features/supplier/components/supplier-suspended-banner';
import { AppShellContext } from './app-shell-context';
import { BottomNav } from './bottom-nav';
import { ContextSidebar } from './context-sidebar';
import { Header } from './header';
import { MobileNavDrawer } from './mobile-nav-drawer';
import { RouteFocus } from './route-focus';
import { SkipLink } from './skip-link';

/** `id` of the content region: target of the skip link and of the focus at every change of page. */
const MAIN_CONTENT_ID = 'main-content';

/** Height of the sticky header (`h-16`): what the window keeps free at the top when it scrolls something into view. */
const HEADER_HEIGHT = '4rem';

interface AppShellLayoutProps {
  contextKey: AppContextKey;
  children: React.ReactNode;
}

/**
 * The shell of every area (short-rent, long-rent, supplier, admin), mounted once by `ContextLayout` around the page of
 * the route (UI-03): skip link, sidebar, mobile menu, header, content region and bottom bar. Changing page only changes
 * the children, so the header and the menus are not mounted again.
 *
 * The window scrolls (not an inner region): the header and the sidebar are sticky, the bottom bar is fixed, and the
 * minimum height is dynamic (`dvh`) so that the browser bars of a phone do not leave a gap. A page that needs the whole
 * height under the header sizes itself (see `vetrina-page.tsx`).
 */
export function AppShellLayout({ contextKey, children }: AppShellLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);
  const { org } = useCurrentUser();
  const organizationName = org?.name ?? null;
  const shell = useMemo(() => ({ contextKey }), [contextKey]);

  useEffect(() => {
    // The window scrolls and the header is sticky: an anchor (`#panel`) or an element that takes the focus must not land
    // under it. Set on the root, which is what the window scrolls, and only while a shell is on the page.
    const root = document.documentElement;
    const previous = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = HEADER_HEIGHT;
    return () => {
      root.style.scrollPaddingTop = previous;
    };
  }, []);

  return (
    <AppShellContext.Provider value={shell}>
      <SkipLink targetId={MAIN_CONTENT_ID} />
      <div className="flex min-h-dvh" data-testid="app-shell" data-context={contextKey}>
        <ContextSidebar contextKey={contextKey} organizationName={organizationName} />
        <MobileNavDrawer contextKey={contextKey} organizationName={organizationName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <DemoBanner />
          <Header />
          <main
            id={MAIN_CONTENT_ID}
            ref={mainRef}
            tabIndex={-1}
            className="flex flex-1 flex-col p-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] outline-none md:pb-6 md:p-6"
          >
            {contextKey === 'supplier' ? <SupplierSuspendedBanner /> : null}
            {children}
          </main>
          <BottomNav contextKey={contextKey} />
        </div>
      </div>
      <RouteFocus mainRef={mainRef} />
    </AppShellContext.Provider>
  );
}
