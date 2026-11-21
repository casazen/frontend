import { useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Search, X } from 'lucide-react';
import { matchesSearch } from '@/components/shared/list-view/list-data';
import { Input } from '@/components/ui/input';
import type { RouteManifestEntry } from '@/config/route-manifest';
import { getNavLabel, getNavTabLabel } from '@/lib/nav-labels';
import { NavIcon } from './nav-icon';

interface MenuSearchProps {
  entries: RouteManifestEntry[];
  onNavigate?: () => void;
  children: ReactNode;
}

/** Looks up both menu entries and their tabs in the already scoped navigation manifest. */
export function MenuSearch({ entries, children, onNavigate }: MenuSearchProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const clear = () => {
    setQuery('');
    input.current?.focus();
  };
  const results = searching ? entries.flatMap(entry => {
    const parent = entries.find(item => item.path === entry.navParent);
    const label = getNavLabel(entry, t);
    const tab = getNavTabLabel(entry, t);
    const section = parent ? getNavLabel(parent, t) : tab !== label ? tab : '';
    return matchesSearch([label, section].join(' '), query) ? [{ entry, label, section }] : [];
  }) : [];

  return (
    <>
      <div className="relative mb-3">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)}
          aria-label={t('nav.searchMenu')} placeholder={t('nav.searchMenu')}
          className="h-11 pl-9 pr-11 [&::-webkit-search-cancel-button]:hidden" />
        {query && (
          <button type="button" onClick={clear} aria-label={t('nav.clearMenuSearch')}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      {searching ? (
        <>
          <p role="status" className={results.length ? 'sr-only' : 'px-2 py-3 text-sm text-muted-foreground'}>
            {results.length ? t('nav.menuResults', { count: results.length }) : t('nav.noMenuResults')}
          </p>
          <ul className="divide-y divide-border">
            {results.map(({ entry, label, section }) => (
              <li key={entry.path}>
                <Link to={entry.path} aria-current={entry.path === pathname ? 'page' : undefined}
                  onClick={() => { setQuery(''); onNavigate?.(); }}
                  className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                  <NavIcon name={entry.icon} className="size-5 shrink-0 text-primary-text" />
                  <span className="min-w-0 flex-1 break-words">
                    <span className="block font-medium">{label}</span>
                    {section && <span className="block text-xs text-muted-foreground">{section}</span>}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : children}
    </>
  );
}
