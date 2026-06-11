import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavIcon } from '@/lib/nav-icons';
import { getNavLabel } from '@/lib/nav-labels';
import { useMobileNav } from '@/hooks/use-mobile-nav';
import { useUiStore } from '@/store/ui-store';
import type { AppContextKey } from '@/config/route-manifest';

interface BottomNavProps {
  contextKey: AppContextKey;
}

export function BottomNav({ contextKey }: BottomNavProps) {
  const { t } = useTranslation();
  const { primaryEntries, hasSecondary, activeTab } = useMobileNav(contextKey);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  if (primaryEntries.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={t('shell.mobileNavigation')}
      className="fixed bottom-0 inset-x-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ height: 'var(--bottom-nav-height)' }}
    >
      <div className="flex h-full items-stretch">
        {primaryEntries.map((entry) => {
          const Icon = getNavIcon(entry.icon);
          const isActive = activeTab === entry.path;
          return (
            <Link
              key={entry.path}
              to={entry.path}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{getNavLabel(entry, t)}</span>
            </Link>
          );
        })}
        {hasSecondary && (
          <button
            type="button"
            aria-label={t('nav.more')}
            aria-expanded={activeTab === 'more'}
            onClick={toggleSidebar}
            className={cn(
              'flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors',
              activeTab === 'more' ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Menu className="h-5 w-5 shrink-0" />
            <span>{t('nav.more')}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
