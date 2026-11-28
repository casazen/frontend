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

export function Header({ search, notifications, help }: HeaderProps) {
  const { isReady } = useWorkspace();
  const shell = useAppShell();
  const isPhone = useMediaQuery(PHONE_QUERY);

  const phoneArea = isPhone ? shell?.contextKey : undefined;

  return (
    <header
      data-testid={isReady ? 'app-ready' : undefined}
      className="safe-area-top sticky top-0 z-40 flex h-[var(--header-height)] items-center gap-1 border-b bg-card px-2 md:gap-3 md:px-6"
    >
      {phoneArea ? <OrgBadge area={phoneArea} /> : null}
      {search ? (
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
