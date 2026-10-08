import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/hooks/use-workspace';
import type { AppContextKey } from '@/config/route-manifest';

function profilePathForContext(context: AppContextKey | null): string {
  if (context === 'admin') return '/app/admin/profile';
  if (context === 'long-rent') return '/app/long-rent/profile';
  return '/app/short-rent/profile';
}

export function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { activeContext } = useWorkspace();
  const navigate = useNavigate();

  if (!user) return null;

  const displayName = user.name || user.email;

  return (
    <DropdownMenu>
      {/* The trigger is only an avatar: it needs a name of its own (UI-03, a11y) and a visible focus ring. */}
      <DropdownMenuTrigger
        aria-label={displayName ? t('appShell.userMenuNamed', { name: displayName }) : t('appShell.userMenu')}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Avatar>
          <AvatarImage src={user.picture} alt={user.name || user.email || ''} />
          <AvatarFallback>{getInitials(user.name || user.email || 'U')}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(profilePathForContext(activeContext))}>
          <User className="mr-2 h-4 w-4" />
          {t('shared.userMenu.profile')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          {t('shared.userMenu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
