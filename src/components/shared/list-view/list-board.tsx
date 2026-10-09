import { useId, useRef } from 'react';
import { MoveRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ListCardBody, type BuiltCard } from './list-card';
import { ListMenuEntries, ListPrimaryAction } from './list-row-actions';
import { useBoardDrag } from './use-board-drag';
import type { ListBoardColumn, ListDefinition, ListMenuEntry } from './list-types';

const TONE_ICON: Record<NonNullable<ListBoardColumn<unknown>['tone']>, string> = {
  neutral: 'text-foreground/70',
  warning: 'text-warning-foreground',
  success: 'text-success-foreground',
  info: 'text-info-foreground',
};

interface ListBoardViewProps<Row> {
  list: ListDefinition<Row>;
  rows: readonly Row[];
  /** What a card says about a row, with its title made into whatever opens the row. */
  card: (row: Row) => BuiltCard;
  /** The other actions of the row, for the menu of its card. */
  menu: (row: Row) => readonly ListMenuEntry[];
  /** A card is to go to another column, by drag or by menu. */
  onMove: (row: Row, to: string) => void;
  /** Only with a mouse or a pen: a finger moves a card with the menu. */
  dragEnabled?: boolean;
}

/**
 * The rows in columns by state, a board (UI-14): a column for each state a row can be in, a card for each row. A card moves to
 * another column by dragging it there (a mouse or a pen) or with "Sposta in…" in its menu, which a keyboard, a screen reader
 * and a finger use; a move that is not allowed says why. On a phone the columns scroll sideways.
 */
export function ListBoardView<Row>({ list, rows, card, menu, onMove, dragEnabled = true }: ListBoardViewProps<Row>) {
  const { t } = useTranslation();
  const baseId = useId();
  const boardRef = useRef<HTMLDivElement>(null);
  const board = list.board;

  const { dragging, over, onPointerDown } = useBoardDrag({
    enabled: dragEnabled,
    boardRef,
    onDrop: (rowKey, toColumn) => {
      const row = rows.find((candidate) => list.rowKey(candidate) === rowKey);
      if (row) onMove(row, toColumn);
    },
  });

  if (!board) return null;

  return (
    <div
      ref={boardRef}
      role="group"
      aria-label={t('listView.board.label')}
      data-testid="list-board"
      onPointerDown={onPointerDown}
      // `relative`: the hidden texts for screen readers (`sr-only`) are placed absolutely; without a positioned box around them
      // they belong to the page and sit where the board has scrolled to, widening the page.
      className="relative flex snap-x snap-proximity items-start gap-3 overflow-x-auto p-3 sm:p-4"
    >
      {board.columns.map((column) => {
        const items = rows.filter(column.test);
        const Icon = column.icon;
        const headingId = `${baseId}-${column.id}`;
        return (
          <section
            key={column.id}
            data-board-column={column.id}
            aria-labelledby={headingId}
            className={cn(
              'flex w-[84%] shrink-0 snap-start flex-col rounded-lg border bg-muted/40 sm:w-72',
              over === column.id && dragging !== null && 'border-dashed border-primary bg-primary/5',
            )}
          >
            <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
              <h2 id={headingId} className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold">
                {Icon ? <Icon className={cn('size-4 shrink-0', TONE_ICON[column.tone ?? 'neutral'])} aria-hidden="true" /> : null}
                <span className="min-w-0 break-words">{column.label}</span>
              </h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground/70" aria-label={t('listView.board.count', { count: items.length })}>
                {items.length}
              </span>
            </header>
            {items.length === 0 ? (
              <p className="px-4 pb-6 pt-3 text-center text-sm text-foreground/70">{column.empty}</p>
            ) : (
              <ul role="list" className="flex flex-col gap-2 p-2 pt-0">
                {items.map((row) => {
                  const key = list.rowKey(row);
                  const built = card(row);
                  const others = board.columns.filter((other) => other.id !== column.id);
                  const primary = list.primaryAction?.(row);
                  const extra = menu(row);
                  return (
                    <li
                      key={key}
                      data-board-card={key}
                      data-testid={`list-board-card-${key}`}
                      data-dragging={dragging === key ? 'true' : undefined}
                      className={cn('rounded-md border bg-background p-3 shadow-sm', dragEnabled && 'md:cursor-grab', dragging === key && 'opacity-40')}
                    >
                      <ListCardBody content={built.content} title={built.title} />
                      <div className="mt-3 flex items-center justify-between gap-2" data-no-drag="">
                        {primary ? <ListPrimaryAction action={primary} /> : <span />}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" aria-label={t('listView.board.moveMenu', { name: list.rowLabel(row) })} data-testid={`list-board-menu-${key}`}>
                              <MoveRight className="size-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-52">
                            <DropdownMenuLabel className="text-foreground/70">{t('listView.board.moveTo')}</DropdownMenuLabel>
                            {others.map((other) => (
                              <DropdownMenuItem key={other.id} className="pointer-coarse:min-h-11" onSelect={() => onMove(row, other.id)} data-testid={`list-board-move-${other.id}`}>
                                {t('listView.board.moveToColumn', { column: other.label })}
                              </DropdownMenuItem>
                            ))}
                            {extra.some((entry) => entry !== 'separator') ? (
                              <>
                                <DropdownMenuSeparator />
                                <ListMenuEntries entries={extra} />
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
