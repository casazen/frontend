import * as React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SkeletonList, SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { cn } from '@/lib/utils';

export interface DataColumn<Row> {
  /** Unique among the columns. It is what `sort` calls the column. */
  key: string;
  /** The title of the column. */
  header: React.ReactNode;
  /** What the cell shows. Default: the property of the row with the name of `key`, as text. */
  cell?: (row: Row) => React.ReactNode;
  /** Numbers and amounts to the right. */
  align?: 'start' | 'end';
  /** The title is a button that sorts the list by this column. */
  sortable?: boolean;
  /** What the rows are compared by when `DataView` sorts them itself. Default: the property named `key`. */
  sortValue?: (row: Row) => string | number | null | undefined;
  /** The cell names the row (a name, a code): it is the header of the row for a screen reader. At most one. */
  rowHeader?: boolean;
  className?: string;
}

export interface DataViewSort {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataViewProps<Row> {
  /** What the list is ("Ospiti"): the caption of the table and the name of the list of cards, for a screen reader. */
  label: string;
  rows: readonly Row[];
  /** Up to five columns on a desktop is plenty: what is secondary goes under the first one, or in the detail. */
  columns: readonly DataColumn<Row>[];
  rowKey: (row: Row) => string;
  /** One row on a phone: what goes in the card. Usually a link that covers it, a title, two lines of detail. */
  renderCard: (row: Row) => React.ReactNode;
  /** The actions of a row, last column of the table (on a phone they belong in the card). */
  rowActions?: (row: Row) => React.ReactNode;

  /**
   * Sorting. Without `sort`, `DataView` sorts the rows itself when a column is `sortable` (client side, `defaultSort` is
   * where it starts). With `sort` the caller owns it: the rows come already sorted (a server, a query) and `onSortChange`
   * says what the user asked for.
   */
  sort?: DataViewSort | null;
  defaultSort?: DataViewSort;
  onSortChange?: (sort: DataViewSort) => void;

  /** A checkbox on every row and one for all, and a bar of actions on the selected ones. */
  selectable?: boolean;
  /** The keys (`rowKey`) of the selected rows. Without it `DataView` keeps the selection itself. */
  selected?: readonly string[];
  onSelectedChange?: (keys: string[]) => void;
  /** The name of the checkbox of a row for a screen reader ("Seleziona Mario Rossi"). Default: "Seleziona la riga". */
  rowLabel?: (row: Row) => string;
  /** The actions on the selected rows, shown in a bar while at least one is selected. */
  bulkActions?: (selectedRows: Row[]) => React.ReactNode;

  isLoading?: boolean;
  isError?: boolean;
  /** What failed to load, already translated. Default: "Impossibile caricare l'elenco". */
  errorTitle?: string;
  error?: unknown;
  onRetry?: () => void;
  /** What to say, and to offer, when there is nothing in the list: the props of an `EmptyState`. */
  empty?: React.ComponentProps<typeof EmptyState>;

  /**
   * Under which width the table is cards: `md` (768 px, default), `lg` (1024 px) or `xl` (1280 px), for a table that needs room:
   * in the shell the sidebar takes 256 px from `lg` on, so a table of five columns needs `xl` to be seen whole.
   */
  cardsUntil?: 'md' | 'lg' | 'xl';
  /** Under the list: pagination, a count. */
  footer?: React.ReactNode;
  className?: string;
  testId?: string;

  /**
   * The row can be opened with a click anywhere on it (the table row, the card): it is for the pointer, the keyboard has the
   * link or the button the row must have in it. A click on something interactive inside the row (a link, a button, a box,
   * a menu) is that thing's, not the row's. Added for the unified list (UI-14).
   */
  onRowClick?: (row: Row, event: React.MouseEvent<HTMLElement>) => void;
  /** Classes for the row of the table and the item of the list of cards (an accent for a row that waits for an answer). */
  rowClassName?: (row: Row) => string | undefined;
  /** `data-testid` of a row, in the table and in the cards (they are two elements for the same row: it is on both). */
  rowTestId?: (row: Row) => string | undefined;
  /** The boxes on the cards: `false` leaves them to the table. On a phone they appear when the person asks to select. */
  cardSelectable?: boolean;
  /** Classes for what is inside a card item, in place of its padding (`p-0` when the card draws its own, to the edges). */
  cardClassName?: string;
  /** No border and no rounded corners around the list of cards: it is already inside a box (the unified list). */
  bare?: boolean;
}

/** What takes a click for itself inside a row: the row does not open under a finger that pressed a link, a button or a box. */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="menuitem"], [role="button"], [data-no-row-click]';

/** The two representations are in the page together and a media query shows one: written out so that the classes can be found. */
const SHOWN_FROM = {
  md: { table: 'hidden md:block', cards: 'md:hidden' },
  lg: { table: 'hidden lg:block', cards: 'lg:hidden' },
  xl: { table: 'hidden xl:block', cards: 'xl:hidden' },
} as const;

function valueOf<Row>(row: Row, column: DataColumn<Row>): string | number | null | undefined {
  if (column.sortValue) return column.sortValue(row);
  const value = (row as Record<string, unknown>)[column.key];
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function sortRows<Row>(rows: readonly Row[], column: DataColumn<Row>, direction: 'asc' | 'desc', locale: string): Row[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = valueOf(a, column);
    const right = valueOf(b, column);
    // Whatever has no value goes last, in either direction.
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
    return collator.compare(String(left), String(right)) * sign;
  });
}

function NativeCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ...rest
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, 'aria-label'>) {
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    // "Some of them" has no attribute, only a property.
    if (input.current) input.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={input}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer accent-primary"
      {...rest}
    />
  );
}

/** The checkbox of a row, with no text of its own: the box is 16 px and the label around it is the 44 px of a finger. */
function SelectBox({ label, ...box }: { checked: boolean; indeterminate?: boolean; label: string; onChange: () => void }) {
  return (
    <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
      <NativeCheckbox aria-label={label} {...box} />
    </label>
  );
}

function SortIcon({ direction }: { direction?: 'asc' | 'desc' }) {
  const Icon = direction === 'asc' ? ChevronUp : direction === 'desc' ? ChevronDown : ChevronsUpDown;
  return <Icon className={cn('h-3.5 w-3.5 shrink-0', !direction && 'opacity-50')} aria-hidden="true" />;
}

/**
 * A list of things that is a table where there is room and a list of cards where there is not (UI-07): the same rows,
 * once as `<table>` and once as `<ul>` of cards, and a media query shows one of them (`md:`), so a phone never scrolls the
 * page sideways to read a row. Nothing in it is a library: columns, a card for a row, and what a list needs around the rows.
 *
 * - Sorting by a column: the title of a `sortable` column is a button, the column in force says `aria-sort`.
 * - Selection and a bar of actions on the selected rows, on the table and on the cards alike.
 * - The three states of a list: loading (a skeleton that is announced), failed (with a retry) and empty (what to do next).
 *
 * It is the base of the unified list (`ListView`, UI-14): filters, chips, saved views and export come on top of it.
 * A rule of content, not of code: five columns at most; what is secondary goes under the first one.
 */
export function DataView<Row>({
  label,
  rows,
  columns,
  rowKey,
  renderCard,
  rowActions,
  sort,
  defaultSort,
  onSortChange,
  selectable = false,
  selected,
  onSelectedChange,
  rowLabel,
  bulkActions,
  isLoading = false,
  isError = false,
  errorTitle,
  error,
  onRetry,
  empty,
  cardsUntil = 'md',
  footer,
  className,
  testId,
  onRowClick,
  rowClassName,
  rowTestId,
  cardSelectable = true,
  cardClassName,
  bare = false,
}: DataViewProps<Row>) {
  const { t, i18n } = useTranslation();
  const [ownSort, setOwnSort] = React.useState<DataViewSort | null>(defaultSort ?? null);
  const [ownSelected, setOwnSelected] = React.useState<readonly string[]>([]);

  const callerSorts = sort !== undefined;
  const currentSort = callerSorts ? sort : ownSort;
  const sortColumn = currentSort ? columns.find((column) => column.key === currentSort.key) : undefined;
  const shownRows = React.useMemo(
    () => (callerSorts || !currentSort || !sortColumn ? rows : sortRows(rows, sortColumn, currentSort.direction, i18n.language)),
    [callerSorts, currentSort, sortColumn, rows, i18n.language],
  );

  const requestSort = (key: string) => {
    const next: DataViewSort = { key, direction: currentSort?.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc' };
    if (!callerSorts) setOwnSort(next);
    onSortChange?.(next);
  };

  const selectedKeys = selected ?? ownSelected;
  const select = (keys: string[]) => {
    if (selected === undefined) setOwnSelected(keys);
    onSelectedChange?.(keys);
  };
  const chosen = new Set(selectedKeys);
  const allKeys = shownRows.map(rowKey);
  const allChosen = allKeys.length > 0 && allKeys.every((key) => chosen.has(key));
  const someChosen = allKeys.some((key) => chosen.has(key));
  const toggleRow = (key: string) => select(chosen.has(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]);
  const toggleAll = () => select(allChosen ? selectedKeys.filter((key) => !allKeys.includes(key)) : [...new Set([...selectedKeys, ...allKeys])]);
  const selectedRows = shownRows.filter((row) => chosen.has(rowKey(row)));

  const rootClass = cn('min-w-0 max-w-full', className);

  if (isError) {
    return (
      <div className={rootClass} data-testid={testId}>
        <ErrorState title={errorTitle ?? t('dataView.loadError')} error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (isLoading) {
    // The placeholders of UI-02, one for each representation: a table where there is room, a list of rows where there is
    // not. Each announces "Loading..." once (`role="status"`); the one that is not shown is `display: none`, so not read.
    const loadingShown = SHOWN_FROM[cardsUntil];
    return (
      <div className={rootClass} data-testid={testId}>
        <div data-testid={testId ? `${testId}-loading` : undefined}>
          <SkeletonTable
            label={t('dataView.loading')}
            columns={Math.min(Math.max(columns.length, 2), 5)}
            className={loadingShown.table}
          />
          <SkeletonList label={t('dataView.loading')} className={loadingShown.cards} />
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={rootClass} data-testid={testId}>
        <EmptyState icon={Inbox} title={t('dataView.emptyTitle')} description={t('dataView.emptyDescription')} {...empty} />
      </div>
    );
  }

  const shown = SHOWN_FROM[cardsUntil];
  const nameOf = (row: Row) => rowLabel?.(row) ?? t('dataView.selectRow');
  const selectableCards = selectable && cardSelectable;
  /** A click on the row itself; whatever is interactive inside the row has its own. */
  const clickRow = (row: Row, event: React.MouseEvent<HTMLElement>) => {
    if (!onRowClick) return;
    const inside = (event.target as HTMLElement).closest(INTERACTIVE);
    if (inside && event.currentTarget.contains(inside)) return;
    onRowClick(row, event);
  };

  return (
    <div className={rootClass} data-testid={testId}>
      {selectable && bulkActions && selectedKeys.length > 0 ? (
        <div
          role="region"
          aria-label={t('dataView.bulkBar')}
          data-testid="data-view-bulk-bar"
          className="sticky top-[var(--header-height,0px)] z-10 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted px-4 py-2 text-sm shadow-sm ring-1 ring-primary/30"
        >
          <strong aria-live="polite" className="font-semibold">
            {t('dataView.selected', { count: selectedKeys.length })}
          </strong>
          <div className="flex min-w-0 grow flex-wrap items-center gap-2">{bulkActions(selectedRows)}</div>
          <Button type="button" variant="ghost" size="sm" onClick={() => select([])}>
            {t('dataView.clearSelection')}
          </Button>
        </div>
      ) : null}

      <div className={cn('min-w-0', shown.table)}>
        {/* `relative`: the caption and the hidden title of the actions are `sr-only`, that is absolutely placed; without a
            positioned box around them they belong to the page, and sit where the table has scrolled to, widening it. */}
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr className="border-b bg-muted/40">
                {selectable ? (
                  <th scope="col" className="w-11 px-1 py-0">
                    <SelectBox checked={allChosen} indeterminate={someChosen} label={t('dataView.selectAll')} onChange={toggleAll} />
                  </th>
                ) : null}
                {columns.map((column) => {
                  const direction = currentSort?.key === column.key ? currentSort.direction : undefined;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn(
                        'px-4 py-3 text-left font-medium text-foreground/70',
                        column.align === 'end' && 'text-right',
                        column.className,
                      )}
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => requestSort(column.key)}
                          className={cn(
                            '-mx-2 inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-left font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            direction && 'text-foreground',
                            column.align === 'end' && 'flex-row-reverse',
                          )}
                        >
                          {column.header}
                          <SortIcon direction={direction} />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
                {rowActions ? (
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t('dataView.rowActions')}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {shownRows.map((row) => {
                const key = rowKey(row);
                const isChosen = chosen.has(key);
                return (
                  <tr
                    key={key}
                    data-selected={isChosen ? 'true' : undefined}
                    data-testid={rowTestId?.(row)}
                    onClick={onRowClick ? (event) => clickRow(row, event) : undefined}
                    className={cn(
                      'border-b transition-colors last:border-0 hover:bg-muted/30 data-[selected=true]:bg-primary/5',
                      onRowClick && 'cursor-pointer',
                      rowClassName?.(row),
                    )}
                  >
                    {selectable ? (
                      <td className="w-11 px-1">
                        <SelectBox checked={isChosen} label={nameOf(row)} onChange={() => toggleRow(key)} />
                      </td>
                    ) : null}
                    {columns.map((column) => {
                      const content = column.cell
                        ? column.cell(row)
                        : String(((row as Record<string, unknown>)[column.key] as string | number | null | undefined) ?? '');
                      const cellClass = cn(
                        'px-4 py-3',
                        column.align === 'end' ? 'text-right tabular-nums' : 'text-left',
                        column.rowHeader ? 'font-medium' : 'text-foreground/70',
                        column.className,
                      );
                      return column.rowHeader ? (
                        <th key={column.key} scope="row" className={cellClass}>
                          {content}
                        </th>
                      ) : (
                        <td key={column.key} className={cellClass}>
                          {content}
                        </td>
                      );
                    })}
                    {rowActions ? <td className="px-4 py-3 text-right">{rowActions(row)}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cn('min-w-0', shown.cards)}>
        {selectableCards ? (
          // Cards have no header with a box in it: the box for all of them is a row of its own, with its words.
          <label className="mb-1 flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm">
            <NativeCheckbox checked={allChosen} indeterminate={someChosen} onChange={toggleAll} />
            {t('dataView.selectAll')}
          </label>
        ) : null}
        <ul role="list" aria-label={label} className={cn('divide-y', !bare && 'rounded-lg border')}>
          {shownRows.map((row) => {
            const key = rowKey(row);
            const isChosen = chosen.has(key);
            return (
              <li
                key={key}
                data-selected={isChosen ? 'true' : undefined}
                data-testid={rowTestId?.(row)}
                onClick={onRowClick ? (event) => clickRow(row, event) : undefined}
                className={cn('flex min-w-0 items-start data-[selected=true]:bg-primary/5', onRowClick && 'cursor-pointer', rowClassName?.(row))}
              >
                {selectableCards ? (
                  <div className="pl-1 pt-1">
                    <SelectBox checked={isChosen} label={nameOf(row)} onChange={() => toggleRow(key)} />
                  </div>
                ) : null}
                <div className={cn('min-w-0 flex-1 break-words p-4', cardClassName)}>{renderCard(row)}</div>
              </li>
            );
          })}
        </ul>
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}
