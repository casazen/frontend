import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { EmptyState } from '@/components/shared/empty-state';

/**
 * The types of a unified list (UI-14). A list is described once, in a `ListDefinition` that `defineList` checks, and the same
 * description serves the table, the cards of a phone, the columns (board) view, the filters, the saved views and the CSV.
 *
 * Every text in a definition is **already translated**: the definition is built where `t` is at hand (a component, with
 * `useMemo(() => defineList({...}), [t])`), so that it follows the language of the person.
 */

export type ListSortDirection = 'asc' | 'desc';

export interface ListSort {
  id: string;
  direction: ListSortDirection;
}

export type ListLayout = 'list' | 'board';

export type ListMode = 'client' | 'server';

export const LIST_MAX_DEFAULT_COLUMNS = 5;

export interface ListCell {
  /**
   * Makes of `children` the thing that opens the row: a link to its page, or a button that opens its drawer (whichever the
   * list has). A `rowHeader` column that does not ask for it is wholly that, so the keyboard can always open a row; a column
   * that wants only the name to be the link wraps just the name: `render: (row, cell) => cell.open(<b>{row.name}</b>)`.
   */
  open: (children: ReactNode) => ReactNode;
}

export interface ListColumn<Row> {
  id: string;
  label: string;
  render: (row: Row, cell: ListCell) => ReactNode;
  sort?: (row: Row) => string | number | null | undefined;
  default?: boolean;
  always?: boolean;
  priority?: number;
  cardStatus?: boolean;
  align?: 'start' | 'end';
  rowHeader?: boolean;
  /**
   * The value in the CSV, as plain text or a number. Without it: the cell if it is text or a number, otherwise the value
   * the column sorts by. A column whose cell is made of components wants this.
   */
  csv?: (row: Row) => string | number | null | undefined;
  className?: string;
}

export interface ListOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

export type ListOptions<Row> = readonly ListOption[] | ((rows: readonly Row[]) => readonly ListOption[]);

interface ListFilterBase {
  id: string;
  label: string;
}

export interface ListSelectFilter<Row> extends ListFilterBase {
  type: 'select';
  options: ListOptions<Row>;
  allLabel?: string;
  test?: (row: Row, value: string) => boolean;
}

export interface ListMultiFilter<Row> extends ListFilterBase {
  type: 'multi';
  options: ListOptions<Row>;
  test?: (row: Row, values: readonly string[]) => boolean;
}

export interface ListDateFilter<Row> extends ListFilterBase {
  type: 'date';
  test?: (row: Row, range: { from?: string; to?: string }) => boolean;
}

export type ListFilter<Row> = ListSelectFilter<Row> | ListMultiFilter<Row> | ListDateFilter<Row>;

export interface ListChip<Row> {
  id: string;
  label: string;
  icon?: LucideIcon;
  hint?: string;
  test?: (row: Row) => boolean;
  urgent?: boolean;
  counted?: boolean;
  count?: (rows: readonly Row[]) => number;
}

export interface ListRowAction {
  /** To tell this action from another one (the swipe actions are put in the menu unless they are there already). */
  id?: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  external?: boolean;
  onSelect?: () => void;
  variant?: 'default' | 'secondary' | 'soft' | 'outline';
  danger?: boolean;
  disabled?: boolean;
  testId?: string;
}

export type ListMenuEntry = ListRowAction | 'separator';

/**
 * What a bulk action says when it is done, when the default line ("Accetta: 3 righe") is not what happened: some rows went through and
 * some did not (SP-08b). `tone` `warning` is a toast that is not a success; the rows that failed are the page's to show.
 */
export interface ListBulkOutcome {
  title: string;
  description?: string;
  tone?: 'success' | 'warning';
}

export interface ListBulkAction<Row> {
  id: string;
  label: string;
  icon?: LucideIcon;
  run: (rows: Row[]) => void | ListBulkOutcome | Promise<void | ListBulkOutcome>;
  confirm?: {
    title: string | ((count: number) => string);
    description: string | ((count: number) => string);
    confirmLabel?: string;
    destructive?: boolean;
  };
  undo?: (rows: Row[]) => void | Promise<void>;
  doneMessage?: (count: number) => string;
}

export type ListBulkEntry<Row> = ListBulkAction<Row> | 'export';

export interface ListSwipeAction {
  id?: string;
  label: string;
  icon?: LucideIcon;
  tone?: 'accent' | 'success' | 'neutral' | 'danger';
  href?: string;
  onSelect?: () => void;
}

export interface ListCardContent {
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  status?: ReactNode;
  meta?: readonly { icon?: LucideIcon; text: ReactNode; label?: string }[];
  foot?: ReactNode;
}

export interface ListDetail<Row> {
  title: (row: Row) => string;
  description?: (row: Row) => string | undefined;
  render: (row: Row, api: { close: () => void }) => ReactNode;
  pageHref?: (row: Row) => string | undefined;
}

/**
 * The detail of a row opens in the global drawer of the shell (UI-15) instead of in a slot of the list: `drawerKind` is the kind
 * the feature registered with `registerDetail`, and the drawer is opened with the id of the row (`rowKey`, or `drawerId`). The
 * address then says it (`?detail=booking:s1`), so the drawer can be shared and Back closes it.
 */
export interface ListDrawerDetail<Row> {
  drawerKind: string;
  drawerId?: (row: Row) => string;
}

export function isDrawerDetail<Row>(detail: ListDetail<Row> | ListDrawerDetail<Row> | undefined): detail is ListDrawerDetail<Row> {
  return detail !== undefined && 'drawerKind' in detail;
}

export interface ListBoardColumn<Row> {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'warning' | 'success' | 'info';
  test: (row: Row) => boolean;
  empty: string;
}

export type ListMoveResult =
  | { ok: true; title?: string; description?: string; undo?: () => void | Promise<void> }
  | { ok: false; title: string; reason: string };

export interface ListBoard<Row> {
  columns: readonly ListBoardColumn<Row>[];
  defaultChip?: string;
  card?: (row: Row) => ListCardContent;
  onMove: (row: Row, to: string, from: string | undefined) => ListMoveResult | void | Promise<ListMoveResult | void>;
}

export interface ListPresetState {
  q?: string;
  chip?: string;
  filters?: Record<string, string>;
  sort?: string;
  columns?: readonly string[];
  layout?: ListLayout;
}

export interface ListPresetView {
  id: string;
  label: string;
  state: ListPresetState;
}

export type ListEmpty = Omit<ComponentProps<typeof EmptyState>, 'icon' | 'className'> & { icon?: LucideIcon };

export interface ListDefinition<Row> {
  key: string;
  title: string;
  rowKey: (row: Row) => string;
  rowLabel: (row: Row) => string;
  columns: readonly ListColumn<Row>[];

  search?: {
    label: string;
    placeholder: string;
    text?: (row: Row) => string;
  };
  chips?: readonly ListChip<Row>[];
  defaultChip?: string;
  allChip?: string;
  filters?: readonly ListFilter<Row>[];
  defaultSort?: string;
  views?: readonly ListPresetView[];

  primaryAction?: (row: Row) => ListRowAction | null | undefined;
  menu?: (row: Row) => readonly ListMenuEntry[];
  bulk?: readonly ListBulkEntry<Row>[];

  card?: (row: Row) => ListCardContent;
  swipe?: (row: Row) => { right?: ListSwipeAction | null; left?: ListSwipeAction | null } | undefined;

  rowHref?: (row: Row) => string | undefined;
  detail?: ListDetail<Row> | ListDrawerDetail<Row>;
  board?: ListBoard<Row>;

  rowTone?: (row: Row) => 'urgent' | 'done' | undefined;
  cardsUntil?: 'md' | 'lg' | 'xl';
  csv?: false | { fileName?: string; separator?: ';' | ',' };

  empty: ListEmpty;
  noResults?: { title: string; description?: string; byChip?: Readonly<Record<string, ListNoResultsOfChip>> };
  countLabel?: (count: number) => string;
}

export interface ListNoResultsOfChip {
  title: string;
  description: string;
  actionLabel?: string;
}

export interface ListViewsScope {
  userId: string;
  context: string;
}
