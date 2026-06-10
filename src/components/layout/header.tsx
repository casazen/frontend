import { UserMenu } from '@/components/auth/user-menu';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrgBadge } from '@/components/org/org-badge';
import { useUiStore } from '@/store/ui-store';

interface HeaderProps {
  slotStart?: React.ReactNode;
}

export function Header({ slotStart }: HeaderProps) {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <header className="safe-area-top sticky top-0 z-40 flex h-16 items-center border-b bg-background px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 md:hidden"
        aria-label="Open navigation menu"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>
      {slotStart}
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <OrgBadge />
        <UserMenu />
      </div>
    </header>
  );
}
