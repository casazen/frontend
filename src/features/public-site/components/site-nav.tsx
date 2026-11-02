import { Link } from 'react-router-dom';
import type { SiteNavItem } from './use-site-nav-items';

/** The menu in the bar of the header, from a desktop up (a phone finds the same links in the sheet of its menu). */
export function SiteNav({ items, label }: { items: readonly SiteNavItem[]; label: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={label} className="hidden min-w-0 items-center gap-1 lg:flex" data-testid="public-site-nav">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          className="inline-flex h-11 items-center rounded-[var(--cz-public-radius)] px-3 text-sm font-semibold hover:bg-black/5"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
