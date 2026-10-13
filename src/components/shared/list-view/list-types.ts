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

/** The column a list is sorted by and the direction. In the address: `?sort=lastStay:desc`. */
export interface ListSort {
  id: string;
  direction: ListSortDirection;
}

/** How the rows are laid out: the list (table, or cards on a phone) or columns by state (a board). */
export type ListLayout = 'list' | 'board';

/**
 * Who filters, searches and sorts. `client`: the page hands over all the rows and the list does it. `server`: the page asks
 * its API with the state of the list (`useListState`) and hands over the rows of the answer, as they are.
 */
export type ListMode = 'client' | 'server';

/** At most this many columns are shown by default; the others are for the person to add. */
export const LIST_MAX_DEFAULT_COLUMNS = 5;

/** What a cell can ask of the list. */
export interface ListCell {
  /**
   * Makes of `children` the thing that opens the row: a link to its page, or a button that opens its drawer (whichever the
   * list has). A `rowHeader` column that does not ask for it is wholly that, so the keyboard can always open a row; a column
   * that wants only the name to be the link wraps just the name: `render: (row, cell) => cell.open(<b>{row.name}</b>)`.
   */
  open: (children: ReactNode) => ReactNode;
}

export interface ListColumn<Row> {
  /** Stable, short, with no comma or colon: it is what the address (`cols`, `sort`) and the saved views call the column. */
  id: string;
  /** The title of the column (header, list of columns, header of the CSV). */
  label: string;
  /** What the cell shows. Put the name of a row in a `rowHeader` column. */
  render: (row: Row, cell: ListCell) => ReactNode;
  /**
   * The column can be sorted: this is what the rows are compared by (text or number; missing values go last). In `server`
   * mode the list does not sort, it only offers the column, and the page orders its query by `state.sort`.
   */
  sort?: (row: Row) => string | number | null | undefined;
  /** Shown without the person asking for it. At most five columns are (`LIST_MAX_DEFAULT_COLUMNS`). */
  default?: boolean;
  /** The column cannot be hidden. It counts as a default column. */
  always?: boolean;
  /**
   * On a phone the row is a card and a card has room for little: the columns with a priority are on it, the lowest number
   * first. The first is the title, the second the line under it, the others small items below. Without a priority the
   * column is only in the table and in the detail.
   */
  priority?: number;
  /** On the card the value goes top right, where the state of the row is. One column at most. */
  cardStatus?: boolean;
  /** Numbers and amounts to the right. */
  align?: 'start' | 'end';
  /** The cell names the row for a screen reader (the table's row header). At most one column. */
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

/** The choices of a filter: a fixed list, or one drawn from the rows (the countries there are guests from). */
export type ListOptions<Row> = readonly ListOption[] | ((rows: readonly Row[]) => readonly ListOption[]);

interface ListFilterBase {
  /** Stable, with no spaces: the address calls it `f_<id>`. */
  id: string;
  label: string;
}

export interface ListSelectFilter<Row> extends ListFilterBase {
  type: 'select';
  options: ListOptions<Row>;
  /** The first choice, the one that does not filter. Default: "Tutti" / "All". */
  allLabel?: string;
  /** `client` mode: does the row pass the filter. */
  test?: (row: Row, value: string) => boolean;
}

export interface ListMultiFilter<Row> extends ListFilterBase {
  type: 'multi';
  options: ListOptions<Row>;
  test?: (row: Row, values: readonly string[]) => boolean;
}

export interface ListDateFilter<Row> extends ListFilterBase {
  type: 'date';
  /** `from` and `to` are stay dates (`2026-10-31`); either may be missing. */
  test?: (row: Row, range: { from?: string; to?: string }) => boolean;
}

export type ListFilter<Row> = ListSelectFilter<Row> | ListMultiFilter<Row> | ListDateFilter<Row>;

/** A quick filter: one of them is on, always. The first is conventionally "everything". */
export interface ListChip<Row> {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** A line that says what is in it (the `title` of the chip). */
  hint?: string;
  /** `client` mode: does the row belong. */
  test?: (row: Row) => boolean;
  /** A counter on the chip, for what needs attention only: the number of rows that pass `test` (when there are any). */
  urgent?: boolean;
  /** Another way to count, for the counter of an `urgent` chip. */
  count?: (rows: readonly Row[]) => number;
}

/** What a button of a row, a card or a menu does: go somewhere (`href`) or run something (`onSelect`). */
export interface ListRowAction {
  /** To tell this action from another one (the swipe actions are put in the menu unless they are there already). */
  id?: string;
  label: string;
  icon?: LucideIcon;
  /** An address of the app (`/app/…`) goes through the router, anything else is a link. */
  href?: string;
  onSelect?: () => void;
  variant?: 'default' | 'secondary' | 'soft' | 'outline';
  danger?: boolean;
  disabled?: boolean;
  testId?: string;
}

export type ListMenuEntry = ListRowAction | 'separator';

export interface ListBulkAction<Row> {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** What it does to the selected rows. A rejection tells the person it failed. */
  run: (rows: Row[]) => void | Promise<void>;
  /** For what cannot be taken back: a dialog asks first. */
  confirm?: {
    title: string | ((count: number) => string);
    description: string | ((count: number) => string);
    confirmLabel?: string;
    destructive?: boolean;
  };
  /**
   * For what can be taken back: after `run` a toast offers "Annulla", and this is what it does. It has to be the real
   * inverse (see `toastUndo`).
   */
  undo?: (rows: Row[]) => void | Promise<void>;
  /** What the toast says when it is done. Default: the label and the number of rows. */
  doneMessage?: (count: number) => string;
}

/** The built-in action that downloads the selected rows as a CSV file. */
export type ListBulkEntry<Row> = ListBulkAction<Row> | 'export';

export interface ListSwipeAction {
  id?: string;
  label: string;
  icon?: LucideIcon;
  tone?: 'accent' | 'success' | 'neutral' | 'danger';
  href?: string;
  onSelect?: () => void;
}

/** What a card says about a row. The columns' priorities make one by themselves; a list that wants more builds it here. */
export interface ListCardContent {
  /** An avatar, an icon: at the start. */
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** Top right: the state. */
  status?: ReactNode;
  meta?: readonly { icon?: LucideIcon; text: ReactNode; label?: string }[];
  foot?: ReactNode;
}

export interface ListDetail<Row> {
  title: (row: Row) => string;
  description?: (row: Row) => string | undefined;
  /** The inside of the drawer (a sheet from the bottom on a phone): a slot, the list does not know what a row holds. */
  render: (row: Row, api: { close: () => void }) => ReactNode;
  /** The page of the row, when there is one: "Apri la scheda completa". */
  pageHref?: (row: Row) => string | undefined;
}

export interface ListBoardColumn<Row> {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'warning' | 'success' | 'info';
  /** Which rows are in this column. */
  test: (row: Row) => boolean;
  /** What to say when the column has nothing in it. */
  empty: string;
}

/** The answer to moving a card. */
export type ListMoveResult =
  | { ok: true; title?: string; description?: string; undo?: () => void | Promise<void> }
  | { ok: false; title: string; reason: string };

export interface ListBoard<Row> {
  columns: readonly ListBoardColumn<Row>[];
  /** The quick filter the board starts from (columns are empty under "Upcoming"): default, the one of the list. */
  defaultChip?: string;
  /** The card of the board, if it is not the one of the list. */
  card?: (row: Row) => ListCardContent;
  /**
   * A card was dropped in another column, or moved with "Sposta in…". Say why when the move is not allowed
   * (`{ ok: false, reason }`): the person is told. `void` means the page has already told them itself.
   */
  onMove: (row: Row, to: string, from: string | undefined) => ListMoveResult | void | Promise<ListMoveResult | void>;
}

/** The state of a list as a person or a definition can name it: what is not named is the default. */
export interface ListPresetState {
  q?: string;
  chip?: string;
  filters?: Record<string, string>;
  /** `lastStay:desc` */
  sort?: string;
  columns?: readonly string[];
  layout?: ListLayout;
}

/** A view that comes with the list ("Arrivi dei prossimi 7 giorni"). */
export interface ListPresetView {
  id: string;
  label: string;
  state: ListPresetState;
}

export type ListEmpty = Omit<ComponentProps<typeof EmptyState>, 'icon' | 'className'> & { icon?: LucideIcon };

export interface ListDefinition<Row> {
  /** Names the list: the saved views, the file of the CSV. Short, lowercase, with no colon. */
  key: string;
  /** The name of the list for a screen reader and for the dialogs ("Ospiti"). */
  title: string;
  rowKey: (row: Row) => string;
  /** The name of a row for a screen reader ("Mario Rossi"): its checkbox, its menu. */
  rowLabel: (row: Row) => string;
  /** At most five of them `default` (or `always`). */
  columns: readonly ListColumn<Row>[];

  search?: {
    label: string;
    placeholder: string;
    /** `client` mode: the text the words searched are looked for in. Default: the label of the row. */
    text?: (row: Row) => string;
  };
  chips?: readonly ListChip<Row>[];
  /** Default: the first chip. */
  defaultChip?: string;
  filters?: readonly ListFilter<Row>[];
  /** `lastStay:desc` */
  defaultSort?: string;
  /** Views that come with the list; the person's own are kept in the browser. */
  views?: readonly ListPresetView[];

  /** The one thing to do about a row, always in sight. */
  primaryAction?: (row: Row) => ListRowAction | null | undefined;
  /** The other things, in the "⋯" menu. */
  menu?: (row: Row) => readonly ListMenuEntry[];
  bulk?: readonly ListBulkEntry<Row>[];

  /** The card of a row, when the priorities of the columns are not enough. */
  card?: (row: Row) => ListCardContent;
  /** What a swipe to the right / to the left does on a card. The actions are in its menu too: a gesture is never the only way. */
  swipe?: (row: Row) => { right?: ListSwipeAction | null; left?: ListSwipeAction | null } | undefined;

  /** Where the name of a row leads (a page of the app) when the row has no drawer. */
  rowHref?: (row: Row) => string | undefined;
  /** The drawer that opens on a row. */
  detail?: ListDetail<Row>;
  /** Columns by state. */
  board?: ListBoard<Row>;

  /** The look of a row: `urgent` waits for an answer, `done` is over. */
  rowTone?: (row: Row) => 'urgent' | 'done' | undefined;
  /** Under which width the table is cards (see `DataView`). Default `md`. */
  cardsUntil?: 'md' | 'lg' | 'xl';
  /** `false` takes the export away. */
  csv?: false | { fileName?: string; separator?: ';' | ',' };

  /** Nothing in the list at all. */
  empty: ListEmpty;
  /** Rows exist but none passes the search and the filters. */
  noResults?: { title: string; description?: string };
  /** The name of the rows with a number: "12 ospiti". Default: "12 risultati". */
  countLabel?: (count: number) => string;
}

/** Where saved views live: a person, in one of the contexts (areas) of the app. */
export interface ListViewsScope {
  userId: string;
  context: string;
}
