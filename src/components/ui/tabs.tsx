import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { TabCount, type TabTone } from './tab-count';
import { TabState, type TabStateMark } from './tab-state';
import { TAB_SELECT_CLASS, tabLinkClass } from './tab-styles';

const stateSuffix = (state: TabStateMark | undefined): string => (state ? ` · ${state.label}` : '');

export interface TabItem<T extends string = string> {
  /** What goes in the address (`?tab=ical`): short, lowercase, and the same forever, because emails and links point at it. */
  value: T;
  label: string;
  count?: number;
  countLabel?: string;
  /** How the number weighs: `warning` for what needs an answer, `danger` for what failed (UI-15). Without it, the accent of the app. */
  tone?: TabTone;
  state?: TabStateMark;
  icon?: LucideIcon;
  testId?: string;
}

export interface TabsProps<T extends string> {
  label: string;
  items: readonly TabItem<T>[];
  param?: string;
  defaultValue?: T;
  value?: T;
  children?: React.ReactNode;
  className?: string;
  layout?: 'row' | 'sidebar';
  panelClassName?: string;
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
                {(item.count && item.count > 0 ? `${item.label} (${item.count})` : item.label) + stateSuffix(item.state)}
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
                  <TabState state={item.state} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {children ? (
        <div
          id={panelId}
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
