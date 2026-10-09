import { UserMenu } from '@/components/auth/user-menu';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { OrgBadge } from '@/components/org/org-badge';
import { useWorkspace } from '@/hooks/use-workspace';
import { useUiStore } from '@/store/ui-store';

interface HeaderProps {
  slotStart?: React.ReactNode;
}

export function Header({ slotStart }: HeaderProps) {
  const { t } = useTranslation();
  const { isReady } = useWorkspace();
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <header
      // The signed-in app is up once its shell is on screen and the workspace is loaded: the e2e logins wait for this id
      // (e2e/auth.setup.ts, e2e/helpers/auth.ts), not for the title of a page. Keep it when the header changes.
      data-testid={isReady ? 'app-ready' : undefined}
      className="safe-area-top sticky top-0 z-40 flex h-16 items-center border-b bg-background px-4 md:px-6"
    >
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 md:hidden"
        aria-label={t('shell.openMenu')}
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>
      {slotStart}
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <OrgBadge />
        <UserMenu />
      </div>
    </header>
  );
}
