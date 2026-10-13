import { useTranslation } from 'react-i18next';
import { UserMenu } from '@/components/auth/user-menu';
import { OrgBadge } from '@/components/org/org-badge';
import { getArea } from '@/config/areas';
import type { AppContextKey } from '@/config/route-manifest';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useWorkspace } from '@/hooks/use-workspace';
import { useAppShell } from './app-shell-context';
import { NavIcon } from './nav-icon';

interface HeaderProps {
  /**
   * Global search (UI-06, `CommandPaletteTrigger`), the notifications bell (UI-12) and the help centre (UI-08): the places
   * where they plug in. Each one is mounted only by who builds the function, and only when the function exists (its flag is
   * on): a function that is not there leaves nothing in the header, no empty box and no button that does nothing. The
   * profile is always there.
   */
  search?: React.ReactNode;
  notifications?: React.ReactNode;
  help?: React.ReactNode;
}

/**
 * Where the user is, on a phone: the icon and the name of the area. The sidebar says it on a computer; here there is no
 * sidebar and, with the menu button gone (UI-05), the header is the place for it. The areas to go to are in the sheet "Altro".
 */
function HeaderAreaLabel({ contextKey }: { contextKey: AppContextKey }) {
  const { t } = useTranslation();
  const area = getArea(contextKey);

  return (
    <div data-testid="header-area" className="flex min-w-0 items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <NavIcon name={area.icon} className="h-4 w-4" />
      </span>
      <span className="truncate text-base font-bold">{t(area.nameKey)}</span>
    </div>
  );
}

/**
 * The header of the shell (UI-05): one height for the whole app (`--header-height`), and from left to right the area (on a
 * phone), the search, then the notifications, the help, the organization with its plan and the profile menu. Language and
 * "Esci" are in the profile menu. There is no menu button: on a phone the menu is "Altro" of the bottom bar.
 *
 * The header carries `data-testid="app-ready"` once the workspace is loaded: the end-to-end logins wait for it (UI-00).
 */
export function Header({ search, notifications, help }: HeaderProps) {
  const { isReady } = useWorkspace();
  const shell = useAppShell();
  const isPhone = useMediaQuery(PHONE_QUERY);

  return (
    <header
      // The signed-in app is up once its shell is on screen and the workspace is loaded: the e2e logins wait for this id
      // (e2e/auth.setup.ts, e2e/helpers/auth.ts), not for the title of a page. Keep it when the header changes.
      data-testid={isReady ? 'app-ready' : undefined}
      className="safe-area-top sticky top-0 z-40 flex h-[var(--header-height)] items-center gap-2 border-b bg-background px-4 md:gap-3 md:px-6"
    >
      {isPhone && shell ? <HeaderAreaLabel contextKey={shell.contextKey} /> : null}
      {search ? (
        // On a computer the search is a field that takes most of the room up to 36rem; on a phone it is an icon that sits with
        // the other buttons, at the right (after the spacer, which is not focusable: the focus order is the same).
        <div data-testid="header-search" className="min-w-0 max-w-xl flex-[4] max-md:order-1 max-md:flex-none">
          {search}
        </div>
      ) : null}
      <div className="flex-1" />
      <div className="flex items-center gap-1 max-md:order-2 md:gap-2">
        {notifications}
        {help}
        <OrgBadge />
        <UserMenu />
      </div>
    </header>
  );
}
