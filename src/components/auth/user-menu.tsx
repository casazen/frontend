import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRef, useState } from 'react';
import { useAppShell } from '@/components/layout/app-shell-context';
import { WorkspaceViewDialog } from '@/components/layout/workspace-view-dialog';
import { User, LogOut, SlidersHorizontal } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/hooks/use-workspace';
import { APP_LOCALES, useAppLocale } from '@/hooks/use-app-locale';
import { getAccessibleAreas } from '@/config/areas';
import type { AppContextKey } from '@/config/route-manifest';
import type { AppLocale } from '@/i18n/config';
import { profilePathForContext } from '@/lib/profile-path';

const ITEM_CLASS = 'min-h-9 gap-2 px-3 max-md:min-h-11 pointer-coarse:min-h-11';

export function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { activeContext, contexts, setActiveContext } = useWorkspace();
  const { locale, setLocale } = useAppLocale();
  const navigate = useNavigate();
  const shell = useAppShell();
  const [customizing, setCustomizing] = useState(false);
  const avatar = useRef<HTMLButtonElement>(null);

  if (!user) return null;

  const displayName = user.name || user.email;
  const areas = getAccessibleAreas(contexts ?? []);

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={avatar}
        aria-label={displayName ? t('appShell.userMenuNamed', { name: displayName }) : t('appShell.userMenu')}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Avatar>
          <AvatarImage src={user.picture} alt={user.name || user.email || ''} />
          <AvatarFallback>{getInitials(user.name || user.email || 'U')}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" data-testid="user-menu">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex min-w-0 flex-col space-y-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM_CLASS} onClick={() => navigate(profilePathForContext(activeContext))}>
          <User className="h-4 w-4" />
          {t('shared.userMenu.profile')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as AppLocale)}>
          {APP_LOCALES.map((option) => (
            <DropdownMenuRadioItem
              key={option.locale}
              value={option.locale}
              lang={option.locale}
              data-testid={`locale-${option.locale}`}
              className={ITEM_CLASS}
            >
              {t(option.nameKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {areas.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('appShell.yourAreas')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={activeContext ?? ''}
              onValueChange={(value) => {
                if (value !== activeContext) setActiveContext(value as AppContextKey);
              }}
            >
              {areas.map((area) => (
                <DropdownMenuRadioItem key={area.key} value={area.key} data-testid={`profile-area-${area.key}`} className={ITEM_CLASS}>
                  {t(area.nameKey)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        {shell?.viewKey && <DropdownMenuItem className={ITEM_CLASS} onSelect={() => setCustomizing(true)}>
          <SlidersHorizontal aria-hidden="true" className="size-4" />{t('workspaceView.title')}
        </DropdownMenuItem>}
        <DropdownMenuItem className={ITEM_CLASS} onClick={logout}>
          <LogOut className="h-4 w-4" />
          {t('shared.userMenu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {customizing && shell?.viewKey && <WorkspaceViewDialog key={shell.viewKey} viewKey={shell.viewKey} contextKey={shell.contextKey} onClose={() => { setCustomizing(false); avatar.current?.focus(); }} />}
    </>
  );
}
