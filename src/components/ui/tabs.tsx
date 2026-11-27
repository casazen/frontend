import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { TabCount, type TabTone } from './tab-count';
import { TAB_SELECT_CLASS, tabLinkClass } from './tab-styles';

export interface TabItem<T extends string = string> {
  /** What goes in the address (`?tab=ical`): short, lowercase, and the same forever, because emails and links point at it. */
  value: T;
  label: string;
  /** A number beside the name: things waiting in that tab (requests to answer, errors). Nothing when it is 0 or missing. */
  count?: number;
  /** What the number counts, for a screen reader ("2 da approvare"). Without it only the number is read. */
  countLabel?: string;
  /** How the number weighs: `warning` for what needs an answer, `danger` for what failed (UI-15). Without it, the accent of the app. */
  tone?: TabTone;
  icon?: LucideIcon;
  testId?: string;
}

export interface TabsProps<T extends string> {
  /** The name of the group of tabs for a screen reader ("Sezioni della prenotazione"). */
  label: string;
  items: readonly TabItem<T>[];
  /** The search parameter that holds the tab: `tab` (default), `vista`, … The other parameters of the address are kept. */
  param?: string;
  /**
   * The tab to show when the address has no parameter or an unknown value. Its own link has no parameter at all, so the
   * plain address of the page is the address of this tab. Default: the first one.
   */
  defaultValue?: T;
  /** The tab to show, when the page already decides it (it reads the same parameter). Default: the one the address says. */
  value?: T;
  /** The content of the tab that is shown: what the page renders for it. It sits in the panel that the tabs control. */
  children?: React.ReactNode;
  className?: string;
  layout?: 'row' | 'sidebar';
  panelClassName?: string;
  /** Test ids for the panel and, on a phone, for the menu that replaces the tabs. */
  panelTestId?: string;
  selectTestId?: string;
}

/**
 * Tabs that are links (UI-07). Each tab is a real link to the same page with `?tab=…` (the name of the parameter is yours),
 * so the address says which tab is open: a refresh, the Back button of the browser, a link in an email or "open in a new
 * tab" all bring the same one, and the other parameters of the address (filters, search) are kept. Choosing a tab replaces
 * the entry of the history instead of adding one, so Back leaves the page and does not walk through the tabs.
 *
 * For the keyboard it is the pattern of the tabs: `tablist`, `tab`, `tabpanel`; only the open tab is in the Tab order, the
 * arrows (and Home, End) move the focus along the tabs, Enter or Space open the one that has the focus. Opening is on
 * purpose a second step: moving over a tab must not load a page of data each time a key is pressed.
 *
 * On a phone (under `md`) the tabs would not fit and would hide the ones that overflow: they become a native menu, which
 * the system knows how to show. It changes the address in the same way.
 *
 * No Radix Tabs: the state lives in the address, not in a component, and a link is what a tab really is here. For sections
 * that are pages of their own (other routes), not one page with a parameter, see `RouteTabs`.
 */
export function Tabs<T extends string>({
  label,
  items,
  param = 'tab',
  defaultValue,
  value,
  children,
  className,
  layout = 'row',
  panelClassName,
  panelTestId,
  selectTestId,
}: TabsProps<T>) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const sidebar = layout === 'sidebar' && !isPhone;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const baseId = React.useId();

  if (items.length === 0) return null;

  const fallback = defaultValue ?? items[0].value;
  const fromAddress = searchParams.get(param);
  const active: T = value ?? (items.some((item) => item.value === fromAddress) ? (fromAddress as T) : fallback);

  /** The address of a tab: this page, this query, with only its own parameter changed (and none for the default tab). */
  const searchFor = (tab: T): string => {
    const next = new URLSearchParams(searchParams);
    if (tab === fallback) next.delete(param);
    else next.set(param, tab);
    const query = next.toString();
    return query ? `?${query}` : '';
  };

  const tabId = (tab: T) => `${baseId}-tab-${tab}`;
  const panelId = `${baseId}-panel`;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[role="tab"]');
    if (!target) return;
    if (event.key === ' ') {
      // A link is opened by Enter on its own; Space would scroll the page.
      event.preventDefault();
      target.click();
      return;
    }
    const forward = sidebar ? 'ArrowDown' : 'ArrowRight';
    const back = sidebar ? 'ArrowUp' : 'ArrowLeft';
    if (![forward, back, 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
    const index = tabs.indexOf(target);
    let next = index;
    if (event.key === forward) next = (index + 1) % tabs.length;
    else if (event.key === back) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else next = tabs.length - 1;
    event.preventDefault();
    tabs[next]?.focus();
  };

  return (
    <div className={cn('min-w-0', sidebar && 'grid grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)] items-start gap-5 xl:gap-8', className)}>
      {isPhone ? (
        <div className="mb-4">
          <label htmlFor={`${baseId}-select`} className="sr-only">
            {label}
          </label>
          <select
            id={`${baseId}-select`}
            className={TAB_SELECT_CLASS}
            value={active}
            aria-controls={children ? panelId : undefined}
            data-testid={selectTestId}
            onChange={(event) =>
              navigate({ search: searchFor(event.target.value as T) }, { replace: true, preventScrollReset: true })
            }
          >
            {items.map((item) => (
              <option key={item.value} value={item.value}>
                {item.count && item.count > 0 ? `${item.label} (${item.count})` : item.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className={sidebar ? 'rounded-2xl border bg-card p-2' : 'mb-6 border-b'}>
          <div
            role="tablist"
            aria-label={label}
            aria-orientation={sidebar ? 'vertical' : 'horizontal'}
            className={sidebar ? 'grid gap-1' : '-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]'}
            onKeyDown={handleKeyDown}
          >
            {items.map((item) => {
              const selected = item.value === active;
              const Icon = item.icon;
              return (
                <Link
                  key={item.value}
                  id={tabId(item.value)}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={selected && children ? panelId : undefined}
                  tabIndex={selected ? 0 : -1}
                  to={{ search: searchFor(item.value) }}
                  replace
                  preventScrollReset
                  data-testid={item.testId}
                  className={sidebar ? cn('flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring', selected ? 'bg-primary-soft text-primary-text' : 'hover:bg-muted') : tabLinkClass(selected)}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                  {item.label}
                  <TabCount count={item.count} label={item.countLabel} tone={item.tone} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {children ? (
        <div
          id={panelId}
          // Under the tabs the panel is the content of the tab that is open and takes its name from it. Under the menu of a
          // phone there are no tabs, so it is only a box.
          role={isPhone ? undefined : 'tabpanel'}
          aria-labelledby={isPhone ? undefined : tabId(active)}
          data-testid={panelTestId}
          className={cn('min-w-0', panelClassName)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
