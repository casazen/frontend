import { useEffect, useMemo, useRef } from 'react';
import type { AppContextKey } from '@/config/route-manifest';
import { useCurrentUser } from '@/queries/use-users';
import { useUiStore } from '@/store/ui-store';
import { cn } from '@/lib/utils';
import { CommandPaletteProvider } from '@/components/shared/command-palette/command-palette-provider';
import { CommandPaletteTrigger } from '@/components/shared/command-palette/command-palette-trigger';
import { DemoBanner } from '@/components/shared/demo-banner';
import { SupplierSuspendedBanner } from '@/features/supplier/components/supplier-suspended-banner';
import { AppShellContext } from './app-shell-context';
import { BottomNav } from './bottom-nav';
import { ContextSidebar } from './context-sidebar';
import { Header } from './header';
import { MoreSheet } from './more-sheet';
import { RouteFocus } from './route-focus';
import { SkipLink } from './skip-link';

/** `id` of the content region: target of the skip link and of the focus at every change of page. */
const MAIN_CONTENT_ID = 'main-content';

/**
 * What the window keeps free at the top when it scrolls something into view: the height of the sticky header, which
 * `globals.css` says once (`--header-height`) and the header takes as its own (UI-05).
 */
const HEADER_HEIGHT = 'var(--header-height)';

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
  const { org, user } = useCurrentUser();
  const organizationName = org?.name ?? null;
  const shell = useMemo(() => ({ contextKey }), [contextKey]);
  // A page that fixes its primary action above the bottom bar of the phone (`PageHeader`, UI-05) needs room under its content.
  const mobilePrimaryVisible = useUiStore((state) => state.mobilePrimaryVisible);

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
      {/* The global search (UI-06): Ctrl/Cmd+K from anywhere in the shell, and the button of the header. The server search (UI-13) is handed to it as `remoteSource` once its flag exists. */}
      <CommandPaletteProvider contextKey={contextKey} userId={user?.id ?? null}>
        <SkipLink targetId={MAIN_CONTENT_ID} />
        <div className="flex min-h-dvh" data-testid="app-shell" data-context={contextKey}>
          <ContextSidebar contextKey={contextKey} organizationName={organizationName} />
          <MoreSheet contextKey={contextKey} organizationName={organizationName} />
          <div className="flex min-w-0 flex-1 flex-col">
            <DemoBanner />
            {/* The notifications bell (UI-12) and the help (UI-08) are handed to the header here too, each only when its function exists. */}
            <Header search={<CommandPaletteTrigger />} />
            <main
              id={MAIN_CONTENT_ID}
              ref={mainRef}
              tabIndex={-1}
              className={cn(
                'flex flex-1 flex-col p-4 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] outline-none md:pb-6 md:p-6',
                mobilePrimaryVisible &&
                  'max-md:pb-[calc(var(--bottom-nav-height)+var(--mobile-primary-height)+env(safe-area-inset-bottom))]',
              )}
            >
              {contextKey === 'supplier' ? <SupplierSuspendedBanner /> : null}
              {children}
            </main>
            <BottomNav contextKey={contextKey} />
          </div>
        </div>
        <RouteFocus mainRef={mainRef} />
      </CommandPaletteProvider>
    </AppShellContext.Provider>
  );
}
