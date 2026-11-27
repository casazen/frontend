import { UserMenu } from '@/components/auth/user-menu';
import { OrgBadge } from '@/components/org/org-badge';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useWorkspace } from '@/hooks/use-workspace';
import { useAppShell } from './app-shell-context';

interface HeaderProps {
  /**
   * Global search (UI-06, `CommandPaletteTrigger`), the notifications bell (UI-12) and the help centre (UI-08): the places
   * where they plug in. Each one is mounted only by who builds the function, and only when the function exists: a function
   * that is not there leaves nothing in the header, no empty box and no button that does nothing. The profile is always there.
   */
  search?: React.ReactNode;
  notifications?: React.ReactNode;
  help?: React.ReactNode;
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

  const phoneArea = isPhone ? shell?.contextKey : undefined;

  return (
    <header
      // The signed-in app is up once its shell is on screen and the workspace is loaded: the e2e logins wait for this id
      // (e2e/auth.setup.ts, e2e/helpers/auth.ts), not for the title of a page. Keep it when the header changes.
      data-testid={isReady ? 'app-ready' : undefined}
      className="safe-area-top sticky top-0 z-40 flex h-[var(--header-height)] items-center gap-1 border-b bg-card px-2 md:gap-3 md:px-6"
    >
      {phoneArea ? <OrgBadge area={phoneArea} /> : null}
      {search ? (
        // On a computer the search is a field that takes most of the room up to 36rem; on a phone it is an icon that sits with
        // the other buttons, at the right (after the spacer, which is not focusable: the focus order is the same).
        <div data-testid="header-search" className="min-w-0 max-w-xl flex-[4] max-md:order-1 max-md:flex-none">
          {search}
        </div>
      ) : null}
      <div className="flex-1 max-md:hidden" />
      <div className="flex shrink-0 items-center gap-0 max-md:order-2 md:gap-2">
        {notifications}
        {help}
        {phoneArea ? null : <OrgBadge />}
        <UserMenu />
      </div>
    </header>
  );
}
