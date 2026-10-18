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
import { User, LogOut } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/hooks/use-workspace';
import { APP_LOCALES, useAppLocale } from '@/hooks/use-app-locale';
import { getAccessibleAreas } from '@/config/areas';
import type { AppContextKey } from '@/config/route-manifest';
import type { AppLocale } from '@/i18n/config';
import { profilePathForContext } from '@/lib/profile-path';

// Every row is at least 44 px tall on a phone and for a finger (the menu items of Radix are 32 px).
const ITEM_CLASS = 'min-h-9 gap-2 px-3 max-md:min-h-11 pointer-coarse:min-h-11';

/**
 * The menu of the profile (header, UI-05): who is signed in, the profile page of the area the user is in, the language of the
 * interface, the areas the user can go to (only when there is more than one) and "Esci". There is no row for the theme until
 * the dark theme exists (D26). A Radix menu: it opens with Enter, Space or the arrow down, the arrows move through the rows,
 * Enter takes one and Esc closes it with the focus back on the avatar.
 */
export function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { activeContext, contexts, setActiveContext } = useWorkspace();
  const { locale, setLocale } = useAppLocale();
  const navigate = useNavigate();

  if (!user) return null;

  const displayName = user.name || user.email;
  const areas = getAccessibleAreas(contexts ?? []);

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
                // The area the user is in stays where it is: the menu just closes.
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
        <DropdownMenuItem className={ITEM_CLASS} onClick={logout}>
          <LogOut className="h-4 w-4" />
          {t('shared.userMenu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
