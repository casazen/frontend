import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getArea } from '@/config/areas';
import { getContextNav, getNavMatchEntries, getVisibleNavEntries, type AppContextKey } from '@/config/route-manifest';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { FROM_TABLET_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useNavCounts } from '@/hooks/use-nav-counts';
import { useWorkspace } from '@/hooks/use-workspace';
import { useUiStore } from '@/store/ui-store';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AreaSwitcher } from './area-switcher';
import { GroupedNavLinks } from './grouped-nav-links';

interface MoreSheetProps {
  contextKey: AppContextKey;
  /** The organization of the user, shown under the name of the area. */
  organizationName?: string | null;
}

/**
 * The sheet that comes up from the bottom of the phone (UI-04b): "Altro" of the bottom bar. It holds what the bar does not
 * list, grouped as the sidebar groups it (tiles, with the counters), and the area switcher, which tells where the user is
 * and lets it go elsewhere. It replaces the menu that slid in from the left: one menu on a phone, reached from the bar
 * (and from the menu button of the header, which opens the same sheet until the header is redrawn).
 *
 * It is a modal dialog: the focus goes into it and stays there, Esc, a tap outside, the close button and a pull of the
 * handle close it, and the page behind it is hidden from assistive technology. The focus goes back to what opened it (to
 * "Altro" when that took none); when a page was chosen it does not, the heading of the new page takes it (`RouteFocus`).
 * It closes by itself when the page changes and when the window grows to the tablet, where the sidebar takes over.
 */
export function MoreSheet({ contextKey, organizationName = null }: MoreSheetProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const open = useUiStore((state) => state.sidebarOpen);
  const setOpen = useUiStore((state) => state.setSidebarOpen);
  const isWide = useMediaQuery(FROM_TABLET_QUERY);

  const permissionCheck = (ctx: AppContextKey, permission: string) => hasPermission(ctx, permission);
  const nav = getContextNav(contextKey, permissionCheck, flags, { withoutBottom: true });
  const matchEntries = getNavMatchEntries(contextKey, permissionCheck, flags);
  const counts = useNavCounts(getVisibleNavEntries(contextKey, permissionCheck, flags));

  // No sheet on a tablet or a computer: it would hide a page that has its own sidebar.
  useEffect(() => {
    if (open && isWide) setOpen(false);
  }, [open, isWide, setOpen]);

  const sheet = useRef<HTMLDivElement>(null);
  // Who opened the sheet, noted as it opens (before the focus moves into it).
  const opener = useRef<HTMLElement | null>(null);
  const choseAPage = useRef(false);
  useLayoutEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    choseAPage.current = false;
  }, [open]);

  const takeFocus = (event: Event) => {
    // Radix would pick the first control that is not a link: the close button, which would show its ring at every tap on
    // "Altro". The focus goes to the sheet itself: a screen reader reads its name, the next Tab reaches the first control.
    event.preventDefault();
    sheet.current?.focus();
  };

  const giveFocusBack = (event: Event) => {
    // Radix would give it to its own trigger, which this sheet does not have: the opener is the bar or the header.
    event.preventDefault();
    if (choseAPage.current) return;
    const noted = opener.current;
    const target =
      noted && noted.isConnected && noted !== document.body
        ? noted
        : document.querySelector<HTMLElement>('[data-more-trigger]');
    target?.focus();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        ref={sheet}
        side="bottom"
        data-testid="more-sheet"
        // There is no description to point to: the title names it and the content speaks for itself.
        aria-describedby={undefined}
        className="outline-none md:hidden"
        onOpenAutoFocus={takeFocus}
        onCloseAutoFocus={giveFocusBack}
      >
        {/* The room on the right is the close button's. */}
        <SheetHeader className="px-4 pb-2 pr-14 pt-0">
          <SheetTitle>{t('nav.more')}</SheetTitle>
        </SheetHeader>
        {/* Scrolls up and down inside the sheet, never sideways: what is wider than the screen is cut or wrapped, not scrolled. */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4">
          <div className="pb-3">
            <AreaSwitcher contextKey={contextKey} organizationName={organizationName} />
          </div>
          <nav aria-label={t('nav.menuLabel', { area: t(getArea(contextKey).nameKey) })}>
            <GroupedNavLinks
              nav={nav}
              matchEntries={matchEntries}
              variant="sheet"
              counts={counts}
              onNavigate={() => {
                choseAPage.current = true;
                setOpen(false);
              }}
            />
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
