import { useEffect, useMemo, useRef } from 'react';
import '@/config/detail-kinds';
import type { AppContextKey } from '@/config/route-manifest';
import { useCurrentUser } from '@/queries/use-users';
import { useUiStore } from '@/store/ui-store';
import { cn } from '@/lib/utils';
import { CommandPaletteProvider } from '@/components/shared/command-palette/command-palette-provider';
import { manualSource } from '@/components/shared/command-palette/sources/manual';
import { CommandPaletteTrigger } from '@/components/shared/command-palette/command-palette-trigger';
import { AlertPopup } from '@/components/shared/alert-popup';
import { DemoBanner } from '@/components/shared/demo-banner';
import { DetailDrawerHost } from '@/components/shared/detail-drawer/detail-drawer-host';
import { ComplianceDrawerReturn } from '@/features/compliance/compliance-drawer/compliance-drawer-welcome';
import { SupplierSuspendedBanner } from '@/features/supplier/components/supplier-suspended-banner';
import { AppShellContext } from './app-shell-context';
import { BottomNav } from './bottom-nav';
import { ContextSidebar } from './context-sidebar';
import { FirstRunWizard } from '@/features/guide/first-run-wizard';
import { GuideButton } from '@/features/guide/guide-panel';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { AskProvider } from '@/features/assistant/ask/ask-provider';
import { AskCasaZenButton } from '@/features/assistant/ask/ask-trigger';
import { Header } from './header';
import { LegalConsentsNotice } from './legal-consents-notice';
import { MoreSheet } from './more-sheet';
import { RouteFocus } from './route-focus';
import { SkipLink } from './skip-link';

const MAIN_CONTENT_ID = 'main-content';

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
 * minimum height is dynamic (`dvh`) so that the browser bars of a phone do not leave a gap. On desktop, a direct child
 * of `main` with `data-app-viewport` can use the remaining height under the header and scroll its own panes.
 */
export function AppShellLayout({ contextKey, children }: AppShellLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);
  const { org, user } = useCurrentUser();
  const organizationName = org?.name ?? null;
  const viewKey = user?.id ? JSON.stringify([user.id, org?.id ?? null, contextKey]) : undefined;
  const compact = useUiStore(state => viewKey ? state.workspaceViews[viewKey]?.compact : false);
  const shell = useMemo(() => ({ contextKey, viewKey }), [contextKey, viewKey]);
  const mobilePrimaryVisible = useUiStore((state) => state.mobilePrimaryVisible);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = HEADER_HEIGHT;
    return () => {
      root.style.scrollPaddingTop = previous;
    };
  }, []);

  return (
    <AppShellContext.Provider value={shell}>
      <AskProvider area={contextKey} userId={user?.id ?? null} orgId={org?.id ?? null} orgName={organizationName}>
        <CommandPaletteProvider contextKey={contextKey} userId={user?.id ?? null} remoteSource={manualSource}>
          <SkipLink targetId={MAIN_CONTENT_ID} />
          <div className="flex min-h-dvh" data-testid="app-shell" data-context={contextKey} data-density={compact ? 'compact' : undefined}>
            <ContextSidebar contextKey={contextKey} organizationName={organizationName} />
            <MoreSheet contextKey={contextKey} organizationName={organizationName} />
            <div className="flex min-w-0 flex-1 flex-col lg:has-[>main>[data-app-viewport]]:h-dvh">
              <DemoBanner />
              <Header
                search={(
                  <div className="flex items-center gap-1 md:gap-3">
                    <CommandPaletteTrigger className="min-w-0 md:flex-1" />
                    <AskCasaZenButton />
                  </div>
                )}
                notifications={<NotificationBell />}
                help={<GuideButton />}
              />
              <main
                id={MAIN_CONTENT_ID}
                ref={mainRef}
                tabIndex={-1}
                className={cn(
                  'flex min-w-0 flex-1 flex-col px-[var(--workspace-gutter)] pt-[var(--workspace-gutter)] pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] outline-none md:pb-[var(--workspace-gutter)]',
                  'lg:has-[>[data-app-viewport]]:min-h-0 lg:has-[>[data-app-viewport]]:overflow-y-auto',
                  mobilePrimaryVisible &&
                    'max-md:pb-[calc(var(--bottom-nav-height)+var(--mobile-primary-height)+env(safe-area-inset-bottom))]',
                )}
              >
                {contextKey === 'supplier' ? <SupplierSuspendedBanner /> : null}
                <LegalConsentsNotice />
                {/* The way back from the Cassetto Compliance (CHK-15): puts the host back where they left and says «Bentornato». Nothing on the page otherwise. */}
                <ComplianceDrawerReturn />
                {children}
              </main>
              <BottomNav contextKey={contextKey} />
            </div>
          </div>
          <RouteFocus mainRef={mainRef} />
          <DetailDrawerHost />
          <AlertPopup />
          {contextKey === 'short-rent' ? <FirstRunWizard /> : null}
        </CommandPaletteProvider>
      </AskProvider>
    </AppShellContext.Provider>
  );
}
