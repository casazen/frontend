import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Inbox, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import { SkeletonList } from '@/components/ui/skeleton';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { getProblemMessage } from '@/lib/api-errors';
import { toastUndo } from '@/lib/toast-undo';
import { cn } from '@/lib/utils';
import { ListBoardView } from './list-board';
import { ListBulkBar, type ListBulkBarAction } from './list-bulk-bar';
import { ListCardBody, SwipeSurface, type BuiltCard } from './list-card';
import { csvFileName, csvSeparatorFor, downloadCsv, listToCsv } from './list-csv';
import { autoCardContent, filterListRows, sortListRows, visibleColumns } from './list-data';
import { ListPagination } from './list-pagination';
import { ListPanel } from './list-panels';
import { ListRowActions } from './list-row-actions';
import { isRefined } from './list-state';
import { ListToolbar } from './list-toolbar';
import type {
  ListBulkAction,
  ListCell,
  ListDefinition,
  ListMenuEntry,
  ListMode,
  ListRowAction,
  ListSwipeAction,
  ListViewsScope,
} from './list-types';
import { useListState } from './use-list-state';
import { useReturnFocus } from './use-return-focus';
import { useSavedViews } from './use-saved-views';

export interface ListViewProps<Row> {
  list: ListDefinition<Row>;
  /** `client`: all the rows. `server`: the rows of the page the server answered for the state in the address. */
  rows: readonly Row[];
  mode?: ListMode;
  /** The first load: placeholders in place of the rows. */
  isLoading?: boolean;
  /** A load after the first (the search changed): the rows that are there stay, a little dimmed. */
  isRefreshing?: boolean;
  isError?: boolean;
  error?: unknown;
  /** What failed to load, already translated. Default: "Impossibile caricare l'elenco". */
  errorTitle?: string;
  onRetry?: () => void;
  /** `server` mode: how many rows there are in all, for the count and the pages. */
  totalCount?: number;
  /** `server` mode: the rows in a page. With it, and more rows than a page, the list has previous and next. */
  pageSize?: number;
  /** `server` mode: the numbers on the quick filters that need attention (`urgent`), by id. */
  chipCounts?: Readonly<Record<string, number | undefined>>;
  /** Whose saved views these are. Without it the list offers none. */
  viewsScope?: ListViewsScope | null;
  testId?: string;
  className?: string;
}

const OPENER =
  'inline-block max-w-full rounded-sm text-left font-semibold text-foreground [overflow-wrap:anywhere] hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const ROW_TONE = {
  urgent: 'shadow-[inset_3px_0_0_0_var(--color-destructive)]',
  done: 'text-foreground/70',
} as const;

function swipeToRowAction(action: ListSwipeAction): ListRowAction {
  return { id: action.id, label: action.label, icon: action.icon, href: action.href, onSelect: action.onSelect, danger: action.tone === 'danger' };
}

const sameAction = (a: ListRowAction, b: { id?: string; label: string }) => (a.id !== undefined && b.id !== undefined ? a.id === b.id : a.label === b.label);

/**
 * The unified list (UI-14): one component for every list of the product, built on `DataView`. A table where there is room and
 * cards on a phone, a search, quick filters, filters in a drawer, views the person can save, columns and order to choose, a CSV
 * of what is on the screen, rows that can be selected for actions on many, the swipe of a card, and a board of columns by
 * state for the lists that have one. What a list is is told once, in a `defineList` definition; this component is the same
 * everywhere.
 *
 * The state (search, quick filter, filters, order, columns, layout, page) is in the address and nowhere else, so Back, a
 * refresh and a shared link give the same list. In `client` mode the list does the searching, filtering and sorting of the
 * rows it is given; in `server` mode it only shows the rows it is given and the page asks its API with the same state
 * (`useListState`).
 *
 * See `README.md` in this folder for an example.
 */
export function ListView<Row>({
  list,
  rows,
  mode = 'client',
  isLoading = false,
  isRefreshing = false,
  isError = false,
  error,
  errorTitle,
  onRetry,
  totalCount,
  pageSize,
  chipCounts,
  viewsScope,
  testId,
  className,
}: ListViewProps<Row>) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const listState = useListState(list);
  const { state } = listState;
  const savedViews = useSavedViews(list.key, viewsScope);
  const detailFocus = useReturnFocus();

  const isBoard = state.layout === 'board' && Boolean(list.board);
  const columns = useMemo(() => visibleColumns(list, state.columns), [list, state.columns]);

  // `client` mode: the list narrows and orders the rows. The counters of the quick filters count the rows the search and the
  // filters leave, whichever quick filter is on.
  const chipRows = useMemo(() => (mode === 'client' ? filterListRows(list, rows, state, { ignoreChip: true }) : rows), [mode, list, rows, state]);
  const shown = useMemo(
    () => (mode === 'client' ? sortListRows(list, filterListRows(list, rows, state), state.sort, i18n.language) : rows),
    [mode, list, rows, state, i18n.language],
  );

  /* ------------------------------------------------------------------------------------------------ Opening a row */

  const [detailKey, setDetailKey] = useState<string | null>(null);
  const detailRow = list.detail && detailKey !== null ? rows.find((row) => list.rowKey(row) === detailKey) : undefined;
  const canOpen = Boolean(list.detail) || Boolean(list.rowHref);

  const openRow = (row: Row, from: HTMLElement | null) => {
    if (list.detail) {
      detailFocus.remember(from);
      setDetailKey(list.rowKey(row));
      return;
    }
    const href = list.rowHref?.(row);
    if (href) void navigate(href);
  };

  /** Whatever opens a row, made of `children`: the button of its drawer, or the link to its page. Nothing if it opens nothing. */
  const opener = (row: Row, children: ReactNode): ReactNode => {
    if (list.detail) {
      return (
        <button type="button" data-list-opener="" className={OPENER} onClick={(event) => openRow(row, event.currentTarget)}>
          {children}
        </button>
      );
    }
    const href = list.rowHref?.(row);
    return href ? (
      <Link to={href} data-list-opener="" className={OPENER}>
        {children}
      </Link>
    ) : (
      children
    );
  };

  /** A cell that asks for the opener where it wants it; a name that does not is wholly the opener. */
  const withOpener = (row: Row, build: (cell: ListCell) => ReactNode, always: boolean): ReactNode => {
    let asked = false;
    const node = build({
      open: (children) => {
        asked = true;
        return opener(row, children);
      },
    });
    return always && canOpen && !asked ? opener(row, node) : node;
  };

  const card = (row: Row): BuiltCard => {
    if (list.card) {
      const content = list.card(row);
      return { content, title: opener(row, content.title) };
    }
    let asked = false;
    const content = autoCardContent(list, columns, row, {
      open: (children) => {
        asked = true;
        return opener(row, children);
      },
    });
    return { content, title: asked ? content.title : opener(row, content.title) };
  };

  const cardForBoard = (row: Row): BuiltCard => {
    const board = list.board;
    if (board?.card) {
      const content = board.card(row);
      return { content, title: opener(row, content.title) };
    }
    return card(row);
  };

  /* ------------------------------------------------------------------------------------------------- Row actions */

  /** The menu of a row: its own entries and, after them, the swipe actions that are not there yet (a gesture is never the only way). */
  const menuOf = (row: Row): readonly ListMenuEntry[] => {
    const entries = [...(list.menu?.(row) ?? [])];
    const swipe = list.swipe?.(row);
    const primary = list.primaryAction?.(row);
    const extra = [swipe?.right, swipe?.left]
      .filter((action): action is ListSwipeAction => Boolean(action))
      .map(swipeToRowAction)
      .filter((action) => !entries.some((entry) => entry !== 'separator' && sameAction(entry, action)) && !(primary && sameAction(primary, action)));
    if (extra.length === 0) return entries;
    return entries.length > 0 ? [...entries, 'separator', ...extra] : extra;
  };
  const hasRowActions = Boolean(list.primaryAction || list.menu || list.swipe);

  /* ------------------------------------------------------------------------------------------------------ Selection */

  const bulk = list.bulk ?? [];
  const hasBulk = bulk.length > 0 && !isBoard;
  const [selectMode, setSelectMode] = useState(false);
  // The selection belongs to the rows it was made on: another search, filter, quick filter or page forgets it (for good: going
  // back to the same quick filter does not bring it back).
  const selectionScope = JSON.stringify([state.q, state.chip, state.filters, state.page]);
  const [selection, setSelection] = useState<{ scope: string; keys: string[] }>({ scope: selectionScope, keys: [] });
  if (selection.scope !== selectionScope) setSelection({ scope: selectionScope, keys: [] });
  const present = new Set(shown.map(list.rowKey));
  const selectedKeys = selection.scope === selectionScope ? selection.keys.filter((key) => present.has(key)) : [];
  const selectedRows = shown.filter((row) => selectedKeys.includes(list.rowKey(row)));
  const clearSelection = () => setSelection({ scope: selectionScope, keys: [] });
  const toggleSelectMode = () => {
    if (selectMode) clearSelection();
    setSelectMode(!selectMode);
  };

  /* ---------------------------------------------------------------------------------------------------------- CSV */

  const exportRows = (toExport: readonly Row[]) => {
    downloadCsv(csvFileName(list), listToCsv(columns, toExport, csvSeparatorFor(list, i18n.language)));
    toast.success(t('listView.export.done', { count: toExport.length }));
  };
  const total = mode === 'server' ? (totalCount ?? rows.length) : shown.length;
  const exportLabel =
    list.csv === false || shown.length === 0
      ? null
      : mode === 'server' && total > shown.length
        ? t('listView.export.menuPage', { count: shown.length })
        : t('listView.export.menu', { count: shown.length });

  /* ---------------------------------------------------------------------------------------------- Actions on many */

  const [confirming, setConfirming] = useState<{ action: ListBulkAction<Row>; rows: Row[] } | null>(null);

  const runBulk = async (action: ListBulkAction<Row>, on: Row[]) => {
    try {
      await action.run(on);
    } catch (failure) {
      toast.error(getProblemMessage(failure, t) ?? t('listView.bulk.failed'));
      return;
    }
    clearSelection();
    const message = action.doneMessage?.(on.length) ?? t('listView.bulk.done', { action: action.label, count: on.length });
    const undo = action.undo;
    if (undo) toastUndo(message, { undo: () => undo(on) });
    else toast.success(message);
  };

  const bulkBarActions: ListBulkBarAction[] = bulk.map((entry) =>
    entry === 'export'
      ? { id: 'export', label: t('listView.bulk.export'), icon: Download, onSelect: () => exportRows(selectedRows) }
      : {
          id: entry.id,
          label: entry.label,
          icon: entry.icon,
          onSelect: () => (entry.confirm ? setConfirming({ action: entry, rows: selectedRows }) : void runBulk(entry, selectedRows)),
        },
  );

  /* ------------------------------------------------------------------------------------------------------- Board */

  const moveCard = async (row: Row, to: string) => {
    const board = list.board;
    if (!board) return;
    const from = board.columns.find((column) => column.test(row))?.id;
    if (from === to) return;
    let result: Awaited<ReturnType<typeof board.onMove>>;
    try {
      result = await board.onMove(row, to, from);
    } catch (failure) {
      toast.error(getProblemMessage(failure, t) ?? t('listView.board.moveFailed'));
      return;
    }
    // Nothing back: the page has told the person itself.
    if (!result) return;
    if (!result.ok) {
      toast.warning(result.title, { description: result.reason });
      return;
    }
    const title = result.title ?? t('listView.board.moved');
    const undo = result.undo;
    if (undo) toastUndo(title, { description: result.description, undo });
    else toast.success(title, { description: result.description });
  };

  /* ------------------------------------------------------------------------------------------------------ States */

  const refined = isRefined(list, state) || state.page > 1;
  const nothingAtAll = !isLoading && !isError && (mode === 'client' ? rows.length === 0 : shown.length === 0 && !refined);
  const noResults = !isLoading && !isError && !nothingAtAll && shown.length === 0;

  const countText = (() => {
    const base = list.countLabel ? list.countLabel(total) : t('listView.count', { count: total });
    return mode === 'client' && shown.length !== rows.length ? t('listView.countOf', { base, total: rows.length }) : base;
  })();

  const dataColumns: DataColumn<Row>[] = columns.map((column) => ({
    key: column.id,
    header: column.label,
    align: column.align,
    sortable: Boolean(column.sort),
    rowHeader: column.rowHeader,
    className: column.className,
    cell: (row) => withOpener(row, (cell) => column.render(row, cell), Boolean(column.rowHeader)),
  }));

  let content: ReactNode;
  if (isError && isBoard) {
    content = (
      <div className="p-4">
        <ErrorState title={errorTitle ?? t('listView.loadError')} error={error} onRetry={onRetry} />
      </div>
    );
  } else if (isLoading && isBoard) {
    content = <SkeletonList label={t('dataView.loading')} className="p-4" />;
  } else if (nothingAtAll) {
    const { icon, ...rest } = list.empty;
    content = <EmptyState icon={icon ?? Inbox} {...rest} />;
  } else if (noResults) {
    content = (
      <EmptyState
        icon={SearchX}
        title={list.noResults?.title ?? t('listView.noResults.title')}
        description={list.noResults?.description ?? t('listView.noResults.description')}
        action={{ label: t('listView.clear'), onClick: listState.clear }}
      />
    );
  } else if (isBoard) {
    content = <ListBoardView list={list} rows={shown} card={cardForBoard} menu={menuOf} onMove={(row, to) => void moveCard(row, to)} dragEnabled={!isPhone} />;
  } else {
    content = (
      <DataView<Row>
        label={list.title}
        rows={shown}
        columns={dataColumns}
        rowKey={list.rowKey}
        testId={testId ? `${testId}-rows` : undefined}
        bare
        cardsUntil={list.cardsUntil}
        isLoading={isLoading}
        isError={isError}
        error={error}
        errorTitle={errorTitle ?? t('listView.loadError')}
        onRetry={onRetry}
        sort={state.sort ? { key: state.sort.id, direction: state.sort.direction } : null}
        onSortChange={(sort) => listState.setSort({ id: sort.key, direction: sort.direction })}
        selectable={hasBulk}
        selected={selectedKeys}
        onSelectedChange={(keys) => setSelection({ scope: selectionScope, keys })}
        rowLabel={list.rowLabel}
        cardSelectable={selectMode}
        rowActions={
          hasRowActions
            ? (row) => <ListRowActions primary={list.primaryAction?.(row)} menu={menuOf(row)} name={list.rowLabel(row)} />
            : undefined
        }
        rowClassName={(row) => {
          const tone = list.rowTone?.(row);
          return tone ? ROW_TONE[tone] : undefined;
        }}
        rowTestId={(row) => `list-row-${list.rowKey(row)}`}
        onRowClick={canOpen ? (row, event) => openRow(row, event.currentTarget.querySelector<HTMLElement>('[data-list-opener]')) : undefined}
        cardClassName="p-0"
        renderCard={(row) => {
          const swipe = list.swipe?.(row);
          const built = card(row);
          return (
            <SwipeSurface right={swipe?.right} left={swipe?.left} enabled={!selectMode}>
              <div className="p-4">
                <ListCardBody content={built.content} title={built.title} />
                {hasRowActions ? (
                  <div className="mt-3">
                    <ListRowActions primary={list.primaryAction?.(row)} menu={menuOf(row)} name={list.rowLabel(row)} card />
                  </div>
                ) : null}
              </div>
            </SwipeSurface>
          );
        }}
      />
    );
  }

  const showFooter = !isLoading && !isError && !nothingAtAll;

  return (
    <section
      aria-label={list.title}
      aria-busy={isRefreshing || isLoading || undefined}
      data-testid={testId}
      className={cn('min-w-0 overflow-clip rounded-lg border bg-card text-card-foreground shadow-sm', className)}
    >
      {nothingAtAll ? null : (
        <ListToolbar
          list={list}
          listState={listState}
          rows={rows}
          chipRows={chipRows}
          chipCounts={chipCounts}
          mode={mode}
          savedViews={savedViews}
          exportLabel={exportLabel}
          onExport={() => exportRows(shown)}
          hasBulk={hasBulk}
          selectMode={selectMode}
          onToggleSelectMode={toggleSelectMode}
        />
      )}

      {hasBulk && selectedKeys.length > 0 ? <ListBulkBar count={selectedKeys.length} actions={bulkBarActions} onClear={clearSelection} /> : null}

      <div className={cn('min-w-0 transition-opacity', isRefreshing && 'opacity-60')}>{content}</div>

      {showFooter ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3 text-sm">
          <p role="status" aria-live="polite" className="text-foreground/70" data-testid="list-count">
            {countText}
          </p>
          {mode === 'server' && pageSize ? <ListPagination page={state.page} pageSize={pageSize} totalCount={total} onPageChange={listState.setPage} /> : null}
        </div>
      ) : null}

      {list.detail && detailRow ? (
        <ListPanel
          open
          onOpenChange={(next) => !next && setDetailKey(null)}
          title={list.detail.title(detailRow)}
          description={list.detail.description?.(detailRow) ?? t('listView.detail.description')}
          onCloseAutoFocus={detailFocus.onCloseAutoFocus}
          testId="list-detail-panel"
          wide
          footer={
            list.detail.pageHref?.(detailRow) ? (
              <Button asChild variant="outline">
                <Link to={list.detail.pageHref(detailRow) ?? ''}>{t('listView.detail.openPage')}</Link>
              </Button>
            ) : undefined
          }
        >
          {list.detail.render(detailRow, { close: () => setDetailKey(null) })}
        </ListPanel>
      ) : null}

      {confirming ? (
        <ConfirmationDialog
          open
          onOpenChange={(next) => !next && setConfirming(null)}
          title={typeof confirming.action.confirm?.title === 'function' ? confirming.action.confirm.title(confirming.rows.length) : (confirming.action.confirm?.title ?? '')}
          description={
            typeof confirming.action.confirm?.description === 'function'
              ? confirming.action.confirm.description(confirming.rows.length)
              : (confirming.action.confirm?.description ?? '')
          }
          confirmLabel={confirming.action.confirm?.confirmLabel}
          variant={confirming.action.confirm?.destructive ? 'destructive' : 'default'}
          onConfirm={() => runBulk(confirming.action, confirming.rows)}
        />
      ) : null}
    </section>
  );
}
