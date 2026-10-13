import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string = string> {
  /** What goes in the address (`?tab=ical`): short, lowercase, and the same forever, because emails and links point at it. */
  value: T;
  label: string;
  /** A number beside the name: things waiting in that tab (requests to answer, errors). Nothing when it is 0 or missing. */
  count?: number;
  /** What the number counts, for a screen reader ("2 da approvare"). Without it only the number is read. */
  countLabel?: string;
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
  /** Test ids for the panel and, on a phone, for the menu that replaces the tabs. */
  panelTestId?: string;
  selectTestId?: string;
}

const SELECT_CLASS =
  'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function CountPill({ item }: { item: TabItem }) {
  if (!item.count || item.count <= 0) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold leading-none text-primary-foreground">
      <span aria-hidden={item.countLabel ? 'true' : undefined}>{item.count > 99 ? '99+' : item.count}</span>
      {item.countLabel ? <span className="sr-only">{`, ${item.countLabel}`}</span> : null}
    </span>
  );
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
 * No Radix Tabs: the state lives in the address, not in a component, and a link is what a tab really is here.
 */
export function Tabs<T extends string>({
  label,
  items,
  param = 'tab',
  defaultValue,
  value,
  children,
  className,
  panelTestId,
  selectTestId,
}: TabsProps<T>) {
  const isPhone = useMediaQuery(PHONE_QUERY);
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
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
    const index = tabs.indexOf(target);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else next = tabs.length - 1;
    event.preventDefault();
    tabs[next]?.focus();
  };

  return (
    <div className={cn('min-w-0', className)}>
      {isPhone ? (
        <div className="mb-4">
          <label htmlFor={`${baseId}-select`} className="sr-only">
            {label}
          </label>
          <select
            id={`${baseId}-select`}
            className={SELECT_CLASS}
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
        <div className="mb-6 border-b">
          <div
            role="tablist"
            aria-label={label}
            aria-orientation="horizontal"
            className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]"
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
                  className={cn(
                    'relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent after:content-['']",
                    // The name of a tab that is not open is `foreground/65`, not `muted-foreground`: that token is 4.4:1 on
                    // white (4.0 on the track of a control), a hair under what a text needs (4.5:1).
                    selected
                      ? 'text-primary after:bg-primary'
                      : 'text-foreground/65 hover:bg-muted hover:text-foreground',
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                  {item.label}
                  <CountPill item={item} />
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
          className="min-w-0"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
