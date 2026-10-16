import * as React from 'react';
import { Link, parsePath, useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { TabCount, type TabTone } from './tab-count';
import { TAB_SELECT_CLASS, tabLinkClass } from './tab-styles';

export interface RouteTabItem {
  label: string;
  /** Where the tab leads: a path of the app, with its query if it has one (`/app/short-rent/payments`, `/report?tab=canali`). */
  href: string;
  /** A number beside the name: things waiting in that section. Nothing when it is 0 or missing. */
  count?: number;
  /**
   * What the number counts, for a screen reader, **with the number**: "2 da incassare". With it the number itself is hidden from
   * assistive technology (the label says it once); without it only the number is read.
   */
  countLabel?: string;
  /** How the number weighs: `warning` for what needs an answer, `danger` for what failed. Without it, the accent of the app. */
  tone?: TabTone;
  /**
   * Says which tab the page is, instead of the address. By default it is the tab whose path the address is on (or under:
   * `/bookings/7` is in `/bookings`) and whose query the address has; the most specific one wins. When any tab says it, only
   * the tabs that say it count.
   */
  current?: boolean;
  icon?: LucideIcon;
  testId?: string;
}

export interface RouteTabsProps {
  /** The name of the group for a screen reader ("Sezioni di Prenotazioni"). */
  label: string;
  items: readonly RouteTabItem[];
  className?: string;
  /** Test id of the menu that replaces the tabs on a phone. */
  selectTestId?: string;
}

/** The path of an address without its trailing slash (`/` stays `/`). */
const trimmed = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

/** The tab the address is on: the longest path that is the address or contains it, then the one that asks for most of the query. */
function currentTab(items: readonly RouteTabItem[], pathname: string, search: string): number {
  if (items.some((item) => item.current !== undefined)) return items.findIndex((item) => item.current === true);

  const here = new URLSearchParams(search);
  const place = trimmed(pathname);
  let best = -1;
  let bestScore = -1;
  items.forEach((item, index) => {
    const { pathname: path = '/', search: query = '' } = parsePath(item.href);
    const target = trimmed(path);
    const onPath = place === target || place.startsWith(target === '/' ? '/' : `${target}/`);
    if (!onPath) return;
    const wanted = [...new URLSearchParams(query)];
    if (!wanted.every(([name, value]) => here.get(name) === value)) return;
    const score = target.length * 100 + wanted.length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

/**
 * Tabs that lead to other pages (UI-15): the sections of an area that are routes of their own (Prenotazioni · Ospiti ·
 * Pagamenti, each with its address), as opposed to `Tabs`, which is one page with a `?tab=` parameter. It is a navigation:
 * a `nav` with a link for each section, and the one the page is on is marked `aria-current="page"` (the Tab key goes
 * through all the links; there is no `tablist`, because there is no panel the tabs control: the page below is the panel).
 *
 * On a phone (under `md`) the links would not fit: they become a native menu, which goes to the page that is chosen.
 *
 *     <RouteTabs label="Sezioni di Prenotazioni" items={[{ label: 'Prenotazioni', href: '/app/short-rent/bookings' }, …]} />
 */
export function RouteTabs({ label, items, className, selectTestId }: RouteTabsProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const baseId = React.useId();

  if (items.length === 0) return null;

  const current = currentTab(items, pathname, search);

  return (
    <nav aria-label={label} className={cn('min-w-0', className)}>
      {isPhone ? (
        <div className="mb-4">
          <label htmlFor={`${baseId}-select`} className="sr-only">
            {label}
          </label>
          <select
            id={`${baseId}-select`}
            className={TAB_SELECT_CLASS}
            value={current >= 0 ? items[current].href : ''}
            data-testid={selectTestId}
            onChange={(event) => void navigate(event.target.value)}
          >
            {/* The page is none of the sections: the menu does not pretend to be on the first one. */}
            {current < 0 ? <option value="" disabled /> : null}
            {items.map((item) => (
              <option key={item.href} value={item.href}>
                {item.count && item.count > 0 ? `${item.label} (${item.count})` : item.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mb-6 border-b">
          <ul role="list" className="-mb-px flex list-none gap-1 overflow-x-auto [scrollbar-width:none]">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.href} className="shrink-0">
                  <Link to={item.href} aria-current={index === current ? 'page' : undefined} data-testid={item.testId} className={tabLinkClass(index === current)}>
                    {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                    {item.label}
                    <TabCount count={item.count} label={item.countLabel} tone={item.tone} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
