import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const HEAD = 'px-3 py-2 font-medium';
const CELL = 'px-3 py-2 align-top';
const FIGURE = `${CELL} text-right tabular-nums`;

/** The width a column of a table of the summary needs before the table scrolls sideways instead of squeezing it (a phone shows two or three of them). */
const COLUMN_WIDTH_REM = 7;

export interface TableColumn<Row> {
  id: string;
  header: string;
  /** A column of figures: right aligned, with digits of one width. */
  numeric?: boolean;
  /** The cell names its row: it is the `<th scope="row">` of it, which a screen reader reads before each figure of the row. */
  rowHeader?: boolean;
  cell: (row: Row) => ReactNode;
}

interface SummaryTableProps<Row> {
  /** What the table is, for a screen reader (the caption) and for the keyboard (the name of the scrolling region). */
  caption: string;
  testId: string;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row, index: number) => string;
}

/**
 * A compact table of the summary of the agency: one row for each row the server sent, in the order it sent them, and nothing more (no total row, no sum of the rows: the figures are the
 * server's, and rows in different currencies are never added together). It scrolls sideways on a phone in a region of its own, so the keyboard can reach it.
 */
export function SummaryTable<Row>({ caption, testId, columns, rows, rowKey }: SummaryTableProps<Row>) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={`${testId}-scroll`}
    >
      <table className="w-full border-collapse text-sm" style={{ minWidth: `${columns.length * COLUMN_WIDTH_REM}rem` }} data-testid={testId}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th key={column.id} scope="col" className={cn(HEAD, column.numeric ? 'text-right' : 'text-left')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} className="border-b border-border" data-testid={`${testId}-row`}>
              {columns.map((column) =>
                column.rowHeader ? (
                  <th key={column.id} scope="row" className={cn(CELL, 'text-left font-medium')}>
                    {column.cell(row)}
                  </th>
                ) : (
                  <td key={column.id} className={column.numeric ? FIGURE : cn(CELL, 'text-left')}>
                    {column.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TableBlockProps {
  title: string;
  /** A line under the title that says what the table is or what its figures lack. */
  note?: string;
  /** The table takes both columns of the section on a wide screen (it has too many columns for one). */
  wide?: boolean;
  testId: string;
  children: ReactNode;
}

/** A table of the summary with its name above it: a heading of the level under the section, no box around it (a card in a card is what the calm screens took away). */
export function TableBlock({ title, note, wide = false, testId, children }: TableBlockProps) {
  const titleId = useId();
  return (
    <div className={cn('min-w-0 space-y-2', wide && '2xl:col-span-2')} role="group" aria-labelledby={titleId} data-testid={testId}>
      <h3 id={titleId} className="break-words text-sm font-semibold">
        {title}
      </h3>
      {note ? (
        <p className="break-words text-sm text-foreground/70" data-testid={`${testId}-note`}>
          {note}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** What a figure is when the server has none for it (a cost nobody reported, a payment nobody records for a caller who reaches only some properties): never zero. */
export function NotAvailable({ label }: { label: string }) {
  return <span className="text-foreground/70">{label}</span>;
}
