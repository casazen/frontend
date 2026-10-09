import { useId, useState } from 'react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { profilePathForContext } from '@/lib/profile-path';
import { cn, getInitials } from '@/lib/utils';
import { LanguageSwitcher } from './language-switcher';

interface SheetAccountProps {
  /** The user chose a page: the sheet has nothing more to say and closes. */
  onNavigate: () => void;
}

const ROW_CLASS =
  'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring';

/**
 * The account in the sheet "Altro" of the phone (UI-05): one row with the user, "Profilo e lingua" (the demo's "Profilo, tema
 * e lingua", the theme being for when the dark theme exists, D26), which opens to the profile page, the language switch and
 * "Esci". It is the same as the profile menu of the header, laid out for a thumb: every row is 44 px tall and there is no
 * menu to open over the sheet.
 */
export function SheetAccount({ onNavigate }: SheetAccountProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { activeContext } = useWorkspace();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!user) return null;

  const displayName = user.name || user.email || '';

  return (
    <section data-testid="sheet-account" className="mt-4 border-t pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={user.picture} alt="" />
          <AvatarFallback>{getInitials(displayName || 'U')}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{displayName}</span>
          <span className="block truncate text-sm text-muted-foreground">{t('appShell.account.profileAndLanguage')}</span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      <div id={panelId} hidden={!open} className="space-y-1 pt-1">
        <Link to={profilePathForContext(activeContext)} onClick={onNavigate} className={ROW_CLASS}>
          <User className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('shared.userMenu.profile')}
        </Link>
        <div className="flex min-h-11 items-center justify-between gap-3 px-3">
          <span className="text-sm font-medium">{t('language.label')}</span>
          <LanguageSwitcher />
        </div>
        <button type="button" onClick={logout} className={ROW_CLASS}>
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('shared.userMenu.logout')}
        </button>
      </div>
    </section>
  );
}
